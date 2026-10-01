// Normalized Ingredient and Exercise Catalog with Nutrition Provenance and Unknown Value Handling

export type IngredientCategory =
  | 'protein'
  | 'grain'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'fat'
  | 'legume';

export type Allergen =
  | 'dairy'
  | 'gluten'
  | 'eggs'
  | 'fish'
  | 'shellfish'
  | 'tree_nuts'
  | 'peanuts'
  | 'soy';

export interface NormalizedIngredient {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly category: IngredientCategory;
  readonly standard_unit: string;
  readonly calories_per_100g: number;
  readonly protein_per_100g: number;
  readonly carbs_per_100g: number;
  readonly fat_per_100g: number;
  readonly fiber_per_100g: number;
  readonly provenance: string;
  readonly allergens: readonly Allergen[];
  readonly is_estimated: boolean;
}

export const INGREDIENT_CATALOG: readonly NormalizedIngredient[] = [
  {
    id: 'chicken_breast',
    name: 'Boneless Skinless Chicken Breast',
    aliases: ['chicken breast', 'grilled chicken', 'cooked chicken breast', 'chicken'],
    category: 'protein',
    standard_unit: 'g',
    calories_per_100g: 165,
    protein_per_100g: 31.0,
    carbs_per_100g: 0.0,
    fat_per_100g: 3.6,
    fiber_per_100g: 0.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 171077)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'salmon_atlantic',
    name: 'Atlantic Salmon Fillet',
    aliases: ['salmon', 'grilled salmon', 'atlantic salmon', 'baked salmon'],
    category: 'protein',
    standard_unit: 'g',
    calories_per_100g: 208,
    protein_per_100g: 20.4,
    carbs_per_100g: 0.0,
    fat_per_100g: 13.4,
    fiber_per_100g: 0.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 175168)',
    allergens: ['fish'],
    is_estimated: false,
  },
  {
    id: 'eggs_whole',
    name: 'Whole Large Egg',
    aliases: ['egg', 'eggs', 'whole egg', 'boiled egg', 'poached egg'],
    category: 'protein',
    standard_unit: 'unit',
    calories_per_100g: 143,
    protein_per_100g: 12.6,
    carbs_per_100g: 0.7,
    fat_per_100g: 9.5,
    fiber_per_100g: 0.0,
    provenance: 'USDA FoodData Central Foundation Foods (FDC ID 748967)',
    allergens: ['eggs'],
    is_estimated: false,
  },
  {
    id: 'egg_whites',
    name: 'Liquid Egg Whites',
    aliases: ['egg whites', 'egg white', 'pure egg whites'],
    category: 'protein',
    standard_unit: 'g',
    calories_per_100g: 52,
    protein_per_100g: 10.9,
    carbs_per_100g: 0.7,
    fat_per_100g: 0.2,
    fiber_per_100g: 0.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 172184)',
    allergens: ['eggs'],
    is_estimated: false,
  },
  {
    id: 'greek_yogurt_nonfat',
    name: 'Nonfat Plain Greek Yogurt',
    aliases: ['greek yogurt', '0% greek yogurt', 'nonfat yogurt', 'plain greek yogurt'],
    category: 'dairy',
    standard_unit: 'g',
    calories_per_100g: 59,
    protein_per_100g: 10.2,
    carbs_per_100g: 3.6,
    fat_per_100g: 0.4,
    fiber_per_100g: 0.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 170903)',
    allergens: ['dairy'],
    is_estimated: false,
  },
  {
    id: 'whey_protein_isolate',
    name: 'Whey Protein Isolate Powder',
    aliases: ['whey protein', 'protein powder', 'whey isolate', 'protein shake'],
    category: 'protein',
    standard_unit: 'g',
    calories_per_100g: 375,
    protein_per_100g: 85.0,
    carbs_per_100g: 3.0,
    fat_per_100g: 1.5,
    fiber_per_100g: 0.0,
    provenance: 'Standard Manufacturer Nutritional Specification (Estimated Aggregate)',
    allergens: ['dairy'],
    is_estimated: true,
  },
  {
    id: 'tofu_firm',
    name: 'Firm Tofu',
    aliases: ['tofu', 'firm tofu', 'soy tofu'],
    category: 'legume',
    standard_unit: 'g',
    calories_per_100g: 83,
    protein_per_100g: 10.0,
    carbs_per_100g: 1.2,
    fat_per_100g: 5.3,
    fiber_per_100g: 1.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 172448)',
    allergens: ['soy'],
    is_estimated: false,
  },
  {
    id: 'rolled_oats',
    name: 'Rolled Oats (Dry)',
    aliases: ['oats', 'oatmeal', 'rolled oats', 'porridge oats'],
    category: 'grain',
    standard_unit: 'g',
    calories_per_100g: 379,
    protein_per_100g: 13.2,
    carbs_per_100g: 67.7,
    fat_per_100g: 6.5,
    fiber_per_100g: 10.1,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 169705)',
    allergens: ['gluten'],
    is_estimated: false,
  },
  {
    id: 'brown_rice',
    name: 'Cooked Brown Rice',
    aliases: ['brown rice', 'cooked brown rice', 'whole grain rice'],
    category: 'grain',
    standard_unit: 'g',
    calories_per_100g: 123,
    protein_per_100g: 2.7,
    carbs_per_100g: 25.6,
    fat_per_100g: 1.0,
    fiber_per_100g: 1.6,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 169704)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'white_rice',
    name: 'Cooked White Jasmine Rice',
    aliases: ['white rice', 'cooked white rice', 'jasmine rice', 'basmati rice'],
    category: 'grain',
    standard_unit: 'g',
    calories_per_100g: 130,
    protein_per_100g: 2.4,
    carbs_per_100g: 28.2,
    fat_per_100g: 0.3,
    fiber_per_100g: 0.4,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 168878)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'sweet_potato',
    name: 'Baked Sweet Potato',
    aliases: ['sweet potato', 'baked sweet potato', 'yam'],
    category: 'vegetable',
    standard_unit: 'g',
    calories_per_100g: 90,
    protein_per_100g: 2.0,
    carbs_per_100g: 20.7,
    fat_per_100g: 0.1,
    fiber_per_100g: 3.3,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 168483)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'banana_fresh',
    name: 'Fresh Banana',
    aliases: ['banana', 'ripe banana', 'yellow banana'],
    category: 'fruit',
    standard_unit: 'unit',
    calories_per_100g: 89,
    protein_per_100g: 1.1,
    carbs_per_100g: 22.8,
    fat_per_100g: 0.3,
    fiber_per_100g: 2.6,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 173944)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'blueberries_fresh',
    name: 'Fresh Blueberries',
    aliases: ['blueberries', 'wild blueberries', 'berries'],
    category: 'fruit',
    standard_unit: 'g',
    calories_per_100g: 57,
    protein_per_100g: 0.7,
    carbs_per_100g: 14.5,
    fat_per_100g: 0.3,
    fiber_per_100g: 2.4,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 171711)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'olive_oil_extra_virgin',
    name: 'Extra Virgin Olive Oil',
    aliases: ['olive oil', 'evoo', 'extra virgin olive oil'],
    category: 'fat',
    standard_unit: 'ml',
    calories_per_100g: 884,
    protein_per_100g: 0.0,
    carbs_per_100g: 0.0,
    fat_per_100g: 100.0,
    fiber_per_100g: 0.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 171413)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'avocado_haas',
    name: 'Haas Avocado',
    aliases: ['avocado', 'fresh avocado', 'haas avocado'],
    category: 'fat',
    standard_unit: 'g',
    calories_per_100g: 160,
    protein_per_100g: 2.0,
    carbs_per_100g: 8.5,
    fat_per_100g: 14.7,
    fiber_per_100g: 6.7,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 171705)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'almonds_raw',
    name: 'Raw Almonds',
    aliases: ['almonds', 'raw almonds', 'almond nuts'],
    category: 'fat',
    standard_unit: 'g',
    calories_per_100g: 579,
    protein_per_100g: 21.2,
    carbs_per_100g: 21.6,
    fat_per_100g: 49.9,
    fiber_per_100g: 12.5,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 170567)',
    allergens: ['tree_nuts'],
    is_estimated: false,
  },
  {
    id: 'peanut_butter_natural',
    name: 'Natural Peanut Butter',
    aliases: ['peanut butter', 'natural peanut butter', 'pb'],
    category: 'fat',
    standard_unit: 'g',
    calories_per_100g: 588,
    protein_per_100g: 25.1,
    carbs_per_100g: 20.0,
    fat_per_100g: 50.4,
    fiber_per_100g: 6.0,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 174268)',
    allergens: ['peanuts'],
    is_estimated: false,
  },
  {
    id: 'broccoli_steamed',
    name: 'Steamed Broccoli Florets',
    aliases: ['broccoli', 'steamed broccoli', 'fresh broccoli'],
    category: 'vegetable',
    standard_unit: 'g',
    calories_per_100g: 35,
    protein_per_100g: 2.4,
    carbs_per_100g: 7.2,
    fat_per_100g: 0.4,
    fiber_per_100g: 2.6,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 170379)',
    allergens: [],
    is_estimated: false,
  },
  {
    id: 'spinach_fresh',
    name: 'Fresh Baby Spinach',
    aliases: ['spinach', 'baby spinach', 'fresh spinach'],
    category: 'vegetable',
    standard_unit: 'g',
    calories_per_100g: 23,
    protein_per_100g: 2.9,
    carbs_per_100g: 3.6,
    fat_per_100g: 0.4,
    fiber_per_100g: 2.2,
    provenance: 'USDA FoodData Central SR Legacy (FDC ID 168462)',
    allergens: [],
    is_estimated: false,
  },
];

