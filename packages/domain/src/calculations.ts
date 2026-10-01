export type BiologicalSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
export type FitnessGoal = 'cut' | 'maintain' | 'bulk';

export const PAL_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export interface BmrEstimate {
  readonly bmr_kcal: number;
  readonly is_estimate: true;
  readonly formula: 'mifflin_st_jeor';
  readonly citation: string;
  readonly stated_assumptions: readonly string[];
  readonly confidence_interval_kcal: { min: number; max: number };
}

export function calculateBmr(params: {
  weight_kg: number;
  height_cm: number;
  age: number;
  biological_sex: BiologicalSex;
}): BmrEstimate {
  const { weight_kg, height_cm, age, biological_sex } = params;

  if (!Number.isFinite(weight_kg) || weight_kg < 20 || weight_kg > 500) {
    throw new Error(`Weight ${weight_kg} kg is outside valid range (20–500 kg)`);
  }
  if (!Number.isFinite(height_cm) || height_cm < 50 || height_cm > 250) {
    throw new Error(`Height ${height_cm} cm is outside valid range (50–250 cm)`);
  }
  if (!Number.isInteger(age) || age < 13 || age > 120) {
    throw new Error(`Age ${age} is outside valid range (13–120 years)`);
  }
  if (biological_sex !== 'male' && biological_sex !== 'female') {
    throw new Error('Biological sex must be male or female for Mifflin-St Jeor calculation');
  }

  // Mifflin-St Jeor Equation (1990)
  // Men: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + 5
  // Women: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) - 161
  const s = biological_sex === 'male' ? 5 : -161;
  const rawBmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + s;
  const bmr_kcal = Math.round(rawBmr);

  // Confidence interval reflects ~±10% clinical predictive variance
  const min = Math.round(bmr_kcal * 0.9);
  const max = Math.round(bmr_kcal * 1.1);

  return {
    bmr_kcal,
    is_estimate: true,
    formula: 'mifflin_st_jeor',
    citation:
      'Mifflin MD, St Jeor ST, Hill JO, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
    stated_assumptions: [
      'Assumes healthy adult resting metabolic state at thermoneutral ambient temperature.',
      `Biological sex factor applied: ${biological_sex === 'male' ? '+5 kcal' : '-161 kcal'}.`,
      'Predictive equation carries ~±10% variance compared to direct indirect calorimetry.',
    ],
    confidence_interval_kcal: { min, max },
  };
}

export interface TdeeEstimate {
  readonly tdee_kcal: number;
  readonly bmr_kcal: number;
  readonly pal_multiplier: number;
  readonly activity_level: ActivityLevel;
  readonly is_estimate: true;
  readonly stated_assumptions: readonly string[];
  readonly confidence_interval_kcal: { min: number; max: number };
}

export function calculateTdee(params: {
  bmr_kcal: number;
  activity_level: ActivityLevel;
}): TdeeEstimate {
  const { bmr_kcal, activity_level } = params;
  if (!Number.isFinite(bmr_kcal) || bmr_kcal <= 0) {
    throw new Error('BMR must be a positive finite number');
  }
  const pal_multiplier = PAL_MULTIPLIERS[activity_level];
  if (!pal_multiplier) {
    throw new Error(`Unsupported activity level: ${activity_level}`);
  }

  const rawTdee = bmr_kcal * pal_multiplier;
  const tdee_kcal = Math.round(rawTdee);

  return {
    tdee_kcal,
    bmr_kcal,
    pal_multiplier,
    activity_level,
    is_estimate: true,
    stated_assumptions: [
      `Physical Activity Level (PAL) multiplier ${pal_multiplier} applied based on '${activity_level}' reporting.`,
      'Non-exercise activity thermogenesis (NEAT) and exercise energy expenditure vary across individual days.',
    ],
    confidence_interval_kcal: {
      min: Math.round(tdee_kcal * 0.9),
      max: Math.round(tdee_kcal * 1.1),
    },
  };
}

