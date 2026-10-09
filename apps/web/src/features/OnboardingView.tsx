import {
  type ActivityLevel,
  calculateBmr,
  calculateCalorieTarget,
  calculateMacroDistribution,
  calculateTdee,
  type FitnessGoal,
  weightInKg,
} from '@kinetra/domain';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Field, Notice, SelectField } from '../components/ui';
import { useRepositories } from '../repositories';

const DRAFT_STORAGE_KEY = 'kinetra_onboarding_draft';

export interface OnboardingDraft {
  step: number;
  displayName: string;
  units: 'metric' | 'imperial';
  timezone: string;
  height: string;
  weight: string;
  biologicalSex: 'female' | 'male';
  age: string;
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  dietaryPreferences: string[];
  allergies: string[];
  equipment: string[];
}

const DEFAULT_DRAFT: OnboardingDraft = {
  step: 1,
  displayName: '',
  units: 'metric',
  timezone:
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      : 'Asia/Kolkata',
  height: '170',
  weight: '70',
  biologicalSex: 'female',
  age: '28',
  goal: 'cut',
  activityLevel: 'moderate',
  experienceLevel: 'intermediate',
  dietaryPreferences: [],
  allergies: [],
  equipment: ['bench', 'barbell', 'dumbbells', 'rack'],
};

const COMMON_DIETS = [
  'omnivore',
  'pescatarian',
  'vegetarian',
  'vegan',
  'high_protein',
  'keto',
  'low_carb',
];
const COMMON_ALLERGENS = [
  'peanuts',
  'dairy',
  'gluten',
  'fish',
  'shellfish',
  'soy',
  'eggs',
  'tree_nuts',
];
const COMMON_EQUIPMENT = [
  'barbell',
  'bench',
  'dumbbells',
  'rack',
  'cables',
  'pullup_bar',
  'bodyweight',
];

