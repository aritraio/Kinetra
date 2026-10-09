import type {
  MealDay,
  MealItem,
  MealPlanPayload,
  WorkoutDay,
  WorkoutExercise,
  WorkoutPlanPayload,
} from '@kinetra/contracts';
import {
  type MealVerificationOptions,
  type MealVerificationProfile,
  verifyMealPlan,
} from './meal-verifier';
import {
  type WorkoutVerificationOptions,
  type WorkoutVerificationProfile,
  verifyWorkoutPlan,
} from './workout-verifier';

interface FoodStaple {
  id: string;
  name: string;
  unit: string;
  calPer100: number;
  pPer100: number;
  cPer100: number;
  fPer100: number;
  category: 'protein' | 'grain' | 'fat' | 'veggie';
  allergens: string[];
}

const STAPLES: readonly FoodStaple[] = [
  {
    id: 'chicken_breast',
    name: 'Boneless Skinless Chicken Breast',
    unit: 'g',
    calPer100: 165,
    pPer100: 31.0,
    cPer100: 0.0,
    fPer100: 3.6,
    category: 'protein',
    allergens: [],
  },
  {
    id: 'egg_whites',
    name: 'Liquid Egg Whites',
    unit: 'g',
    calPer100: 52,
    pPer100: 10.9,
    cPer100: 0.7,
    fPer100: 0.2,
    category: 'protein',
    allergens: ['eggs'],
  },
  {
    id: 'salmon_atlantic',
    name: 'Atlantic Salmon Fillet',
    unit: 'g',
    calPer100: 208,
    pPer100: 20.4,
    cPer100: 0.0,
    fPer100: 13.4,
    category: 'protein',
    allergens: ['fish'],
  },
  {
    id: 'greek_yogurt_nonfat',
    name: 'Nonfat Plain Greek Yogurt',
    unit: 'g',
    calPer100: 59,
    pPer100: 10.2,
    cPer100: 3.6,
    fPer100: 0.4,
    category: 'protein',
    allergens: ['dairy'],
  },
  {
    id: 'tofu_firm',
    name: 'Firm Tofu',
    unit: 'g',
    calPer100: 83,
    pPer100: 10.0,
    cPer100: 1.2,
    fPer100: 5.3,
    category: 'protein',
    allergens: ['soy'],
  },
  {
    id: 'eggs_whole',
    name: 'Whole Large Egg',
    unit: 'g',
    calPer100: 143,
    pPer100: 12.6,
    cPer100: 0.7,
    fPer100: 9.5,
    category: 'protein',
    allergens: ['eggs'],
  },
  {
    id: 'brown_rice',
    name: 'Cooked Brown Rice',
    unit: 'g',
    calPer100: 123,
    pPer100: 2.7,
    cPer100: 25.6,
    fPer100: 1.0,
    category: 'grain',
    allergens: [],
  },
  {
    id: 'white_rice',
    name: 'Cooked White Jasmine Rice',
    unit: 'g',
    calPer100: 130,
    pPer100: 2.4,
    cPer100: 28.2,
    fPer100: 0.3,
    category: 'grain',
    allergens: [],
  },
  {
    id: 'rolled_oats',
    name: 'Rolled Oats (Dry)',
    unit: 'g',
    calPer100: 379,
    pPer100: 13.2,
    cPer100: 67.7,
    fPer100: 6.5,
    category: 'grain',
    allergens: ['gluten'],
  },
  {
    id: 'sweet_potato',
    name: 'Baked Sweet Potato',
    unit: 'g',
    calPer100: 90,
    pPer100: 2.0,
    cPer100: 20.7,
    fPer100: 0.1,
    category: 'grain',
    allergens: [],
  },
  {
    id: 'olive_oil_extra_virgin',
    name: 'Extra Virgin Olive Oil',
    unit: 'g',
    calPer100: 884,
    pPer100: 0.0,
    cPer100: 0.0,
    fPer100: 100.0,
    category: 'fat',
    allergens: [],
  },
  {
    id: 'peanut_butter_natural',
    name: 'Natural Peanut Butter',
    unit: 'g',
    calPer100: 588,
    pPer100: 25.1,
    cPer100: 20.0,
    fPer100: 50.4,
    category: 'fat',
    allergens: ['peanuts'],
  },
  {
    id: 'broccoli_steamed',
    name: 'Steamed Broccoli Florets',
    unit: 'g',
    calPer100: 35,
    pPer100: 2.4,
    cPer100: 7.2,
    fPer100: 0.4,
    category: 'veggie',
    allergens: [],
  },
  {
    id: 'spinach_fresh',
    name: 'Fresh Baby Spinach',
    unit: 'g',
    calPer100: 23,
    pPer100: 2.9,
    cPer100: 3.6,
    fPer100: 0.4,
    category: 'veggie',
    allergens: [],
  },
];

