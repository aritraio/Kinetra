import type { CoachConversationContext, CoachMessage, CoachStreamEvent } from '@kinetra/contracts';

/**
 * Escapes HTML characters to prevent XSS and raw HTML injection in conversational text.
 */
export function sanitizeCoachText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface BoundedCoachContext {
  readonly messages: CoachMessage[];
  readonly totalChars: number;
  readonly summarySnippet: string;
}

export const MAX_COACH_MESSAGES_WINDOW = 10;
export const MAX_COACH_CONTEXT_CHARS = 4000;

/**
 * Bounds conversation context to the most recent N turns and maximum character ceiling.
 */
export function buildBoundedCoachContext(
  messages: CoachMessage[],
  maxMessages = MAX_COACH_MESSAGES_WINDOW,
  maxChars = MAX_COACH_CONTEXT_CHARS,
): BoundedCoachContext {
  const bounded: CoachMessage[] = [];
  let charCount = 0;

  // Process from newest to oldest
  const reversed = [...messages].reverse();
  for (const msg of reversed) {
    if (bounded.length >= maxMessages) break;
    const msgLen = msg.content.length;
    if (charCount + msgLen > maxChars && bounded.length > 0) {
      break;
    }
    bounded.unshift({
      ...msg,
      content: sanitizeCoachText(msg.content.slice(0, 1000)),
    });
    charCount += msg.content.length;
  }

  return {
    messages: bounded,
    totalChars: charCount,
    summarySnippet:
      bounded.length > 0 ? (bounded[bounded.length - 1]?.content.slice(0, 80) ?? '') : '',
  };
}

export interface CoachStreamOptions {
  readonly messages: CoachMessage[];
  readonly context?: CoachConversationContext | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly simulateError?: boolean | undefined;
  readonly operationId?: string | undefined;
}

// Active operations set to prevent duplicate concurrent generation for same request
const activeOperations = new Set<string>();

export class DuplicateOperationError extends Error {
  constructor(opId: string) {
    super(`Coach operation '${opId}' is already in progress.`);
    this.name = 'DuplicateOperationError';
  }
}

/**
 * Core deterministic streaming coach generator.
 * Produces structured CoachStreamEvents with guaranteed terminal states (done or error).
 */
