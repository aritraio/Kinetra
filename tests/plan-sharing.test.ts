import { describe, expect, it } from 'vitest';
import {
  createPlanShareGrant,
  sanitizePlanForSharing,
  validateShareGrant,
} from '../packages/domain/src/sharing/plan-sharing';
import { createDemoRepositories } from '../packages/domain/src/demo-repository';
import type { PlanVersionRecord } from '../packages/contracts/src/index';

describe('Phase 9 — P9-03 Revocable Plan Sharing with Zero-PII Sanitization', () => {
  const dummyOwnerId = 'user-test-uuid-1234';
  const dummyPlanId = 'plan-test-uuid-5678';

  const mockWorkoutVersion: PlanVersionRecord = {
    plan_id: dummyPlanId,
    owner_id: dummyOwnerId,
    version: 2,
    schema_version: '2026-10-01',
    policy_version: '2026-10-01',
    prompt_version: 'v1.0',
    provenance: 'template',
    created_at: new Date().toISOString(),
    payload: {
      kind: 'workout',
      schema_version: '2026-10-01',
      policy_version: '2026-10-01',
      split_name: 'Upper Hypertrophy Split',
      days_per_week: 4,
      days: [
        {
          day_number: 1,
          day_name: 'Day 1 - Upper',
          focus: 'Upper Hypertrophy',
          is_rest_day: false,
          exercises: [
            {
              exercise_id: 'incline_dumbbell_bench',
              name: 'Incline Dumbbell Bench',
              target_sets: 3,
              target_reps: '8-10',
              rest_seconds: 90,
              equipment: 'dumbbells',
            },
          ],
        },
      ],
      notes: 'Focus on 3-second eccentrics.',
    },
  };

  describe('Grant Generation & Policy Boundaries', () => {
    it('creates active grant with unique cryptographic token and ISO timestamps', () => {
      const grant = createPlanShareGrant(dummyOwnerId, dummyPlanId, 2, 7);

      expect(grant.owner_id).toBe(dummyOwnerId);
      expect(grant.plan_id).toBe(dummyPlanId);
      expect(grant.version).toBe(2);
      expect(grant.token).toBeDefined();
      expect(grant.token.length).toBeGreaterThanOrEqual(32);
      expect(grant.revoked_at).toBeNull();

      const validation = validateShareGrant(grant);
      expect(validation.valid).toBe(true);
    });

    it('clamps expiration duration strictly to [1, 30] days ceiling per privacy policy', () => {
      const clampedMax = createPlanShareGrant(dummyOwnerId, dummyPlanId, 1, 90);
      const createdTime = new Date(clampedMax.created_at).getTime();
      const expiresTime = new Date(clampedMax.expires_at).getTime();
      const diffDays = Math.round((expiresTime - createdTime) / (86400 * 1000));
      expect(diffDays).toBe(30);

      const clampedMin = createPlanShareGrant(dummyOwnerId, dummyPlanId, 1, -10);
      const minCreatedTime = new Date(clampedMin.created_at).getTime();
      const minExpiresTime = new Date(clampedMin.expires_at).getTime();
      const minDiffDays = Math.round((minExpiresTime - minCreatedTime) / (86400 * 1000));
      expect(minDiffDays).toBe(1);
    });

    it('detects revoked grants immediately', () => {
      const grant = createPlanShareGrant(dummyOwnerId, dummyPlanId, 2, 7);
      grant.revoked_at = new Date().toISOString();

      const validation = validateShareGrant(grant);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('revoked');
    });

    it('detects expired grants immediately', () => {
      const grant = createPlanShareGrant(dummyOwnerId, dummyPlanId, 2, 7);
      // Simulate timestamp in the past
      grant.expires_at = new Date(Date.now() - 3600000).toISOString();

      const validation = validateShareGrant(grant);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('expired');
    });
  });

  describe('Strict Zero-PII Sanitization Enforcement', () => {
    it('strips all owner IDs, emails, biometrics, weight logs, and personal history', () => {
      const grant = createPlanShareGrant(dummyOwnerId, dummyPlanId, 2, 7);
      const sharedView = sanitizePlanForSharing(grant, mockWorkoutVersion, 'workout');

      // Allowed fields in SharedPlanView
      expect(sharedView.share_id).toBe(grant.id);
      expect(sharedView.kind).toBe('workout');
      expect(sharedView.version).toBe(2);
      expect(sharedView.payload).toEqual(mockWorkoutVersion.payload);
      expect(sharedView.policy_version).toBe('2026-10-01');

      // Forbidden fields MUST NOT be present
      const serialized = JSON.stringify(sharedView);
      expect(serialized).not.toContain(dummyOwnerId);
      expect(serialized).not.toContain('email');
      expect(serialized).not.toContain('weight_kg');
      expect(serialized).not.toContain('height_cm');
      expect(serialized).not.toContain('maya');
      expect(serialized).not.toContain('marcus');
    });
  });

  describe('Repository & Lifecycle Verification', () => {
    it('creates, lists, retrieves, and revokes share grants in demo repository', async () => {
      const repos = createDemoRepositories('maya');
      const workoutPlan = await repos.plans.getPlan('workout');
      expect(workoutPlan).not.toBeNull();

      if (!workoutPlan) return;

      // 1. Create grant
      const grant = await repos.plans.createShareGrant({
        plan_id: workoutPlan.plan.id,
        version: workoutPlan.current_version.version,
        duration_days: 14,
      });

      expect(grant.token).toBeDefined();

      // 2. List grants
      const list = await repos.plans.listShareGrants(workoutPlan.plan.id);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((g) => g.id === grant.id)).toBe(true);

      // 3. Retrieve shared view using public token
      const sharedView = await repos.plans.getSharedPlan(grant.token);
      expect(sharedView.kind).toBe('workout');
      expect(sharedView.version).toBe(workoutPlan.current_version.version);
      expect(sharedView.payload).toBeDefined();

      // 4. Revoke grant
      await repos.plans.revokeShareGrant(grant.id);

      // 5. Subsequent access should be rejected
      await expect(repos.plans.getSharedPlan(grant.token)).rejects.toThrow('Share link is revoked');
    });

    it('rejects access when token is unrecognized or invalid', async () => {
      const repos = createDemoRepositories('marcus');
      await expect(repos.plans.getSharedPlan('invalid-non-existent-token')).rejects.toThrow(
        'Share link not found or invalid token',
      );
    });
  });
});
