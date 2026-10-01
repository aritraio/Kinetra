import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  unique,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';
// SQL migrations own grants/RLS/functions. This package describes row shapes for typed queries.
export const profiles = pgTable('profiles', {
  owner_id: uuid('owner_id').primaryKey(),
  display_name: text('display_name').notNull(),
  height_cm: numeric('height_cm').notNull(),
  weight_kg: numeric('weight_kg').notNull(),
  goal: text('goal').notNull(),
  timezone: text('timezone').notNull(),
  units: text('units').notNull(),
  revision: integer('revision').notNull().default(1),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const dailyLogs = pgTable(
  'daily_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    owner_id: uuid('owner_id').notNull(),
    local_date: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    weight_kg: numeric('weight_kg').notNull(),
    revision: integer('revision').notNull().default(1),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.owner_id, table.local_date)],
);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull(),
  kind: text('kind').notNull(),
  created_at: createdAt(),
});
export const planVersions = pgTable(
  'plan_versions',
  {
    plan_id: uuid('plan_id').notNull(),
    owner_id: uuid('owner_id').notNull(),
    version: integer('version').notNull(),
    payload: jsonb('payload').notNull(),
    schema_version: text('schema_version').notNull(),
    policy_version: text('policy_version').notNull(),
    prompt_version: text('prompt_version').notNull(),
    provenance: text('provenance').notNull(),
    created_at: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.plan_id, table.version] })],
);
export const trainingSessions = pgTable('training_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull(),
  plan_id: uuid('plan_id'),
  plan_version: integer('plan_version'),
  started_at: timestamp('started_at', { withTimezone: true }).notNull(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  created_at: createdAt(),
});
export const aiOperations = pgTable(
  'ai_operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    owner_id: uuid('owner_id').notNull(),
    idempotency_key: uuid('idempotency_key').notNull(),
    input_digest: text('input_digest').notNull(),
    state: text('state').notNull(),
    created_at: createdAt(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [unique().on(table.owner_id, table.idempotency_key)],
);
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull(),
  purpose: text('purpose').notNull(),
  action: text('action').notNull(),
  policy_version: text('policy_version').notNull(),
  created_at: createdAt(),
});
export const photoMetadata = pgTable('photo_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull(),
  object_path: text('object_path').notNull().unique(),
  consent_id: uuid('consent_id').notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: createdAt(),
});
export const deletionJobs = pgTable('deletion_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull(),
  state: text('state').notNull(),
  requested_at: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const usageBuckets = pgTable(
  'usage_buckets',
  {
    owner_id: uuid('owner_id').notNull(),
    bucket: timestamp('bucket', { withTimezone: true }).notNull(),
    requests: integer('requests').notNull().default(0),
    reserved_tokens: integer('reserved_tokens').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.owner_id, table.bucket] })],
);
export const globalUsageBuckets = pgTable('global_usage_buckets', {
  bucket: timestamp('bucket', { withTimezone: true }).primaryKey(),
  requests: integer('requests').notNull().default(0),
  reserved_tokens: integer('reserved_tokens').notNull().default(0),
});
export const aiBudgetLeases = pgTable('ai_budget_leases', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: createdAt(),
});
