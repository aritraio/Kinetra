import { createHash } from 'node:crypto';

export interface IdempotencyEntry<T = unknown> {
  readonly owner_id: string;
  readonly idempotency_key: string;
  readonly input_hash: string;
  status: 'in_progress' | 'completed' | 'failed';
  result?: T | undefined;
  promise?: Promise<T> | undefined;
  created_at: number;
  updated_at: number;
}

export type IdempotencyDecision<T> =
  | { readonly kind: 'replayed'; readonly result: T }
  | {
      readonly kind: 'execute';
      readonly leaseId: string;
      readonly commit: (result: T) => void;
      readonly release: () => void;
      readonly setPromise: (p: Promise<T>) => void;
    };

export class IdempotencyConflictError extends Error {
  constructor(message = 'Idempotency key reuse with differing input payload') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyStore {
  private readonly entries = new Map<string, IdempotencyEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMs = 60000) {
    this.ttlMs = ttlMs;
  }

  hashPayload(payload: unknown): string {
    const serialized = JSON.stringify(payload, Object.keys(payload as object).sort());
    return createHash('sha256').update(serialized).digest('hex');
  }

  async acquire<T>(
    ownerId: string,
    idempotencyKey: string,
    payload: unknown,
  ): Promise<IdempotencyDecision<T>> {
    const key = `${ownerId}:${idempotencyKey}`;
    const inputHash = this.hashPayload(payload);
    const now = Date.now();

    const existing = this.entries.get(key);

    if (existing) {
      // 1. Key reuse with different payload check
      if (existing.input_hash !== inputHash) {
        throw new IdempotencyConflictError();
      }

      // 2. Replay completed result
      if (existing.status === 'completed' && existing.result !== undefined) {
        return {
          kind: 'replayed',
          result: existing.result as T,
        };
      }

      // 3. Concurrent in-progress request deduplication
      if (existing.status === 'in_progress') {
        const isStale = now - existing.created_at > this.ttlMs;
        if (!isStale && existing.promise) {
          const concurrentResult = await (existing.promise as Promise<T>);
          return {
            kind: 'replayed',
            result: concurrentResult,
          };
        }
      }
    }

    // Register new in-progress lease
    const entry: IdempotencyEntry<T> = {
      owner_id: ownerId,
      idempotency_key: idempotencyKey,
      input_hash: inputHash,
      status: 'in_progress',
      created_at: now,
      updated_at: now,
    };

    this.entries.set(key, entry as IdempotencyEntry<unknown>);

    return {
      kind: 'execute',
      leaseId: key,
      setPromise: (p: Promise<T>) => {
        entry.promise = p;
      },
      commit: (result: T) => {
        entry.status = 'completed';
        entry.result = result;
        entry.updated_at = Date.now();
        entry.promise = undefined;
      },
      release: () => {
        entry.status = 'failed';
        entry.updated_at = Date.now();
        entry.promise = undefined;
      },
    };
  }

  clear(): void {
    this.entries.clear();
  }
}

export const globalIdempotencyStore = new IdempotencyStore();
