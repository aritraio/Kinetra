import type { LogRecord, PlanWithVersion, ProfileRecord } from '@kinetra/contracts';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRepositories } from '../repositories';

export function TodayView({ onNavigateToPlan }: { onNavigateToPlan: () => void }) {
  const repos = useRepositories();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<PlanWithVersion | null>(null);
  const [mealPlan, setMealPlan] = useState<PlanWithVersion | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick log state
  const [inputWeight, setInputWeight] = useState('');
  const [inputCalories, setInputCalories] = useState('');
  const [logStatus, setLogStatus] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
      const firstLog = l[0];
      if (firstLog) {
        setInputWeight(
          p?.units === 'imperial'
            ? (firstLog.weight_kg * 2.20462).toFixed(1)
            : firstLog.weight_kg.toFixed(1),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    void loadData();
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

      await repos.logs.saveLog(0, {
        expected_revision: 0,
        local_date: todayDate,
        timezone: profile.timezone,
        weight: {
          value: numericWeight,
          unit: profile.units === 'imperial' ? 'lb' : 'kg',
        },
        calories,
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

  const latestLog = logs[0];
  const workoutPayload =
    workoutPlan?.current_version.payload.kind === 'workout'
      ? workoutPlan.current_version.payload
      : null;
  const mealPayload =
    mealPlan?.current_version.payload.kind === 'meal' ? mealPlan.current_version.payload : null;

  const todayWorkoutDay = workoutPayload?.days[0];

  const targetCalories = mealPayload?.target_calories ?? 2000;
  const loggedCalories = latestLog?.calories ?? targetCalories;
  const caloriePercent = Math.min(100, Math.round((loggedCalories / targetCalories) * 100));

  const targetProtein = mealPayload?.target_protein_g ?? 150;
  const loggedProtein = latestLog?.protein_g ?? targetProtein;

  const targetCarbs = mealPayload?.target_carbs_g ?? 200;
  const loggedCarbs = latestLog?.carbs_g ?? targetCarbs;

  const targetFat = mealPayload?.target_fat_g ?? 60;
  const loggedFat = latestLog?.fat_g ?? targetFat;

  return (
    <div className="feature-view">
      <section className="hero-section">
        <p className="eyebrow">
          {profile?.display_name || 'Synthetic Demo Persona'} · {profile?.goal.toUpperCase()} PHASE
        </p>
        <h1>Today’s Briefing</h1>
        <p className="intro">
          Review your next priority action, target nutritional intake, and log your progress.
          Deterministic synthetic demo active.
        </p>
      </section>

      <div className="card-grid">
        {/* Next Workout Action */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Next Action: Planned Training</h2>
            <span className="badge badge-accent">
              {todayWorkoutDay ? todayWorkoutDay.focus : 'Active Rest'}
            </span>
          </div>
          {todayWorkoutDay && !todayWorkoutDay.is_rest_day ? (
            <div className="card-content">
              <p className="workout-headline">
                {todayWorkoutDay.day_name}: {todayWorkoutDay.focus}
              </p>
              <ul className="action-list">
                {todayWorkoutDay.exercises.slice(0, 3).map((ex) => (
                  <li key={ex.exercise_id} className="exercise-item">
                    <strong>{ex.name}</strong> — {ex.target_sets} sets × {ex.target_reps}
                    {ex.prescribed_load
                      ? ` @ ${ex.prescribed_load.value}${ex.prescribed_load.unit}`
                      : ''}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onNavigateToPlan} className="btn-secondary">
                View Full Workout Routine
              </button>
            </div>
          ) : (
            <p>Scheduled rest and recovery day. Focus on hydration and mobility.</p>
          )}
        </section>

        {/* Nutrition Target & Progress */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Today’s Nutrition Summary</h2>
            <span className="badge">
              {loggedCalories} / {targetCalories} kcal ({caloriePercent}%)
            </span>
          </div>
          <div className="card-content">
            <div className="meter-container">
              <div className="meter-bar" style={{ width: `${caloriePercent}%` }} />
            </div>

            <div className="macro-row">
              <div className="macro-pill">
                <span className="macro-label">Protein</span>
                <span className="macro-value">{loggedProtein}g</span>
                <span className="macro-target">Target: {targetProtein}g</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Carbs</span>
                <span className="macro-value">{loggedCarbs}g</span>
                <span className="macro-target">Target: {targetCarbs}g</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Fat</span>
                <span className="macro-value">{loggedFat}g</span>
                <span className="macro-target">Target: {targetFat}g</span>
              </div>
            </div>

            <p className="disclaimer-note">
              Calculated via Mifflin-St Jeor equation baseline adjusted for {profile?.goal} target.
            </p>
          </div>
        </section>

        {/* Quick Log Form */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Quick Daily Log</h2>
            <span className="badge badge-muted">Local Demo Storage</span>
          </div>
          <form onSubmit={handleQuickLog} className="card-content">
            <label>
              Body Weight ({profile?.units === 'imperial' ? 'lb' : 'kg'})
              <input
                type="number"
                step="0.1"
                value={inputWeight}
                onChange={(e) => setInputWeight(e.target.value)}
                required
              />
            </label>
            <label>
              Total Calories Consumed (kcal)
              <input
                type="number"
                placeholder={targetCalories.toString()}
                value={inputCalories}
                onChange={(e) => setInputCalories(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary">
              Record Daily Entry
            </button>
            {logStatus && (
              <p role="status" className="status-msg">
                {logStatus}
              </p>
            )}
          </form>
        </section>

        {/* Sync & Connectivity Card */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Storage & Connectivity</h2>
            <span className="badge badge-success">Isolated Demo Mode</span>
          </div>
          <div className="card-content">
            <p>
              Current session is running entirely in-memory using deterministic synthetic fixtures.
              No provider keys are used, and no data is sent to production servers.
            </p>
            <p className="text-muted">
              Current local date: <strong>{latestLog?.local_date || '2026-10-01'}</strong> (
              {profile?.timezone})
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