export function findIngredient(query: string): NormalizedIngredient | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Exact match on id, name, or alias
  for (const item of INGREDIENT_CATALOG) {
    if (item.id === normalized || item.name.toLowerCase() === normalized) {
      return item;
    }
    for (const alias of item.aliases) {
      if (alias.toLowerCase() === normalized) return item;
    }
  }

  // 2. Bidirectional substring match (name or alias contains query, or query contains alias/id)
  for (const item of INGREDIENT_CATALOG) {
    const itemName = item.name.toLowerCase();
    if (itemName.includes(normalized) || normalized.includes(item.id)) return item;
    for (const alias of item.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower.includes(normalized) || normalized.includes(aliasLower)) {
        return item;
      }
    }
  }

  return null;
}

export interface ResolvedIngredientNutrients {
  readonly ingredient: NormalizedIngredient;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly fiber_g: number;
  readonly is_estimated: boolean;
  readonly is_unknown: boolean;
}

export function resolveIngredient(query: string, amountGrams = 100): ResolvedIngredientNutrients {
  const match = findIngredient(query);
  const factor = Math.max(0, amountGrams) / 100;

  if (match) {
    return {
      ingredient: match,
      calories: Math.round(match.calories_per_100g * factor),
      protein_g: Math.round(match.protein_per_100g * factor * 10) / 10,
      carbs_g: Math.round(match.carbs_per_100g * factor * 10) / 10,
      fat_g: Math.round(match.fat_per_100g * factor * 10) / 10,
      fiber_g: Math.round(match.fiber_per_100g * factor * 10) / 10,
      is_estimated: match.is_estimated,
      is_unknown: false,
    };
  }

  // Safe fallback for unknown ingredient: conservative estimate (150 kcal/100g, 5g P, 20g C, 5g F)
  const unknownFallback: NormalizedIngredient = {
    id: `unknown_${query
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')}`,
    name: query.trim() || 'Unspecified Food',
    aliases: [],
    category: 'grain',
    standard_unit: 'g',
    calories_per_100g: 150,
    protein_per_100g: 5.0,
    carbs_per_100g: 20.0,
    fat_per_100g: 5.0,
    fiber_per_100g: 2.0,
    provenance: 'Uncataloged Item — Standard Nutritional Heuristic Baseline',
    allergens: [],
    is_estimated: true,
  };

  return {
    ingredient: unknownFallback,
    calories: Math.round(150 * factor),
    protein_g: Math.round(5.0 * factor * 10) / 10,
    carbs_g: Math.round(20.0 * factor * 10) / 10,
    fat_g: Math.round(5.0 * factor * 10) / 10,
    fiber_g: Math.round(2.0 * factor * 10) / 10,
    is_estimated: true,
    is_unknown: true,
  };
}

