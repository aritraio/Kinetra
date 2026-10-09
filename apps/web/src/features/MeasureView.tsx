import {
  type ActivityLevel,
  calculateBmr,
  calculateCalorieTarget,
  calculateMacroDistribution,
  calculateNavyBodyFat,
  calculateTdee,
  type FitnessGoal,
} from '@kinetra/domain';
import { useEffect, useState } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { useRepositories } from '../repositories';

interface AnthropometricEntry {
  date: string;
  waistCm: number;
  neckCm: number;
  hipCm?: number | undefined;
  bfPercent: number;
}

export function MeasureView() {
  const repos = useRepositories();

  // Unit mode
  const [unitMode, setUnitMode] = useState<'metric' | 'imperial'>('metric');

  // Editable parameters for dynamic calculation exploration
  const [weightKg, setWeightKg] = useState<number>(70);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [age, setAge] = useState<number>(30);
  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<FitnessGoal>('cut');

  // Anthropometrics state
  const [waistCm, setWaistCm] = useState<number>(75);
  const [neckCm, setNeckCm] = useState<number>(36);
  const [hipCm, setHipCm] = useState<number>(95);

  // Historical measurements
  const [measurementHistory, setMeasurementHistory] = useState<AnthropometricEntry[]>([
    {
      date: '2026-10-01',
      waistCm: 75.5,
      neckCm: 36.0,
      hipCm: 95.5,
      bfPercent: 24.2,
    },
    {
      date: '2026-09-24',
      waistCm: 76.0,
      neckCm: 36.0,
      hipCm: 96.0,
      bfPercent: 24.8,
    },
  ]);

  useEffect(() => {
    void repos.profile.getProfile().then((p) => {
      if (p) {
        setWeightKg(p.weight_kg);
        setHeightCm(p.height_cm);
        if (p.age) setAge(p.age);
        if (p.biological_sex) setSex(p.biological_sex);
        if (p.activity_level) setActivity(p.activity_level);
        setGoal(p.goal);
        setUnitMode(p.units);
      }
    });
  }, [repos]);

  // Compute live calculations via pure domain functions
  const bmrEstimate = calculateBmr({
    weight_kg: weightKg,
    height_cm: heightCm,
    age,
    biological_sex: sex,
  });

  const tdeeEstimate = calculateTdee({
    bmr_kcal: bmrEstimate.bmr_kcal,
    activity_level: activity,
  });

  const targetEstimate = calculateCalorieTarget({
    tdee_kcal: tdeeEstimate.tdee_kcal,
    goal,
    biological_sex: sex,
  });

  const macroEstimate = calculateMacroDistribution({
    target_calories: targetEstimate.target_calories_kcal,
    weight_kg: weightKg,
    goal,
  });

  let navyBf = null;
  try {
    navyBf = calculateNavyBodyFat({
      height_cm: heightCm,
      waist_cm: waistCm,
      neck_cm: neckCm,
      hip_cm: sex === 'female' ? hipCm : undefined,
      biological_sex: sex,
    });
  } catch {
    // Graceful handling of invalid test circumferences
  }

  const handleRecordMeasurement = () => {
    if (!navyBf) return;
    const today = new Date().toISOString().slice(0, 10);
    const newEntry: AnthropometricEntry = {
      date: today,
      waistCm,
      neckCm,
      hipCm: sex === 'female' ? hipCm : undefined,
      bfPercent: navyBf.body_fat_percentage,
    };
    setMeasurementHistory((prev) => [newEntry, ...prev.filter((e) => e.date !== today)]);
  };

  const handleClearHistory = () => {
    setMeasurementHistory([]);
  };

  // Unit display helpers
  const displayWeight =
    unitMode === 'imperial' ? (weightKg * 2.20462).toFixed(1) : weightKg.toFixed(1);
  const displayHeight =
    unitMode === 'imperial' ? (heightCm / 2.54).toFixed(1) : heightCm.toFixed(1);
  const weightUnit = unitMode === 'imperial' ? 'lb' : 'kg';
  const lengthUnit = unitMode === 'imperial' ? 'in' : 'cm';

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
            <p className="eyebrow">DOMICILE CALCULATIONS · VALIDATED SCIENTIFIC EQUATIONS</p>
            <h1>Measure & Metabolic Targets</h1>
            <p className="intro">
              Transparent energy estimations derived from validated formulas. Mathematical models
              with declared assumptions.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              background: 'var(--surface)',
              padding: '4px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <Button
              size="small"
              variant={unitMode === 'metric' ? 'primary' : 'quiet'}
              onClick={() => setUnitMode('metric')}
            >
              Metric (kg/cm)
            </Button>
            <Button
              size="small"
              variant={unitMode === 'imperial' ? 'primary' : 'quiet'}
              onClick={() => setUnitMode('imperial')}
            >
              Imperial (lb/in)
            </Button>
          </div>
        </div>
      </section>

      {/* Prominent Scientific Policy Notice */}
      <Notice variant="info" style={{ marginBottom: '24px' }}>
        <strong>Scientific Policy Notice:</strong> All values presented on this dashboard are
        mathematical estimations derived from published regression models. Kinetra does not provide
        clinical, medical, or diagnostic assessments. Never present a calculated regression estimate
        as a diagnostic measurement.
      </Notice>

      <div className="card-grid">
        {/* Interactive Parameter Controls */}
        <section className="instrument card" aria-labelledby="params-title">
          <div className="card-header">
            <h2 id="params-title">Biometric Parameters</h2>
            <span className="badge badge-accent">Input Variables</span>
          </div>
          <div className="card-content">
            <div className="input-row">
              <label>
                Biological Sex
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'male' | 'female')}
                  className="field-select"
                >
                  <option value="female">Female (-161 kcal coefficient)</option>
                  <option value="male">Male (+5 kcal coefficient)</option>
                </select>
              </label>

              <label>
                Age (years)
                <input
                  type="number"
                  min="13"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value, 10) || 25)}
                  className="field-input tabular-nums"
                />
              </label>
            </div>

            <div className="input-row">
              <label>
                Height ({lengthUnit})
                <input
                  type="number"
                  min="20"
                  max="250"
                  step="0.1"
                  value={displayHeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setHeightCm(unitMode === 'imperial' ? val * 2.54 : val);
                  }}
                  className="field-input tabular-nums"
                />
              </label>

              <label>
                Weight ({weightUnit})
                <input
                  type="number"
                  min="20"
                  max="500"
                  step="0.1"
                  value={displayWeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setWeightKg(unitMode === 'imperial' ? val * 0.453592 : val);
                  }}
                  className="field-input tabular-nums"
                />
              </label>
            </div>

            <div className="input-row">
              <label>
                Daily Activity Baseline
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                  className="field-select"
                >
                  <option value="sedentary">Sedentary (1.20× multiplier)</option>
                  <option value="light">Lightly Active (1.375× multiplier)</option>
                  <option value="moderate">Moderately Active (1.55× multiplier)</option>
                  <option value="very_active">Very Active (1.725× multiplier)</option>
                  <option value="extra_active">Extra Active (1.90× multiplier)</option>
                </select>
              </label>

              <label>
                Fitness Goal Trajectory
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as FitnessGoal)}
                  className="field-select"
                >
                  <option value="cut">Cut (Caloric Deficit / Fat Loss)</option>
                  <option value="maintain">Maintain (Energy Balance)</option>
                  <option value="bulk">Bulk (Caloric Surplus / Muscle Hypertrophy)</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* Calculation Assumptions & Equations Card */}
        <section className="instrument card" aria-labelledby="assumptions-title">
          <div className="card-header">
            <h2 id="assumptions-title">Calculation Assumptions</h2>
            <span className="badge">Methodology</span>
          </div>
          <div className="card-content">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <strong>1. Basal Metabolic Rate (Mifflin-St Jeor):</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  {'BMR = 10 × weight (kg) + 6.25 × height (cm) - 5 × age + s'}
                  <br />
                  where s = +5 for males, -161 for females. Validated accuracy ±10% against indirect
                  calorimetry.
                </p>
              </div>

              <div>
                <strong>2. Total Daily Energy Expenditure (TDEE):</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  {'TDEE = BMR × PAL (Physical Activity Level coefficient from 1.20 to 1.90).'}
                </p>
              </div>

              <div>
                <strong>3. Target Goal Energy Adjustment:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Cut: moderate deficit of 300–500 kcal/day (safe fat loss). Bulk: moderate surplus
                  of 200–400 kcal/day. Maintain: 0 kcal delta.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Target Estimates Summary */}
        <section className="instrument card" aria-labelledby="targets-title">
          <div className="card-header">
            <h2 id="targets-title">Estimated Energy Targets</h2>
            <span className="badge badge-accent">Results</span>
          </div>
          <div className="card-content">
            <div className="macro-breakdown-row" style={{ marginBottom: '16px' }}>
              <div className="macro-chip">
                <span className="macro-chip-label">Basal Rate (BMR)</span>
                <span className="macro-chip-val tabular-nums">{bmrEstimate.bmr_kcal} kcal</span>
              </div>
              <div className="macro-chip">
                <span className="macro-chip-label">Maintenance (TDEE)</span>
                <span className="macro-chip-val tabular-nums">{tdeeEstimate.tdee_kcal} kcal</span>
              </div>
              <div className="macro-chip">
                <span className="macro-chip-label">Target Energy Intake</span>
                <span className="macro-chip-val tabular-nums" style={{ fontWeight: 800 }}>
                  {targetEstimate.target_calories_kcal} kcal
                </span>
              </div>
            </div>

            <div className="macro-breakdown-row">
              <div className="macro-chip">
                <span className="macro-chip-label">Protein</span>
                <span className="macro-chip-val tabular-nums">{macroEstimate.protein_g}g</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {macroEstimate.protein_calories} kcal
                </span>
              </div>
              <div className="macro-chip">
                <span className="macro-chip-label">Carbohydrates</span>
                <span className="macro-chip-val tabular-nums">{macroEstimate.carbs_g}g</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {macroEstimate.carbs_calories} kcal
                </span>
              </div>
              <div className="macro-chip">
                <span className="macro-chip-label">Fat</span>
                <span className="macro-chip-val tabular-nums">{macroEstimate.fat_g}g</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {macroEstimate.fat_calories} kcal
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Anthropometric Body Fat Estimator */}
        <section className="instrument card" aria-labelledby="bf-title">
          <div className="card-header">
            <h2 id="bf-title">Anthropometric Circumference Estimator</h2>
            <span className="badge">U.S. Navy Method</span>
          </div>
          <div className="card-content">
            <div className="input-row">
              <label>
                Waist ({lengthUnit})
                <input
                  type="number"
                  step="0.5"
                  value={unitMode === 'imperial' ? (waistCm / 2.54).toFixed(1) : waistCm}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setWaistCm(unitMode === 'imperial' ? val * 2.54 : val);
                  }}
                  className="field-input tabular-nums"
                />
              </label>

              <label>
                Neck ({lengthUnit})
                <input
                  type="number"
                  step="0.5"
                  value={unitMode === 'imperial' ? (neckCm / 2.54).toFixed(1) : neckCm}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setNeckCm(unitMode === 'imperial' ? val * 2.54 : val);
                  }}
                  className="field-input tabular-nums"
                />
              </label>

              {sex === 'female' && (
                <label>
                  Hip ({lengthUnit})
                  <input
                    type="number"
                    step="0.5"
                    value={unitMode === 'imperial' ? (hipCm / 2.54).toFixed(1) : hipCm}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setHipCm(unitMode === 'imperial' ? val * 2.54 : val);
                    }}
                    className="field-input tabular-nums"
                  />
                </label>
              )}
            </div>

            {navyBf ? (
              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--soft)',
                  padding: '16px',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <div>
                  <span
                    style={{ fontSize: '28px', fontWeight: 800, color: 'var(--ink)' }}
                    className="tabular-nums"
                  >
                    {navyBf.body_fat_percentage}%
                  </span>
                  <span style={{ marginLeft: '10px', fontSize: '13px', color: 'var(--muted)' }}>
                    Estimated Body Fat (Standard Error: ±3.5%)
                  </span>
                </div>
                <Button size="small" variant="secondary" onClick={handleRecordMeasurement}>
                  Record to History
                </Button>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
                Enter circumference measurements above to calculate estimate.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Anthropometric Measurement History & Understandable Empty State */}
      <section
        className="instrument card"
        style={{ marginTop: '24px' }}
        aria-labelledby="history-title"
      >
        <div className="card-header">
          <h2 id="history-title">Measurement History & Trends</h2>
          <span className="badge">Circumference Telemetry</span>
        </div>
        <div className="card-content">
          {measurementHistory.length === 0 ? (
            <EmptyState
              title="No Anthropometric Measurements Recorded"
              description="Record your waist, neck, and hip circumferences using a standard flexible tape measure to track physical body composition trends over time. Measure in the morning upon waking, relaxed with normal exhalation."
              actionLabel="Add Current Values"
              onAction={handleRecordMeasurement}
            />
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Showing {measurementHistory.length} recorded entries
                </span>
                <Button size="small" variant="quiet" onClick={handleClearHistory}>
                  Clear History
                </Button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="chart-data-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Waist ({lengthUnit})</th>
                      <th scope="col">Neck ({lengthUnit})</th>
                      {sex === 'female' && <th scope="col">Hip ({lengthUnit})</th>}
                      <th scope="col">Est. Body Fat (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurementHistory.map((m) => (
                      <tr key={m.date}>
                        <td>{m.date}</td>
                        <td className="tabular-nums">
                          {unitMode === 'imperial'
                            ? (m.waistCm / 2.54).toFixed(1)
                            : m.waistCm.toFixed(1)}
                        </td>
                        <td className="tabular-nums">
                          {unitMode === 'imperial'
                            ? (m.neckCm / 2.54).toFixed(1)
                            : m.neckCm.toFixed(1)}
                        </td>
                        {sex === 'female' && (
                          <td className="tabular-nums">
                            {m.hipCm
                              ? unitMode === 'imperial'
                                ? (m.hipCm / 2.54).toFixed(1)
                                : m.hipCm.toFixed(1)
                              : '—'}
                          </td>
                        )}
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>
                          {m.bfPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Scientific Citations */}
      <section className="instrument reference-section" style={{ marginTop: '24px' }}>
        <h3>Scientific References & Mathematical Foundations</h3>
        <ul className="citation-list">
          <li>
            <strong>BMR Formulation:</strong> {bmrEstimate.citation}
          </li>
          <li>
            <strong>Protein Guideline:</strong> Morton RW, et al. A systematic review and
            meta-analysis of protein supplementation in resistance-trained adults. Br J Sports Med.
            2018.
          </li>
          <li>
            <strong>Body Fat Prediction:</strong> Hodgdon JA, Beckett MB. Prediction of percent body
            fat from body circumferences and height. Naval Health Research Center.
          </li>
        </ul>
      </section>
    </div>
  );
}
