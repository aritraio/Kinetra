import assert from 'node:assert/strict';

export interface EnvSeparationConfig {
  nodeEnv: 'development' | 'production' | 'test';
  kinetraEnv: 'local' | 'preview' | 'production';
  geminiApiKey?: string;
  supabaseServiceRoleKey?: string;
  supabaseJwtSecret?: string;
  allowedRedirectOrigins: string[];
  cspHeader: string;
  photoBucketPrivate: boolean;
  photoPresignedTtlSeconds: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export function validateEnvironmentSeparation(config: EnvSeparationConfig): ValidationResult {
  const violations: string[] = [];

  // 1. Production Secrets & Keys Isolation
  if (config.nodeEnv === 'production' || config.kinetraEnv === 'production') {
    if (
      !config.geminiApiKey ||
      config.geminiApiKey.includes('synthetic') ||
      config.geminiApiKey.length < 20
    ) {
      violations.push('Production environment must have a valid non-synthetic GEMINI_API_KEY');
    }
    if (
      !config.supabaseServiceRoleKey ||
      config.supabaseServiceRoleKey.includes('dev-') ||
      config.supabaseServiceRoleKey.length < 30
    ) {
      violations.push(
        'Production environment must have a valid non-placeholder SUPABASE_SERVICE_ROLE_KEY',
      );
    }
    if (
      !config.supabaseJwtSecret ||
      config.supabaseJwtSecret === 'super-secret-jwt-token-with-at-least-32-bytes-long' ||
      config.supabaseJwtSecret.length < 32
    ) {
      violations.push('Production environment must not use default local SUPABASE_JWT_SECRET');
    }
  }

  // 2. Auth Redirect Whitelist
  for (const origin of config.allowedRedirectOrigins) {
    if (origin === '*' || origin.includes('javascript:') || origin.includes('data:')) {
      violations.push(`Wildcard or unsafe redirect origin forbidden: ${origin}`);
    }
    if (
      config.nodeEnv === 'production' &&
      (origin.includes('localhost') || origin.includes('127.0.0.1'))
    ) {
      violations.push(
        `Production environment must not include localhost in redirect origins: ${origin}`,
      );
    }
  }

  // 3. Private Storage Isolation Policy
  if (!config.photoBucketPrivate) {
    violations.push('Progress photos storage bucket MUST be private (no public read access)');
  }
  if (config.photoPresignedTtlSeconds > 300) {
    violations.push(
      `Photo presigned URL TTL exceeds 300s limit: got ${config.photoPresignedTtlSeconds}s`,
    );
  }

  // 4. Content Security Policy (CSP)
  const csp = config.cspHeader;
  if (!csp.includes("object-src 'none'")) {
    violations.push("CSP missing object-src 'none'");
  }
  if (!csp.includes("frame-ancestors 'none'")) {
    violations.push("CSP missing frame-ancestors 'none'");
  }
  if (csp.includes("script-src 'self' 'unsafe-inline'") || csp.includes('script-src *')) {
    violations.push('CSP contains unsafe script-src directive');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function validateSeedDataGuard(
  targetEnv: string,
  seedRecordIds: string[],
): { safe: boolean; reason?: string } {
  if (targetEnv === 'production') {
    return {
      safe: false,
      reason:
        'Synthetic demo seed scripts are strictly prohibited from executing against production environments.',
    };
  }

  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const id of seedRecordIds) {
    if (uuidV4Regex.test(id)) {
      return {
        safe: false,
        reason: `Seed record ID '${id}' resembles a real UUID v4; synthetic seeds must use explicit prefixes (e.g., 'synthetic-maya-001') to avoid ID collision.`,
      };
    }
  }

  return { safe: true };
}

// Self-executing CLI probe
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- Running Environment Separation Validation ---');

  // Test production configuration checks
  const prodConfig: EnvSeparationConfig = {
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

  const prodResult = validateEnvironmentSeparation(prodConfig);
  assert.equal(
    prodResult.valid,
    true,
    `Production validation failed: ${prodResult.violations.join(', ')}`,
  );

  // Verify seed guard rejects production target
  const seedGuardProd = validateSeedDataGuard('production', ['synthetic-maya-001']);
  assert.equal(seedGuardProd.safe, false, 'Seed guard must reject production execution');

  // Verify seed guard accepts synthetic IDs in non-production
  const seedGuardDev = validateSeedDataGuard('development', [
    'synthetic-maya-001',
    'synthetic-marcus-002',
  ]);
  assert.equal(seedGuardDev.safe, true, 'Seed guard must accept synthetic IDs in dev');

  console.log(' Environment separation, secret isolation, CSP, and seed data guards verified.');
}
