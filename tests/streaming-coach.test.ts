import { describe, expect, it } from 'vitest';
import {
  buildBoundedCoachContext,
  generateCoachStream,
  sanitizeCoachText,
  DuplicateOperationError,
} from '../packages/domain/src/coach/coach-service';
import type { CoachMessage, CoachStreamEvent } from '../packages/contracts/src/coach';

describe('P9-01 — Streaming Coach Protocol & Operational Boundaries', () => {
  it('bounds relevant history to 10 messages and character limits', () => {
    const manyMessages: CoachMessage[] = Array.from({ length: 25 }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message turn ${i}: ${'sample text '.repeat(20)}`,
      created_at: new Date(Date.now() - (25 - i) * 60000).toISOString(),
    }));

    const bounded = buildBoundedCoachContext(manyMessages);

    // Max 10 messages
    expect(bounded.messages.length).toBeLessThanOrEqual(10);
    // Preserves recent messages
    expect(bounded.messages[bounded.messages.length - 1]?.id).toBe('msg-24');
    expect(bounded.totalChars).toBeLessThanOrEqual(4000);
  });

  it('escapes raw HTML entities to prevent unescaped rendering', () => {
    const raw = '<script>alert("xss")</script> & <b>bold</b>';
    const sanitized = sanitizeCoachText(raw);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
    expect(sanitized).toContain('&amp;');
    expect(sanitized).toContain('&quot;');
  });

  it('emits structured phases, text deltas, citations, and terminates cleanly with done', async () => {
    const messages: CoachMessage[] = [
      {
        id: 'msg-user-1',
        role: 'user',
        content: 'Why did my weight go up by 0.8 kg today?',
        created_at: new Date().toISOString(),
      },
    ];

    const stream = generateCoachStream({ messages });
    const events: CoachStreamEvent[] = [];

    for await (const event of stream) {
      events.push(event);
    }

    // 1. Started event
    const firstEvent = events[0];
    expect(firstEvent?.type).toBe('started');
    if (firstEvent && firstEvent.type === 'started') {
      expect(firstEvent.protocolVersion).toBe(1);
    }

    // 2. Status phases: analyzing, synthesizing, reviewing
    const statusEvents = events.filter((e) => e.type === 'status');
    expect(statusEvents.some((s) => s.phase === 'analyzing')).toBe(true);
    expect(statusEvents.some((s) => s.phase === 'synthesizing')).toBe(true);
    expect(statusEvents.some((s) => s.phase === 'reviewing')).toBe(true);

    // 3. Text deltas
    const textDeltas = events.filter((e) => e.type === 'text_delta');
    expect(textDeltas.length).toBeGreaterThan(0);
    const fullText = textDeltas.map((d) => d.text).join('');
    expect(fullText).toContain('single daily check-in is just one empirical data point');

    // 4. Citations & suggestions
    const citations = events.filter((e) => e.type === 'citation');
    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0]?.source).toContain('Helms et al.');

    const suggestions = events.filter((e) => e.type === 'action_suggestion');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.action === 'open_progress')).toBe(true);

    // 5. Terminal state
    const lastEvent = events[events.length - 1];
    expect(lastEvent?.type).toBe('done');
  });

  it('supports cancellation via AbortSignal and ceases emission immediately', async () => {
    const controller = new AbortController();
    const messages: CoachMessage[] = [
      {
        id: 'msg-user-1',
        role: 'user',
        content: 'Explain my progressive overload policy',
        created_at: new Date().toISOString(),
      },
    ];

    const stream = generateCoachStream({ messages, signal: controller.signal });
    const events: CoachStreamEvent[] = [];

    let count = 0;
    for await (const event of stream) {
      events.push(event);
      count++;
      if (count === 2) {
        // Abort mid-stream
        controller.abort();
      }
    }

    // Stream stopped abruptly; no terminal done was emitted after abort
    expect(events.length).toBeLessThanOrEqual(3);
    const lastEvent = events[events.length - 1];
    expect(lastEvent?.type).not.toBe('done');
  });

  it('emits actionable retryable error on provider disruption with terminal error state', async () => {
    const messages: CoachMessage[] = [
      {
        id: 'msg-user-1',
        role: 'user',
        content: 'Review training adherence',
        created_at: new Date().toISOString(),
      },
    ];

    const stream = generateCoachStream({ messages, simulateError: true });
    const events: CoachStreamEvent[] = [];

    for await (const event of stream) {
      events.push(event);
    }

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === 'error') {
      expect(errorEvent.code).toBe('COACH_PROVIDER_UNAVAILABLE');
      expect(errorEvent.retryable).toBe(true);
    }

    // Terminal state: last event is the error
    expect(events[events.length - 1]?.type).toBe('error');
  });

  it('prevents accidental duplicate concurrent generation for same operation ID', async () => {
    const messages: CoachMessage[] = [
      {
        id: 'msg-user-1',
        role: 'user',
        content: 'Help me review form',
        created_at: new Date().toISOString(),
      },
    ];

    const opId = 'concurrent-op-123';
    const stream1 = generateCoachStream({ messages, operationId: opId });

    // Begin consuming stream 1
    const firstIter = await stream1.next();
    expect(firstIter.value?.type).toBe('started');

    // Attempting concurrent stream with same operationId throws DuplicateOperationError
    await expect(async () => {
      const stream2 = generateCoachStream({ messages, operationId: opId });
      await stream2.next();
    }).rejects.toThrow(DuplicateOperationError);

    // Complete stream 1
    for await (const _ of stream1) {
      // drain
    }
  });
});
