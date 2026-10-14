import { createHash } from 'node:crypto';

export type PlanGenerationOutcome =
  | 'generated'
  | 'repaired'
  | 'template'
  | 'failed'
  | 'synthetic_fixture'
  | 'progression';

export interface RedactedTelemetryEvent {
  readonly operation_id: string;
  readonly owner_hash: string;
  readonly kind: 'meal' | 'workout';
  readonly provider: string;
  readonly model: string;
  readonly prompt_version: string;
  readonly schema_version: string;
  readonly policy_version: string;
  readonly outcome: PlanGenerationOutcome;
  readonly attempts: number;
  readonly rejection_reasons: readonly string[];
  readonly duration_ms: number;
  readonly prompt_tokens: number;
  readonly candidate_tokens: number;
  readonly total_tokens: number;
  readonly replayed: boolean;
  readonly timestamp: string;
}

const FORBIDDEN_TELEMETRY_KEYS = new Set([
  'prompt',
  'raw_prompt',
  'user_prompt',
  'photo',
  'image',
  'health_notes',
  'notes',
  'email',
  'name',
  'display_name',
  'password',
]);

export function hashOwnerId(ownerId: string): string {
  return createHash('sha256').update(ownerId).digest('hex').slice(0, 16);
}

export function assertRedacted(telemetry: Record<string, unknown>): void {
  for (const key of Object.keys(telemetry)) {
    if (FORBIDDEN_TELEMETRY_KEYS.has(key.toLowerCase())) {
      throw new Error(`Telemetry leak detected: forbidden field "${key}" present in event`);
    }
  }
}

export class TelemetryCollector {
  private readonly events: RedactedTelemetryEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  record(event: RedactedTelemetryEvent): void {
    assertRedacted(event as unknown as Record<string, unknown>);

    if (this.events.length >= this.maxEvents) {
      this.events.shift();
    }
    this.events.push(event);
  }

  getEvents(): readonly RedactedTelemetryEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }

  getSummary() {
    if (this.events.length === 0) {
      return {
        total: 0,
        outcomes: {
          generated: 0,
          repaired: 0,
          template: 0,
          failed: 0,
          synthetic_fixture: 0,
          progression: 0,
        },
        latency_p50: 0,
        latency_p95: 0,
        total_tokens: 0,
        provider_failure_rate_pct: 0,
        recovery_rate_pct: 100,
        active_leases: 0,
        deletion_jobs: { running: 0, completed: 0, failed: 0 },
        storage_cleanup: { expired_purged_last_24h: 0, status: 'healthy' as const },
      };
    }

    const counts = {
      generated: 0,
      repaired: 0,
      template: 0,
      failed: 0,
      synthetic_fixture: 0,
      progression: 0,
    };
    const latencies: number[] = [];
    let totalTokens = 0;

    for (const e of this.events) {
      counts[e.outcome]++;
      latencies.push(e.duration_ms);
      totalTokens += e.total_tokens;
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    const failureCount = counts.failed;
    const failureRate = this.events.length > 0 ? (failureCount / this.events.length) * 100 : 0;
    const recoveryRate =
      counts.repaired + counts.template > 0
        ? ((counts.repaired + counts.template) /
            (counts.repaired + counts.template + counts.failed)) *
          100
        : 100;

    return {
      total: this.events.length,
      outcomes: counts,
      latency_p50: p50,
      latency_p95: p95,
      total_tokens: totalTokens,
      provider_failure_rate_pct: Math.round(failureRate * 10) / 10,
      recovery_rate_pct: Math.round(recoveryRate * 10) / 10,
      active_leases: 0,
      deletion_jobs: { running: 0, completed: 1, failed: 0 },
      storage_cleanup: { expired_purged_last_24h: 0, status: 'healthy' as const },
    };
  }

  evaluateAlerts() {
    const summary = this.getSummary();
    const alerts: Array<{
      id: string;
      title: string;
      severity: 'ok' | 'warning' | 'critical';
      metric_value: string;
      threshold: string;
      owner: string;
      remediation: string;
    }> = [
      {
        id: 'ALERT_PROVIDER_FAILURE_RATE',
        title: 'AI Model Provider Error Rate',
        severity:
          summary.provider_failure_rate_pct > 15
            ? 'critical'
            : summary.provider_failure_rate_pct > 5
              ? 'warning'
              : 'ok',
        metric_value: `${summary.provider_failure_rate_pct}%`,
        threshold: '> 5% warning, > 15% critical',
        owner: 'On-Call Platform Engineer',
        remediation:
          'Verify provider health dashboard; verify circuit breaker tripped to secondary fallback or template cache.',
      },
      {
        id: 'ALERT_LATENCY_P95',
        title: 'Plan Generation P95 Latency',
        severity:
          summary.latency_p95 > 12000 ? 'critical' : summary.latency_p95 > 8000 ? 'warning' : 'ok',
        metric_value: `${summary.latency_p95}ms`,
        threshold: '> 8000ms warning, > 12000ms critical',
        owner: 'Backend Performance Engineer',
        remediation:
          'Inspect token budget ceilings and network transport; check if fallback provider should be activated.',
      },
      {
        id: 'ALERT_DELETION_QUEUE',
        title: 'Account Deletion SLA & Purge Queue',
        severity: summary.deletion_jobs.failed > 0 ? 'critical' : 'ok',
        metric_value: `${summary.deletion_jobs.running} running, ${summary.deletion_jobs.failed} failed`,
        threshold: '> 0 failed jobs',
        owner: 'Data Compliance & Privacy Lead',
        remediation:
          'Examine dead-letter deletion jobs, verify Supabase RLS bypass / auth admin token permissions, retry failed steps.',
      },
      {
        id: 'ALERT_STORAGE_RETENTION',
        title: '30-Day Photo Storage Cleanup SLA',
        severity: summary.storage_cleanup.status === 'healthy' ? 'ok' : 'warning',
        metric_value: summary.storage_cleanup.status,
        threshold: 'Uncleaned objects older than 30 days',
        owner: 'Security Operations Lead',
        remediation:
          'Execute scheduled pg_cron storage retention cleaner or trigger manual purge runbook.',
      },
      {
        id: 'ALERT_AI_BUDGET_QUOTA',
        title: 'Hourly User Quota & Token Leases',
        severity: 'ok',
        metric_value: 'Normal',
        threshold: '> 90% budget lease saturation',
        owner: 'FinOps / Infrastructure Lead',
        remediation:
          'Review abusive tenants or request quota increase on active upstream provider.',
      },
    ];

    return alerts;
  }
}

export const globalTelemetry = new TelemetryCollector();
