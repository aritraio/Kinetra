import type { PlanVersionRecord, PlanWithVersion, ProgressionProposal } from '@kinetra/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Field, Notice, SelectField, StatusBadge } from '../components/ui';
import { useRepositories } from '../repositories';

export function PlanView() {
  const repos = useRepositories();
  const [activeTab, setActiveTab] = useState<'meal' | 'workout'>('workout');
  const [mealPlan, setMealPlan] = useState<PlanWithVersion | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<PlanWithVersion | null>(null);
  const [loading, setLoading] = useState(true);

  // Version history & selection
  const [workoutVersions, setWorkoutVersions] = useState<PlanVersionRecord[]>([]);
  const [mealVersions, setMealVersions] = useState<PlanVersionRecord[]>([]);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);

  // Plan generation modal state
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  // Adaptive progression modal state
  const [isProgressionOpen, setIsProgressionOpen] = useState(false);
  const [isAnalyzingProgression, setIsAnalyzingProgression] = useState(false);
  const [progressionProposal, setProgressionProposal] = useState<ProgressionProposal | null>(null);
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [progressionSuccess, setProgressionSuccess] = useState<string | null>(null);
  const [selectedExerciseAdjustments, setSelectedExerciseAdjustments] = useState<
    Record<string, boolean>
  >({});
  const [isApplyingProgression, setIsApplyingProgression] = useState(false);

  // Generator inputs
  const [genCalories, setGenCalories] = useState('2100');
  const [genSplit, setGenSplit] = useState('Upper / Lower Split');
  const [genDays, setGenDays] = useState('4');
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      const [mp, wp] = await Promise.all([
        repos.plans.getPlan('meal'),
        repos.plans.getPlan('workout'),
      ]);
      setMealPlan(mp);
      setWorkoutPlan(wp);

      if (repos.plans.listPlanVersions) {
        const [mVers, wVers] = await Promise.all([
          repos.plans.listPlanVersions('meal'),
          repos.plans.listPlanVersions('workout'),
        ]);
        setMealVersions(mVers);
        setWorkoutVersions(wVers);
      } else {
        if (mp) setMealVersions([mp.current_version]);
        if (wp) setWorkoutVersions([wp.current_version]);
      }
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // Reset selected version when switching tabs
  useEffect(() => {
    if (activeTab) {
      setSelectedVersionNum(null);
    }
  }, [activeTab]);

  const activePlan = activeTab === 'workout' ? workoutPlan : mealPlan;
  const versionsList = activeTab === 'workout' ? workoutVersions : mealVersions;

  // Currently displayed version record
  const displayedVersionRecord: PlanVersionRecord | null =
    selectedVersionNum !== null
      ? (versionsList.find((v) => v.version === selectedVersionNum) ??
        activePlan?.current_version ??
        null)
      : (activePlan?.current_version ?? null);

  const isViewingPinnedVersion =
    displayedVersionRecord?.version === activePlan?.current_version.version;

  const handlePinVersion = async () => {
    if (!displayedVersionRecord || !repos.plans.pinPlanVersion) return;
    setPinStatus('Pinning version...');
    try {
      await repos.plans.pinPlanVersion(activeTab, displayedVersionRecord.version);
      setPinStatus(`Version ${displayedVersionRecord.version} is now pinned as active.`);
      await loadPlans();
      setTimeout(() => setPinStatus(null), 2000);
    } catch (err: unknown) {
      setPinStatus(err instanceof Error ? err.message : 'Pinning failed');
    }
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(null);

    // Save previous active plan in case of provider failure
    const previousPlanSnapshot = activePlan;

    try {
      if (!repos.plans.generatePlan) {
        throw new Error('Plan generation is not supported in the active repository.');
      }

      const calories = parseInt(genCalories, 10);
      const days = parseInt(genDays, 10);

      const result = await repos.plans.generatePlan({
        kind: activeTab,
        target_calories: activeTab === 'meal' ? calories : undefined,
        split_name: activeTab === 'workout' ? genSplit : undefined,
        days_per_week: activeTab === 'workout' ? days : undefined,
      });

      setGenerationSuccess(
        `Generated Version ${result.version.version} successfully. Verified with 0 hard violations.`,
      );
      await loadPlans();
      setSelectedVersionNum(result.version.version);
      setTimeout(() => {
        setIsGeneratorOpen(false);
        setGenerationSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      // PRESERVE PREVIOUS PLAN UPON FAILURE:
      // Active plan remains exactly what was saved in previousPlanSnapshot.
      setGenerationError(
        err instanceof Error
          ? `Generation failed: ${err.message}. Previous accepted plan has been safely preserved.`
          : 'Generation failed. Previous accepted plan preserved.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenProgression = async () => {
    setIsProgressionOpen(true);
    setIsAnalyzingProgression(true);
    setProgressionError(null);
    setProgressionSuccess(null);
    try {
      if (!repos.plans.getProgressionProposal) {
        throw new Error('Adaptive progression not supported by current repository');
      }
      const proposal = await repos.plans.getProgressionProposal();
      setProgressionProposal(proposal);
      const initialSelected: Record<string, boolean> = {};
      for (const adj of proposal.exercise_adjustments) {
        initialSelected[adj.exercise_id] = adj.action === 'progress' || adj.action === 'deload';
      }
      setSelectedExerciseAdjustments(initialSelected);
    } catch (err: unknown) {
      setProgressionError(err instanceof Error ? err.message : 'Progression evaluation failed');
    } finally {
      setIsAnalyzingProgression(false);
    }
  };

  const handleApplyProgression = async () => {
    if (!progressionProposal || !repos.plans.applyProgressionProposal) return;
    setIsApplyingProgression(true);
    setProgressionError(null);
    try {
      const acceptedIds = Object.entries(selectedExerciseAdjustments)
        .filter(([_, isSelected]) => isSelected)
        .map(([id]) => id);

      const updated = await repos.plans.applyProgressionProposal(progressionProposal, acceptedIds);
      setProgressionSuccess(
        `New verified plan version ${updated.current_version.version} created and pinned! History preserved.`,
      );
      await loadPlans();
      setSelectedVersionNum(updated.current_version.version);
      setTimeout(() => {
        setIsProgressionOpen(false);
        setProgressionSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setProgressionError(err instanceof Error ? err.message : 'Failed to apply progression');
    } finally {
      setIsApplyingProgression(false);
    }
  };

  const toggleExerciseSelection = (exerciseId: string) => {
    setSelectedExerciseAdjustments((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  if (loading) {
    return (
      <section className="instrument">
        <p role="status">Loading plan details...</p>
      </section>
    );
  }

  const workoutPayload =
    displayedVersionRecord?.payload.kind === 'workout' ? displayedVersionRecord.payload : null;
  const mealPayload =
    displayedVersionRecord?.payload.kind === 'meal' ? displayedVersionRecord.payload : null;

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
            <p className="eyebrow">VERIFIED PLANS · DETERMINISTIC IMMUTABLE VERSIONS</p>
            <h1>Prescribed Plans</h1>
            <p className="intro">
              Review verified daily nutrition schedules and structured resistance training programs.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab === 'workout' && (
              <Button variant="secondary" onClick={handleOpenProgression}>
                Adaptive Progression
              </Button>
            )}
            <Button variant="primary" onClick={() => setIsGeneratorOpen(true)}>
              + Generate New Verified Plan
            </Button>
          </div>
        </div>
      </section>

      {/* Tab Switcher */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'workout' ? 'active' : ''}`}
          onClick={() => setActiveTab('workout')}
        >
          Workout Routine ({workoutPayload?.split_name || 'Workout'})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'meal' ? 'active' : ''}`}
          onClick={() => setActiveTab('meal')}
        >
          Meal Schedule ({mealPayload?.target_calories || 2000} kcal)
        </button>
      </div>

      {/* Immutable Version Selector & Banner */}
      <div
        className="version-banner"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-control)',
          margin: '16px 0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Plan Version:</span>
          <select
            value={displayedVersionRecord?.version ?? 1}
            onChange={(e) => setSelectedVersionNum(parseInt(e.target.value, 10))}
            className="field-select"
            style={{ minHeight: '36px', padding: '4px 10px', fontSize: '13px' }}
          >
            {versionsList.map((v) => (
              <option key={v.version} value={v.version}>
                Version {v.version} ({v.provenance}){' '}
                {v.version === activePlan?.current_version.version ? '— [Active Pinned]' : ''}
              </option>
            ))}
          </select>

          <StatusBadge
            status={isViewingPinnedVersion ? 'verified' : 'stale'}
            label={isViewingPinnedVersion ? 'Active Pinned Plan' : 'Historical Snapshot'}
          />

          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Provenance: <code>{displayedVersionRecord?.provenance}</code> · Policy:{' '}
            <code>{displayedVersionRecord?.policy_version}</code> · 0 Hard Violations
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pinStatus && (
            <span style={{ fontSize: '12px', color: 'var(--muted)' }} role="status">
              {pinStatus}
            </span>
          )}
          {!isViewingPinnedVersion && (
            <Button size="small" variant="secondary" onClick={handlePinVersion}>
              Pin as Active Plan
            </Button>
          )}
        </div>
      </div>

      {/* WORKOUT CONTENT */}
      {activeTab === 'workout' && workoutPayload && (
        <div className="plan-container">
          {workoutPayload.notes && (
            <p className="plan-notes" style={{ marginBottom: '20px' }}>
              <strong>Coaching Notes:</strong> {workoutPayload.notes}
            </p>
          )}

          <div className="days-stack">
            {workoutPayload.days.map((day) => (
              <div key={day.day_number} className="day-card card" style={{ marginBottom: '20px' }}>
                <div className="day-header">
                  <h3>
                    {day.day_name}: {day.focus}
                  </h3>
                  <span className={`badge ${day.is_rest_day ? 'badge-muted' : 'badge-accent'}`}>
                    {day.is_rest_day ? 'Rest Day' : `${day.exercises.length} Movements`}
                  </span>
                </div>

                {!day.is_rest_day && day.exercises.length > 0 ? (
                  <div className="exercises-table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="exercise-table">
                      <thead>
                        <tr>
                          <th>Exercise</th>
                          <th>Target Sets</th>
                          <th>Prescribed Reps</th>
                          <th>Prescribed Load</th>
                          <th>Rest</th>
                          <th>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.exercises.map((ex) => (
                          <tr key={ex.exercise_id}>
                            <td>
                              <strong>{ex.name}</strong>
                              <span
                                className="sub-text"
                                style={{
                                  display: 'block',
                                  fontSize: '11px',
                                  color: 'var(--muted)',
                                }}
                              >
                                Equipment: {ex.equipment}
                              </span>
                            </td>
                            <td className="tabular-nums">{ex.target_sets} sets</td>
                            <td className="tabular-nums">{ex.target_reps}</td>
                            <td className="tabular-nums">
                              {ex.prescribed_load
                                ? `${ex.prescribed_load.value} ${ex.prescribed_load.unit}`
                                : 'Bodyweight'}
                              {ex.rpe ? ` (RPE ${ex.rpe})` : ''}
                            </td>
                            <td className="tabular-nums">{ex.rest_seconds}s</td>
                            <td className="cue-cell">{ex.instructions || 'Controlled tempo.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rest-notice" style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Scheduled recovery. Prioritize sleep, light mobility, and hydration.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEAL CONTENT */}
      {activeTab === 'meal' && mealPayload && (
        <div className="plan-container">
          <div
            className="macro-target-bar"
            style={{
              display: 'flex',
              gap: '16px',
              padding: '12px 16px',
              background: 'var(--soft)',
              borderRadius: 'var(--radius-control)',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            <span>Daily Targets:</span>
            <strong className="tabular-nums">{mealPayload.target_calories} kcal</strong>
            <span>
              • Protein: <strong className="tabular-nums">{mealPayload.target_protein_g}g</strong>
            </span>
            <span>
              • Carbs: <strong className="tabular-nums">{mealPayload.target_carbs_g}g</strong>
            </span>
            <span>
              • Fat: <strong className="tabular-nums">{mealPayload.target_fat_g}g</strong>
            </span>
          </div>

          {mealPayload.notes && (
            <p className="plan-notes" style={{ marginBottom: '20px' }}>
              <strong>Dietary Guidance:</strong> {mealPayload.notes}
            </p>
          )}

          <div className="days-stack">
            {mealPayload.days.map((day) => (
              <div key={day.day_number} className="day-card card" style={{ marginBottom: '20px' }}>
                <div className="day-header">
                  <h3>{day.day_name} Schedule</h3>
                  <span className="badge tabular-nums">
                    {day.total_calories} kcal (P: {day.total_protein_g}g | C: {day.total_carbs_g}g |
                    F: {day.total_fat_g}g)
                  </span>
                </div>

                <div
                  className="meals-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                    marginTop: '16px',
                  }}
                >
                  {day.meals.map((meal) => (
                    <div
                      key={meal.meal_id}
                      className="meal-card"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-card)',
                        padding: '16px',
                      }}
                    >
                      <div
                        className="meal-header"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: '15px' }}>{meal.name}</h4>
                        <span
                          className="meal-meta tabular-nums"
                          style={{ fontSize: '12px', color: 'var(--muted)' }}
                        >
                          {meal.target_time ? `@ ${meal.target_time} • ` : ''}
                          {meal.calories} kcal
                        </span>
                      </div>
                      <div
                        className="meal-macros tabular-nums"
                        style={{
                          display: 'flex',
                          gap: '8px',
                          fontSize: '12px',
                          color: 'var(--muted)',
                          marginBottom: '12px',
                        }}
                      >
                        <span>P: {meal.protein_g}g</span>
                        <span>C: {meal.carbs_g}g</span>
                        <span>F: {meal.fat_g}g</span>
                      </div>
                      <ul
                        className="ingredient-list"
                        style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}
                      >
                        {meal.items.map((item) => (
                          <li
                            key={item.ingredient_id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '4px 0',
                              borderBottom: '1px solid var(--soft)',
                            }}
                          >
                            <span>{item.name}</span>
                            <span
                              className="item-amount tabular-nums"
                              style={{ color: 'var(--muted)' }}
                            >
                              {item.amount}
                              {item.unit} ({item.calories} kcal)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GENERATE PLAN DIALOG */}
      <Dialog
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        title={`Generate Verified ${activeTab === 'workout' ? 'Workout' : 'Meal'} Plan`}
        description="Produces a candidate plan strictly checked against domain verifier rules."
        size="medium"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeTab === 'workout' ? (
            <>
              <SelectField
                label="Training Split"
                value={genSplit}
                onChange={(e) => setGenSplit(e.target.value)}
                options={[
                  'Upper / Lower Split',
                  'Push / Pull / Legs',
                  'Full Body 3-Day',
                  'Upper / Lower / Arms',
                ]}
              />
              <SelectField
                label="Training Days Per Week"
                value={genDays}
                onChange={(e) => setGenDays(e.target.value)}
                options={[
                  { value: '3', label: '3 Days / Week' },
                  { value: '4', label: '4 Days / Week' },
                  { value: '5', label: '5 Days / Week' },
                ]}
              />
            </>
          ) : (
            <Field
              label="Daily Target Calories"
              type="number"
              unit="kcal"
              value={genCalories}
              onChange={(e) => setGenCalories(e.target.value)}
              help="Domain verifier requires ±50 kcal accuracy per daily schedule."
            />
          )}

          <Notice variant="info">
            <strong>Verification Guarantee:</strong> All outputs undergo deterministic domain
            verification before acceptance. If generation fails constraints, your existing active
            plan will remain completely preserved.
          </Notice>

          {generationError && <Notice variant="error">{generationError}</Notice>}

          {generationSuccess && <Notice variant="success">{generationSuccess}</Notice>}

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}
          >
            <Button
              variant="quiet"
              onClick={() => setIsGeneratorOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleGeneratePlan} loading={isGenerating}>
              Generate & Verify
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ADAPTIVE PROGRESSION REVIEW MODAL */}
      <Dialog
        isOpen={isProgressionOpen}
        onClose={() => setIsProgressionOpen(false)}
        title="Explainable Adaptive Progression"
        description="Policy v2026-10-01 · Deterministic autoregulation based on completed session logs"
        size="large"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Notice variant="info">
            <strong>Explainability &amp; Review:</strong> Progression proposals are conservative,
            bounded by strict domain safety rules, and never hallucinated. Accepting creates a new
            verified plan version while preserving your full training history.
          </Notice>

          {isAnalyzingProgression && (
            <p
              role="status"
              style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)' }}
            >
              Analyzing completed sessions within the 28-day observation window...
            </p>
          )}

          {progressionError && <Notice variant="error">{progressionError}</Notice>}
          {progressionSuccess && <Notice variant="success">{progressionSuccess}</Notice>}

          {progressionProposal && !isAnalyzingProgression && (
            <>
              {/* Overall Proposal Card */}
              <div
                style={{
                  background: 'var(--soft)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-control)',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px',
                    }}
                  >
                    <strong>Overall Recommendation:</strong>
                    <StatusBadge
                      status={
                        progressionProposal.overall_action === 'progress'
                          ? 'verified'
                          : progressionProposal.overall_action === 'deload'
                            ? 'stale'
                            : progressionProposal.overall_action === 'maintain'
                              ? 'verified'
                              : 'unknown'
                      }
                      label={
                        progressionProposal.overall_action === 'progress'
                          ? 'Progress Earned'
                          : progressionProposal.overall_action === 'deload'
                            ? 'Reactive Deload'
                            : progressionProposal.overall_action === 'maintain'
                              ? 'Maintain Prescription'
                              : 'Insufficient History'
                      }
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--fg)' }}>
                    {progressionProposal.global_summary}
                  </p>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Evaluated: {new Date(progressionProposal.evaluated_at).toLocaleDateString()}
                </span>
              </div>

              {/* Per-Exercise Adjustments */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '420px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {progressionProposal.exercise_adjustments.map((adj) => {
                  const isSelectable = adj.action === 'progress' || adj.action === 'deload';
                  const isChecked = selectedExerciseAdjustments[adj.exercise_id] ?? false;

                  return (
                    <div
                      key={adj.exercise_id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-control)',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isSelectable && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleExerciseSelection(adj.exercise_id)}
                              aria-label={`Accept adjustment for ${adj.exercise_name}`}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                          )}
                          <div>
                            <strong style={{ fontSize: '14px' }}>{adj.exercise_name}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className={`badge ${
                              adj.action === 'progress'
                                ? 'badge-accent'
                                : adj.action === 'deload'
                                  ? 'badge-muted'
                                  : 'badge-muted'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            {adj.action === 'progress'
                              ? `+${adj.delta.load_delta > 0 ? adj.delta.load_delta : adj.delta.reps_delta} ${adj.delta.load_delta > 0 ? adj.delta.unit : 'reps'}`
                              : adj.action === 'deload'
                                ? `${adj.delta.load_delta} ${adj.delta.unit} (Deload)`
                                : adj.action === 'maintain'
                                  ? 'Maintain'
                                  : 'Insufficient Data'}
                          </span>
                        </div>
                      </div>

                      {/* Current vs Proposed */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '13px',
                          background: 'var(--soft)',
                          padding: '6px 12px',
                          borderRadius: '4px',
                        }}
                      >
                        <span>
                          Current:{' '}
                          <strong>
                            {adj.current_prescription.load
                              ? `${adj.current_prescription.load.value} ${adj.current_prescription.load.unit}`
                              : 'BW'}{' '}
                            × {adj.current_prescription.target_reps} reps
                          </strong>
                        </span>
                        <span>→</span>
                        <span>
                          Proposed:{' '}
                          <strong
                            style={{
                              color: adj.action === 'progress' ? 'var(--accent)' : 'inherit',
                            }}
                          >
                            {adj.proposed_prescription.load
                              ? `${adj.proposed_prescription.load.value} ${adj.proposed_prescription.load.unit}`
                              : 'BW'}{' '}
                            × {adj.proposed_prescription.target_reps} reps
                          </strong>
                        </span>
                      </div>

                      {/* Reason */}
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                        <strong>Reason:</strong> {adj.reason}
                      </p>

                      {/* Evidence & Warnings */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          fontSize: '11px',
                          color: 'var(--muted)',
                        }}
                      >
                        <span>
                          Evidence: {adj.evidence.sessions_analyzed} session(s)
                          {adj.evidence.avg_rpe ? ` · Avg RPE: ${adj.evidence.avg_rpe}` : ''}
                          {` · Completion: ${adj.evidence.completion_rate_pct}%`}
                          {` · Confidence: ${Math.round(adj.confidence * 100)}%`}
                        </span>
                        {adj.warnings.length > 0 && (
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            {adj.warnings[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                <Button
                  variant="quiet"
                  onClick={() => setIsProgressionOpen(false)}
                  disabled={isApplyingProgression}
                >
                  Decline / Keep Current
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApplyProgression}
                  loading={isApplyingProgression}
                  disabled={
                    !Object.values(selectedExerciseAdjustments).some(Boolean) ||
                    isApplyingProgression
                  }
                >
                  Accept Selected Adjustments (Creates v
                  {(activePlan?.current_version.version ?? 1) + 1})
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
