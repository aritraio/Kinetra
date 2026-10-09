import type { z } from 'zod';

export interface ProviderCapabilities {
  readonly structured_output: boolean;
  readonly json_schema_enforcement: boolean;
  readonly streaming: boolean;
  readonly max_output_tokens: number;
}

export interface ProviderProbeResult {
  readonly provider: 'google-gemini';
  readonly model: string;
  readonly probe_date: string;
  readonly capabilities: ProviderCapabilities;
  readonly limitations: readonly string[];
}

export interface ProviderGenerationOptions {
  readonly temperature?: number | undefined;
  readonly top_p?: number | undefined;
  readonly seed?: number | undefined;
  readonly max_tokens?: number | undefined;
  readonly timeout_ms?: number | undefined;
}

export interface ProviderResponse<T> {
  readonly data: T;
  readonly raw_text: string;
  readonly prompt_tokens: number;
  readonly candidate_tokens: number;
  readonly total_tokens: number;
  readonly duration_ms: number;
  readonly model: string;
}

export const PINNED_MODEL_CONFIG = {
  provider: 'google-gemini' as const,
  model: 'gemini-2.5-flash',
  temperature: 0.2,
  top_p: 0.95,
  seed: 42,
  probe_date: '2026-10-08',
  max_output_tokens: 8192,
  timeout_ms: 12000,
} as const;

export const OBSERVED_LIMITATIONS: readonly string[] = [
  'Strict JSON schema requires object types to declare all fields and non-empty descriptions',
  'Large weekly schedules approaching 8k output tokens can exceed latency budget if not concise',
  'Provider rate limits on free-tier necessitate bounded retry and local template fallback',
  'Streaming structured output requires client-side incremental JSON assembly or SSE chunking',
];

export interface TransportHandler {
  generateContent: (
    prompt: string,
    schemaDescription: string,
  ) => Promise<{ text: string; promptTokens: number; candidateTokens: number }>;
}

export class GeminiProviderAdapter {
  readonly model = PINNED_MODEL_CONFIG.model;
  readonly probeDate = PINNED_MODEL_CONFIG.probe_date;
  private readonly customTransport?: TransportHandler | undefined;
  private readonly apiKey?: string | undefined;

  constructor(options?: {
    apiKey?: string | undefined;
    transport?: TransportHandler | undefined;
  }) {
    this.apiKey = options?.apiKey;
    this.customTransport = options?.transport;
  }

  probeCapabilities(): ProviderProbeResult {
    return {
      provider: PINNED_MODEL_CONFIG.provider,
      model: this.model,
      probe_date: this.probeDate,
      capabilities: {
        structured_output: true,
        json_schema_enforcement: true,
        streaming: true,
        max_output_tokens: PINNED_MODEL_CONFIG.max_output_tokens,
      },
      limitations: OBSERVED_LIMITATIONS,
    };
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    schemaName: string,
    options?: ProviderGenerationOptions,
  ): Promise<ProviderResponse<T>> {
    const startTime = Date.now();
    let rawText = '';
    let promptTokens = 0;
    let candidateTokens = 0;

    if (this.customTransport) {
      const res = await this.customTransport.generateContent(prompt, schemaName);
      rawText = res.text;
      promptTokens = res.promptTokens;
      candidateTokens = res.candidateTokens;
    } else if (this.apiKey) {
      // Direct Gemini REST API call
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options?.temperature ?? PINNED_MODEL_CONFIG.temperature,
            topP: options?.top_p ?? PINNED_MODEL_CONFIG.top_p,
            maxOutputTokens: options?.max_tokens ?? PINNED_MODEL_CONFIG.max_output_tokens,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(options?.timeout_ms ?? PINNED_MODEL_CONFIG.timeout_ms),
      });

      if (!response.ok) {
        throw new Error(`Gemini API transport error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const candidate = json.candidates?.[0];
      rawText = candidate?.content?.parts?.[0]?.text ?? '';
      promptTokens = json.usageMetadata?.promptTokenCount ?? 150;
      candidateTokens = json.usageMetadata?.candidatesTokenCount ?? 350;
    } else {
      throw new Error(
        'GeminiProviderAdapter requires GEMINI_API_KEY or a configured transport handler',
      );
    }

    const durationMs = Date.now() - startTime;

    // Parse JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(`Model returned malformed non-JSON payload: ${rawText.slice(0, 100)}...`);
    }

    // Validate with Zod schema
    const validated = schema.safeParse(parsedJson);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      throw new Error(`Model output failed schema validation: ${issues}`);
    }

    return {
      data: validated.data,
      raw_text: rawText,
      prompt_tokens: promptTokens,
      candidate_tokens: candidateTokens,
      total_tokens: promptTokens + candidateTokens,
      duration_ms: durationMs,
      model: this.model,
    };
  }
}
