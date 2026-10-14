# Production & Staging Deployment Runbook

**Document Date:** 2026-10-09  
**Status:** Approved for v1.0.0-rc1  
**Requirement Reference:** P9-11 (Deployment Runbook)

---

## 1. Deployment Invariants & Pre-Flight Checks

Before deploying any commit to staging or production, the following checks must pass with zero errors:

```bash
# 1. Monorepo Verification (lint, format, boundary checks, typecheck, tests, build)
pnpm check

# 2. AI & Progression Evaluation Benchmarks (100% acceptance required)
pnpm evals

# 3. Secret Leak Scanner (must report 0 server secret markers in web assets)
node --import tsx scripts/scan-web.ts
```

---

## 2. Environment Configuration

### Required Production Secrets (Server-Only)
Never expose these variables to the frontend or build environment:
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret for Supabase administrative calls.
- `GEMINI_API_KEY`: Google Gemini upstream API key.
- `GROQ_API_KEY`: Groq fallback API key.
- `DATABASE_URL`: Direct pooled PostgreSQL connection string.

### Required Frontend Variables
- `VITE_API_BASE_URL`: HTTPS endpoint of the deployed API (`https://api.kinetra.app/api`).
- `VITE_SUPABASE_URL`: HTTPS endpoint of the hosted Supabase project.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Public anonymous API key.

---

## 3. Zero-Downtime Deployment Sequence

```
1. Run Database Migrations (Additive Only)
   └── supabase db push --db-url "$DATABASE_URL"

2. Deploy Backend API Service (Hono Node Runtime)
   ├── Launch new version container
   ├── Await health check pass: GET /api/health
   └── Shift ingress traffic to new container

3. Deploy Static Web Frontend (Vite SPA)
   ├── Upload dist/ assets to CDN with immutable hash filenames
   └── Atomically swap index.html entry point

4. Post-Deployment Smoke Test
   └── node --import tsx scripts/smoke.ts
```

---

## 4. Health Check Probes & Telemetry Endpoints

- **Liveness Probe**: `GET /api/health/live`  
  Returns `200 OK` `{ "status": "alive" }` if process event loop is responsive.
- **Readiness Probe**: `GET /api/health/ready`  
  Checks database pool connectivity and redis/cache availability.
- **Detailed Telemetry**: `GET /api/health`  
  Exposes circuit breaker status, uptime, and request counters.
- **Client Ops Dashboard**: `/ops` route in web application (protected for operators).

---

## 5. Rollback Triggers & Rapid Revert

### Automated Rollback Triggers
1. Readiness probe fails 3 consecutive attempts post-traffic shift.
2. 5xx error rate exceeds 1.0% over any 3-minute rolling window.
3. p95 response latency exceeds 2,500ms for non-streaming routes.
4. Circuit breaker trips to `OPEN` within 5 minutes of deploy.

### Emergency Rollback Commands
```bash
# Revert web frontend CDN index.html to previous release tag
git checkout tags/v1.0.0-rc0 -- apps/web/dist/index.html
# Roll back backend container deployment
kubectl rollout undo deployment/kinetra-api
```
All database migrations are backward-compatible, ensuring the previous application version runs without errors.
