import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button, Notice } from '../components/ui';
import { webEnvironment } from '../env';
import { useRepositories } from '../repositories';
import { consumeStream } from '../stream';
import type { CoachMessage, CoachStreamEvent } from '@kinetra/contracts';

interface ExtendedCoachMessage extends CoachMessage {
  phase?: 'analyzing' | 'synthesizing' | 'reviewing';
  citations?: Array<{ source: string; url?: string }>;
  suggestions?: Array<{ action: string; label: string }>;
  isStreaming?: boolean;
}

const INITIAL_MESSAGES: ExtendedCoachMessage[] = [
  {
    id: 'msg-seed-1',
    role: 'user',
    content: 'How should I think about a day when my weight goes up?',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'msg-seed-2',
    role: 'assistant',
    content:
      'A single check-in is one data point. Look at the pattern across your recent logs before deciding whether your plan needs a review.\n\nYour 14-day demo history shows a downward trend despite daily water and glycogen fluctuations.',
    created_at: new Date(Date.now() - 3500000).toISOString(),
    citations: [
      {
        source: 'Helms et al. (2014) Natural bodybuilding contest prep recommendations',
        url: 'https://jissn.biomedcentral.com/articles/10.1186/1550-2783-11-20',
      },
    ],
    suggestions: [
      { action: 'open_progress', label: 'Open weight trend' },
      { action: 'view_plan', label: 'Inspect nutrition targets' },
    ],
  },
];

