# Kinetra Privacy and Data Lifecycle Policy

Policy version: **2026-10-09** (Kinetra v1.0.0-rc1).  
Status: **Production-Hardened Policy — Full v1 Implemented**.

This document outlines the privacy commitments, data lifecycle management, retention limits, and verifiable technical controls enforced by the Kinetra platform across all client and backend operations.

---

## 1. Core Architectural Privacy Commitments

1. **Zero Biometric Data Transmission**:
   - Posture analysis and repetition tracking in the Posture Lab execute **100% locally** on the user's device using TensorFlow.js / MediaPipe Pose in WebAssembly and WebGL.
   - Raw camera video streams and pixel data are processed in memory within the client browser. No camera frames, video recordings, or facial data are ever saved to disk or transmitted to any server.

2. **On-Device Voice Transcription**:
   - Voice quick logging utilizes the browser's native Web Speech API (`SpeechRecognition`).
   - Transcription occurs directly on the client, and extraction into structured exercise or meal schemas is performed client-side using deterministic regex and domain parsing.
   - Voice data is never committed to daily logs without explicit user review and editable confirmation.

3. **Client-Bounded Streaming Coach Context**:
   - The AI Streaming Coach maintains conversation context strictly bounded to the 10 most recent user-assistant interactions and capped at 4,000 characters.
   - All streamed tokens are sanitized against cross-site scripting (HTML escaping).
   - Conversation context is held client-side and ephemeral; active server operation records expire within 24 hours.

4. **Revocable & Sanitized Plan Sharing**:
   - Shared workout plans contain **only** sanitized exercise names, sets, reps, and target loads.
   - All personal identifiers, user profiles, body weights, progress photos, daily logs, and private notes are strictly stripped at the domain boundary prior to token creation.
   - Share grants are time-limited (maximum 30 days) and can be revoked immediately by the owner at any time.

5. **Optional Progress Photos with 30-Day Auto-Expiry**:
   - Progress photo capture and storage require separate, explicit consent (`photo_storage`).
   - All uploaded photos are stored in private, authenticated storage buckets with an immutable 30-day TTL (Time To Live). Photos older than 30 days are automatically purged by database lifecycle workers.

---

## 2. Retention Periods & Automated Enforcement

| Data Class | Retention Limit | Automated Enforcement Mechanism |
| :--- | :--- | :--- |
| **User Profile & Account** | Until deleted by user | Cascade deletion via Supabase Auth + `clearAccountData` in IndexedDB |
| **Workout Logs & History** | Until deleted by user | Cascade deletion on account removal; soft deletion tombstones supported |
| **Progress Photos** | **30 days maximum** | Hourly `cleanup_expired_photos` DB job + client-side filter (`photos-lifecycle.test.ts`) |
| **Plan Share Grants** | **30 days maximum** | Expiring cryptographically random bearer token; immediate owner revocation |
| **AI Operation Leases** | **24 hours maximum** | `cleanup_ai_leases` database cron job; active lease expires in 30 seconds |
| **Operational Telemetry** | **30 days aggregate** | Anonymized rolling metrics; zero PII or user health details stored in traces |
| **Offline IndexedDB Outbox** | Synced or 30 days | Replayed on reconnect; completely wiped upon sign-out or account deletion |

---

## 3. Explicit Consent Boundaries

Consent records are append-only and cryptographically bound to the authenticated user ID, purpose, timestamp, and policy version (`2026-10-09`):

- **`camera_local`**: Grants permission to open the user's camera feed strictly for on-device posture feedback. Capture terminates automatically upon leaving the Posture Lab view.
- **`photo_storage`**: Grants optional permission to store private physique progress photos in secure storage subject to the 30-day auto-deletion policy.
- **`provider_processing`**: Discloses the use of upstream AI provider endpoints (Google Gemini / Groq Llama) for structured workout generation, with strict schema verification and zero secondary data training.

A grant for one purpose never implies consent for another. Any consent grant can be withdrawn by the user at any time from the Settings / Privacy interface.

---

## 4. User Rights: Self-Service Export & Account Deletion

In full compliance with GDPR (Articles 15, 17, 20) and CCPA regulations, Kinetra provides automated self-service controls:

### Comprehensive Data Export
- Users can export a complete, machine-readable JSON archive of all personal data, including profile records, historical daily logs, training sessions, generated plans, and active consent audit trails.
- The export payload contains zero secrets, tokens, or system infrastructure configuration.

### Immediate, Atomic Account Deletion
When a user initiates account deletion:
1. Active session tokens are immediately invalidated across all devices.
2. The database executes an atomic deletion transaction cascading across profiles, logs, sessions, share grants, consent logs, and storage buckets.
3. The local client wipes all IndexedDB offline storage, cache registries, pending outbox mutations, and memory states.
4. Any in-flight background sync jobs are aborted immediately.

---

## 5. Security & Fallback Integrity

- **Circuit Breaker & Fallback Safety**: If primary AI providers fail or exhibit high latency, Kinetra fails over to secondary providers or deterministic local templates. Domain verifiers enforce identical safety bounds regardless of whether output originated from Gemini, Llama, or static templates.
- **Zero Secrets in Client Code**: All private service keys (`SUPABASE_SERVICE_ROLE_KEY`, AI provider API keys) remain exclusively on server-side runtime environments. Web builds are continuously scanned by `scripts/scan-web.ts` to ensure 0 exposed server secrets.
