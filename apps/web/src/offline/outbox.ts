import type {
  LogRecord,
  OutboxMutation,
  OutboxMutationState,
  ProfileRecord,
} from '@kinetra/contracts';
import type { Table } from 'dexie';
import type { KinetraDatabase } from './db';

export interface NewMutationInput<T = unknown> {
  ownerId: string;
  entity: 'profile' | 'log' | 'session' | 'plan';
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: T;
  baseRevision: number;
}

/**
 * Enqueue a mutation and apply local optimistic state change in a single atomic IndexedDB transaction.
 */
export async function enqueueAtomicMutation<T, TRecord>(
  db: KinetraDatabase,
  targetTable: Table<TRecord, string>,
  input: NewMutationInput<T>,
  localRecord?: TRecord,
): Promise<OutboxMutation<T>> {
  const mutationId = crypto.randomUUID();
  const mutation: OutboxMutation<T> = {
    id: mutationId,
    ownerId: input.ownerId,
    entity: input.entity,
    entityId: input.entityId,
    operation: input.operation,
    payload: input.payload,
    baseRevision: input.baseRevision,
    createdAt: new Date().toISOString(),
    attempts: 0,
    state: 'queued',
  };

  // Atomic transaction across the target entity table and outbox
  await db.transaction('rw', [targetTable, db.outbox], async () => {
    if (input.operation === 'delete') {
      await targetTable.delete(input.entityId);
    } else if (localRecord) {
      await targetTable.put(localRecord);
    }
    await db.outbox.put(mutation as OutboxMutation);
  });

  return mutation;
}

export async function getPendingMutations(
  db: KinetraDatabase,
  ownerId: string,
): Promise<OutboxMutation[]> {
  const all = await db.outbox.where('ownerId').equals(ownerId).toArray();
  // Filter for queued or failed items, ordered by createdAt
  return (
    all
      .filter((m) => m.state === 'queued' || m.state === 'failed')
      // Sort causally by creation time
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );
}

export async function getConflicts(
  db: KinetraDatabase,
  ownerId: string,
): Promise<OutboxMutation[]> {
  const all = await db.outbox.where('ownerId').equals(ownerId).toArray();
  return all.filter((m) => m.state === 'conflict');
}

export async function updateMutationState(
  db: KinetraDatabase,
  id: string,
  state: OutboxMutationState,
  error?: string,
  conflictRecord?: unknown,
): Promise<void> {
  const existing = await db.outbox.get(id);
  if (!existing) return;

  await db.outbox.update(id, {
    state,
    error,
    conflictRecord,
    attempts: state === 'failed' ? existing.attempts + 1 : existing.attempts,
  });
}

export async function removeMutation(db: KinetraDatabase, id: string): Promise<void> {
  await db.outbox.delete(id);
}

export async function resolveOutboxConflict(
  db: KinetraDatabase,
  mutationId: string,
  resolution: 'keep_local' | 'keep_remote',
  currentRemoteRevision: number,
  currentRemoteRecord?: unknown,
): Promise<void> {
  const mutation = await db.outbox.get(mutationId);
  if (!mutation) return;

  if (resolution === 'keep_local') {
    // Overwrite remote by updating base revision to match remote's current revision and re-queuing
    await db.outbox.update(mutationId, {
      baseRevision: currentRemoteRevision,
      state: 'queued',
      error: undefined,
      conflictRecord: undefined,
    });
  } else {
    // Discard local edit, delete mutation from outbox, and apply remote record to local cache
    await db.transaction('rw', [db.outbox, db.daily_logs, db.profiles], async () => {
      await db.outbox.delete(mutationId);
      if (currentRemoteRecord) {
        if (mutation.entity === 'log') {
          await db.daily_logs.put(currentRemoteRecord as LogRecord);
        } else if (mutation.entity === 'profile') {
          await db.profiles.put(currentRemoteRecord as ProfileRecord);
        }
      }
    });
  }
}
