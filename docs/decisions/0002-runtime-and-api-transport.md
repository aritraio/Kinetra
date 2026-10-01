# ADR 0002: Runtime and API Transport Architecture

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Kinetra Core Team
- **Task ID:** P0-05, P1-04

## Context

Kinetra requires:
1. Typed client-server communication with runtime input validation.
2. Long-running or real-time streaming capability for AI coaching responses and generation progress.
3. Compatibility with database drivers (Postgres), modern AI SDKs (`@google/genai`), and cryptographic utilities without edge runtime limitations.

We evaluated Edge vs. Node.js serverless runtimes, as well as REST vs. tRPC vs. GraphQL.

## Decision

1. **Hosting & Runtime:**
   - Deploy `apps/api` to a **Node.js serverless runtime** (Node 20+ LTS).
   - Reject premature Edge runtime migration to prevent runtime incompatibilities with Node libraries and connection pooling.
2. **API Transport:**
   - Use **Hono** as the API framework on Node.
   - Use **tRPC** (mounted within Hono) for all request/response procedures (Profile, Daily Logs, Plan Management, Privacy Operations).
   - Use dedicated **Server-Sent Events (SSE)** endpoints in Hono (`/api/stream/coach`, `/api/stream/plan-status`) for real-time token streaming and status notifications.
3. **Web Architecture:**
   - Deploy `apps/web` as a client-side Single Page Application (SPA) built with **Vite + React + TanStack Router + TanStack Query**.

## Consequences

### Positive
- Strict end-to-end type safety: types flow directly from `@kinetra/contracts` through tRPC to the client query layer.
- Streaming robustness: SSE handles browser reconnection, chunked event framing, and cancellation cleanly without the overhead of WebSockets.
- Ecosystem compatibility: Node serverless supports full Postgres connection management, encryption routines, and SDKs.

### Negative / Tradeoffs
- Cold starts: Node serverless functions may experience slightly higher cold start latency compared to edge workers (mitigated by lightweight Hono bundle).
- Two transport mechanisms: Developers must use tRPC for standard mutations/queries and SSE for streaming token channels.
