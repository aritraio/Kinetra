import type { LogRecord, PlanWithVersion, ProfileRecord } from '@kinetra/contracts';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Notice, StatusBadge } from '../components/ui';
import { useRepositories } from '../repositories';
import { checkMissedReminders, type MissedReminder } from './reminders';

export function TodayView({ onNavigateToPlan }: { onNavigateToPlan: () => void }) {
  const repos = useRepositories();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<PlanWithVersion | null>(null);
  const [mealPlan, setMealPlan] = useState<PlanWithVersion | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick log states
  const [inputWeight, setInputWeight] = useState('');
  const [inputCalories, setInputCalories] = useState('');
  const [inputWater, setInputWater] = useState('');
  const [logStatus, setLogStatus] = useState<string | null>(null);

  // Sync status
  const [lastSynced, setLastSynced] = useState<string>('Just now');
  const [isSyncing, setIsSyncing] = useState(false);

  // Missed reminders state
  const [missedReminders, setMissedReminders] = useState<MissedReminder[]>([]);

  const loadData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [p, l, wp, mp] = await Promise.all([
        repos.profile.getProfile(),
        repos.logs.listLogs(14),
        repos.plans.getPlan('workout'),
        repos.plans.getPlan('meal'),
      ]);
      setProfile(p);
      setLogs(l);
      setWorkoutPlan(wp);
      setMealPlan(mp);

      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLog = l.find((log) => log.local_date === todayStr);

      if (todayLog) {
        setInputWeight(
          p?.units === 'imperial'
            ? (todayLog.weight_kg * 2.20462).toFixed(1)
            : todayLog.weight_kg.toFixed(1),
        );
        if (todayLog.calories) setInputCalories(todayLog.calories.toString());
        if (todayLog.water_ml) setInputWater(todayLog.water_ml.toString());
      } else {
        const latest = l[0];
        if (latest) {
          setInputWeight(
            p?.units === 'imperial'
              ? (latest.weight_kg * 2.20462).toFixed(1)
              : latest.weight_kg.toFixed(1),
          );
        }
      }

      setLastSynced(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [repos]);

  useEffect(() => {
    void loadData();

    // Check missed reminders on mount and visibility change
    const checkReminders = () => {
      const { missed } = checkMissedReminders();
      if (missed.length > 0) {
        setMissedReminders(missed);
      }
    };

    checkReminders();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkReminders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData]);

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLogStatus('Saving...');
    try {
      const numericWeight = parseFloat(inputWeight);
      if (Number.isNaN(numericWeight) || numericWeight <= 0) {
        setLogStatus('Enter a valid weight number');
        return;
      }
      const todayDate = new Date().toISOString().slice(0, 10);
      const calories = inputCalories ? parseInt(inputCalories, 10) : undefined;
      const water_ml = inputWater ? parseInt(inputWater, 10) : undefined;

      const todayExisting = logs.find((l) => l.local_date === todayDate);

      await repos.logs.saveLog(todayExisting?.revision ?? 0, {
        expected_revision: todayExisting?.revision ?? 0,
        local_date: todayDate,
        timezone: profile.timezone,
        weight: {
          value: numericWeight,
          unit: profile.units === 'imperial' ? 'lb' : 'kg',
        },
        calories,
        water_ml,
      });

      setLogStatus('Log recorded successfully.');
      await loadData();
    } catch (err: unknown) {
      setLogStatus(err instanceof Error ? err.message : 'Save failed');
    }
  };

  if (loading) {
    return (
      <section className="instrument">
        <p role="status">Loading today overview...</p>
      </section>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.local_date === todayStr);

  const workoutPayload =
    workoutPlan?.current_version.payload.kind === 'workout'
      ? workoutPlan.current_version.payload
      : null;
  const mealPayload =
    mealPlan?.current_version.payload.kind === 'meal' ? mealPlan.current_version.payload : null;

  const todayWorkoutDay = workoutPayload?.days[0];
  const targetCalories = mealPayload?.target_calories ?? 2000;
  const loggedCalories = todayLog?.calories ?? 0;
  const caloriePercent = Math.min(100, Math.round((loggedCalories / targetCalories) * 100));

  const hasLoggedWeightToday = Boolean(todayLog);
  const hasLoggedCaloriesToday = Boolean(todayLog?.calories);
  const isWorkoutCompleted = Boolean(todayLog?.notes?.includes('Workout completed'));

  // Calculate Single Clear Next Action
  let nextActionTag = 'PRIORITY ACTION';
  let nextActionTitle = 'Record Morning Weight';
  let nextActionDesc =
    'Log your morning weight on an empty stomach to maintain rolling trend accuracy.';
  let nextActionType: 'weight' | 'workout' | 'nutrition' | 'complete' = 'weight';

  if (!hasLoggedWeightToday) {
    nextActionTag = 'PRIORITY ACTION';
    nextActionTitle = 'Record Morning Weigh-in';
    nextActionDesc = 'Daily weigh-in provides the baseline for weekly moving average computations.';
    nextActionType = 'weight';
  } else if (todayWorkoutDay && !todayWorkoutDay.is_rest_day && !isWorkoutCompleted) {
    nextActionTag = 'TRAINING ACTION';
    nextActionTitle = `Complete ${todayWorkoutDay.focus}`;
    nextActionDesc = `Prescribed ${todayWorkoutDay.exercises.length} structured movements in your verified program.`;
    nextActionType = 'workout';
  } else if (!hasLoggedCaloriesToday) {
    nextActionTag = 'NUTRITION ACTION';
    nextActionTitle = 'Record Daily Calorie Intake';
    nextActionDesc = `Target: ${targetCalories} kcal with prescribed macronutrient distribution.`;
    nextActionType = 'nutrition';
  } else {
    nextActionTag = 'ALL ACTIONS COMPLETED';
    nextActionTitle = 'All Daily Actions Recorded';
    nextActionDesc = 'Weight, training focus, and daily nutrition targets are logged for today.';
    nextActionType = 'complete';
  }

  const unitWeight = profile?.units === 'imperial' ? 'lb' : 'kg';
  const formatWeightVal = (kg: number) =>
    profile?.units === 'imperial' ? (kg * 2.20462).toFixed(1) : kg.toFixed(1);

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
            <p className="eyebrow">
              {profile?.display_name || 'Active Persona'} · {profile?.goal.toUpperCase()} PHASE
            </p>
            <h1>Today’s Briefing</h1>
            <p className="intro">
              Review your primary next action, current verified plan summary, and daily logging
              status.
            </p>
          </div>

          {/* Visible Connectivity & Sync Status */}
          <div
            className="sync-status-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                {repos.isDemo ? '● Isolated Demo Mode' : '● Online & Connected'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Last synced: {lastSynced}
              </span>
            </div>
            <Button
              size="small"
              variant="quiet"
              onClick={() => void loadData()}
              loading={isSyncing}
            >
              Sync
            </Button>
          </div>
        </div>
      </section>

      {/* Missed Reminder Banner if user returned after scheduled time */}
      {missedReminders.length > 0 && missedReminders[0] && (
        <div className="missed-reminder-banner" role="alert">
          <div>
            <span className="badge badge-accent" style={{ marginBottom: '4px' }}>
              MISSED SCHEDULED WINDOW
            </span>
            <h3 style={{ margin: '4px 0', fontSize: '16px' }}>
              {missedReminders[0].title} ({missedReminders[0].scheduledTime})
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              {missedReminders[0].action}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="small" variant="quiet" onClick={() => setMissedReminders([])}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* ONE CLEAR NEXT ACTION CARD */}
      <section className="next-action-card" aria-labelledby="next-action-title">
        <div className="next-action-content">
          <span className="next-action-tag">{nextActionTag}</span>
          <h2 id="next-action-title" className="next-action-title">
            {nextActionTitle}
          </h2>
          <p className="next-action-desc">{nextActionDesc}</p>
        </div>
        <div className="next-action-cta">
          {nextActionType === 'workout' && (
            <Button variant="primary" onClick={onNavigateToPlan}>
              View Routine
            </Button>
          )}
          {nextActionType === 'weight' && (
            <Button
              variant="primary"
              onClick={() => {
                const el = document.getElementById('today-weight-input');
                el?.focus();
              }}
            >
              Record Weight
            </Button>
          )}
          {nextActionType === 'nutrition' && (
            <Button
              variant="primary"
              onClick={() => {
                const el = document.getElementById('today-calories-input');
                el?.focus();
              }}
            >
              Log Calories
            </Button>
          )}
          {nextActionType === 'complete' && <StatusBadge status="verified" label="All Done" />}
        </div>
      </section>

      {/* TODAY'S LOGGING STATUS (DISTINGUISHING RECOMMENDATION VS COMPLETED WORK) */}
      <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '28px 0 16px' }}>
        Today’s Logging Status
      </h3>
      <div className="logging-status-grid">
        {/* Weight Status */}
        <div className={`log-status-card ${hasLoggedWeightToday ? 'recorded' : 'pending'}`}>
          {hasLoggedWeightToday ? (
            <span className="log-status-badge-recorded">✓ RECORDED</span>
          ) : (
            <span className="log-status-badge-pending">PENDING ENTRY</span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Morning Body Weight
          </span>
          <span
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}
            className="tabular-nums"
          >
            {hasLoggedWeightToday
              ? `${formatWeightVal(todayLog!.weight_kg)} ${unitWeight}`
              : 'Not logged today'}
          </span>
        </div>

        {/* Nutrition Status */}
        <div className={`log-status-card ${hasLoggedCaloriesToday ? 'recorded' : 'pending'}`}>
          {hasLoggedCaloriesToday ? (
            <span className="log-status-badge-recorded">✓ RECORDED</span>
          ) : (
            <span className="log-status-badge-pending">RECOMMENDED TARGET</span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Daily Nutrition
          </span>
          <span
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}
            className="tabular-nums"
          >
            {hasLoggedCaloriesToday
              ? `${loggedCalories} / ${targetCalories} kcal`
              : `${targetCalories} kcal target`}
          </span>
        </div>

        {/* Workout Status */}
        <div className={`log-status-card ${isWorkoutCompleted ? 'recorded' : 'pending'}`}>
          {isWorkoutCompleted ? (
            <span className="log-status-badge-recorded">✓ COMPLETED</span>
          ) : todayWorkoutDay?.is_rest_day ? (
            <span className="log-status-badge-recorded">REST DAY</span>
          ) : (
            <span className="log-status-badge-pending">RECOMMENDED WORKOUT</span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Daily Resistance Training
          </span>
          <span
            style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}
          >
            {todayWorkoutDay ? todayWorkoutDay.focus : 'Rest & Recovery'}
          </span>
        </div>

        {/* Water Status */}
        <div className={`log-status-card ${todayLog?.water_ml ? 'recorded' : 'pending'}`}>
          {todayLog?.water_ml ? (
            <span className="log-status-badge-recorded">✓ RECORDED</span>
          ) : (
            <span className="log-status-badge-pending">RECOMMENDED TARGET</span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Hydration
          </span>
          <span
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}
            className="tabular-nums"
          >
            {todayLog?.water_ml ? `${todayLog.water_ml} mL` : '2,500 mL target'}
          </span>
        </div>
      </div>

      {/* PLAN SUMMARY CARDS */}
      <div className="card-grid" style={{ marginTop: '24px' }}>
        {/* Workout Summary */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Current Program: {workoutPayload?.split_name ?? 'Training Split'}</h2>
            <span className="badge badge-accent">
              {todayWorkoutDay?.is_rest_day ? 'Active Recovery' : 'Day 1'}
            </span>
          </div>
          <div className="card-content">
            {todayWorkoutDay && !todayWorkoutDay.is_rest_day ? (
              <>
                <p className="workout-headline">
                  <strong>Focus:</strong> {todayWorkoutDay.focus} (
                  {todayWorkoutDay.exercises.length} movements)
                </p>
                <ul className="action-list" style={{ margin: '12px 0 16px', paddingLeft: '18px' }}>
                  {todayWorkoutDay.exercises.slice(0, 3).map((ex) => (
                    <li key={ex.exercise_id} style={{ marginBottom: '6px' }}>
                      <strong>{ex.name}</strong>: {ex.target_sets} sets × {ex.target_reps}
                      {ex.prescribed_load
                        ? ` @ ${ex.prescribed_load.value}${ex.prescribed_load.unit}`
                        : ''}
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" onClick={onNavigateToPlan}>
                  View Full Routine & Prescriptions
                </Button>
              </>
            ) : (
              <p>Scheduled rest day. Prioritize hydration, sleep, and joint mobility.</p>
            )}
          </div>
        </section>

        {/* Nutrition Target Summary */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Prescribed Nutrition Targets</h2>
            <span className="badge">
              {loggedCalories} / {targetCalories} kcal ({caloriePercent}%)
            </span>
          </div>
          <div className="card-content">
            <div className="meter-container" style={{ margin: '8px 0 16px' }}>
              <div className="meter-bar" style={{ width: `${caloriePercent}%` }} />
            </div>

            <div className="macro-row">
              <div className="macro-pill">
                <span className="macro-label">Protein</span>
                <span className="macro-value">{mealPayload?.target_protein_g ?? 140}g</span>
                <span className="macro-target">Recommended</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Carbs</span>
                <span className="macro-value">{mealPayload?.target_carbs_g ?? 200}g</span>
                <span className="macro-target">Recommended</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Fat</span>
                <span className="macro-value">{mealPayload?.target_fat_g ?? 60}g</span>
                <span className="macro-target">Recommended</span>
              </div>
            </div>

            <p className="disclaimer-note" style={{ marginTop: '16px' }}>
              Derived from Mifflin-St Jeor metabolic baseline with declared {profile?.goal} energy
              targets.
            </p>
          </div>
        </section>

        {/* Quick Log Form */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Record Today’s Metrics</h2>
            <span className="badge badge-muted">Date: {todayStr}</span>
          </div>
          <form onSubmit={handleQuickLog} className="card-content">
            <div className="input-row">
              <label>
                Body Weight ({unitWeight})
                <input
                  id="today-weight-input"
                  type="number"
                  step="0.1"
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  className="field-input tabular-nums"
                  required
                />
              </label>

              <label>
                Total Calories (kcal)
                <input
                  id="today-calories-input"
                  type="number"
                  placeholder={targetCalories.toString()}
                  value={inputCalories}
                  onChange={(e) => setInputCalories(e.target.value)}
                  className="field-input tabular-nums"
                />
              </label>

              <label>
                Water (mL)
                <input
                  type="number"
                  placeholder="2500"
                  value={inputWater}
                  onChange={(e) => setInputWater(e.target.value)}
                  className="field-input tabular-nums"
                />
              </label>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button type="submit" variant="primary">
                Save Today’s Log
              </Button>
              {logStatus && (
                <span role="status" style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {logStatus}
                </span>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
