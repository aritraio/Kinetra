import type { LogRecord, ProfileRecord, TrainingSessionRecord } from '@kinetra/contracts';
import { useEffect, useState } from 'react';
import { useRepositories } from '../repositories';

export function ProgressView() {
  const repos = useRepositories();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [sessions, setSessions] = useState<TrainingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      repos.profile.getProfile(),
      repos.logs.listLogs(30),
      repos.history.listSessions(10),
    ]).then(([p, l, s]) => {
      setProfile(p);
      setLogs(l);
      setSessions(s);
      setLoading(false);
    });
  }, [repos]);

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

  // Compute min and max weight for scaling the visual trend bars
  const weights = chronological.map((l) => l.weight_kg);
  const minW = Math.min(...weights, 60);
  const maxW = Math.max(...weights, 90);
  const range = Math.max(1, maxW - minW);

  return (
    <div className="feature-view">
      <section className="hero-section">
        <p className="eyebrow">HISTORICAL TRENDS · 14-DAY FIDELITY CHECK</p>
        <h1>Progress & Daily Logs</h1>
        <p className="intro">
          Review weight trend telemetry, daily nutritional consistency, and logged resistance
          training sessions.
        </p>
      </section>

      {/* KPI Cards */}
      <div className="stat-cards-grid">
        <div className="stat-card card">
          <span className="stat-label">Baseline Weight (Day 1)</span>
          <span className="stat-value">
            {startWeight} {unit}
          </span>
          <span className="stat-sub">{startLog?.local_date}</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">Current Weight (Day 14)</span>
          <span className="stat-value">
            {currentWeight} {unit}
          </span>
          <span className="stat-sub">{latestLog?.local_date}</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">Net Trend Delta</span>
          <span className={`stat-value ${deltaKg < 0 ? 'text-trend-down' : 'text-trend-up'}`}>
            {deltaKg > 0 ? '+' : ''}
            {deltaDisplay} {unit}
          </span>
          <span className="stat-sub">Target goal: {profile?.goal.toUpperCase()}</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">Logging Consistency</span>
          <span className="stat-value">{logs.length} / 14 Days</span>
          <span className="stat-sub">100% adherence</span>
        </div>
      </div>

      {/* Visual Weight Trend Graph */}
      <section className="instrument card graph-card">
        <div className="card-header">
          <h2>14-Day Weight Trajectory</h2>
          <span className="badge badge-accent">Daily Weigh-ins</span>
        </div>
        <div className="chart-container">
          <div className="trend-bars">
            {chronological.map((log) => {
              const heightPercent = Math.max(
                15,
                Math.min(100, Math.round(((log.weight_kg - minW) / range) * 85 + 15)),
              );
              return (
                <div
                  key={log.id}
                  className="trend-bar-col"
                  title={`${log.local_date}: ${formatWeight(log.weight_kg)} ${unit}`}
                >
                  <div className="trend-bar" style={{ height: `${heightPercent}%` }} />
                  <span className="bar-date">{log.local_date.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Daily Logs Table */}
      <section className="instrument card">
        <div className="card-header">
          <h2>Daily Entries ({logs.length} Records)</h2>
          <span className="badge">Chronological Log</span>
        </div>
        <div className="table-responsive">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight ({unit})</th>
                <th>Calories (kcal)</th>
                <th>Protein (g)</th>
                <th>Carbs (g)</th>
                <th>Fat (g)</th>
                <th>Water (ml)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.local_date}</strong>
                  </td>
                  <td>
                    {formatWeight(log.weight_kg)} {unit}
                  </td>
                  <td>{log.calories ?? '—'}</td>
                  <td>{log.protein_g ?? '—'}</td>
                  <td>{log.carbs_g ?? '—'}</td>
                  <td>{log.fat_g ?? '—'}</td>
                  <td>{log.water_ml ?? '—'}</td>
                  <td className="cue-cell">{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Training History */}
      <section className="instrument card">
        <div className="card-header">
          <h2>Completed Training History ({sessions.length} Sessions)</h2>
          <span className="badge badge-accent">Verified Work</span>
        </div>
        <div className="session-stack">
          {sessions.map((sess) => (
            <div key={sess.id} className="session-card">
              <div className="session-header">
                <strong>Session on {sess.started_at.slice(0, 10)}</strong>
                <span className="sub-text">
                  Completed: {sess.completed_at ? sess.completed_at.slice(11, 16) : '—'}
                </span>
              </div>
              {sess.notes && <p className="session-notes">{sess.notes}</p>}
              <div className="session-exercises">
                {sess.exercises.map((ex) => (
                  <div key={ex.exercise_id} className="session-ex-row">
                    <span className="ex-title">{ex.name}:</span>
                    <span className="ex-sets-summary">
                      {ex.sets.map((s) => `${s.reps}r @ ${s.load.value}${s.load.unit}`).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