function isAllowedStaple(
  s: FoodStaple,
  allergies: Set<string>,
  diet: string,
  pantryList?: readonly string[] | undefined,
): boolean {
  if (s.allergens.some((a) => allergies.has(a))) return false;

  const isVegan = diet === 'vegan';
  const isVeg = diet === 'vegetarian' || isVegan;
  const isPescatarian = diet === 'pescatarian';

  if (
    isVegan &&
    (s.id === 'chicken_breast' ||
      s.id === 'egg_whites' ||
      s.id === 'salmon_atlantic' ||
      s.id === 'greek_yogurt_nonfat' ||
      s.id === 'eggs_whole')
  ) {
    return false;
  }

  if (isVeg && (s.id === 'chicken_breast' || s.id === 'salmon_atlantic')) {
    return false;
  }

  if (isPescatarian && s.id === 'chicken_breast') {
    return false;
  }

  if (pantryList) {
    const inPantry = pantryList.some((p) => {
      const pl = p.toLowerCase().trim();
      return pl.includes(s.id) || s.id.includes(pl) || s.name.toLowerCase().includes(pl);
    });
    if (!inPantry) return false;
  }

  return true;
}

const defaultProteinStaple: FoodStaple = {
  id: 'chicken_breast',
  name: 'Boneless Skinless Chicken Breast',
  unit: 'g',
  calPer100: 165,
  pPer100: 31,
  cPer100: 0,
  fPer100: 3.6,
  category: 'protein',
  allergens: [],
};

const defaultGrainStaple: FoodStaple = {
  id: 'brown_rice',
  name: 'Cooked Brown Rice',
  unit: 'g',
  calPer100: 111,
  pPer100: 2.6,
  cPer100: 23,
  fPer100: 0.9,
  category: 'grain',
  allergens: [],
};

const defaultFatStaple: FoodStaple = {
  id: 'olive_oil_extra_virgin',
  name: 'Extra Virgin Olive Oil',
  unit: 'g',
  calPer100: 884,
  pPer100: 0,
  cPer100: 0,
  fPer100: 100,
  category: 'fat',
  allergens: [],
};

const defaultProduceStaple: FoodStaple = {
  id: 'broccoli_steamed',
  name: 'Steamed Broccoli florets',
  unit: 'g',
  calPer100: 35,
  pPer100: 2.4,
  cPer100: 7.2,
  fPer100: 0.4,
  category: 'veggie',
  allergens: [],
};

function selectStaple(
  category: FoodStaple['category'],
  allergies: Set<string>,
  diet: string,
  targetProtein: number,
  targetFat: number,
  pantryList?: readonly string[] | undefined,
): FoodStaple {
  const allowed = STAPLES.filter(
    (s) => s.category === category && isAllowedStaple(s, allergies, diet, pantryList),
  );

  if (category === 'protein') {
    if (allowed.length > 0) {
      const maxAllowedRatio = (targetFat + 8) / Math.max(1, targetProtein);
      const safe = allowed.filter((s) => s.fPer100 / Math.max(1, s.pPer100) <= maxAllowedRatio);
      if (safe.length > 0) {
        const sorted = [...safe].sort((a, b) => b.pPer100 - a.pPer100);
        return sorted[0] ?? defaultProteinStaple;
      }
      const sorted = [...allowed].sort(
        (a, b) => a.fPer100 / Math.max(1, a.pPer100) - b.fPer100 / Math.max(1, b.pPer100),
      );
      return sorted[0] ?? defaultProteinStaple;
    }

    if (diet === 'vegan') return STAPLES.find((s) => s.id === 'tofu_firm') ?? defaultProteinStaple;
    if (diet === 'vegetarian')
      return STAPLES.find((s) => s.id === 'egg_whites') ?? defaultProteinStaple;
    if (diet === 'pescatarian')
      return STAPLES.find((s) => s.id === 'salmon_atlantic') ?? defaultProteinStaple;
    return STAPLES[0] ?? defaultProteinStaple;
  }

  if (category === 'grain') {
    if (allowed.length > 0) {
      if (diet === 'vegan' || targetFat < 50) {
        const whiteRice = allowed.find((s) => s.id === 'white_rice');
        if (whiteRice) return whiteRice;
      }
      return allowed[0] ?? defaultGrainStaple;
    }
    return STAPLES.find((s) => s.id === 'brown_rice') ?? defaultGrainStaple;
  }

  if (category === 'fat') {
    if (allowed.length > 0) return allowed[0] ?? defaultFatStaple;
    return STAPLES.find((s) => s.id === 'olive_oil_extra_virgin') ?? defaultFatStaple;
  }

  if (allowed.length > 0) return allowed[0] ?? defaultProduceStaple;
  return STAPLES.find((s) => s.id === 'broccoli_steamed') ?? defaultProduceStaple;
}

