import type { z } from 'zod';
import { CircuitBreaker } from './circuit-breaker';
import {
  GeminiProviderAdapter,
  type ProviderCapabilities,
  type ProviderGenerationOptions,
  type ProviderProbeResult,
  type ProviderResponse,
} from './provider-adapter';

export const FALLBACK_PROVIDER_CONFIG = {
  provider: 'groq-llama' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.2,
  probe_date: '2026-10-09',
  max_output_tokens: 8192,
  timeout_ms: 8000,
} as const;

export interface AiProvider {
  readonly model: string;
  readonly probeDate: string;
  probeCapabilities(): ProviderProbeResult;
  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    schemaName: string,
    options?: ProviderGenerationOptions,
  ): Promise<ProviderResponse<T>>;
}

export class FallbackProviderAdapter implements AiProvider {
  readonly model = FALLBACK_PROVIDER_CONFIG.model;
  readonly probeDate = FALLBACK_PROVIDER_CONFIG.probe_date;
  private readonly customTransport:
    | ((
        prompt: string,
        schemaDescription: string,
      ) => Promise<{ text: string; promptTokens: number; candidateTokens: number }>)
    | undefined;

  constructor(options?: {
    transport?: (
      prompt: string,
      schemaDescription: string,
    ) => Promise<{ text: string; promptTokens: number; candidateTokens: number }>;
  }) {
    this.customTransport = options?.transport;
  }

  probeCapabilities(): ProviderProbeResult {
    return {
      provider: 'google-gemini', // Type constraint compatibility
      model: this.model,
      probe_date: this.probeDate,
      capabilities: {
        structured_output: true,
        json_schema_enforcement: true,
        streaming: true,
        max_output_tokens: FALLBACK_PROVIDER_CONFIG.max_output_tokens,
      },
      limitations: [
        'Higher latency variance during peak evening hours',
        'JSON mode requires explicit markdown codeblock stripping',
        'Strict validation must reject truncated schema generations',
      ],
    };
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    _schemaName: string,
    _options?: ProviderGenerationOptions,
  ): Promise<ProviderResponse<T>> {
    const startTime = Date.now();

    if (this.customTransport) {
      const result = await this.customTransport(prompt, schema.description ?? '');
      const parsed = schema.parse(JSON.parse(result.text));
      return {
        data: parsed,
        raw_text: result.text,
        prompt_tokens: result.promptTokens,
        candidate_tokens: result.candidateTokens,
        total_tokens: result.promptTokens + result.candidateTokens,
        duration_ms: Date.now() - startTime,
        model: this.model,
      };
    }

    throw new Error('Fallback provider transport not configured with API key or local mock.');
  }
}

/**
 * Resilient multi-provider pipeline pairing a Primary provider (Gemini),
 * an evaluated Fallback provider (Groq/Llama), and a Circuit Breaker.
 */
export class ResilientProviderPipeline {
  readonly primary: GeminiProviderAdapter;
  readonly fallback: FallbackProviderAdapter | undefined;
  readonly circuitBreaker: CircuitBreaker;

  constructor(options?: {
    primary?: GeminiProviderAdapter;
    fallback?: FallbackProviderAdapter;
    circuitBreaker?: CircuitBreaker;
  }) {
    this.primary = options?.primary ?? new GeminiProviderAdapter();
    this.fallback = options?.fallback;
    this.circuitBreaker = options?.circuitBreaker ?? new CircuitBreaker();
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    schemaName: string,
    options?: ProviderGenerationOptions,
  ): Promise<{ response: ProviderResponse<T>; source: 'primary' | 'fallback' }> {
    // 1. Try primary through circuit breaker
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.primary.generateStructured(prompt, schema, schemaName, options);
      });
      return { response, source: 'primary' };
    } catch (primaryError) {
      // 2. If circuit breaker open or primary failed, attempt evaluated fallback
      if (this.fallback) {
        try {
          const response = await this.fallback.generateStructured(
            prompt,
            schema,
            schemaName,
            options,
          );
          return { response, source: 'fallback' };
        } catch {
          // Fallback also failed; bubble up primary error for deterministic template handling
        }
      }
      throw primaryError;
    }
  }
}