export interface CalorieTargetEstimate {
  readonly target_calories_kcal: number;
  readonly baseline_tdee_kcal: number;
  readonly adjustment_kcal: number;
  readonly adjustment_percentage: number;
  readonly goal: FitnessGoal;
  readonly safety_floor_applied: boolean;
  readonly is_estimate: true;
  readonly stated_assumptions: readonly string[];
  readonly policy_reference: string;
}

export function calculateCalorieTarget(params: {
  tdee_kcal: number;
  goal: FitnessGoal;
  biological_sex?: BiologicalSex;
  custom_adjustment_percent?: number;
}): CalorieTargetEstimate {
  const { tdee_kcal, goal, biological_sex, custom_adjustment_percent } = params;
  if (!Number.isFinite(tdee_kcal) || tdee_kcal <= 0) {
    throw new Error('TDEE must be a positive finite number');
  }

  let adjustment_percentage = 0;
  if (custom_adjustment_percent !== undefined) {
    if (custom_adjustment_percent < -40 || custom_adjustment_percent > 40) {
      throw new Error('Custom calorie adjustment percent must be between -40% and +40%');
    }
    adjustment_percentage = custom_adjustment_percent;
  } else {
    if (goal === 'cut') adjustment_percentage = -20;
    else if (goal === 'bulk') adjustment_percentage = 10;
    else adjustment_percentage = 0;
  }

  const unconstrained = Math.round(tdee_kcal * (1 + adjustment_percentage / 100));

  // ACSM / Harvard Health safe energy intake floors: 1200 kcal (female), 1500 kcal (male), default 1200 kcal
  const floor = biological_sex === 'male' ? 1500 : 1200;
  let target_calories_kcal = unconstrained;
  let safety_floor_applied = false;

  if (target_calories_kcal < floor) {
    target_calories_kcal = floor;
    safety_floor_applied = true;
  }

  const adjustment_kcal = target_calories_kcal - tdee_kcal;

  return {
    target_calories_kcal,
    baseline_tdee_kcal: tdee_kcal,
    adjustment_kcal,
    adjustment_percentage,
    goal,
    safety_floor_applied,
    is_estimate: true,
    stated_assumptions: [
      goal === 'cut'
        ? `Calorie deficit of ${Math.abs(adjustment_percentage)}% applied to facilitate safe fat loss while preserving lean mass.`
        : goal === 'bulk'
          ? `Calorie surplus of ${adjustment_percentage}% applied to support muscle protein synthesis.`
          : 'Caloric balance set equal to estimated TDEE for bodyweight maintenance.',
      safety_floor_applied
        ? `Target was clamped to clinical safety floor (${floor} kcal/day) to prevent metabolic or nutritional deficiency.`
        : `Within standard evidence-based bounds (minimum guideline floor: ${floor} kcal/day).`,
    ],
    policy_reference:
      'ACSM / Dietary Guidelines for Americans energy balance recommendation with safe deficit thresholds.',
  };
}

export interface MacroDistributionEstimate {
  readonly target_calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly protein_calories: number;
  readonly carbs_calories: number;
  readonly fat_calories: number;
  readonly protein_ratio_g_per_kg: number;
  readonly fat_percentage_of_calories: number;
  readonly is_estimate: true;
  readonly stated_assumptions: readonly string[];
}

