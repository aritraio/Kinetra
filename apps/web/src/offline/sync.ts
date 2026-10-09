import type {
  LogRecord,
  LogUpdate,
  OutboxMutation,
  Profile,
  ProfileRecord,
  SyncStatus,
} from '@kinetra/contracts';
import type { KinetraDatabase } from './db';
import {
  getConflicts,
  getPendingMutations,
  removeMutation,
  resolveOutboxConflict,
  updateMutationState,
} from './outbox';

export interface RemoteSyncClient {
  saveProfile(expectedRevision: number, profile: Profile): Promise<ProfileRecord>;
  getProfile(): Promise<ProfileRecord | null>;
  saveLog(expectedRevision: number, log: LogUpdate): Promise<LogRecord>;
  getLogs(): Promise<LogRecord[]>;
}

export type SyncStatusListener = (status: SyncStatus) => void;

export class SyncEngine {
  private db: KinetraDatabase;
  private ownerId: string;
  private remote: RemoteSyncClient;
  private isOnline: boolean;
  private isSyncing = false;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private listeners = new Set<SyncStatusListener>();
  private cleanupListeners: Array<() => void> = [];

  constructor(db: KinetraDatabase, ownerId: string, remote: RemoteSyncClient) {
    this.db = db;
    this.ownerId = ownerId;
    this.remote = remote;
    this.isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;

    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      this.isOnline = true;
      this.notify();
      void this.sync();
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.notify();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        void this.sync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    this.cleanupListeners.push(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    });
  }

  public destroy(): void {
    for (const cleanup of this.cleanupListeners) {
      cleanup();
    }
    this.cleanupListeners = [];
    this.listeners.clear();
  }

  public async setOnline(online: boolean): Promise<void> {
    this.isOnline = online;
    this.notify();
    if (online) {
      await this.sync();
    }
  }

  public async getStatus(): Promise<SyncStatus> {
    const pending = await getPendingMutations(this.db, this.ownerId);
    const conflicts = await getConflicts(this.db, this.ownerId);

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      conflictCount: conflicts.length,
      lastSyncedAt: this.lastSyncedAt,
      error: this.lastError,
    };
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    void this.getStatus().then((status) => listener(status));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    void this.getStatus().then((status) => {
      for (const listener of this.listeners) {
        listener(status);
      }
    });
  }

  /**
   * Main synchronization execution.
   * Processes mutations in order per entity, deduplicating, catching conflicts and transient errors.
   */
  public async sync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      const pending = await getPendingMutations(this.db, this.ownerId);
      if (pending.length === 0) {
        this.isSyncing = false;
        this.notify();
        return;
      }

      // Group mutations by entity to maintain causal ordering per entity
      const entityGroups = new Map<string, OutboxMutation[]>();
      for (const mutation of pending) {
        const key = `${mutation.entity}:${mutation.entityId}`;
        const group = entityGroups.get(key) ?? [];
        group.push(mutation);
        entityGroups.set(key, group);
      }

      // Process each entity sequence in order
      for (const [_key, mutations] of entityGroups.entries()) {
        if (!this.isOnline) break;
        for (const mutation of mutations) {
          if (!this.isOnline) break; // Disconnected mid-sync: preserve pending items

          await updateMutationState(this.db, mutation.id, 'syncing');

          try {
            if (mutation.entity === 'profile') {
              const res = await this.remote.saveProfile(
                mutation.baseRevision,
                mutation.payload as Profile,
              );
              // Update local cache with server confirmed version
              await this.db.profiles.put(res);
              await removeMutation(this.db, mutation.id);
            } else if (mutation.entity === 'log') {
              const res = await this.remote.saveLog(
                mutation.baseRevision,
                mutation.payload as LogUpdate,
              );
              // Update local cache with server confirmed version
              await this.db.daily_logs.put(res);
              await removeMutation(this.db, mutation.id);
            }

            this.lastSyncedAt = new Date().toISOString();
          } catch (error: unknown) {
            const errorRecord =
              typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
            const errorMessage =
              error instanceof Error ? error.message : String(errorRecord.message ?? error);
            const errorCode = String(errorRecord.code ?? '');
            const isConflict =
              errorMessage.includes('conflict') ||
              errorMessage.includes('CONFLICT') ||
              errorMessage.includes('Changed elsewhere') ||
              errorCode === 'CONFLICT';
            const isAuth =
              errorMessage.includes('UNAUTHENTICATED') ||
              errorMessage.includes('UNAUTHORIZED') ||
              errorMessage.includes('Sign in') ||
              errorCode === 'UNAUTHORIZED';

            if (isConflict) {
              // P6-04: Cross-device conflict detected
              let currentRemoteRecord: unknown = null;
              try {
                if (mutation.entity === 'profile') {
                  currentRemoteRecord = await this.remote.getProfile();
                } else if (mutation.entity === 'log') {
                  const logs = await this.remote.getLogs();
                  currentRemoteRecord =
                    logs.find((l) => l.local_date === mutation.entityId) ?? null;
                }
              } catch {
                // If fetching remote fails, record still preserved
              }

              await updateMutationState(
                this.db,
                mutation.id,
                'conflict',
                'Revision conflict with remote server edit',
                currentRemoteRecord,
              );
              // Break processing for this specific entity so subsequent dependent edits don't apply out of order
              break;
            } else if (isAuth) {
              // Pause sync until sign in; do not waste attempts
              this.lastError = 'Authentication expired. Sign in to resume sync.';
              await updateMutationState(this.db, mutation.id, 'failed', this.lastError);
              this.isSyncing = false;
              this.notify();
              return;
            } else {
              // Transient or network failure
              this.lastError = errorMessage;
              await updateMutationState(this.db, mutation.id, 'failed', errorMessage);
              // If we disconnected, stop sync
              if (
                errorMessage.includes('Failed to fetch') ||
                errorMessage.includes('Network') ||
                !this.isOnline
              ) {
                this.isOnline = false;
                break;
              }
            }
          }
        }
      }
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  public async resolveConflict(
    mutationId: string,
    resolution: 'keep_local' | 'keep_remote',
    remoteRevision: number,
    remoteRecord?: unknown,
  ): Promise<void> {
    await resolveOutboxConflict(this.db, mutationId, resolution, remoteRevision, remoteRecord);
    this.notify();
    if (resolution === 'keep_local' && this.isOnline) {
      await this.sync();
    }
  }
}
