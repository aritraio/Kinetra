import { useEffect, useState } from 'react';
import { Button, Notice } from '../components/ui';
import type {
  MealPlanPayload,
  SharedPlanView as SharedPlanViewType,
  WorkoutPlanPayload,
} from '@kinetra/contracts';
import { useRepositories } from '../repositories';

export function SharedPlanView({ token, onClose }: { token: string; onClose: () => void }) {
  const repos = useRepositories();
  const [sharedPlan, setSharedPlan] = useState<SharedPlanViewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShared() {
      setLoading(true);
      setError(null);
      try {
        if (repos.plans.getSharedPlan) {
          const result = await repos.plans.getSharedPlan(token);
          setSharedPlan(result);
        } else {
          throw new Error('Public plan sharing is not available.');
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'This share link is either expired, revoked by its owner, or invalid.',
        );
      } finally {
        setLoading(false);
      }
    }
    void loadShared();
  }, [token, repos]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <p>Loading shared routine…</p>
      </div>
    );
  }

  if (error || !sharedPlan) {
    return (
      <div className="card" style={{ padding: '32px', maxWidth: '600px', margin: '40px auto' }}>
        <h2>Share Link Unavailable</h2>
        <Notice variant="error" style={{ margin: '16px 0' }}>
          {error || 'This share link is inactive.'}
        </Notice>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          The owner may have revoked this link or its expiration period has passed. No private data
          is accessible.
        </p>
        <div style={{ marginTop: '20px' }}>
          <Button variant="primary" onClick={onClose}>
            Return to App
          </Button>
        </div>
      </div>
    );
  }

  const isWorkout = sharedPlan.kind === 'workout';
  const workoutPayload = isWorkout ? (sharedPlan.payload as WorkoutPlanPayload) : null;
  const mealPayload = !isWorkout ? (sharedPlan.payload as MealPlanPayload) : null;

  return (
    <div
      className="shared-plan-view"
      style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <span className="badge badge-accent" style={{ marginBottom: '8px' }}>
            VERIFIED SHARED ROUTINE
          </span>
          <h1>
            {isWorkout
              ? `${workoutPayload?.split_name ?? 'Training Split'} (v${sharedPlan.version})`
              : `Nutrition Target ${mealPayload?.target_calories ?? 2000} kcal (v${sharedPlan.version})`}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Shared via secure expiring grant · Expires on{' '}
            {new Date(sharedPlan.expires_at).toLocaleDateString()}
          </p>
        </div>

        <Button variant="quiet" onClick={onClose}>
          ✕ Close Shared View
        </Button>
      </header>

      <Notice variant="info" style={{ marginBottom: '24px' }}>
        <strong>Privacy disclosure:</strong> This public link exposes only the verified workout or
        nutrition prescription. The owner’s identity, private weight logs, calorie logs, and photos
        are strictly excluded.
      </Notice>

      {/* Workout details */}
      {isWorkout && workoutPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3>Schedule Overview</h3>
            <p>
              <strong>Frequency:</strong> {workoutPayload.days_per_week} days per week ·{' '}
              <strong>Split:</strong> {workoutPayload.split_name}
            </p>
            {workoutPayload.notes && <p className="note">{workoutPayload.notes}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {workoutPayload.days.map((day) => (
              <div key={day.day_number} className="card">
                <div className="card-header">
                  <h3>
                    Day {day.day_number}: {day.focus}
                  </h3>
                  {day.is_rest_day ? (
                    <span className="badge">Active Recovery</span>
                  ) : (
                    <span className="badge badge-accent">{day.exercises.length} Movements</span>
                  )}
                </div>
                {!day.is_rest_day && (
                  <div style={{ marginTop: '12px' }}>
                    <table style={{ width: '100%', fontSize: 'var(--text-sm)' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Exercise</th>
                          <th style={{ textAlign: 'center' }}>Sets</th>
                          <th style={{ textAlign: 'center' }}>Reps</th>
                          <th style={{ textAlign: 'right' }}>Prescribed Load</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.exercises.map((ex) => (
                          <tr key={ex.exercise_id}>
                            <td style={{ fontWeight: 600 }}>{ex.name}</td>
                            <td style={{ textAlign: 'center' }}>{ex.target_sets}</td>
                            <td style={{ textAlign: 'center' }}>{ex.target_reps}</td>
                            <td style={{ textAlign: 'right' }}>
                              {ex.prescribed_load
                                ? `${ex.prescribed_load.value} ${ex.prescribed_load.unit}`
                                : 'Bodyweight / Form'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal details */}
      {!isWorkout && mealPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3>Daily Nutritional Targets</h3>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <div className="macro-pill">
                <span className="macro-label">Calories</span>
                <span className="macro-value">{mealPayload.target_calories} kcal</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Protein</span>
                <span className="macro-value">{mealPayload.target_protein_g}g</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Carbs</span>
                <span className="macro-value">{mealPayload.target_carbs_g}g</span>
              </div>
              <div className="macro-pill">
                <span className="macro-label">Fat</span>
                <span className="macro-value">{mealPayload.target_fat_g}g</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
