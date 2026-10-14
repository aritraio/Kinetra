import { useState } from 'react';
import { Button, Dialog, Field, Notice } from '../components/ui';
import { extractFromVoiceTranscript } from '@kinetra/domain';
import type {
  VoiceExtractionResult,
  VoiceMealItemExtraction,
  VoiceWorkoutSetExtraction,
} from '@kinetra/contracts';
import { useRepositories } from '../repositories';

interface VoiceLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function VoiceLogModal({ isOpen, onClose, onSaved }: VoiceLogModalProps) {
  const repos = useRepositories();
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<VoiceExtractionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields state
  const [editableWeight, setEditableWeight] = useState<number>(0);
  const [editableExercise, setEditableExercise] = useState<string>('');
  const [editableSets, setEditableSets] = useState<VoiceWorkoutSetExtraction[]>([]);
  const [editableMealName, setEditableMealName] = useState<string>('');
  const [editableMealItems, setEditableMealItems] = useState<VoiceMealItemExtraction[]>([]);

  const startListening = () => {
    setRecognitionError(null);
    setExtractionResult(null);

    // Browser SpeechRecognition check
    interface SpeechRecognitionInstance {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      abort: () => void;
      onstart: (() => void) | null;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
    }
    type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setRecognitionError(
        'Speech recognition is not supported in this browser. You can type or paste your spoken transcript below.',
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
        const text = event.results?.[0]?.[0]?.transcript;
        if (text) {
          setTranscript(text);
          processTranscript(text);
        }
      };

      recognition.onerror = (event: { error: string }) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setRecognitionError(
            'Microphone access denied. Grant browser microphone permissions or type your entry.',
          );
        } else {
          setRecognitionError(
            `Voice recognition error (${event.error}). You can type your entry below.`,
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setRecognitionError(
        'Could not initialize speech recognition. You can type your entry below.',
      );
    }
  };

  const processTranscript = (rawText: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = extractFromVoiceTranscript({
      transcript: rawText,
      local_date: today,
      timezone: 'UTC',
    });

    setExtractionResult(result);

    if (result.extraction) {
      if (result.extraction.kind === 'weight_log') {
        setEditableWeight(result.extraction.weight_kg);
      } else if (result.extraction.kind === 'workout_log') {
        setEditableExercise(result.extraction.exercise_name);
        setEditableSets(result.extraction.sets.map((s) => ({ ...s })));
      } else if (result.extraction.kind === 'meal_log') {
        setEditableMealName(result.extraction.meal_name);
        setEditableMealItems(result.extraction.items.map((i) => ({ ...i })));
      }
    }
  };

  const handleManualParse = () => {
    if (transcript.trim()) {
      processTranscript(transcript.trim());
    }
  };

