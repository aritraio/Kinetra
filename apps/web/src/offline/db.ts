import type {
  LogRecord,
  OutboxMutation,
  PlanKind,
  PlanVersionRecord,
  PlanWithVersion,
  ProfileRecord,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import Dexie, { type EntityTable } from 'dexie';

export interface SyncMetadataRecord {
  key: string;
  value: string;
}

export interface CachedPlan {
  kind: PlanKind;
  data: PlanWithVersion;
  updated_at: string;
}

export class KinetraDatabase extends Dexie {
  profiles!: EntityTable<ProfileRecord, 'owner_id'>;
  daily_logs!: EntityTable<LogRecord, 'local_date'>;
  plans!: EntityTable<CachedPlan, 'kind'>;
  plan_versions!: EntityTable<PlanVersionRecord, 'plan_id'>;
  sessions!: EntityTable<TrainingSessionRecord, 'id'>;
  outbox!: EntityTable<OutboxMutation, 'id'>;
  sync_meta!: EntityTable<SyncMetadataRecord, 'key'>;

  constructor(ownerId: string, dbNamePrefix = 'kinetra_user_') {
    super(`${dbNamePrefix}${ownerId}`);

    // Version 1 of account-scoped schema
    this.version(1).stores({
      profiles: 'owner_id, revision, updated_at',
      daily_logs: 'local_date, revision, updated_at',
      plans: 'kind, updated_at',
      plan_versions: 'plan_id, version, [plan_id+version]',
      sessions: 'id, started_at',
      outbox: 'id, ownerId, entity, entityId, state, createdAt',
      sync_meta: 'key',
    });
  }

  /**
   * Applies schema migration cleanly.
   * Can be used to test migration from v1 to v2.
   */
  upgradeToVersion2(): void {
    if (this.isOpen()) {
      this.close();
    }
    this.version(2)
      .stores({
        profiles: 'owner_id, revision, updated_at',
        daily_logs: 'local_date, revision, updated_at, timezone',
        plans: 'kind, updated_at',
        plan_versions: 'plan_id, version, [plan_id+version]',
        sessions: 'id, started_at',
        outbox: 'id, ownerId, entity, entityId, state, createdAt',
        sync_meta: 'key',
      })
      .upgrade(() => {
        // Migration logic for schema v2
      });
  }
}

const activeDatabases = new Map<string, KinetraDatabase>();

export function getAccountDatabase(ownerId: string): KinetraDatabase {
  let db = activeDatabases.get(ownerId);
  if (!db) {
    db = new KinetraDatabase(ownerId);
    activeDatabases.set(ownerId, db);
  }
  return db;
}

export async function clearAccountData(ownerId: string): Promise<void> {
  const db = activeDatabases.get(ownerId) ?? new KinetraDatabase(ownerId);
  activeDatabases.delete(ownerId);
  if (db.isOpen()) {
    db.close();
  }
  await Dexie.delete(`kinetra_user_${ownerId}`);
}