export function CoachView({
  onNavigateToTab,
}: {
  onNavigateToTab?: (tab: 'today' | 'measure' | 'plan' | 'progress' | 'posture') => void;
}) {
  const repos = useRepositories();
  const [messages, setMessages] = useState<ExtendedCoachMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<
    'analyzing' | 'synthesizing' | 'reviewing' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-scroll strictly triggered when messages change or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingPhase]);

  const handleSend = async (userPrompt: string) => {
    const trimmed = userPrompt.trim();
    if (!trimmed || isStreaming) return;

    setErrorMessage(null);
    setInputText('');

    const userMessage: ExtendedCoachMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    const assistantPlaceholderId = crypto.randomUUID();
    const assistantMessage: ExtendedCoachMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true,
      phase: 'analyzing',
      citations: [],
      suggestions: [],
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setIsStreaming(true);
    setStreamingPhase('analyzing');

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // In demo mode or if API endpoint unreachable, we stream from local domain engine
      const response = await fetch(`${webEnvironment.VITE_API_BASE_URL}/stream/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(0, -1).map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })),
        }),
        signal: controller.signal,
      }).catch(() => null);

      if (response && response.ok) {
        await consumeStream(response, (event) => {
          if (controller.signal.aborted) return;
          handleStreamEvent(assistantPlaceholderId, event as CoachStreamEvent);
        });
      } else {
        // Fallback: Use client-side domain coach generator directly for resilient local/offline execution
        const { generateCoachStream } = await import('@kinetra/domain');
        const coachGen = generateCoachStream({
          messages: nextMessages.slice(0, -1),
          signal: controller.signal,
        });

        for await (const event of coachGen) {
          if (controller.signal.aborted) break;
          handleStreamEvent(assistantPlaceholderId, event);
        }
      }
    } catch (_err: unknown) {
      if (!controller.signal.aborted) {
        setErrorMessage('Coaching session temporarily interrupted. Tap retry to reconnect.');
      }
    } finally {
      setIsStreaming(false);
      setStreamingPhase(null);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantPlaceholderId ? { ...m, isStreaming: false } : m)),
      );
    }
  };

  const handleStreamEvent = (messageId: string, event: CoachStreamEvent) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;

        if (event.type === 'status') {
          setStreamingPhase(event.phase);
          return { ...m, phase: event.phase };
        }
        if (event.type === 'text_delta') {
          return { ...m, content: m.content + event.text };
        }
        if (event.type === 'citation') {
          const current = m.citations ?? [];
          return {
            ...m,
            citations: [
              ...current,
              { source: event.source, ...(event.url ? { url: event.url } : {}) },
            ],
          };
        }
        if (event.type === 'action_suggestion') {
          const current = m.suggestions ?? [];
          return {
            ...m,
            suggestions: [...current, { action: event.action, label: event.label }],
          };
        }
        if (event.type === 'done') {
          const { phase: _, ...rest } = m;
          return { ...rest, isStreaming: false };
        }
        if (event.type === 'error') {
          setErrorMessage(event.message);
          return { ...m, isStreaming: false };
        }
        return m;
      }),
    );
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamingPhase(null);
  };

  const handleSuggestionClick = (action: string) => {
    if (action === 'open_progress' && onNavigateToTab) onNavigateToTab('progress');
    else if (action === 'view_plan' && onNavigateToTab) onNavigateToTab('plan');
    else if (action === 'open_posture_lab' && onNavigateToTab) onNavigateToTab('posture');
    else if (action === 'view_progression' && onNavigateToTab) onNavigateToTab('plan');
    else if (action === 'view_nutrition' && onNavigateToTab) onNavigateToTab('plan');
  };

  return (
    <div className="coach-view">
      <header className="view-header">
        <div>
          <h1>Kinetra Coach</h1>
          <p className="intro">
            Contextual training and adherence guidance grounded in verified plan constraints and
            empirical logs.
          </p>
        </div>
        {isStreaming && (
          <div className="streaming-status-pill" role="status" aria-live="polite">
            <span className="live-dot" />
            <span>
              {streamingPhase === 'analyzing'
                ? 'Analyzing logs…'
                : streamingPhase === 'synthesizing'
                  ? 'Synthesizing response…'
                  : 'Reviewing…'}
            </span>
            <Button size="small" variant="quiet" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </header>

      {errorMessage && (
        <Notice variant="error" style={{ marginBottom: '16px' }}>
          {errorMessage}{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => handleSend(messages[messages.length - 2]?.content || 'Review my plan')}
          >
            Retry
          </button>
        </Notice>
      )}

      <div className="coach-layout">
        {/* Chat Conversation Scroll Area */}
        <section
          className="coach-chat-card card"
          aria-label="Conversation history"
          role="log"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="messages-stream">
            {messages.map((msg) => (
              <div key={msg.id} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                {msg.role === 'assistant' && (
                  <div className="eyebrow" style={{ marginBottom: '6px' }}>
                    {msg.isStreaming
                      ? 'KINETRA COACH / STREAMING…'
                      : 'KINETRA COACH / RESPONSE COMPLETE'}
                  </div>
                )}
                <div className="bubble-content" style={{ whiteSpace: 'pre-line' }}>
                  {msg.content || (msg.isStreaming ? 'Thinking…' : '')}
                </div>

                {/* Citations section */}
                {msg.citations && msg.citations.length > 0 && (
                  <div
                    className="citations-tray"
                    style={{ marginTop: '10px', fontSize: 'var(--text-xs)' }}
                  >
                    <strong>Evidence Sources:</strong>
                    <ul>
                      {msg.citations.map((c) => (
                        <li key={c.url || c.source}>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer">
                              {c.source}
                            </a>
                          ) : (
                            c.source
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action suggestion buttons */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div
                    className="suggestions-tray"
                    style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                  >
                    {msg.suggestions.map((sug) => (
                      <button
                        key={`${sug.action}-${sug.label}`}
                        type="button"
                        className="suggestion-pill-btn"
                        onClick={() => handleSuggestionClick(sug.action)}
                      >
                        {sug.label} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend(inputText);
            }}
          >
            <input
              type="text"
              aria-label="Message Coach"
              placeholder="Ask about your routine, adherence, or progression…"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isStreaming}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isStreaming || !inputText.trim()}
              aria-label="Send message to Coach"
            >
              Send
            </Button>
          </form>

          <p
            className="note"
            style={{ marginTop: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
          >
            AI guidance may be incomplete. Numeric plan changes require a separate review. Kinetra
            Coach does not diagnose conditions.
          </p>
        </section>

        {/* Suggested Prompts & Calculation Sources sidebar */}
        <aside className="coach-sidebar card">
          <div className="card-header">
            <h2>Start with a Question</h2>
          </div>
          <div className="suggested-prompts-list">
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleSend('How can I stay consistent with my training this week?')}
            >
              <strong>My Routine</strong>
              <span>How can I stay consistent this week?</span>
            </button>
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleSend('How does progressive overload work in my plan?')}
            >
              <strong>My Training</strong>
              <span>How does progressive overload work?</span>
            </button>
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleSend('Explain the assumptions in my nutritional target.')}
            >
              <strong>My Nutrition</strong>
              <span>Explain the assumptions in my target.</span>
            </button>
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleSend('What should I focus on for my squat form?')}
            >
              <strong>Form & Kinematics</strong>
              <span>What should I focus on for squat form?</span>
            </button>
          </div>

          <div className="divider" style={{ margin: '16px 0' }} />

          <h3>Sources & Governance</h3>
          <p className="note" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Guidance citations appear only when supported by peer-reviewed evidence or versioned
            domain specifications (Policy v2026-10-01).
          </p>
        </aside>
      </div>
    </div>
  );
}
