import type { PlanWithVersion } from '@kinetra/contracts';
import { useEffect, useState } from 'react';
import { useRepositories } from '../repositories';

export function PlanView() {
  const repos = useRepositories();
  const [activeTab, setActiveTab] = useState<'meal' | 'workout'>('workout');
  const [mealPlan, setMealPlan] = useState<PlanWithVersion | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<PlanWithVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([repos.plans.getPlan('meal'), repos.plans.getPlan('workout')]).then(([mp, wp]) => {
      setMealPlan(mp);
      setWorkoutPlan(wp);
      setLoading(false);
    });
  }, [repos]);

  if (loading) {
    return (
      <section className="instrument">
        <p role="status">Loading plan details...</p>
      </section>
    );
  }

  const mealPayload =
    mealPlan?.current_version.payload.kind === 'meal' ? mealPlan.current_version.payload : null;

  const workoutPayload =
    workoutPlan?.current_version.payload.kind === 'workout'
      ? workoutPlan.current_version.payload
      : null;

  return (
    <div className="feature-view">
      <section className="hero-section">
        <p className="eyebrow">VERIFIED PLANS · DETERMINISTIC IMMUTABLE VERSIONS</p>
        <h1>Prescribed Plans</h1>
        <p className="intro">
          Review verified daily nutrition schedules and structured resistance training programs.
        </p>
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

      {activeTab === 'workout' && workoutPayload && (
        <div className="plan-container">
          <div className="version-banner">
            <span>
              <strong>Version {workoutPlan?.current_version.version}</strong> · Provenance:{' '}
              <code>{workoutPlan?.current_version.provenance}</code> · Policy:{' '}
              <code>{workoutPlan?.current_version.policy_version}</code>
            </span>
          </div>

          {workoutPayload.notes && (
            <p className="plan-notes">
              <strong>Coaching Notes:</strong> {workoutPayload.notes}
            </p>
          )}

          <div className="days-stack">
            {workoutPayload.days.map((day) => (
              <div key={day.day_number} className="day-card card">
                <div className="day-header">
                  <h3>
                    {day.day_name}: {day.focus}
                  </h3>
                  <span className={`badge ${day.is_rest_day ? 'badge-muted' : 'badge-accent'}`}>
                    {day.is_rest_day ? 'Rest Day' : `${day.exercises.length} Movements`}
                  </span>
                </div>

                {!day.is_rest_day && day.exercises.length > 0 ? (
                  <div className="exercises-table-wrap">
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
                              <span className="sub-text">Equipment: {ex.equipment}</span>
                            </td>
                            <td>{ex.target_sets} sets</td>
                            <td>{ex.target_reps}</td>
                            <td>
                              {ex.prescribed_load
                                ? `${ex.prescribed_load.value} ${ex.prescribed_load.unit}`
                                : 'Bodyweight'}
                              {ex.rpe ? ` (RPE ${ex.rpe})` : ''}
                            </td>
                            <td>{ex.rest_seconds}s</td>
                            <td className="cue-cell">{ex.instructions || 'Controlled tempo.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rest-notice">
                    Scheduled recovery. Prioritize sleep, light mobility, and hydration.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'meal' && mealPayload && (
        <div className="plan-container">
          <div className="version-banner">
            <span>
              <strong>Version {mealPlan?.current_version.version}</strong> · Provenance:{' '}
              <code>{mealPlan?.current_version.provenance}</code> · Policy:{' '}
              <code>{mealPlan?.current_version.policy_version}</code>
            </span>
          </div>

          <div className="macro-target-bar">
            <span>Daily Targets:</span>
            <strong>{mealPayload.target_calories} kcal</strong>
            <span>
              • Protein: <strong>{mealPayload.target_protein_g}g</strong>
            </span>
            <span>
              • Carbs: <strong>{mealPayload.target_carbs_g}g</strong>
            </span>
            <span>
              • Fat: <strong>{mealPayload.target_fat_g}g</strong>
            </span>
          </div>

          {mealPayload.notes && (
            <p className="plan-notes">
              <strong>Dietary Guidance:</strong> {mealPayload.notes}
            </p>
          )}

          <div className="days-stack">
            {mealPayload.days.map((day) => (
              <div key={day.day_number} className="day-card card">
                <div className="day-header">
                  <h3>{day.day_name} Schedule</h3>
                  <span className="badge">
                    {day.total_calories} kcal (P: {day.total_protein_g}g | C: {day.total_carbs_g}g |
                    F: {day.total_fat_g}g)
                  </span>
                </div>

                <div className="meals-grid">
                  {day.meals.map((meal) => (
                    <div key={meal.meal_id} className="meal-card">
                      <div className="meal-header">
                        <h4>{meal.name}</h4>
                        <span className="meal-meta">
                          {meal.target_time ? `@ ${meal.target_time} • ` : ''}
                          {meal.calories} kcal
                        </span>
                      </div>
                      <div className="meal-macros">
                        <span>P: {meal.protein_g}g</span>
                        <span>C: {meal.carbs_g}g</span>
                        <span>F: {meal.fat_g}g</span>
                      </div>
                      <ul className="ingredient-list">
                        {meal.items.map((item) => (
                          <li key={item.ingredient_id}>
                            <span>{item.name}</span>
                            <span className="item-amount">
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
    </div>
  );
}