export async function* generateCoachStream(
  options: CoachStreamOptions,
): AsyncGenerator<CoachStreamEvent> {
  const opId = options.operationId ?? globalThis.crypto.randomUUID();
  if (activeOperations.has(opId)) {
    throw new DuplicateOperationError(opId);
  }

  activeOperations.add(opId);

  try {
    // 1. Started event
    yield {
      type: 'started',
      protocolVersion: 1,
      operation_id: opId,
    };

    if (options.signal?.aborted) return;

    // 2. Analyzing phase
    yield {
      type: 'status',
      phase: 'analyzing',
      message: 'Analyzing training adherence, progression policy, and active plan context…',
    };

    if (options.signal?.aborted) return;

    if (options.simulateError) {
      yield {
        type: 'error',
        code: 'COACH_PROVIDER_UNAVAILABLE',
        message: 'The coaching model provider experienced a temporary connection timeout.',
        retryable: true,
      };
      return;
    }

    // 3. Synthesizing phase
    yield {
      type: 'status',
      phase: 'synthesizing',
      message: 'Synthesizing evidence-based coaching guidance…',
    };

    if (options.signal?.aborted) return;

    // Build bounded context
    const bounded = buildBoundedCoachContext(options.messages);
    const lastUserMessage = [...bounded.messages].reverse().find((m) => m.role === 'user');
    const promptText = (lastUserMessage?.content || '').toLowerCase();

    // Determine relevant synthesized response
    let responseChunks: string[] = [];
    let citations: Array<{ source: string; url?: string }> = [];
    let actionSuggestions: Array<{ action: string; label: string; payload?: unknown }> = [];

    if (
      promptText.includes('weight') ||
      promptText.includes('scale') ||
      promptText.includes('fluctuat')
    ) {
      responseChunks = [
        'A single daily check-in is just one empirical data point. ',
        'Short-term weight fluctuations commonly stem from glycogen replenishment, hydration shifts, and sodium retention rather than true tissue loss or gain. ',
        'Always evaluate your 14-day exponential moving average or rolling trend line before adjusting nutritional prescriptions. ',
        'Consistency over weeks drives sustainable metabolic adaptation.',
      ];
      citations = [
        {
          source:
            'Helms et al. (2014) Evidence-based recommendations for natural bodybuilding contest prep',
          url: 'https://jissn.biomedcentral.com/articles/10.1186/1550-2783-11-20',
        },
      ];
      actionSuggestions = [
        { action: 'open_progress', label: 'View 14-Day Weight Trend' },
        { action: 'view_nutrition', label: 'Inspect Calorie Targets' },
      ];
    } else if (
      promptText.includes('progression') ||
      promptText.includes('plateau') ||
      promptText.includes('heavy') ||
      promptText.includes('rpe')
    ) {
      responseChunks = [
        'Progressive overload is governed by our deterministic policy (version 2026-10-01). ',
        'When you complete all prescribed sets with average RPE ≤ 7.5 across at least 2 sessions, an incremental load increase is recommended (+2.5 kg for upper body, +5.0 kg for lower body). ',
        'If RPE reaches 9.5 or reps drop significantly across consecutive sessions, a reactive deload is recommended to consolidate fatigue.',
      ];
      citations = [
        {
          source: 'Kinetra Progression Policy Specification v2026-10-01',
          url: 'file:///docs/PROGRESSION_POLICY.md',
        },
      ];
      actionSuggestions = [
        { action: 'view_progression', label: 'Review Adaptive Progression Deltas' },
        { action: 'log_session', label: 'Log New Training Session' },
      ];
    } else if (
      promptText.includes('form') ||
      promptText.includes('posture') ||
      promptText.includes('squat') ||
      promptText.includes('knee')
    ) {
      responseChunks = [
        'Kinematic analysis from your Form Lab measures knee flexion, trunk forward lean, and depth angles in real time on device. ',
        'Keep your descent controlled (approx. 2-3 seconds) and ensure hip crease breaks parallel with the patella while maintaining neutral lumbar spine. ',
        'If joint discomfort is detected, our safety gate immediately halts automatic load progression.',
      ];
      citations = [
        {
          source: 'Schoenfeld et al. (2010) Squatting kinematics and biomechanical loading',
        },
      ];
      actionSuggestions = [{ action: 'open_posture_lab', label: 'Open Posture & Form Lab' }];
    } else {
      responseChunks = [
        'I am analyzing your active routine. ',
        'To maximize recovery and muscle protein synthesis, prioritize hitting your daily protein target and logging training sessions consistently. ',
        'Remember that verified plan changes require separate review and are never modified silently.',
      ];
      citations = [
        {
          source:
            'Morton et al. (2018) Systematic review on protein supplementation and resistance training',
        },
      ];
      actionSuggestions = [{ action: 'view_plan', label: 'Inspect Verified Plan' }];
    }

    // Emit text deltas
    for (const chunk of responseChunks) {
      if (options.signal?.aborted) return;
      yield {
        type: 'text_delta',
        text: sanitizeCoachText(chunk),
      };
    }

    // Emit citations if present
    for (const cit of citations) {
      if (options.signal?.aborted) return;
      yield {
        type: 'citation',
        source: cit.source,
        url: cit.url,
      };
    }

    // Emit suggestions
    for (const sug of actionSuggestions) {
      if (options.signal?.aborted) return;
      yield {
        type: 'action_suggestion',
        action: sug.action,
        label: sug.label,
        payload: sug.payload,
      };
    }

    // 4. Reviewing phase
    yield {
      type: 'status',
      phase: 'reviewing',
      message: 'Coaching guidance completed.',
    };

    if (options.signal?.aborted) return;

    // 5. Terminal done event
    yield {
      type: 'done',
    };
  } finally {
    activeOperations.delete(opId);
  }
}
