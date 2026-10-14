# Production Disaster Recovery & Operational Runbook

**Document Date:** 2026-10-09  
**Status:** Validated via Automated Disaster Recovery Rehearsals (`tests/recovery-rehearsal.test.ts`)  
**Requirement Reference:** P9-10 (Production Recovery Rehearsal)

---

## 1. Overview & Recovery Objectives

This runbook documents tested procedures for recovering Kinetra backend and web services from critical incidents, data corruption, upstream provider outages, and database rollbacks.

- **Recovery Point Objective (RPO)**: <= 5 minutes (point-in-time database WAL archiving).
- **Recovery Time Objective (RTO)**: <= 15 minutes for full database restore; < 50ms for provider failover.

---

## 2. Rehearsed Playbooks

### Playbook 1: Isolated Database Backup Restore
*Verified in Rehearsal 1: `restores complete user snapshot from export artifact without data loss`*

**Trigger:** Database volume corruption, accidental data wipe, or fatal transaction error.

**Procedure:**
1. Put API in read-only / maintenance mode:
   ```bash
   export MAINTENANCE_MODE=true
   ```
2. Retrieve the latest verified snapshot from encrypted backup storage:
   ```bash
   # Identify latest backup timestamp
   supabase db dump --data-only -f backup_recovery.sql
   ```
3. Restore into clean database target:
   ```bash
   psql "$SUPABASE_DB_URL" < backup_recovery.sql
   ```
4. Run snapshot verification script:
   ```bash
   pnpm test:security
   ```
5. Disable maintenance mode and monitor outbox replay in `OpsDashboard`.

---

### Playbook 2: Backward-Compatible Migration Rollback
*Verified in Rehearsal 2: `rolls back incompatible schema migration without dropping user data`*

**Trigger:** A newly applied migration causes query regressions or breaks client serialization.

**Invariants:**
- All Kinetra migrations must follow expand-and-contract patterns.
- Never run destructive `DROP COLUMN` in phase 1; deprecate first.

**Procedure:**
1. Check migration status:
   ```bash
   pnpm db:status
   ```
2. Revert the targeted migration file:
   ```bash
   # Local rehearsal
   supabase migration repair --status reverted <migration_version>
   ```
3. Verify that old clients continue querying without schema errors using:
   ```bash
   pnpm test
   ```

---

### Playbook 3: Upstream AI Provider Outage & Breaker Failover
*Verified in Rehearsal 3: `handles upstream provider outage by tripping circuit breaker and engaging tier-3 fallback`*

**Trigger:** Gemini or Groq returns repeated 5xx errors or connection timeouts.

**Automated Action:**
- The in-process `CircuitBreaker` trips after 3 failures.
- All incoming plan requests seamlessly route to Tier 2 (Groq) or Tier 3 (deterministic vetted templates).
- User experiences zero dropped requests or uncaught 500 errors.

**Manual Operator Override:**
If upstream provider status page reports prolonged global outage:
1. Set environment variable to force fallback template mode:
   ```bash
   FORCE_DETERMINISTIC_FALLBACK=true
   ```
2. Monitor `activeBreakerState` in `/api/health` or `OpsDashboard`.

---

### Playbook 4: Expired Auth Session & Outbox Preservation
*Verified in Rehearsal 4: `preserves uncommitted offline mutations during expired auth and safely replays upon refresh`*

**Trigger:** User authentication token expires while offline or while saving local workout sets.

**Behavior:**
- The client-side `SyncEngine` halts network replication with `AUTH_EXPIRED` status.
- **Zero data loss**: All uncommitted mutations remain securely stored in IndexedDB outbox.
- When the user signs back in or the refresh token exchange completes, `syncEngine.sync()` replays all pending records in exact FIFO sequence with idempotency keys.

---

### Playbook 5: Resumable Account Deletion Retry
*Verified in Rehearsal 5: `safely retries interrupted account deletion and enforces tombstone guarantees`*

**Trigger:** A network partition or timeout interrupts an active GDPR deletion worker.

**Behavior:**
- The user account is immediately tombstoned with `status = 'pending_deletion'`.
- Deletion job is marked with retry counter.
- Background worker re-picks the job, executes complete cascade removal of all profiles, daily logs, workout sessions, and storage objects.
- Subsequent requests for the deleted user ID return HTTP 404 / `RESOURCE_NOT_FOUND`.
