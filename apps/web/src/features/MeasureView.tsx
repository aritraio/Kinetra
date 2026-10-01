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
import { useRepositories } from '../repositories';

export function MeasureView() {
  const repos = useRepositories();

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

  useEffect(() => {
    void repos.profile.getProfile().then((p) => {
      if (p) {
        setWeightKg(p.weight_kg);
        setHeightCm(p.height_cm);
        if (p.age) setAge(p.age);
        if (p.biological_sex) setSex(p.biological_sex);
        if (p.activity_level) setActivity(p.activity_level);
        setGoal(p.goal);
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

  return (
    <div className="feature-view">
      <section className="hero-section">
        <p className="eyebrow">DOMICILE CALCULATIONS · VALIDATED FORMULAS</p>
        <h1>Measure & Metabolic Targets</h1>
        <p className="intro">
          Transparent energy estimations derived from validated equations. No opaque algorithms or
          unscientific diagnostic claims.
        </p>
      </section>

      {/* Clinical Disclaimer Alert */}
      <div className="alert-banner">
        <strong>Scientific Policy Notice:</strong> All values are mathematical estimates with
        declared assumptions and empirical confidence bounds. Kinetra does not provide clinical,
        medical, or diagnostic assessments.
      </div>

      <div className="card-grid">
        {/* Interactive Parameter Controls */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Biometric Parameters</h2>
            <span className="badge badge-accent">Input Variables</span>
          </div>
          <div className="card-content">
            <div className="input-row">
              <label>
                Biological Sex
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'male' | 'female')}
                  className="select-input"
                >
                  <option value="female">Female (-161 kcal factor)</option>
                  <option value="male">Male (+5 kcal factor)</option>
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
                />
              </label>
            </div>

            <div className="input-row">
              <label>
                Height (cm)
                <input
                  type="number"
                  min="50"
                  max="250"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseFloat(e.target.value) || 170)}
                />
              </label>

              <label>
                Weight (kg)
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="500"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 70)}
                />
              </label>
            </div>

            <div className="input-row">
              <label>
                Activity Level (PAL)
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                  className="select-input"
                >
                  <option value="sedentary">Sedentary (1.2× desk work)</option>
                  <option value="light">Light Activity (1.375× 1-3 days/wk)</option>
                  <option value="moderate">Moderate Activity (1.55× 3-5 days/wk)</option>
                  <option value="very_active">Very Active (1.725× 6-7 days/wk)</option>
                  <option value="extra_active">Extra Active (1.9× 2x/day training)</option>
                </select>
              </label>

              <label>
                Target Goal
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as FitnessGoal)}
                  className="select-input"
                >
                  <option value="cut">Cut (-20% deficit)</option>
                  <option value="maintain">Maintain (0% balance)</option>
                  <option value="bulk">Bulk (+10% surplus)</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* Metabolic Targets Readout */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Metabolic Readout</h2>
            <span className="badge">Pure Domain Output</span>
          </div>
          <div className="card-content readout-grid">
            <div className="readout-box">
              <span className="readout-label">Basal Metabolic Rate (BMR)</span>
              <span className="readout-value">{bmrEstimate.bmr_kcal} kcal</span>
              <span className="readout-sub">
                ±10% Range: {bmrEstimate.confidence_interval_kcal.min}–
                {bmrEstimate.confidence_interval_kcal.max} kcal
              </span>
            </div>

            <div className="readout-box">
              <span className="readout-label">Total Daily Energy (TDEE)</span>
              <span className="readout-value">{tdeeEstimate.tdee_kcal} kcal</span>
              <span className="readout-sub">
                Multiplier: {tdeeEstimate.pal_multiplier}× ({activity})
              </span>
            </div>

            <div className="readout-box highlight-box">
              <span className="readout-label">Target Daily Calories</span>
              <span className="readout-value">{targetEstimate.target_calories_kcal} kcal</span>
              <span className="readout-sub">
                {targetEstimate.adjustment_percentage > 0 ? '+' : ''}
                {targetEstimate.adjustment_percentage}% adjustment ({targetEstimate.adjustment_kcal}{' '}
                kcal)
                {targetEstimate.safety_floor_applied ? ' [Safety Floor Applied]' : ''}
              </span>
            </div>
          </div>
        </section>

        {/* Macronutrient Distribution Card */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Macronutrient Breakdown</h2>
            <span className="badge badge-accent">Sports Nutrition Standard</span>
          </div>
          <div className="card-content">
            <div className="macro-breakdown-row">
              <div className="macro-card">
                <h3>Protein</h3>
                <p className="macro-grams">{macroEstimate.protein_g}g</p>
                <p className="macro-detail">
                  {macroEstimate.protein_calories} kcal ({macroEstimate.protein_ratio_g_per_kg}g /
                  kg)
                </p>
              </div>
              <div className="macro-card">
                <h3>Carbohydrates</h3>
                <p className="macro-grams">{macroEstimate.carbs_g}g</p>
                <p className="macro-detail">
                  {macroEstimate.carbs_calories} kcal (Remaining energy)
                </p>
              </div>
              <div className="macro-card">
                <h3>Fat</h3>
                <p className="macro-grams">{macroEstimate.fat_g}g</p>
                <p className="macro-detail">
                  {macroEstimate.fat_calories} kcal ({macroEstimate.fat_percentage_of_calories}% of
                  total)
                </p>
              </div>
            </div>

            <div className="assumptions-box">
              <h4>Stated Assumptions:</h4>
              <ul>
                {macroEstimate.stated_assumptions.map((assump) => (
                  <li key={assump}>{assump}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Anthropometric Navy Body Fat Estimator */}
        <section className="instrument card">
          <div className="card-header">
            <h2>Anthropometric Body Fat Estimate</h2>
            <span className="badge">U.S. Navy Method</span>
          </div>
          <div className="card-content">
            <div className="input-row">
              <label>
                Waist Circumference (cm)
                <input
                  type="number"
                  step="0.5"
                  value={waistCm}
                  onChange={(e) => setWaistCm(parseFloat(e.target.value) || 75)}
                />
              </label>
              <label>
                Neck Circumference (cm)
                <input
                  type="number"
                  step="0.5"
                  value={neckCm}
                  onChange={(e) => setNeckCm(parseFloat(e.target.value) || 36)}
                />
              </label>
              {sex === 'female' && (
                <label>
                  Hip Circumference (cm)
                  <input
                    type="number"
                    step="0.5"
                    value={hipCm}
                    onChange={(e) => setHipCm(parseFloat(e.target.value) || 95)}
                  />
                </label>
              )}
            </div>

            {navyBf ? (
              <div className="navy-result">
                <span className="navy-score">{navyBf.body_fat_percentage}%</span>
                <p className="navy-note">
                  Estimated Body Fat (Circumference method, Hodgdon & Beckett). Subject to ±3–4%
                  error margin versus hydrostatic weighing or DEXA.
                </p>
              </div>
            ) : (
              <p className="text-muted">Enter valid anatomical circumference measurements above.</p>
            )}
          </div>
        </section>
      </div>

      {/* Evidence & References Footer */}
      <section className="instrument reference-section">
        <h3>Scientific References & Citations</h3>
        <ul className="citation-list">
          <li>
            <strong>BMR Formulation:</strong> {bmrEstimate.citation}
          </li>
          <li>
            <strong>Protein Guideline:</strong> Morton RW, et al. A systematic review, meta-analysis
            and meta-regression of the effect of protein supplementation on resistance training
            adaptations. Br J Sports Med. 2018;52(6):376-384.
          </li>
          <li>
            <strong>Anthropometrics:</strong> Hodgdon JA, Beckett MB. Prediction of percent body fat
            for U.S. Navy men and women from body circumferences and height. Reports 84-29 and
            84-11. Naval Health Research Center.
          </li>
        </ul>
      </section>
    </div>
  );
}
