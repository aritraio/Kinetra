import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CircuitBreaker, CircuitBreakerOpenError } from '../apps/api/src/ai/circuit-breaker';
import {
  FallbackProviderAdapter,
  ResilientProviderPipeline,
} from '../apps/api/src/ai/fallback-provider';
import type { GeminiProviderAdapter } from '../apps/api/src/ai/provider-adapter';

const testOutputSchema = z.object({
  exercise: z.string(),
  sets: z.number(),
  reps: z.number(),
});

type TestOutput = z.infer<typeof testOutputSchema>;

describe('Phase 9 — P9-05 Evaluated Fallback Provider & Circuit Breaker', () => {
  describe('CircuitBreaker State Machine', () => {
    it('initializes in CLOSED state and executes actions successfully', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 100 });
      expect(cb.getState()).toBe('CLOSED');

      const result = await cb.execute(async () => 'success-payload');
      expect(result).toBe('success-payload');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('transitions from CLOSED to OPEN after reaching failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });

      // First failure
      await expect(
        cb.execute(async () => {
          throw new Error('503 Service Unavailable');
        }),
      ).rejects.toThrow('503 Service Unavailable');
      expect(cb.getState()).toBe('CLOSED');

      // Second failure trips breaker
      await expect(
        cb.execute(async () => {
          throw new Error('503 Service Unavailable');
        }),
      ).rejects.toThrow('503 Service Unavailable');
      expect(cb.getState()).toBe('OPEN');

      // Subsequent call is short-circuited immediately
      await expect(cb.execute(async () => 'never-called')).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('transitions to HALF_OPEN after reset timeout and recovers to CLOSED on success', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

      // Trip the breaker
      cb.trip();
      expect(cb.getState()).toBe('OPEN');

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 60));
      expect(cb.getState()).toBe('HALF_OPEN');

      // Successful probe in HALF_OPEN restores CLOSED state
      const recovered = await cb.execute(async () => 'probe-success');
      expect(recovered).toBe('probe-success');
      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('FallbackProviderAdapter', () => {
    it('exposes accurate capabilities and limitations for Groq/Llama-3.3-70b', () => {
      const fallback = new FallbackProviderAdapter();
      const capabilities = fallback.probeCapabilities();

      expect(capabilities.model).toBe('llama-3.3-70b-versatile');
      expect(capabilities.capabilities.structured_output).toBe(true);
      expect(capabilities.capabilities.max_output_tokens).toBe(8192);
      expect(capabilities.limitations).toHaveLength(3);
    });

    it('parses structured schema outputs via custom transport', async () => {
      const mockTransport = vi.fn().mockResolvedValue({
        text: JSON.stringify({ exercise: 'Overhead Press', sets: 4, reps: 6 }),
        promptTokens: 120,
        candidateTokens: 35,
      });

      const fallback = new FallbackProviderAdapter({ transport: mockTransport });
      const res = await fallback.generateStructured(
        'Generate press workout',
        testOutputSchema,
        'press_workout',
      );

      expect(res.data).toEqual({ exercise: 'Overhead Press', sets: 4, reps: 6 });
      expect(res.prompt_tokens).toBe(120);
      expect(res.candidate_tokens).toBe(35);
      expect(res.total_tokens).toBe(155);
      expect(res.model).toBe('llama-3.3-70b-versatile');
    });
  });

  describe('ResilientProviderPipeline Orchestration', () => {
    it('routes to primary provider when healthy', async () => {
      const mockPrimary: Partial<GeminiProviderAdapter> = {
        generateStructured: vi.fn().mockResolvedValue({
          data: { exercise: 'Bench Press', sets: 3, reps: 8 },
          raw_text: '{}',
          prompt_tokens: 100,
          candidate_tokens: 25,
          total_tokens: 125,
          duration_ms: 150,
          model: 'gemini-2.5-flash',
        }),
      };

      const pipeline = new ResilientProviderPipeline({
        primary: mockPrimary as unknown as GeminiProviderAdapter,
        circuitBreaker: new CircuitBreaker({ failureThreshold: 2 }),
      });

      const result = await pipeline.generateStructured(
        'Generate bench workout',
        testOutputSchema,
        'bench_workout',
      );

      expect(result.source).toBe('primary');
      expect(result.response.data.exercise).toBe('Bench Press');
    });

    it('falls back to secondary provider when primary fails', async () => {
      const mockPrimary: Partial<GeminiProviderAdapter> = {
        generateStructured: vi.fn().mockRejectedValue(new Error('Rate limit exceeded (429)')),
      };

      const mockFallbackTransport = vi.fn().mockResolvedValue({
        text: JSON.stringify({ exercise: 'Dumbbell Incline Bench', sets: 3, reps: 10 }),
        promptTokens: 80,
        candidateTokens: 20,
      });

      const fallbackAdapter = new FallbackProviderAdapter({ transport: mockFallbackTransport });

      const pipeline = new ResilientProviderPipeline({
        primary: mockPrimary as unknown as GeminiProviderAdapter,
        fallback: fallbackAdapter,
        circuitBreaker: new CircuitBreaker({ failureThreshold: 3 }),
      });

      const result = await pipeline.generateStructured(
        'Generate bench workout',
        testOutputSchema,
        'bench_workout',
      );

      expect(result.source).toBe('fallback');
      expect(result.response.data.exercise).toBe('Dumbbell Incline Bench');
    });

    it('bubbles up error if both primary and fallback providers fail, enabling deterministic templates', async () => {
      const mockPrimary: Partial<GeminiProviderAdapter> = {
        generateStructured: vi.fn().mockRejectedValue(new Error('Gemini API Outage (500)')),
      };

      const mockFallbackTransport = vi.fn().mockRejectedValue(new Error('Groq Network Timeout'));
      const fallbackAdapter = new FallbackProviderAdapter({ transport: mockFallbackTransport });

      const pipeline = new ResilientProviderPipeline({
        primary: mockPrimary as unknown as GeminiProviderAdapter,
        fallback: fallbackAdapter,
        circuitBreaker: new CircuitBreaker({ failureThreshold: 1 }),
      });

      await expect(
        pipeline.generateStructured('Generate workout', testOutputSchema, 'workout'),
      ).rejects.toThrow('Gemini API Outage (500)');
    });
  });
});
