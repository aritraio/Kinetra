import type {
  PlanKind,
  PlanShareGrant,
  PlanVersionRecord,
  SharedPlanView,
} from '@kinetra/contracts';

function generateSecureToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates an immutable, expiring share grant for a specific plan version.
 * Maximum expiration duration is 30 days per PRIVACY.md policy.
 */
export function createPlanShareGrant(
  ownerId: string,
  planId: string,
  version: number,
  durationDays = 7,
): PlanShareGrant {
  const boundedDays = Math.max(1, Math.min(30, durationDays));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + boundedDays * 86400 * 1000);
  const token = generateSecureToken(24);

  return {
    id: globalThis.crypto.randomUUID(),
    plan_id: planId,
    owner_id: ownerId,
    version,
    token,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    revoked_at: null,
  };
}

/**
 * Validates whether a share grant remains active, unrevoked, and unexpired.
 */
export function validateShareGrant(
  grant: PlanShareGrant,
  nowIso = new Date().toISOString(),
): { valid: boolean; reason?: 'expired' | 'revoked' } {
  if (grant.revoked_at !== null) {
    return { valid: false, reason: 'revoked' };
  }

  if (nowIso > grant.expires_at) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true };
}

/**
 * Strips all user profile data, PII, biometrics, weight logs, training history,
 * photos, and owner IDs from the shared view.
 * Exposes ONLY the verified workout/meal prescription payload.
 */
export function sanitizePlanForSharing(
  grant: PlanShareGrant,
  versionRecord: PlanVersionRecord,
  kind: PlanKind,
): SharedPlanView {
  return {
    share_id: grant.id,
    kind,
    version: grant.version,
    payload: JSON.parse(JSON.stringify(versionRecord.payload)),
    created_at: grant.created_at,
    expires_at: grant.expires_at,
    policy_version: '2026-10-01',
    schema_version: '2026-10-01',
  };
}