function createItem(staple: FoodStaple, grams: number): MealItem {
  const g = Math.max(10, Math.round(grams));
  const factor = g / 100;
  const p = Math.round(staple.pPer100 * factor * 10) / 10;
  const c = Math.round(staple.cPer100 * factor * 10) / 10;
  const f = Math.round(staple.fPer100 * factor * 10) / 10;
  const cal = Math.round(4 * p + 4 * c + 9 * f);
  return {
    ingredient_id: staple.id,
    name: staple.name,
    amount: g,
    unit: staple.unit,
    calories: cal,
    protein_g: p,
    carbs_g: c,
    fat_g: f,
  };
}

export function getFallbackMealPlan(
  profile: MealVerificationProfile,
  options?: MealVerificationOptions,
): MealPlanPayload | null {
  const targetCal = Math.round(profile.target_calories);
  const targetP = Math.round(profile.target_protein_g);
  const targetC = Math.round(profile.target_carbs_g);
  const targetF = Math.round(profile.target_fat_g);

  if (targetCal < 800 || targetCal > 6000 || targetP < 20 || targetF < 10) {
    return null; // Unsatisfiable boundary
  }

  const allergies = new Set((profile.allergies ?? []).map((a) => a.toLowerCase().trim()));
  const diet = (profile.dietary_preferences?.[0] ?? 'omnivore').toLowerCase().trim();
  const pantryList = profile.pantry_only ? profile.pantry_ingredients : undefined;

  const proteinStaple = selectStaple('protein', allergies, diet, targetP, targetF, pantryList);
  const carbStaple = selectStaple('grain', allergies, diet, targetP, targetF, pantryList);
  const fatStaple = selectStaple('fat', allergies, diet, targetP, targetF, pantryList);
  const veggieStaple = selectStaple('veggie', allergies, diet, targetP, targetF, pantryList);

  // 1. Calibrate macro targets if target_calories deviates from 4P + 4C + 9F
  const macroCal = 4 * targetP + 4 * targetC + 9 * targetF;
  const calDelta = targetCal - macroCal;

  let effectiveP = targetP;
  let effectiveC = targetC;
  let effectiveF = targetF;

  if (Math.abs(calDelta) > 10) {
    const pShift = Math.max(-8, Math.min(8, Math.round((calDelta * 0.2) / 4)));
    const cShift = Math.max(-16, Math.min(16, Math.round((calDelta * 0.45) / 4)));
    const fShift = Math.max(-8, Math.min(8, Math.round((calDelta * 0.35) / 9)));
    effectiveP += pShift;
    effectiveC += cShift;
    effectiveF += fShift;
  }

  if (diet === 'vegan' && effectiveF < 55) {
    effectiveP = Math.max(targetP - 8, effectiveP - 6);
  }

  // 2. Veggie baseline: 120g per day
  const veggieGrams = 120;
  const vFactor = veggieGrams / 100;
  const pFromVeg = veggieStaple.pPer100 * vFactor;
  const cFromVeg = veggieStaple.cPer100 * vFactor;
  const fFromVeg = veggieStaple.fPer100 * vFactor;

  // 3. Solve 2x2 system for protein staple and carb staple
  const pNeeded = Math.max(10, effectiveP - pFromVeg);
  const cNeeded = Math.max(10, effectiveC - cFromVeg);

  const p1 = proteinStaple.pPer100 / 100;
  const c1 = proteinStaple.cPer100 / 100;
  const p2 = carbStaple.pPer100 / 100;
  const c2 = carbStaple.cPer100 / 100;

  const det = p1 * c2 - p2 * c1;
  let dailyProteinGrams = 0;
  let dailyCarbGrams = 0;

  if (Math.abs(det) > 0.001) {
    dailyProteinGrams = Math.max(30, (pNeeded * c2 - cNeeded * p2) / det);
    dailyCarbGrams = Math.max(30, (cNeeded * p1 - pNeeded * c1) / det);
  } else {
    dailyProteinGrams = Math.max(30, pNeeded / Math.max(0.05, p1));
    dailyCarbGrams = Math.max(30, cNeeded / Math.max(0.05, c2));
  }

  // 4. Solve fat staple grams
  const fSoFar =
    (dailyProteinGrams / 100) * proteinStaple.fPer100 +
    (dailyCarbGrams / 100) * carbStaple.fPer100 +
    fFromVeg;
  const fNeeded = effectiveF - fSoFar;
  const dailyFatGrams = fNeeded > 3 ? Math.max(0, fNeeded / (fatStaple.fPer100 / 100)) : 0;

  const daysCount = profile.days_count ?? 7;
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const days: MealDay[] = [];

  for (let d = 1; d <= daysCount; d++) {
    const mealFractions = [
      { id: 'm1', name: 'Energizing Breakfast', time: '08:00', frac: 0.3 },
      { id: 'm2', name: 'Balanced Power Lunch', time: '13:00', frac: 0.35 },
      { id: 'm3', name: 'Nourishing Dinner', time: '19:00', frac: 0.35 },
    ];

    const dayMeals = mealFractions.map((m) => {
      const pItem = createItem(proteinStaple, dailyProteinGrams * m.frac);
      const cItem = createItem(carbStaple, dailyCarbGrams * m.frac);
      const vItem = createItem(veggieStaple, veggieGrams * m.frac);
      const items: MealItem[] = [pItem, cItem, vItem];

      const mealFatGrams = dailyFatGrams * m.frac;
      if (mealFatGrams >= 4) {
        items.push(createItem(fatStaple, mealFatGrams));
      }

      const mealCal = items.reduce((s, i) => s + i.calories, 0);
      const mealP = Math.round(items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10;
      const mealC = Math.round(items.reduce((s, i) => s + i.carbs_g, 0) * 10) / 10;
      const mealF = Math.round(items.reduce((s, i) => s + i.fat_g, 0) * 10) / 10;

      return {
        meal_id: m.id,
        name: m.name,
        target_time: m.time,
        calories: mealCal,
        protein_g: mealP,
        carbs_g: mealC,
        fat_g: mealF,
        items,
      };
    });

    const meal3 = dayMeals[2] ?? dayMeals[0];
    if (meal3) {
      const curDayP = Math.round(dayMeals.reduce((s, m) => s + m.protein_g, 0) * 10) / 10;
      const curDayC = Math.round(dayMeals.reduce((s, m) => s + m.carbs_g, 0) * 10) / 10;

      const deltaC = effectiveC - curDayC;
      if (Math.abs(deltaC) > 5 && meal3.items[1]) {
        const carbItem = meal3.items[1];
        const adjGrams = Math.round(deltaC / (carbStaple.cPer100 / 100));
        const newGrams = Math.max(20, carbItem.amount + adjGrams);
        meal3.items[1] = createItem(carbStaple, newGrams);
      }

      const deltaP = effectiveP - curDayP;
      if (Math.abs(deltaP) > 4 && meal3.items[0]) {
        const pItem = meal3.items[0];
        const adjGrams = Math.round(deltaP / (proteinStaple.pPer100 / 100));
        const newGrams = Math.max(20, pItem.amount + adjGrams);
        meal3.items[0] = createItem(proteinStaple, newGrams);
      }

      meal3.calories = meal3.items.reduce((s, i) => s + i.calories, 0);
      meal3.protein_g = Math.round(meal3.items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10;
      meal3.carbs_g = Math.round(meal3.items.reduce((s, i) => s + i.carbs_g, 0) * 10) / 10;
      meal3.fat_g = Math.round(meal3.items.reduce((s, i) => s + i.fat_g, 0) * 10) / 10;

      // Calorie calibration: ensure day calories land within +/-30 kcal of targetCal
      const intermediateDayCal = dayMeals.reduce((s, m) => s + m.calories, 0);
      const curCalDiff = intermediateDayCal - targetCal;
      if (Math.abs(curCalDiff) > 20 && meal3.items[1]) {
        const carbItem = meal3.items[1];
        const carbsToShift = Math.max(
          -20,
          Math.min(20, Math.round(-curCalDiff / (carbStaple.calPer100 / 100))),
        );
        if (carbsToShift !== 0 && carbItem.amount + carbsToShift >= 20) {
          meal3.items[1] = createItem(carbStaple, carbItem.amount + carbsToShift);
        }
      }

      // Final reconciliation for meal 3
      meal3.calories = meal3.items.reduce((s, i) => s + i.calories, 0);
      meal3.protein_g = Math.round(meal3.items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10;
      meal3.carbs_g = Math.round(meal3.items.reduce((s, i) => s + i.carbs_g, 0) * 10) / 10;
      meal3.fat_g = Math.round(meal3.items.reduce((s, i) => s + i.fat_g, 0) * 10) / 10;
    }

    const finalDayCal = dayMeals.reduce((s, m) => s + m.calories, 0);
    const finalDayP = Math.round(dayMeals.reduce((s, m) => s + m.protein_g, 0) * 10) / 10;
    const finalDayC = Math.round(dayMeals.reduce((s, m) => s + m.carbs_g, 0) * 10) / 10;
    const finalDayF = Math.round(dayMeals.reduce((s, m) => s + m.fat_g, 0) * 10) / 10;

    days.push({
      day_number: d,
      day_name: dayNames[(d - 1) % 7] ?? `Day ${d}`,
      total_calories: finalDayCal,
      total_protein_g: finalDayP,
      total_carbs_g: finalDayC,
      total_fat_g: finalDayF,
      meals: dayMeals,
    });
  }

  const payload: MealPlanPayload = {
    kind: 'meal',
    schema_version: '2026-10-01',
    policy_version: '2026-10-01',
    target_calories: targetCal,
    target_protein_g: targetP,
    target_carbs_g: targetC,
    target_fat_g: targetF,
    days,
    notes: 'Verified fallback meal plan generated from nutrient-dense staples.',
  };

  const verification = verifyMealPlan(payload, profile, options);
  if (!verification.valid) {
    return null;
  }

  return payload;
}

export function getFallbackWorkoutPlan(
  profile: WorkoutVerificationProfile,
  options?: WorkoutVerificationOptions,
): WorkoutPlanPayload | null {
  const daysPerWeek = profile.days_per_week;
  if (daysPerWeek < 1 || daysPerWeek > 7) return null;

  const equipment = new Set((profile.available_equipment ?? []).map((e) => e.toLowerCase().trim()));
  const hasBarbell = equipment.has('barbell');
  const hasSquatRack = equipment.has('squat_rack') || equipment.has('rack');
  const hasBench =
    equipment.has('bench') ||
    equipment.has('flat_bench') ||
    equipment.has('adjustable_bench') ||
    equipment.has('incline_bench');
  const hasDumbbells = equipment.has('dumbbells') || equipment.has('dumbbell');
  const hasPullUpBar =
    equipment.has('pull_up_bar') || equipment.has('pullup_bar') || equipment.has('pull up bar');

  // Exercise selection strictly tailored to available equipment
  const squatEx: WorkoutExercise =
    hasBarbell && hasSquatRack
      ? {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          target_sets: 3,
          target_reps: '6-8',
          rest_seconds: 120,
          equipment: 'barbell',
          instructions: 'Descend until hip crease is below knee.',
        }
      : hasDumbbells
        ? {
            exercise_id: 'walking_lunges_dumbbell',
            name: 'Dumbbell Walking Lunges',
            target_sets: 3,
            target_reps: '8-12',
            rest_seconds: 90,
            equipment: 'dumbbells',
            instructions: 'Take consistent strides with upright torso.',
          }
        : {
            exercise_id: 'bodyweight_squat',
            name: 'Bodyweight Air Squats',
            target_sets: 3,
            target_reps: '15-20',
            rest_seconds: 60,
            equipment: 'bodyweight',
            instructions: 'Control descent, stand tall at top.',
          };

  const pushEx: WorkoutExercise =
    hasBarbell && hasBench
      ? {
          exercise_id: 'barbell_bench_press',
          name: 'Barbell Bench Press',
          target_sets: 3,
          target_reps: '6-8',
          rest_seconds: 120,
          equipment: 'barbell',
          instructions: 'Retract scapulae, touch lower sternum.',
        }
      : hasDumbbells && hasBench
        ? {
            exercise_id: 'dumbbell_incline_press',
            name: 'Incline Dumbbell Bench Press',
            target_sets: 3,
            target_reps: '8-10',
            rest_seconds: 90,
            equipment: 'dumbbells',
            instructions: 'Lower dumbbells with control.',
          }
        : {
            exercise_id: 'pushup_standard',
            name: 'Standard Push-Up',
            target_sets: 3,
            target_reps: '10-15',
            rest_seconds: 60,
            equipment: 'bodyweight',
            instructions: 'Maintain rigid plank line.',
          };

  const pullEx: WorkoutExercise = hasBarbell
    ? {
        exercise_id: 'barbell_bent_over_row',
        name: 'Barbell Bent-Over Row',
        target_sets: 3,
        target_reps: '8-10',
        rest_seconds: 90,
        equipment: 'barbell',
        instructions: 'Hinge at 45 degrees, pull bar to navel.',
      }
    : hasDumbbells
      ? {
          exercise_id: 'dumbbell_bicep_curl',
          name: 'Standing Dumbbell Bicep Curl',
          target_sets: 3,
          target_reps: '10-12',
          rest_seconds: 60,
          equipment: 'dumbbells',
          instructions: 'Keep elbows pinned, supinate at top.',
        }
      : hasPullUpBar
        ? {
            exercise_id: 'pull_up',
            name: 'Overhand Pull-Up',
            target_sets: 3,
            target_reps: '6-10',
            rest_seconds: 90,
            equipment: 'pull_up_bar',
            instructions: 'Full dead hang to chin over bar.',
          }
        : {
            exercise_id: 'inverted_row_bodyweight',
            name: 'Inverted Row / Pull-Up',
            target_sets: 3,
            target_reps: '8-12',
            rest_seconds: 60,
            equipment: 'bodyweight',
            instructions: 'Pull chest toward bar.',
          };

  const hingeEx: WorkoutExercise = hasBarbell
    ? {
        exercise_id: 'barbell_deadlift',
        name: 'Conventional Barbell Deadlift',
        target_sets: 3,
        target_reps: '5',
        rest_seconds: 180,
        equipment: 'barbell',
        instructions: 'Lock lats, push floor away through midfoot.',
      }
    : hasDumbbells
      ? {
          exercise_id: 'romanian_deadlift_dumbbell',
          name: 'Dumbbell Romanian Deadlift (RDL)',
          target_sets: 3,
          target_reps: '8-10',
          rest_seconds: 90,
          equipment: 'dumbbells',
          instructions: 'Hinge back at hips feeling hamstring stretch.',
        }
      : {
          exercise_id: 'glute_bridge_bodyweight',
          name: 'Single-Leg Glute Bridge',
          target_sets: 3,
          target_reps: '12-15',
          rest_seconds: 60,
          equipment: 'bodyweight',
          instructions: 'Drive through heels, squeeze glute.',
        };

  const overheadEx: WorkoutExercise = hasBarbell
    ? {
        exercise_id: 'overhead_press',
        name: 'Standing Barbell Overhead Press',
        target_sets: 3,
        target_reps: '6-8',
        rest_seconds: 120,
        equipment: 'barbell',
        instructions: 'Press bar straight up over midfoot.',
      }
    : hasDumbbells
      ? {
          exercise_id: 'dumbbell_shoulder_press',
          name: 'Seated Dumbbell Shoulder Press',
          target_sets: 3,
          target_reps: '8-10',
          rest_seconds: 90,
          equipment: 'dumbbells',
          instructions: 'Press upward smoothly.',
        }
      : {
          exercise_id: 'pike_pushup_bodyweight',
          name: 'Pike Push-Up',
          target_sets: 3,
          target_reps: '8-12',
          rest_seconds: 60,
          equipment: 'bodyweight',
          instructions: 'Inverted V, press through shoulders.',
        };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const days: WorkoutDay[] = [];

  // Determine split strategy based on days per week (enforce >= 2 exercises on active days)
  if (daysPerWeek === 3) {
    days.push(
      {
        day_number: 1,
        day_name: dayNames[0] ?? 'Monday',
        focus: 'Full Body A',
        is_rest_day: false,
        exercises: [squatEx, pushEx, pullEx, hingeEx],
      },
      {
        day_number: 2,
        day_name: dayNames[1] ?? 'Tuesday',
        focus: 'Rest & Recovery',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 3,
        day_name: dayNames[2] ?? 'Wednesday',
        focus: 'Full Body B',
        is_rest_day: false,
        exercises: [hingeEx, overheadEx, pullEx, squatEx],
      },
      {
        day_number: 4,
        day_name: dayNames[3] ?? 'Thursday',
        focus: 'Rest & Recovery',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 5,
        day_name: dayNames[4] ?? 'Friday',
        focus: 'Full Body C',
        is_rest_day: false,
        exercises: [squatEx, pushEx, pullEx, overheadEx],
      },
      {
        day_number: 6,
        day_name: dayNames[5] ?? 'Saturday',
        focus: 'Active Recovery',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 7,
        day_name: dayNames[6] ?? 'Sunday',
        focus: 'Rest & Prep',
        is_rest_day: true,
        exercises: [],
      },
    );
  } else if (daysPerWeek === 4) {
    days.push(
      {
        day_number: 1,
        day_name: dayNames[0] ?? 'Monday',
        focus: 'Upper Body A',
        is_rest_day: false,
        exercises: [pushEx, pullEx, overheadEx],
      },
      {
        day_number: 2,
        day_name: dayNames[1] ?? 'Tuesday',
        focus: 'Lower Body A',
        is_rest_day: false,
        exercises: [squatEx, hingeEx],
      },
      {
        day_number: 3,
        day_name: dayNames[2] ?? 'Wednesday',
        focus: 'Rest & Mobility',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 4,
        day_name: dayNames[3] ?? 'Thursday',
        focus: 'Upper Body B',
        is_rest_day: false,
        exercises: [overheadEx, pullEx, pushEx],
      },
      {
        day_number: 5,
        day_name: dayNames[4] ?? 'Friday',
        focus: 'Lower Body B',
        is_rest_day: false,
        exercises: [hingeEx, squatEx],
      },
      {
        day_number: 6,
        day_name: dayNames[5] ?? 'Saturday',
        focus: 'Active Recovery',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 7,
        day_name: dayNames[6] ?? 'Sunday',
        focus: 'Rest & Prep',
        is_rest_day: true,
        exercises: [],
      },
    );
  } else if (daysPerWeek === 5) {
    days.push(
      {
        day_number: 1,
        day_name: dayNames[0] ?? 'Monday',
        focus: 'Push (Chest/Delts)',
        is_rest_day: false,
        exercises: [pushEx, overheadEx],
      },
      {
        day_number: 2,
        day_name: dayNames[1] ?? 'Tuesday',
        focus: 'Pull (Back/Rear Delts)',
        is_rest_day: false,
        exercises: [pullEx, hingeEx],
      },
      {
        day_number: 3,
        day_name: dayNames[2] ?? 'Wednesday',
        focus: 'Legs (Quads/Hamstrings)',
        is_rest_day: false,
        exercises: [squatEx, hingeEx],
      },
      {
        day_number: 4,
        day_name: dayNames[3] ?? 'Thursday',
        focus: 'Upper Body Hypertrophy',
        is_rest_day: false,
        exercises: [pushEx, pullEx],
      },
      {
        day_number: 5,
        day_name: dayNames[4] ?? 'Friday',
        focus: 'Lower Body Strength',
        is_rest_day: false,
        exercises: [hingeEx, squatEx],
      },
      {
        day_number: 6,
        day_name: dayNames[5] ?? 'Saturday',
        focus: 'Rest & Recovery',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 7,
        day_name: dayNames[6] ?? 'Sunday',
        focus: 'Rest & Prep',
        is_rest_day: true,
        exercises: [],
      },
    );
  } else {
    for (let i = 1; i <= 7; i++) {
      const isRest = i > daysPerWeek;
      days.push({
        day_number: i,
        day_name: dayNames[i - 1] ?? `Day ${i}`,
        focus: isRest ? 'Rest' : `Training Day ${i}`,
        is_rest_day: isRest,
        exercises: isRest ? [] : [squatEx, pushEx, pullEx],
      });
    }
  }

  const payload: WorkoutPlanPayload = {
    kind: 'workout',
    schema_version: '2026-10-01',
    policy_version: '2026-10-01',
    split_name: `${daysPerWeek}-Day Targeted Split`,
    days_per_week: daysPerWeek,
    days,
    notes: 'Verified fallback workout plan tailored to verified movement biomechanics.',
  };

  const verification = verifyWorkoutPlan(payload, profile, options);
  if (!verification.valid) {
    return null;
  }

  return payload;
}
