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
        outcomes: { generated: 0, repaired: 0, template: 0, failed: 0, synthetic_fixture: 0 },
        latency_p50: 0,
        latency_p95: 0,
        total_tokens: 0,
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

    return {
      total: this.events.length,
      outcomes: counts,
      latency_p50: p50,
      latency_p95: p95,
      total_tokens: totalTokens,
    };
  }
}

export const globalTelemetry = new TelemetryCollector();
