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
  const [_sessions, setSessions] = useState<TrainingSessionRecord[]>([]);
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

  // Progress photos state (P9-04)
  const [photosConsent, setPhotosConsent] = useState(false);
  const [photos, setPhotos] = useState<
    Array<{
      id: string;
      url: string;
      captured_at: string;
      expires_at: string;
      notes?: string | undefined;
    }>
  >([]);
  const [photoToDelete, setPhotoToDelete] = useState<{
    id: string;
    notes?: string | undefined;
  } | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [newPhotoNotes, setNewPhotoNotes] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [p, l, s, consent, phList] = await Promise.all([
        repos.profile.getProfile(),
        repos.logs.listLogs(30),
        repos.history.listSessions(10),
        repos.photos?.getConsent() ?? Promise.resolve(false),
        repos.photos?.listPhotos() ?? Promise.resolve([]),
      ]);
      setProfile(p);
      setLogs(l);
      setSessions(s);
      setPhotosConsent(Boolean(consent));
      setPhotos(phList);
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

  const handleGrantPhotoConsent = async () => {
    await repos.photos?.setConsent(true);
    await loadData();
  };

  const handleWithdrawPhotoConsent = async () => {
    await repos.photos?.setConsent(false);
    await loadData();
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete || !repos.photos) return;
    setIsDeletingPhoto(true);
    try {
      await repos.photos.deletePhoto(photoToDelete.id);
      setPhotoToDelete(null);
      await loadData();
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!repos.photos) return;
    setIsSavingPhoto(true);
    try {
      await repos.photos.savePhoto({
        id: crypto.randomUUID(),
        url: '/design/assets/photos/front-relaxed.svg',
        captured_at: new Date().toISOString(),
        notes: newPhotoNotes || 'Physique check-in',
      });
      setIsAddPhotoOpen(false);
      setNewPhotoNotes('');
      await loadData();
    } finally {
      setIsSavingPhoto(false);
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

      {/* OPTIONAL PROGRESS PHOTOS TIMELINE & COMPARISON (P9-04) */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2>Progress Photos</h2>
            <p
              style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              Optional, private visual timeline. Auto-expires in 30 days. No body-fat scoring.
            </p>
          </div>
          {photosConsent && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="small" variant="primary" onClick={() => setIsAddPhotoOpen(true)}>
                + Add Photo Check-In
              </Button>
              <Button size="small" variant="quiet" onClick={handleWithdrawPhotoConsent}>
                Withdraw Consent & Purge
              </Button>
            </div>
          )}
        </div>

        {!photosConsent ? (
          <div
            style={{
              padding: '16px',
              background: 'var(--surface-secondary, #1e2230)',
              borderRadius: '8px',
              marginTop: '12px',
            }}
          >
            <p style={{ fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>
              Progress photos require explicit, separate consent (purpose <code>photo_storage</code>
              ). Photographs remain local to your account, are strictly deleted after at most 30
              days, and are never used for AI model training or clinical diagnostics.
            </p>
            <Button variant="primary" size="small" onClick={handleGrantPhotoConsent}>
              Grant Photo Storage Consent
            </Button>
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            {photos.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No photos recorded yet. Tap "+ Add Photo Check-In" to log your first progress
                check-in.
              </p>
            ) : (
              <div>
                {/* Timeline / Comparison Cards Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {photos.map((ph, idx) => {
                    const daysRemaining = Math.max(
                      0,
                      Math.ceil((new Date(ph.expires_at).getTime() - Date.now()) / (86400 * 1000)),
                    );
                    return (
                      <div
                        key={ph.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: 'var(--surface)',
                        }}
                      >
                        <div
                          style={{
                            height: '180px',
                            background: 'var(--surface-secondary, #252836)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 'var(--text-sm)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <span
                            role="img"
                            aria-label={`Physique check-in photo taken ${new Date(ph.captured_at).toLocaleDateString()}`}
                          >
                            📷 Check-In #{idx + 1}
                          </span>
                        </div>
                        <div style={{ padding: '12px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <strong style={{ fontSize: 'var(--text-xs)' }}>
                              {new Date(ph.captured_at).toLocaleDateString()}
                            </strong>
                            <span className="badge" style={{ fontSize: '10px' }}>
                              Retained {daysRemaining}d
                            </span>
                          </div>
                          <p
                            style={{
                              margin: '6px 0 10px',
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {ph.notes || 'Physique check-in'}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="quiet"
                              onClick={() => setPhotoToDelete(ph)}
                            >
                              Delete Photo
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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

      {/* ADD PHOTO DIALOG */}
      <Dialog
        isOpen={isAddPhotoOpen}
        onClose={() => setIsAddPhotoOpen(false)}
        title="Add Progress Photo Check-In"
        description="Records an optional private progress photo with a 30-day retention countdown."
        size="small"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field
            label="Photo Check-In Notes"
            value={newPhotoNotes}
            onChange={(e) => setNewPhotoNotes(e.target.value)}
            placeholder="e.g. Week 4 check-in (front relaxed)"
          />
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Photo data is saved privately and will automatically expire in 30 days.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              variant="quiet"
              onClick={() => setIsAddPhotoOpen(false)}
              disabled={isSavingPhoto}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddPhoto} loading={isSavingPhoto}>
              Save Photo Check-In
            </Button>
          </div>
        </div>
      </Dialog>

      {/* DELETE PHOTO DIALOG */}
      <Dialog
        isOpen={Boolean(photoToDelete)}
        onClose={() => setPhotoToDelete(null)}
        title="Delete Progress Photo"
        description="Are you sure you want to delete this photo check-in? It will be immediately purged from local storage."
        size="small"
        role="alertdialog"
      >
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}
        >
          <Button variant="quiet" onClick={() => setPhotoToDelete(null)} disabled={isDeletingPhoto}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleDeletePhoto} loading={isDeletingPhoto}>
            Purge Photo
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
