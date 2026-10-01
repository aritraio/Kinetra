import { pgTable, text } from 'drizzle-orm/pg-core';

// Public synthetic fixture only. Tenant tables and RLS arrive in Phase 2.
export const foundationFixtures = pgTable('foundation_fixtures', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
});

export * from './tenant';