export function checkIngredientExclusions(
  ingredient: NormalizedIngredient,
  allergensOrExclusions: readonly string[],
): boolean {
  const normalizedExclusions = new Set(allergensOrExclusions.map((e) => e.trim().toLowerCase()));

  for (const allergen of ingredient.allergens) {
    if (normalizedExclusions.has(allergen)) return true;
  }

  if (
    normalizedExclusions.has(ingredient.id.toLowerCase()) ||
    normalizedExclusions.has(ingredient.name.toLowerCase())
  ) {
    return true;
  }

  return false;
}

// --- Exercise Catalog ---

export type MuscleGroup =
  | 'quadriceps'
  | 'chest'
  | 'back'
  | 'hamstrings'
  | 'shoulders'
  | 'glutes'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core';

export type MovementPattern =
  | 'squat'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'hip_hinge'
  | 'vertical_push'
  | 'vertical_pull'
  | 'lunge'
  | 'isolation';

export interface NormalizedExercise {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly primary_muscle: MuscleGroup;
  readonly secondary_muscles: readonly MuscleGroup[];
  readonly movement_pattern: MovementPattern;
  readonly equipment: readonly string[];
  readonly is_compound: boolean;
  readonly form_cues: readonly string[];
}

export const EXERCISE_CATALOG: readonly NormalizedExercise[] = [
  {
    id: 'barbell_back_squat',
    name: 'Barbell Back Squat',
    aliases: ['squat', 'back squat', 'barbell squat'],
    primary_muscle: 'quadriceps',
    secondary_muscles: ['glutes', 'hamstrings', 'core'],
    movement_pattern: 'squat',
    equipment: ['barbell', 'squat_rack'],
    is_compound: true,
    form_cues: [
      'Maintain braced neutral spine and full foot contact throughout movement.',
      'Descend until hip crease is below the top of the knee (parallel or deeper).',
      'Drive evenly through midfoot on ascent without knees caving inwards.',
    ],
  },
  {
    id: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    aliases: ['bench press', 'flat bench', 'barbell bench'],
    primary_muscle: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    movement_pattern: 'horizontal_push',
    equipment: ['barbell', 'bench'],
    is_compound: true,
    form_cues: [
      'Retract and depress scapulae, establishing stable upper-back arch.',
      'Lower bar with control to lower sternum.',
      'Press upward in a slight J-curve back over the shoulders.',
    ],
  },
  {
    id: 'barbell_deadlift',
    name: 'Conventional Barbell Deadlift',
    aliases: ['deadlift', 'conventional deadlift', 'barbell deadlift'],
    primary_muscle: 'hamstrings',
    secondary_muscles: ['glutes', 'back', 'core'],
    movement_pattern: 'hip_hinge',
    equipment: ['barbell'],
    is_compound: true,
    form_cues: [
      'Set bar over midfoot, engage lats, and pull slack out of the bar before lift.',
      'Drive floor away with legs until bar passes knees, then hinge hips forward.',
      'Keep bar path strictly vertical against the body.',
    ],
  },
  {
    id: 'overhead_press',
    name: 'Standing Barbell Overhead Press',
    aliases: ['overhead press', 'ohp', 'military press', 'strict press'],
    primary_muscle: 'shoulders',
    secondary_muscles: ['triceps', 'core'],
    movement_pattern: 'vertical_push',
    equipment: ['barbell'],
    is_compound: true,
    form_cues: [
      'Squeeze glutes and brace core to prevent lumbar hyperextension.',
      'Clear chin on initial press, then push head through window at lockout.',
    ],
  },
  {
    id: 'barbell_bent_over_row',
    name: 'Barbell Bent-Over Row',
    aliases: ['barbell row', 'bent over row', 'pendlay row'],
    primary_muscle: 'back',
    secondary_muscles: ['biceps', 'shoulders', 'core'],
    movement_pattern: 'horizontal_pull',
    equipment: ['barbell'],
    is_compound: true,
    form_cues: [
      'Hinge at hips with torso near 45–90 degrees and spine neutral.',
      'Pull bar toward lower ribcage driving with elbows, pausing at peak contraction.',
    ],
  },
  {
    id: 'pull_up',
    name: 'Overhand Pull-Up',
    aliases: ['pull up', 'pullup', 'bodyweight pull-up'],
    primary_muscle: 'back',
    secondary_muscles: ['biceps', 'shoulders'],
    movement_pattern: 'vertical_pull',
    equipment: ['pull_up_bar'],
    is_compound: true,
    form_cues: [
      'Start from full dead hang with engaged shoulders.',
      'Drive elbows down toward pockets until chin clears bar.',
    ],
  },
  {
    id: 'romanian_deadlift_dumbbell',
    name: 'Dumbbell Romanian Deadlift (RDL)',
    aliases: ['rdl', 'dumbbell rdl', 'romanian deadlift'],
    primary_muscle: 'hamstrings',
    secondary_muscles: ['glutes', 'back'],
    movement_pattern: 'hip_hinge',
    equipment: ['dumbbells'],
    is_compound: true,
    form_cues: [
      'Maintain soft knee bend and push hips straight backward.',
      'Lower dumbbells along shins until maximum hamstring stretch without lumbar rounding.',
    ],
  },
  {
    id: 'dumbbell_incline_press',
    name: 'Incline Dumbbell Bench Press',
    aliases: ['incline dumbbell press', 'incline bench', 'incline press'],
    primary_muscle: 'chest',
    secondary_muscles: ['shoulders', 'triceps'],
    movement_pattern: 'horizontal_push',
    equipment: ['dumbbells', 'bench'],
    is_compound: true,
    form_cues: [
      'Set bench to 30-degree incline.',
      'Lower dumbbells with elbows tucked ~45 degrees, pressing to lockout over upper chest.',
    ],
  },
  {
    id: 'dumbbell_bicep_curl',
    name: 'Standing Dumbbell Bicep Curl',
    aliases: ['bicep curl', 'dumbbell curl', 'curls'],
    primary_muscle: 'biceps',
    secondary_muscles: [],
    movement_pattern: 'isolation',
    equipment: ['dumbbells'],
    is_compound: false,
    form_cues: [
      'Keep elbows pinned at sides; avoid swinging torso or using momentum.',
      'Supinate wrists at top of movement for peak bicep contraction.',
    ],
  },
  {
    id: 'cable_triceps_pushdown',
    name: 'Cable Triceps Rope Pushdown',
    aliases: ['tricep pushdown', 'cable pushdown', 'rope pushdown'],
    primary_muscle: 'triceps',
    secondary_muscles: [],
    movement_pattern: 'isolation',
    equipment: ['cable_machine'],
    is_compound: false,
    form_cues: [
      'Keep upper arms stationary perpendicular to floor.',
      'Spread rope at bottom of extension and flex triceps forcefully.',
    ],
  },
  {
    id: 'walking_lunges_dumbbell',
    name: 'Dumbbell Walking Lunges',
    aliases: ['walking lunges', 'lunges', 'dumbbell lunges'],
    primary_muscle: 'quadriceps',
    secondary_muscles: ['glutes', 'hamstrings', 'calves'],
    movement_pattern: 'lunge',
    equipment: ['dumbbells'],
    is_compound: true,
    form_cues: [
      'Take consistent strides, dropping back knee toward floor with upright torso.',
      'Drive through front heel to step through to next rep smoothly.',
    ],
  },
];