  const handleConfirmAndSave = async () => {
    if (!extractionResult?.extraction) return;
    setIsSaving(true);

    try {
      const today = new Date().toISOString().slice(0, 10);

      if (extractionResult.extraction.kind === 'weight_log') {
        // Fetch current logs to get expected revision
        const currentLogs = await repos.logs.listLogs(1);
        const expectedRev = currentLogs[0]?.revision ?? 0;
        await repos.logs.saveLog(expectedRev, {
          expected_revision: expectedRev,
          local_date: today,
          timezone: 'UTC',
          weight: { value: editableWeight, unit: 'kg' },
        });
      } else if (extractionResult.extraction.kind === 'workout_log') {
        // Save to workout log
        if (repos.history) {
          const session = {
            id: crypto.randomUUID(),
            owner_id: 'user-active',
            started_at: new Date(Date.now() - 3600000).toISOString(),
            ended_at: new Date().toISOString(),
            exercises: [
              {
                exercise_id: editableExercise.toLowerCase().replace(/\s+/g, '-'),
                exercise_name: editableExercise,
                sets: editableSets.map((s) => ({
                  set_number: s.set_number,
                  reps: s.reps,
                  load_kg: s.load_kg,
                  ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
                })),
              },
            ],
            notes: `Voice logged: "${transcript}"`,
          };
          if ('addSession' in repos) {
            (repos as unknown as { addSession: (s: unknown) => void }).addSession(session);
          }
        }
      } else if (extractionResult.extraction.kind === 'meal_log') {
        const totalCalories = editableMealItems.reduce((acc, i) => acc + i.estimated_calories, 0);
        const currentLogs = await repos.logs.listLogs(1);
        const expectedRev = currentLogs[0]?.revision ?? 0;
        await repos.logs.saveLog(expectedRev, {
          expected_revision: expectedRev,
          local_date: today,
          timezone: 'UTC',
          weight: currentLogs[0]?.weight_kg
            ? { value: currentLogs[0].weight_kg, unit: 'kg' }
            : { value: 70, unit: 'kg' },
          ...(totalCalories > 0 ? { calories: totalCalories } : {}),
        });
      }

      onSaved?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Voice Quick Log"
      description="Speak naturally to record weight, workout sets, or meals. Review and edit before saving."
      size="medium"
    >
      <div
        className="voice-log-modal-content"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        {recognitionError && <Notice variant="info">{recognitionError}</Notice>}

        {/* Audio Capture Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--surface-secondary, #1e2230)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isListening
                  ? 'var(--color-danger, #e53935)'
                  : 'var(--text-muted, #718096)',
                boxShadow: isListening ? '0 0 8px #e53935' : 'none',
              }}
            />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              {isListening ? 'Listening… speak your check-in' : 'Microphone ready'}
            </span>
          </div>

          <Button size="small" variant={isListening ? 'quiet' : 'primary'} onClick={startListening}>
            {isListening ? 'Listening…' : 'Start Recording'}
          </Button>
        </div>

        {/* Spoken Transcript Input */}
        <div>
          <Field
            label="Spoken Transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder='e.g., "Weighed 73.5 kg this morning" or "Bench press 3 sets 8 reps at 80 kg"'
            help="You can edit the transcript or type directly if microphone is unavailable."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Button size="small" variant="quiet" onClick={handleManualParse}>
              Extract Fields
            </Button>
          </div>
        </div>

        {/* Extracted Structured Entity Card */}
        {extractionResult && (
          <div
            className="extracted-preview-card"
            style={{
              padding: '14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Extracted Fields (Editable)</strong>
              <span className="badge" style={{ fontSize: 'var(--text-xs)' }}>
                Confidence: {Math.round(extractionResult.confidence * 100)}%
              </span>
            </div>

            {/* Weight log view */}
            {extractionResult.extraction?.kind === 'weight_log' && (
              <Field
                label="Body Weight (kg)"
                type="number"
                step="0.1"
                value={String(editableWeight)}
                onChange={(e) => setEditableWeight(Number.parseFloat(e.target.value) || 0)}
              />
            )}

            {/* Workout log view */}
            {extractionResult.extraction?.kind === 'workout_log' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Field
                  label="Exercise Name"
                  value={editableExercise}
                  onChange={(e) => setEditableExercise(e.target.value)}
                />

                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Sets & Reps</span>
                {editableSets.map((s, idx) => (
                  <div
                    key={s.set_number}
                    style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', width: '50px' }}>
                      Set {s.set_number}
                    </span>
                    <input
                      type="number"
                      aria-label={`Set ${s.set_number} reps`}
                      placeholder="Reps"
                      value={s.reps}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10) || 0;
                        setEditableSets((prev) =>
                          prev.map((st, i) => (i === idx ? { ...st, reps: val } : st)),
                        );
                      }}
                      style={{ width: '80px', padding: '6px' }}
                    />
                    <input
                      type="number"
                      aria-label={`Set ${s.set_number} load kg`}
                      placeholder="Load kg"
                      value={s.load_kg}
                      onChange={(e) => {
                        const val = Number.parseFloat(e.target.value) || 0;
                        setEditableSets((prev) =>
                          prev.map((st, i) => (i === idx ? { ...st, load_kg: val } : st)),
                        );
                      }}
                      style={{ width: '90px', padding: '6px' }}
                    />
                    {s.rpe !== undefined && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        RPE {s.rpe}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Meal log view */}
            {extractionResult.extraction?.kind === 'meal_log' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Field
                  label="Meal Name"
                  value={editableMealName}
                  onChange={(e) => setEditableMealName(e.target.value)}
                />

                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                  Extracted Food Items
                </span>
                {editableMealItems.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>{item.name}</span>
                    <span>
                      {item.amount}
                      {item.unit}
                    </span>
                    <span className="badge">{item.estimated_calories} kcal</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {item.estimated_protein_g}g P
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ambiguities or null extraction */}
            {!extractionResult.extraction && (
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Could not confidently extract structured fields from this transcript.
                </p>
                {extractionResult.ambiguities.length > 0 && (
                  <ul
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      marginTop: '6px',
                    }}
                  >
                    {extractionResult.ambiguities.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}
        >
          <Button variant="quiet" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmAndSave}
            disabled={!extractionResult?.extraction || isSaving}
            loading={isSaving}
          >
            Confirm & Save to Daily Log
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
