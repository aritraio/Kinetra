import { describe, expect, it } from 'vitest';
import {
  type EnvSeparationConfig,
  validateEnvironmentSeparation,
  validateSeedDataGuard,
} from '../scripts/validate-env-separation';

describe('Phase 10 — P10-02 Environment Separation & Production Isolation', () => {
  const validProdConfig: EnvSeparationConfig = {
    nodeEnv: 'production',
    kinetraEnv: 'production',
    geminiApiKey: 'AIzaSyA0123456789abcdefghijklmnopqrstuvwxyz',
    supabaseServiceRoleKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_service_role_key_with_proper_length_and_entropy',
    supabaseJwtSecret: 'prod-jwt-secret-with-sufficient-high-entropy-entropy-at-least-32-chars',
    allowedRedirectOrigins: ['https://kinetra.app', 'https://auth.kinetra.app'],
    cspHeader:
      "default-src 'none'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; connect-src 'self'",
    photoBucketPrivate: true,
    photoPresignedTtlSeconds: 120,
  };

  it('approves a fully hardened production configuration', () => {
    const result = validateEnvironmentSeparation(validProdConfig);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects placeholder or synthetic secrets in production mode', () => {
    const invalidConfig: EnvSeparationConfig = {
      ...validProdConfig,
      geminiApiKey: 'synthetic-gemini-key',
      supabaseJwtSecret: 'super-secret-jwt-token-with-at-least-32-bytes-long', // default local dev secret
    };

    const result = validateEnvironmentSeparation(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('GEMINI_API_KEY'))).toBe(true);
    expect(result.violations.some((v) => v.includes('SUPABASE_JWT_SECRET'))).toBe(true);
  });

  it('rejects localhost and wildcard redirect domains in production mode', () => {
    const invalidConfig: EnvSeparationConfig = {
      ...validProdConfig,
      allowedRedirectOrigins: ['https://kinetra.app', 'http://localhost:5173', '*'],
    };

    const result = validateEnvironmentSeparation(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('localhost'))).toBe(true);
    expect(result.violations.some((v) => v.includes('Wildcard'))).toBe(true);
  });

  it('rejects public progress photo storage buckets or long-lived presigned URLs', () => {
    const invalidConfig: EnvSeparationConfig = {
      ...validProdConfig,
      photoBucketPrivate: false,
      photoPresignedTtlSeconds: 3600, // 1 hour is too long for private photos
    };

    const result = validateEnvironmentSeparation(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('storage bucket MUST be private'))).toBe(true);
    expect(result.violations.some((v) => v.includes('TTL exceeds 300s limit'))).toBe(true);
  });

  it('enforces strict CSP omitting unsafe-inline script or frame-ancestors', () => {
    const invalidCspConfig: EnvSeparationConfig = {
      ...validProdConfig,
      cspHeader: "default-src 'self'; script-src 'self' 'unsafe-inline'",
    };

    const result = validateEnvironmentSeparation(invalidCspConfig);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('unsafe script-src'))).toBe(true);
    expect(result.violations.some((v) => v.includes("object-src 'none'"))).toBe(true);
    expect(result.violations.some((v) => v.includes("frame-ancestors 'none'"))).toBe(true);
  });

  describe('Seed Data Isolation & Collision Prevention', () => {
    it('blocks execution of synthetic seeds targeting production databases', () => {
      const res = validateSeedDataGuard('production', ['synthetic-maya-001']);
      expect(res.safe).toBe(false);
      expect(res.reason).toContain('strictly prohibited from executing against production');
    });

    it('rejects synthetic records using standard UUID v4 to prevent collision with real users', () => {
      const collidingUuid = 'c8b6b23d-0d67-4f76-857e-3907c0879fcf';
      const res = validateSeedDataGuard('preview', [collidingUuid]);
      expect(res.safe).toBe(false);
      expect(res.reason).toContain('resembles a real UUID v4');
    });

    it('permits synthetic records with explicit non-UUID prefixes in non-production environments', () => {
      const res = validateSeedDataGuard('preview', ['synthetic-maya-001', 'synthetic-marcus-002']);
      expect(res.safe).toBe(true);
      expect(res.reason).toBeUndefined();
    });
  });
});
