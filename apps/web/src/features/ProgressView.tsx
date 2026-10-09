import type { LogRecord, ProfileRecord, TrainingSessionRecord } from '@kinetra/contracts';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button, ChartSummary, Dialog, Field, Notice } from '../components/ui';
import { useRepositories } from '../repositories';

const LOG_DRAFT_KEY = 'kinetra_log_draft';

interface LogFormState {
  date: string;
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  notes: string;
  expectedRevision: number;
  isEditing: boolean;
}

const EMPTY_LOG_FORM: LogFormState = {
  date: new Date().toISOString().slice(0, 10),
  weight: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  water: '',
  notes: '',
  expectedRevision: 0,
  isEditing: false,
};

export function ProgressView() {
  const repos = useRepositories();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [sessions, setSessions] = useState<TrainingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal & draft state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<LogFormState>(EMPTY_LOG_FORM);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation dialog
  const [logToDelete, setLogToDelete] = useState<LogRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Revision conflict state
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [p, l, s] = await Promise.all([
        repos.profile.getProfile(),
        repos.logs.listLogs(30),
        repos.history.listSessions(10),
      ]);
      setProfile(p);
      setLogs(l);
      setSessions(s);
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    void loadData();

    // Check for unsaved log draft in sessionStorage
    try {
      const saved = sessionStorage.getItem(LOG_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.weight === 'string') {
          setFormState(parsed);
          setHasRestoredDraft(true);
        }
      }
    } catch {
      // Ignore
    }
  }, [loadData]);

  const updateFormState = (updates: Partial<LogFormState>) => {
    setFormState((prev) => {
      const next = { ...prev, ...updates };
      try {
        sessionStorage.setItem(LOG_DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
    setFormError(null);
  };

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(LOG_DRAFT_KEY);
    } catch {
      // Ignore
    }
    setFormState(EMPTY_LOG_FORM);
    setHasRestoredDraft(false);
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = logs.find((l) => l.local_date === today);

    if (existing) {
      handleOpenEdit(existing);
      return;
    }

    const initial = {
      ...EMPTY_LOG_FORM,
      date: today,
      expectedRevision: 0,
      isEditing: false,
    };
    setFormState(initial);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (log: LogRecord) => {
    const weightVal =
      profile?.units === 'imperial'
        ? (log.weight_kg * 2.20462).toFixed(1)
        : log.weight_kg.toFixed(1);

    const editState: LogFormState = {
      date: log.local_date,
      weight: weightVal,
      calories: log.calories?.toString() ?? '',
      protein: log.protein_g?.toString() ?? '',
      carbs: log.carbs_g?.toString() ?? '',
      fat: log.fat_g?.toString() ?? '',
      water: log.water_ml?.toString() ?? '',
      notes: log.notes ?? '',
      expectedRevision: log.revision,
      isEditing: true,
    };
    setFormState(editState);
    setIsFormOpen(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setFormError(null);
    setConflictNotice(null);

    try {
      const numericWeight = parseFloat(formState.weight);
      if (Number.isNaN(numericWeight) || numericWeight <= 0) {
        setFormError('Please enter a valid weight.');
        setIsSaving(false);
        return;
      }

      await repos.logs.saveLog(formState.expectedRevision, {
        expected_revision: formState.expectedRevision,
        local_date: formState.date,
        timezone: profile.timezone,
        weight: {
          value: numericWeight,
          unit: profile.units === 'imperial' ? 'lb' : 'kg',
        },
        calories: formState.calories ? parseInt(formState.calories, 10) : undefined,
        protein_g: formState.protein ? parseInt(formState.protein, 10) : undefined,
        carbs_g: formState.carbs ? parseInt(formState.carbs, 10) : undefined,
        fat_g: formState.fat ? parseInt(formState.fat, 10) : undefined,
        water_ml: formState.water ? parseInt(formState.water, 10) : undefined,
        notes: formState.notes || undefined,
      });

      clearDraft();
      setIsFormOpen(false);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      if (message.includes('Revision conflict')) {
        setConflictNotice(
          'Revision conflict: This entry was updated on another session. Re-fetch data and verify changes.',
        );
      }
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!logToDelete) return;
    setIsDeleting(true);
    try {
      if (repos.logs.deleteLog) {
        await repos.logs.deleteLog(logToDelete.local_date);
      }
      setLogToDelete(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <section className="instrument">
        <p role="status">Loading progress trends...</p>
      </section>
    );
  }

  // Logs ordered ascending for trend calculations
  const chronological = logs.slice().sort((a, b) => a.local_date.localeCompare(b.local_date));
  const startLog = chronological[0];
  const latestLog = chronological[chronological.length - 1];

  const unit = profile?.units === 'imperial' ? 'lb' : 'kg';
  const formatWeight = (kg: number) =>
    profile?.units === 'imperial' ? (kg * 2.20462).toFixed(1) : kg.toFixed(1);

  const startWeight = startLog ? formatWeight(startLog.weight_kg) : '—';
  const currentWeight = latestLog ? formatWeight(latestLog.weight_kg) : '—';
  const deltaKg = startLog && latestLog ? latestLog.weight_kg - startLog.weight_kg : 0;
  const deltaDisplay =
    profile?.units === 'imperial' ? (deltaKg * 2.20462).toFixed(1) : deltaKg.toFixed(1);

  // Moving average (7-day window)
  const recent7 = chronological.slice(-7);
  const avg7 =
    recent7.length > 0
      ? (recent7.reduce((sum, l) => sum + l.weight_kg, 0) / recent7.length).toFixed(1)
      : '—';
  const avg7Display =
    profile?.units === 'imperial' && avg7 !== '—' ? (parseFloat(avg7) * 2.20462).toFixed(1) : avg7;

  // Chart data points
  const weightChartData = chronological.map((l) => ({
    label: l.local_date.slice(5),
    value: Number(formatWeight(l.weight_kg)),
    formattedValue: formatWeight(l.weight_kg),
    date: l.local_date,
  }));

  const calorieChartData = chronological
    .filter((l) => l.calories !== undefined)
    .map((l) => ({
      label: l.local_date.slice(5),
      value: l.calories ?? 0,
      formattedValue: `${l.calories} kcal`,
      date: l.local_date,
    }));

  return (
    <div className="feature-view">
      <section className="hero-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <p className="eyebrow">HISTORICAL TRENDS · 14-DAY FIDELITY CHECK</p>
            <h1>Progress & Daily Logs</h1>
            <p className="intro">
              Review weight trend telemetry, daily nutritional consistency, and logged resistance
              training sessions.
            </p>
          </div>

          <Button variant="primary" onClick={handleOpenCreate}>
            + Record Daily Log
          </Button>
        </div>
      </section>

      {/* Unsaved Draft Restoration Banner */}
      {hasRestoredDraft && (
        <div className="draft-notice-banner" role="status">
          <span>Unsaved log entry draft restored from previous session.</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="small" variant="secondary" onClick={() => setIsFormOpen(true)}>
              Resume Editing
            </Button>
            <Button size="small" variant="quiet" onClick={clearDraft}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Conflict Notice */}
      {conflictNotice && (
        <Notice variant="error" style={{ marginBottom: '20px' }}>
          {conflictNotice}
        </Notice>
      )}

      {/* KPI Cards & Milestone Summaries */}
      <div className="stat-cards-grid">
        <div className="stat-card card">
          <span className="stat-label">Baseline Weight (Day 1)</span>
          <span className="stat-value tabular-nums">
            {startWeight} {unit}
          </span>
          <span className="stat-sub">{startLog?.local_date}</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">Current Weight (Latest)</span>
          <span className="stat-value tabular-nums">
            {currentWeight} {unit}
          </span>
          <span className="stat-sub">{latestLog?.local_date}</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">7-Day Moving Avg</span>
          <span className="stat-value tabular-nums">
            {avg7Display} {unit}
          </span>
          <span className="stat-sub">Rolling smooth trend</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">Net Trend Delta</span>
          <span
            className={`stat-value tabular-nums ${deltaKg < 0 ? 'text-trend-down' : 'text-trend-up'}`}
          >
            {deltaKg > 0 ? '+' : ''}
            {deltaDisplay} {unit}
          </span>
          <span className="stat-sub">Goal: {profile?.goal.toUpperCase()}</span>
        </div>
      </div>

      {/* ACCESSIBLE VISUAL CHARTS (P5-01 & P5-06) */}
      <ChartSummary
        title="Body Weight Progression"
        description="Daily body weight telemetry with moving average and accessible data table."
        unit={unit}
        data={weightChartData}
      />

      {calorieChartData.length > 0 && (
        <ChartSummary
          title="Daily Caloric Intake Adherence"
          description="Logged daily energy intake against targeted nutrition schedule."
          unit="kcal"
          data={calorieChartData}
          targetValue={2000}
        />
      )}

      {/* BOUNDED HISTORY LIST & CRUD CONTROLS */}
      <section
        className="instrument card"
        style={{ marginTop: '28px' }}
        aria-labelledby="history-heading"
      >
        <div className="card-header">
          <h2 id="history-heading">Daily Logs Telemetry</h2>
          <span className="badge">
            {logs.length} Recorded Entries · Create / Edit / Delete Enabled
          </span>
        </div>
        <div className="card-content">
          <div style={{ overflowX: 'auto' }}>
            <table className="chart-data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Weight ({unit})</th>
                  <th scope="col">Calories</th>
                  <th scope="col">Water (mL)</th>
                  <th scope="col">Notes</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong>{log.local_date}</strong>
                    </td>
                    <td className="tabular-nums">{formatWeight(log.weight_kg)}</td>
                    <td className="tabular-nums">{log.calories ? `${log.calories} kcal` : '—'}</td>
                    <td className="tabular-nums">{log.water_ml ? `${log.water_ml}` : '—'}</td>
                    <td
                      style={{
                        maxWidth: '240px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {log.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <Button size="small" variant="quiet" onClick={() => handleOpenEdit(log)}>
                          Edit
                        </Button>
                        <Button size="small" variant="quiet" onClick={() => setLogToDelete(log)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CREATE / EDIT DAILY LOG MODAL */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formState.isEditing ? `Edit Log: ${formState.date}` : 'Record Daily Log'}
        description="Preserve daily biometrics, caloric nutrition, and hydration metrics."
        size="medium"
      >
        <form onSubmit={handleSaveLog}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field
              label="Date (YYYY-MM-DD)"
              type="date"
              value={formState.date}
              onChange={(e) => updateFormState({ date: e.target.value })}
              required
            />

            <Field
              label={`Body Weight (${unit})`}
              type="number"
              step="0.1"
              value={formState.weight}
              onChange={(e) => updateFormState({ weight: e.target.value })}
              required
            />

            <div className="input-row">
              <Field
                label="Calories Consumed (kcal)"
                type="number"
                value={formState.calories}
                onChange={(e) => updateFormState({ calories: e.target.value })}
              />

              <Field
                label="Water Intake (mL)"
                type="number"
                value={formState.water}
                onChange={(e) => updateFormState({ water: e.target.value })}
              />
            </div>

            <div className="input-row">
              <Field
                label="Protein (g)"
                type="number"
                value={formState.protein}
                onChange={(e) => updateFormState({ protein: e.target.value })}
              />

              <Field
                label="Carbs (g)"
                type="number"
                value={formState.carbs}
                onChange={(e) => updateFormState({ carbs: e.target.value })}
              />

              <Field
                label="Fat (g)"
                type="number"
                value={formState.fat}
                onChange={(e) => updateFormState({ fat: e.target.value })}
              />
            </div>

            <Field
              label="Session Notes / Reflection"
              value={formState.notes}
              onChange={(e) => updateFormState({ notes: e.target.value })}
              placeholder="e.g. Completed heavy bench press; felt high energy."
            />

            {formError && <Notice variant="error">{formError}</Notice>}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '12px',
              }}
            >
              <Button variant="quiet" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={isSaving}>
                {formState.isEditing ? 'Save Changes' : 'Record Entry'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        isOpen={Boolean(logToDelete)}
        onClose={() => setLogToDelete(null)}
        title="Confirm Log Deletion"
        description={`Are you sure you want to delete the daily log for ${logToDelete?.local_date}? This action cannot be undone.`}
        size="small"
        role="alertdialog"
      >
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}
        >
          <Button variant="quiet" onClick={() => setLogToDelete(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleDeleteLog} loading={isDeleting}>
            Delete Log
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