export function calculateMacroDistribution(params: {
  target_calories: number;
  weight_kg: number;
  goal: FitnessGoal;
  custom_protein_g_per_kg?: number;
  custom_fat_percentage?: number;
}): MacroDistributionEstimate {
  const { target_calories, weight_kg, goal, custom_protein_g_per_kg, custom_fat_percentage } =
    params;

  if (!Number.isFinite(target_calories) || target_calories < 500) {
    throw new Error('Target calories must be at least 500 kcal');
  }
  if (!Number.isFinite(weight_kg) || weight_kg < 20 || weight_kg > 500) {
    throw new Error('Weight must be between 20 kg and 500 kg');
  }

  // Protein guideline: 1.6 to 2.2 g/kg (Morton et al. 2018). Default 2.0 for cut, 1.8 for maintain/bulk.
  const protein_ratio_g_per_kg = custom_protein_g_per_kg ?? (goal === 'cut' ? 2.0 : 1.8);
  const protein_g = Math.round(weight_kg * protein_ratio_g_per_kg);
  const protein_calories = protein_g * 4;

  // Fat guideline: 20% to 30% of total energy. Default 25%.
  const fat_percentage_of_calories = custom_fat_percentage ?? 25;
  const fat_calories = Math.round(target_calories * (fat_percentage_of_calories / 100));
  const fat_g = Math.round(fat_calories / 9);

  // Carbs: remaining energy divided by 4 kcal/g
  const remaining_calories = Math.max(0, target_calories - protein_calories - fat_calories);
  const carbs_g = Math.round(remaining_calories / 4);
  const carbs_calories = carbs_g * 4;

  return {
    target_calories,
    protein_g,
    carbs_g,
    fat_g,
    protein_calories,
    carbs_calories,
    fat_calories,
    protein_ratio_g_per_kg,
    fat_percentage_of_calories,
    is_estimate: true,
    stated_assumptions: [
      `Protein: ${protein_ratio_g_per_kg.toFixed(1)} g/kg bodyweight (${protein_g}g / ${protein_calories} kcal) per sports nutrition guidelines.`,
      `Fat: ${fat_percentage_of_calories}% of total calories (${fat_g}g / ${fat_calories} kcal) for essential fatty acids and hormone production.`,
      `Carbohydrates: Remaining energy (${carbs_g}g / ${carbs_calories} kcal) allocated for glycogen and training performance.`,
    ],
  };
}

export interface NavyBodyFatEstimate {
  readonly body_fat_percentage: number;
  readonly biological_sex: BiologicalSex;
  readonly is_estimate: true;
  readonly formula: 'us_navy_anthropometric';
  readonly stated_assumptions: readonly string[];
}

export function calculateNavyBodyFat(params: {
  height_cm: number;
  waist_cm: number;
  neck_cm: number;
  hip_cm?: number | undefined;
  biological_sex: BiologicalSex;
}): NavyBodyFatEstimate {
  const { height_cm, waist_cm, neck_cm, hip_cm, biological_sex } = params;

  if (height_cm <= 0 || waist_cm <= 0 || neck_cm <= 0) {
    throw new Error('Circumferences and height must be positive numbers');
  }

  let body_fat_percentage = 0;

  if (biological_sex === 'male') {
    if (waist_cm <= neck_cm) {
      throw new Error(
        'Waist circumference must be greater than neck circumference for male formula',
      );
    }
    // %BF = 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
    const density =
      1.0324 - 0.19077 * Math.log10(waist_cm - neck_cm) + 0.15456 * Math.log10(height_cm);
    body_fat_percentage = Math.round((495 / density - 450) * 10) / 10;
  } else {
    if (!hip_cm || hip_cm <= 0) {
      throw new Error('Hip circumference is required for female body fat calculation');
    }
    if (waist_cm + hip_cm <= neck_cm) {
      throw new Error('Waist + hip circumference must be greater than neck circumference');
    }
    // %BF = 495 / (1.29579 - 0.35004 * log10(waist + hip - neck) + 0.22100 * log10(height)) - 450
    const density =
      1.29579 - 0.35004 * Math.log10(waist_cm + hip_cm - neck_cm) + 0.221 * Math.log10(height_cm);
    body_fat_percentage = Math.round((495 / density - 450) * 10) / 10;
  }

  // Bound to sensible human limits (3% to 60%)
  body_fat_percentage = Math.max(3, Math.min(60, body_fat_percentage));

  return {
    body_fat_percentage,
    biological_sex,
    is_estimate: true,
    formula: 'us_navy_anthropometric',
    stated_assumptions: [
      'Calculated via U.S. Navy Anthropometric tape-measure equation (Hodgdon & Beckett).',
      'Provides an empirical estimate with ±3–4% error margin compared to DEXA; not a clinical diagnostic scan.',
    ],
  };
}