export function OnboardingView({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const repos = useRepositories();
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) return { ...DEFAULT_DRAFT, ...JSON.parse(saved) };
    } catch {
      // Fallback
    }
    return DEFAULT_DRAFT;
  });

  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) setHasRestoredDraft(true);
    } catch {
      // Ignore
    }
  }, []);

  const updateDraft = (updates: Partial<OnboardingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full or unavailable
      }
      return next;
    });
    setStepErrors({});
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setDraft(DEFAULT_DRAFT);
    setHasRestoredDraft(false);
    setStepErrors({});
  };

  const toggleArrayItem = (key: 'dietaryPreferences' | 'allergies' | 'equipment', item: string) => {
    const list = draft[key];
    const nextList = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
    updateDraft({ [key]: nextList });
  };

  // Convert inputs to metric numbers for formulas
  const numericHeightCm =
    draft.units === 'imperial'
      ? parseFloat(draft.height || '0') * 2.54
      : parseFloat(draft.height || '0');

  const numericWeightKg =
    draft.units === 'imperial'
      ? parseFloat(draft.weight || '0') * 0.453592
      : parseFloat(draft.weight || '0');

  const numericAge = parseInt(draft.age || '25', 10);

  // Validate per step
  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (draft.step === 1) {
      if (!draft.displayName.trim()) {
        errors.displayName = 'Display name is required.';
      }
      if (!draft.timezone.trim()) {
        errors.timezone = 'Timezone is required.';
      }
    } else if (draft.step === 2) {
      if (
        !draft.height ||
        Number.isNaN(numericHeightCm) ||
        numericHeightCm < 50 ||
        numericHeightCm > 250
      ) {
        errors.height = 'Enter a valid height between 50 and 250 cm (20–98 in).';
      }
      if (
        !draft.weight ||
        Number.isNaN(numericWeightKg) ||
        numericWeightKg < 20 ||
        numericWeightKg > 500
      ) {
        errors.weight = 'Enter a valid weight between 20 and 500 kg (44–1100 lb).';
      }
      if (!draft.age || Number.isNaN(numericAge) || numericAge < 13 || numericAge > 120) {
        errors.age = 'Enter an age between 13 and 120.';
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      updateDraft({ step: Math.min(5, draft.step + 1) });
    }
  };

  const handleBack = () => {
    updateDraft({ step: Math.max(1, draft.step - 1) });
  };

  // Complete onboarding and save profile
  const handleFinish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const height_cm = Math.round(numericHeightCm);
      const weight_kg = Number(numericWeightKg.toFixed(1));

      await repos.profile.saveProfile(0, {
        display_name: draft.displayName.trim(),
        height_cm,
        weight_kg,
        goal: draft.goal,
        timezone: draft.timezone,
        units: draft.units,
        biological_sex: draft.biologicalSex,
        age: numericAge,
        activity_level: draft.activityLevel,
        experience_level: draft.experienceLevel,
        dietary_preferences: draft.dietaryPreferences,
        allergies: draft.allergies,
        equipment: draft.equipment,
      });

      // Clear draft after successful creation
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore
      }

      onComplete();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Live calculations for Step 5 Review
  let bmrKcal = 0;
  let tdeeKcal = 0;
  let targetCalories = 2000;
  let macros = { protein_g: 140, carbs_g: 200, fat_g: 65 };

  if (numericHeightCm > 0 && numericWeightKg > 0 && numericAge > 0) {
    try {
      const bmr = calculateBmr({
        weight_kg: numericWeightKg,
        height_cm: numericHeightCm,
        age: numericAge,
        biological_sex: draft.biologicalSex,
      });
      bmrKcal = bmr.bmr_kcal;

      const tdee = calculateTdee({
        bmr_kcal: bmrKcal,
        activity_level: draft.activityLevel,
      });
      tdeeKcal = tdee.tdee_kcal;

      const target = calculateCalorieTarget({
        tdee_kcal: tdeeKcal,
        goal: draft.goal,
        biological_sex: draft.biologicalSex,
      });
      targetCalories = target.target_calories_kcal;

      const dist = calculateMacroDistribution({
        target_calories: targetCalories,
        weight_kg: numericWeightKg,
        goal: draft.goal,
      });
      macros = {
        protein_g: dist.protein_g,
        carbs_g: dist.carbs_g,
        fat_g: dist.fat_g,
      };
    } catch {
      // Fallback
    }
  }

  return (
    <div className="feature-view onboarding-wizard">
      <section className="hero-section">
        <p className="eyebrow">STEP-BY-STEP SETUP · VALIDATED DEFAULTS</p>
        <h1>Welcome to Kinetra</h1>
        <p className="intro">
          Establish your verified metabolic baseline, resistance training parameters, and dietary
          preferences.
        </p>
      </section>

      {hasRestoredDraft && (
        <div className="draft-notice-banner" role="status">
          <span>Unsaved onboarding draft restored from this device.</span>
          <Button size="small" variant="quiet" onClick={handleClearDraft}>
            Discard & Start Fresh
          </Button>
        </div>
      )}

      {/* Step Indicators */}
      <nav className="wizard-steps-nav" aria-label="Onboarding Progress">
        {[
          { num: 1, label: 'Basics' },
          { num: 2, label: 'Biometrics' },
          { num: 3, label: 'Goals' },
          { num: 4, label: 'Preferences' },
          { num: 5, label: 'Review' },
        ].map((s) => (
          <div
            key={s.num}
            className={`wizard-step-item ${draft.step === s.num ? 'active' : ''} ${draft.step > s.num ? 'completed' : ''}`}
            aria-current={draft.step === s.num ? 'step' : undefined}
          >
            <span className="wizard-step-num">{s.num}</span>
            <span className="wizard-step-label">{s.label}</span>
          </div>
        ))}
      </nav>

      {/* STEP 1: BASICS */}
      {draft.step === 1 && (
        <section className="card instrument" aria-labelledby="step1-title">
          <h2 id="step1-title" className="card-title">
            1. Account & Regional Settings
          </h2>
          <p className="card-desc">
            Provide your preferred display name, measurement units, and timezone for daily
            scheduling.
          </p>

          <Field
            label="Display Name"
            placeholder="e.g. Maya Lin"
            value={draft.displayName}
            onChange={(e) => updateDraft({ displayName: e.target.value })}
            error={stepErrors.displayName}
            help="Used to personalize coaching insights and logs."
            required
          />

          <SelectField
            label="Measurement Units"
            value={draft.units}
            onChange={(e) => updateDraft({ units: e.target.value as 'metric' | 'imperial' })}
            options={[
              { value: 'metric', label: 'Metric (Centimeters & Kilograms)' },
              { value: 'imperial', label: 'Imperial (Inches & Pounds)' },
            ]}
            help="You can change units at any time."
          />

          <Field
            label="Local Timezone"
            value={draft.timezone}
            onChange={(e) => updateDraft({ timezone: e.target.value })}
            error={stepErrors.timezone}
            help="Daily logs, meal schedules, and notifications follow your local timezone."
            required
          />
        </section>
      )}

      {/* STEP 2: BIOMETRICS */}
      {draft.step === 2 && (
        <section className="card instrument" aria-labelledby="step2-title">
          <h2 id="step2-title" className="card-title">
            2. Physical Profile & Biometrics
          </h2>
          <p className="card-desc">
            Required to calculate Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure
            (TDEE).
          </p>

          <Field
            label="Height"
            type="number"
            unit={draft.units === 'imperial' ? 'in' : 'cm'}
            value={draft.height}
            onChange={(e) => updateDraft({ height: e.target.value })}
            error={stepErrors.height}
            help={
              draft.units === 'imperial'
                ? `Approx. ${numericHeightCm.toFixed(1)} cm`
                : `Approx. ${(numericHeightCm / 2.54).toFixed(1)} inches`
            }
            required
          />

          <Field
            label="Current Weight"
            type="number"
            step="0.1"
            unit={draft.units === 'imperial' ? 'lb' : 'kg'}
            value={draft.weight}
            onChange={(e) => updateDraft({ weight: e.target.value })}
            error={stepErrors.weight}
            help={
              draft.units === 'imperial'
                ? `Approx. ${numericWeightKg.toFixed(1)} kg`
                : `Approx. ${(numericWeightKg * 2.20462).toFixed(1)} lb`
            }
            required
          />

          <SelectField
            label="Biological Sex"
            value={draft.biologicalSex}
            onChange={(e) => updateDraft({ biologicalSex: e.target.value as 'female' | 'male' })}
            options={[
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
            ]}
            help="Used strictly for Mifflin-St Jeor metabolic baseline formula coefficients."
          />

          <Field
            label="Age"
            type="number"
            value={draft.age}
            onChange={(e) => updateDraft({ age: e.target.value })}
            error={stepErrors.age}
            help="Years (must be at least 13)."
            required
          />
        </section>
      )}

      {/* STEP 3: GOALS & ACTIVITY */}
      {draft.step === 3 && (
        <section className="card instrument" aria-labelledby="step3-title">
          <h2 id="step3-title" className="card-title">
            3. Fitness Goals & Activity Level
          </h2>
          <p className="card-desc">
            Define your primary nutritional trajectory and baseline physical activity multiplier.
          </p>

          <SelectField
            label="Fitness Goal"
            value={draft.goal}
            onChange={(e) => updateDraft({ goal: e.target.value as FitnessGoal })}
            options={[
              { value: 'cut', label: 'Cut (Caloric Deficit / Fat Loss)' },
              { value: 'maintain', label: 'Maintain (Energy Balance / Performance)' },
              { value: 'bulk', label: 'Bulk (Moderate Caloric Surplus / Hypertrophy)' },
            ]}
            help="Modulates your daily caloric targets relative to calculated TDEE."
          />

          <SelectField
            label="Daily Activity Level"
            value={draft.activityLevel}
            onChange={(e) => updateDraft({ activityLevel: e.target.value as ActivityLevel })}
            options={[
              { value: 'sedentary', label: 'Sedentary (Little or no exercise, desk job)' },
              { value: 'light', label: 'Lightly Active (Exercise 1–3 days/week)' },
              { value: 'moderate', label: 'Moderately Active (Exercise 3–5 days/week)' },
              { value: 'very_active', label: 'Very Active (Hard exercise 6–7 days/week)' },
              { value: 'extra_active', label: 'Extra Active (Physical job or 2x daily training)' },
            ]}
            help="Determines your physical activity multiplier (1.20 to 1.90)."
          />

          <SelectField
            label="Lifting Experience Level"
            value={draft.experienceLevel}
            onChange={(e) =>
              updateDraft({
                experienceLevel: e.target.value as 'beginner' | 'intermediate' | 'advanced',
              })
            }
            options={[
              { value: 'beginner', label: 'Beginner (< 1 year structured lifting)' },
              { value: 'intermediate', label: 'Intermediate (1–3 years consistent training)' },
              { value: 'advanced', label: 'Advanced (3+ years progressive overload)' },
            ]}
            help="Guides workout volume and compound progression rates."
          />
        </section>
      )}

      {/* STEP 4: PREFERENCES & CONSTRAINTS */}
      {draft.step === 4 && (
        <section className="card instrument" aria-labelledby="step4-title">
          <h2 id="step4-title" className="card-title">
            4. Dietary Preferences & Equipment (Optional)
          </h2>
          <p className="card-desc">
            Tag any dietary patterns, strict allergies to exclude, and available training gear.
          </p>

          <div className="field-group">
            <span className="field-label">Dietary Preferences</span>
            <div className="chip-grid">
              {COMMON_DIETS.map((diet) => (
                <button
                  type="button"
                  key={diet}
                  className={`chip-btn ${draft.dietaryPreferences.includes(diet) ? 'selected' : ''}`}
                  onClick={() => toggleArrayItem('dietaryPreferences', diet)}
                >
                  {diet.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group" style={{ marginTop: '20px' }}>
            <span className="field-label">Allergies & Hard Exclusions</span>
            <div className="chip-grid">
              {COMMON_ALLERGENS.map((allergen) => (
                <button
                  type="button"
                  key={allergen}
                  className={`chip-btn ${draft.allergies.includes(allergen) ? 'selected' : ''}`}
                  onClick={() => toggleArrayItem('allergies', allergen)}
                >
                  {allergen.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group" style={{ marginTop: '20px' }}>
            <span className="field-label">Available Equipment</span>
            <div className="chip-grid">
              {COMMON_EQUIPMENT.map((eq) => (
                <button
                  type="button"
                  key={eq}
                  className={`chip-btn ${draft.equipment.includes(eq) ? 'selected' : ''}`}
                  onClick={() => toggleArrayItem('equipment', eq)}
                >
                  {eq.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP 5: REVIEW & CALCULATION ESTIMATION */}
      {draft.step === 5 && (
        <section className="card instrument" aria-labelledby="step5-title">
          <h2 id="step5-title" className="card-title">
            5. Review & Baseline Projections
          </h2>
          <p className="card-desc">
            Review your calculated metabolic baseline. All values are pure mathematical estimations.
          </p>

          <div className="macro-breakdown-row" style={{ marginBottom: '20px' }}>
            <div className="macro-chip">
              <span className="macro-chip-label">BMR Baseline</span>
              <span className="macro-chip-val tabular-nums">{bmrKcal} kcal</span>
            </div>
            <div className="macro-chip">
              <span className="macro-chip-label">Estimated TDEE</span>
              <span className="macro-chip-val tabular-nums">{tdeeKcal} kcal</span>
            </div>
            <div className="macro-chip">
              <span className="macro-chip-label">Target Daily Calories</span>
              <span className="macro-chip-val tabular-nums" style={{ fontWeight: 800 }}>
                {targetCalories} kcal
              </span>
            </div>
          </div>

          <div className="macro-breakdown-row" style={{ marginBottom: '24px' }}>
            <div className="macro-chip">
              <span className="macro-chip-label">Protein</span>
              <span className="macro-chip-val tabular-nums">{macros.protein_g}g</span>
            </div>
            <div className="macro-chip">
              <span className="macro-chip-label">Carbohydrates</span>
              <span className="macro-chip-val tabular-nums">{macros.carbs_g}g</span>
            </div>
            <div className="macro-chip">
              <span className="macro-chip-label">Fat</span>
              <span className="macro-chip-val tabular-nums">{macros.fat_g}g</span>
            </div>
          </div>

          <Notice variant="info">
            <strong>Camera & Permissions Note:</strong> Kinetra does not require camera or photo
            access during onboarding. All biometric computations occur locally according to
            published scientific equations.
          </Notice>

          {saveError && (
            <Notice variant="error" style={{ marginTop: '16px' }}>
              {saveError}
            </Notice>
          )}
        </section>
      )}

      {/* Navigation Buttons */}
      <div
        className="actions"
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}
      >
        <div>
          {draft.step > 1 && (
            <Button variant="secondary" onClick={handleBack} disabled={saving}>
              Back
            </Button>
          )}
          {draft.step === 1 && onCancel && (
            <Button variant="quiet" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>

        <div>
          {draft.step < 5 ? (
            <Button variant="primary" onClick={handleNext}>
              Next Step
            </Button>
          ) : (
            <Button variant="primary" onClick={handleFinish} loading={saving}>
              Save Profile & Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