export function findExercise(query: string): NormalizedExercise | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  for (const item of EXERCISE_CATALOG) {
    if (item.id === normalized || item.name.toLowerCase() === normalized) {
      return item;
    }
    for (const alias of item.aliases) {
      if (alias.toLowerCase() === normalized) return item;
    }
  }

  for (const item of EXERCISE_CATALOG) {
    const itemName = item.name.toLowerCase();
    if (itemName.includes(normalized) || normalized.includes(item.id)) return item;
    for (const alias of item.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower.includes(normalized) || normalized.includes(aliasLower)) {
        return item;
      }
    }
  }

  return null;
}

export function resolveExercise(query: string): NormalizedExercise & { is_unknown?: boolean } {
  const match = findExercise(query);
  if (match) return match;

  return {
    id: `custom_${query
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')}`,
    name: query.trim() || 'Custom Movement',
    aliases: [],
    primary_muscle: 'quadriceps',
    secondary_muscles: [],
    movement_pattern: 'isolation',
    equipment: ['bodyweight'],
    is_compound: false,
    form_cues: ['Perform with controlled tempo and full range of motion.'],
    is_unknown: true,
  };
}

export function checkExerciseEquipment(
  exercise: NormalizedExercise,
  availableEquipment: readonly string[],
): boolean {
  if (exercise.equipment.length === 0 || exercise.equipment.includes('bodyweight')) return true;
  const set = new Set(availableEquipment.map((e) => e.trim().toLowerCase()));
  return exercise.equipment.every((eq) => set.has(eq.toLowerCase()));
}
