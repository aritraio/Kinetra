import type {
  MealPlanPayload,
  PlanVerificationResult,
  PlanVerificationViolation,
} from '@kinetra/contracts';
import { mealPlanPayloadSchema } from '@kinetra/contracts';
import { checkIngredientExclusions, findIngredient } from './catalog';

export interface MealVerificationProfile {
  readonly target_calories: number;
  readonly target_protein_g: number;
  readonly target_carbs_g: number;
  readonly target_fat_g: number;
  readonly days_count?: number | undefined;
  readonly allergies?: readonly string[] | undefined;
  readonly dietary_preferences?: readonly string[] | undefined;
  readonly pantry_only?: boolean | undefined;
  readonly pantry_ingredients?: readonly string[] | undefined;
  readonly soft_preferences?: readonly string[] | undefined;
}

export interface MealVerificationOptions {
  readonly calorie_tolerance_kcal?: number | undefined;
  readonly protein_tolerance_g?: number | undefined;
  readonly carbs_tolerance_g?: number | undefined;
  readonly fat_tolerance_g?: number | undefined;
  readonly meal_math_tolerance_kcal?: number | undefined;
  readonly meal_math_tolerance_g?: number | undefined;
  readonly day_math_tolerance_kcal?: number | undefined;
  readonly day_math_tolerance_g?: number | undefined;
  readonly allow_unknown_ingredients?: boolean | undefined;
}

interface ResolvedMealOptions {
  readonly calorie_tolerance_kcal: number;
  readonly protein_tolerance_g: number;
  readonly carbs_tolerance_g: number;
  readonly fat_tolerance_g: number;
  readonly meal_math_tolerance_kcal: number;
  readonly meal_math_tolerance_g: number;
  readonly day_math_tolerance_kcal: number;
  readonly day_math_tolerance_g: number;
  readonly allow_unknown_ingredients: boolean;
}

const DEFAULT_OPTIONS: ResolvedMealOptions = {
  calorie_tolerance_kcal: 50,
  protein_tolerance_g: 10,
  carbs_tolerance_g: 20,
  fat_tolerance_g: 10,
  meal_math_tolerance_kcal: 5,
  meal_math_tolerance_g: 2,
  day_math_tolerance_kcal: 10,
  day_math_tolerance_g: 3,
  allow_unknown_ingredients: false,
};

const LAND_MEATS = new Set([
  'chicken_breast',
  'beef',
  'turkey',
  'pork',
  'chicken',
  'ground_beef_90_10',
  'steak',
  'bacon',
]);

const SEAFOOD = new Set(['salmon_atlantic', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia']);

export function verifyMealPlan(
  plan: unknown,
  profile: MealVerificationProfile,
  options?: MealVerificationOptions,
): PlanVerificationResult {
  const opts: ResolvedMealOptions = {
    calorie_tolerance_kcal:
      options?.calorie_tolerance_kcal ?? DEFAULT_OPTIONS.calorie_tolerance_kcal,
    protein_tolerance_g: options?.protein_tolerance_g ?? DEFAULT_OPTIONS.protein_tolerance_g,
    carbs_tolerance_g: options?.carbs_tolerance_g ?? DEFAULT_OPTIONS.carbs_tolerance_g,
    fat_tolerance_g: options?.fat_tolerance_g ?? DEFAULT_OPTIONS.fat_tolerance_g,
    meal_math_tolerance_kcal:
      options?.meal_math_tolerance_kcal ?? DEFAULT_OPTIONS.meal_math_tolerance_kcal,
    meal_math_tolerance_g: options?.meal_math_tolerance_g ?? DEFAULT_OPTIONS.meal_math_tolerance_g,
    day_math_tolerance_kcal:
      options?.day_math_tolerance_kcal ?? DEFAULT_OPTIONS.day_math_tolerance_kcal,
    day_math_tolerance_g: options?.day_math_tolerance_g ?? DEFAULT_OPTIONS.day_math_tolerance_g,
    allow_unknown_ingredients:
      options?.allow_unknown_ingredients ?? DEFAULT_OPTIONS.allow_unknown_ingredients,
  };
  const hard_violations: PlanVerificationViolation[] = [];
  const soft_warnings: PlanVerificationViolation[] = [];

  // 1. Schema boundary validation
  const parsed = mealPlanPayloadSchema.safeParse(plan);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      hard_violations.push({
        code: 'SCHEMA_INVALID',
        message: `Schema violation at ${issue.path.join('.')}: ${issue.message}`,
        severity: 'hard',
        path: issue.path.join('.'),
      });
    }
    return { valid: false, hard_violations, soft_warnings };
  }

  const mealPlan: MealPlanPayload = parsed.data;

  // 2. Day count check
  const expectedDays = profile.days_count ?? 7;
  if (mealPlan.days.length !== expectedDays) {
    hard_violations.push({
      code: 'DAY_COUNT_MISMATCH',
      message: `Plan has ${mealPlan.days.length} days, expected ${expectedDays}`,
      severity: 'hard',
      actual: mealPlan.days.length,
      expected: expectedDays,
    });
  }

  // Ensure sequential day numbers
  const dayNumbers = mealPlan.days.map((d) => d.day_number);
  const uniqueDayNumbers = new Set(dayNumbers);
  if (uniqueDayNumbers.size !== dayNumbers.length) {
    hard_violations.push({
      code: 'DUPLICATE_DAY_NUMBERS',
      message: 'Plan contains non-unique day numbers',
      severity: 'hard',
    });
  }

  // Build exclusion lists
  const allergies = (profile.allergies ?? []).map((a) => a.trim().toLowerCase());
  const dietaryPreferences = (profile.dietary_preferences ?? []).map((p) => p.trim().toLowerCase());
  const isVegan = dietaryPreferences.includes('vegan');
  const isVegetarian = dietaryPreferences.includes('vegetarian');
  const isPescatarian = dietaryPreferences.includes('pescatarian');

  const pantrySet = profile.pantry_only
    ? new Set((profile.pantry_ingredients ?? []).map((p) => p.trim().toLowerCase()))
    : null;

  let maxCalorieDelta = 0;
  let maxProteinDelta = 0;
  let maxCarbsDelta = 0;
  let maxFatDelta = 0;

  // 3. Inspect each day
  for (const day of mealPlan.days) {
    const dayPath = `days[day_${day.day_number}]`;

    // Meal count bounds (2 to 6 meals per day)
    if (day.meals.length < 2 || day.meals.length > 6) {
      hard_violations.push({
        code: 'INVALID_MEAL_COUNT',
        message: `Day ${day.day_number} has ${day.meals.length} meals. Must have between 2 and 6 meals`,
        severity: 'hard',
        path: `${dayPath}.meals`,
        actual: day.meals.length,
      });
    }

    let calculatedDayCalories = 0;
    let calculatedDayProtein = 0;
    let calculatedDayCarbs = 0;
    let calculatedDayFat = 0;

    const seenMealNames = new Set<string>();

    for (const [mealIdx, meal] of day.meals.entries()) {
      const mealPath = `${dayPath}.meals[${mealIdx}]`;

      // Duplicate meal check within same day
      const normalizedMealName = meal.name.trim().toLowerCase();
      if (seenMealNames.has(normalizedMealName)) {
        hard_violations.push({
          code: 'DUPLICATE_MEAL_IN_DAY',
          message: `Day ${day.day_number} contains duplicated meal: "${meal.name}"`,
          severity: 'hard',
          path: mealPath,
        });
      }
      seenMealNames.add(normalizedMealName);

      let sumItemCalories = 0;
      let sumItemProtein = 0;
      let sumItemCarbs = 0;
      let sumItemFat = 0;

      for (const [itemIdx, item] of meal.items.entries()) {
        const itemPath = `${mealPath}.items[${itemIdx}]`;

        // Item-level macro math consistency: 4P + 4C + 9F ≈ Cal
        const expectedItemCalories = 4 * item.protein_g + 4 * item.carbs_g + 9 * item.fat_g;
        const macroCalDiff = Math.abs(expectedItemCalories - item.calories);
        const allowedMacroCalDiff = Math.max(25, item.calories * 0.2);
        if (macroCalDiff > allowedMacroCalDiff) {
          hard_violations.push({
            code: 'ITEM_MACRO_MATH_MISMATCH',
            message: `Item "${item.name}" calories (${item.calories}) does not match macros (${item.protein_g}g P, ${item.carbs_g}g C, ${item.fat_g}g F = ~${Math.round(expectedItemCalories)} kcal)`,
            severity: 'hard',
            path: itemPath,
            actual: item.calories,
            expected: Math.round(expectedItemCalories),
          });
        }

        sumItemCalories += item.calories;
        sumItemProtein += item.protein_g;
        sumItemCarbs += item.carbs_g;
        sumItemFat += item.fat_g;

        // Ingredient resolution & exclusions
        const ingredient = findIngredient(item.ingredient_id) ?? findIngredient(item.name);
        if (!ingredient) {
          if (!opts.allow_unknown_ingredients) {
            hard_violations.push({
              code: 'UNRESOLVED_INGREDIENT',
              message: `Item "${item.name}" (id: ${item.ingredient_id}) could not be resolved in the ingredient catalog`,
              severity: 'hard',
              path: itemPath,
            });
          } else {
            soft_warnings.push({
              code: 'ESTIMATED_UNKNOWN_INGREDIENT',
              message: `Item "${item.name}" is not cataloged and uses estimated values`,
              severity: 'soft',
              path: itemPath,
            });
          }
        } else {
          // Hard exclusion checks (allergens)
          if (checkIngredientExclusions(ingredient, allergies)) {
            hard_violations.push({
              code: 'HARD_EXCLUSION_ALLERGEN',
              message: `Ingredient "${ingredient.name}" violates user allergy exclusion`,
              severity: 'hard',
              path: itemPath,
            });
          }

          const ingredientId = ingredient.id.toLowerCase();

          // Dietary preference: Pescatarian (no land meats)
          if (isPescatarian && LAND_MEATS.has(ingredientId)) {
            hard_violations.push({
              code: 'HARD_EXCLUSION_PESCATARIAN',
              message: `Ingredient "${ingredient.name}" violates pescatarian preference (contains land meat)`,
              severity: 'hard',
              path: itemPath,
            });
          }

          // Dietary preference: Vegetarian (no land meat, no seafood)
          if (isVegetarian && (LAND_MEATS.has(ingredientId) || SEAFOOD.has(ingredientId))) {
            hard_violations.push({
              code: 'HARD_EXCLUSION_VEGETARIAN',
              message: `Ingredient "${ingredient.name}" violates vegetarian preference`,
              severity: 'hard',
              path: itemPath,
            });
          }

          // Dietary preference: Vegan (no animal products: meat, seafood, dairy, eggs)
          if (
            isVegan &&
            (LAND_MEATS.has(ingredientId) ||
              SEAFOOD.has(ingredientId) ||
              ingredient.category === 'dairy' ||
              ingredient.allergens.includes('dairy') ||
              ingredient.allergens.includes('eggs'))
          ) {
            hard_violations.push({
              code: 'HARD_EXCLUSION_VEGAN',
              message: `Ingredient "${ingredient.name}" violates vegan preference (animal product)`,
              severity: 'hard',
              path: itemPath,
            });
          }
        }

        // Pantry-only mode check
        if (pantrySet) {
          const itemKey = item.name.toLowerCase();
          const idKey = item.ingredient_id.toLowerCase();
          let inPantry = false;
          for (const pantryItem of pantrySet) {
            if (
              itemKey.includes(pantryItem) ||
              pantryItem.includes(itemKey) ||
              idKey.includes(pantryItem) ||
              pantryItem.includes(idKey)
            ) {
              inPantry = true;
              break;
            }
          }
          if (!inPantry) {
            hard_violations.push({
              code: 'PANTRY_CONSTRAINT_VIOLATED',
              message: `Ingredient "${item.name}" is not in the user's pantry list`,
              severity: 'hard',
              path: itemPath,
            });
          }
        }

        // Soft preferences check (e.g., user dislikes)
        if (profile.soft_preferences) {
          for (const pref of profile.soft_preferences) {
            const prefLower = pref.toLowerCase();
            if (
              prefLower.startsWith('dislike:') ||
              prefLower.startsWith('avoid:') ||
              prefLower.startsWith('no ')
            ) {
              const disItem = prefLower.replace(/^(dislike:|avoid:|no )/, '').trim();
              if (item.name.toLowerCase().includes(disItem)) {
                soft_warnings.push({
                  code: 'SOFT_PREFERENCE_UNMET',
                  message: `Item "${item.name}" matches soft preference to avoid "${disItem}"`,
                  severity: 'soft',
                  path: itemPath,
                });
              }
            }
          }
        }
      }

      // Meal sum math check
      if (Math.abs(sumItemCalories - meal.calories) > opts.meal_math_tolerance_kcal) {
        hard_violations.push({
          code: 'MEAL_CALORIE_SUM_MISMATCH',
          message: `Meal "${meal.name}" calories (${meal.calories}) does not match sum of items (${sumItemCalories})`,
          severity: 'hard',
          path: mealPath,
          actual: meal.calories,
          expected: sumItemCalories,
        });
      }
      if (Math.abs(sumItemProtein - meal.protein_g) > opts.meal_math_tolerance_g) {
        hard_violations.push({
          code: 'MEAL_PROTEIN_SUM_MISMATCH',
          message: `Meal "${meal.name}" protein (${meal.protein_g}g) does not match sum of items (${Math.round(sumItemProtein * 10) / 10}g)`,
          severity: 'hard',
          path: mealPath,
          actual: meal.protein_g,
          expected: Math.round(sumItemProtein * 10) / 10,
        });
      }
      if (Math.abs(sumItemCarbs - meal.carbs_g) > opts.meal_math_tolerance_g) {
        hard_violations.push({
          code: 'MEAL_CARBS_SUM_MISMATCH',
          message: `Meal "${meal.name}" carbs (${meal.carbs_g}g) does not match sum of items (${Math.round(sumItemCarbs * 10) / 10}g)`,
          severity: 'hard',
          path: mealPath,
          actual: meal.carbs_g,
          expected: Math.round(sumItemCarbs * 10) / 10,
        });
      }
      if (Math.abs(sumItemFat - meal.fat_g) > opts.meal_math_tolerance_g) {
        hard_violations.push({
          code: 'MEAL_FAT_SUM_MISMATCH',
          message: `Meal "${meal.name}" fat (${meal.fat_g}g) does not match sum of items (${Math.round(sumItemFat * 10) / 10}g)`,
          severity: 'hard',
          path: mealPath,
          actual: meal.fat_g,
          expected: Math.round(sumItemFat * 10) / 10,
        });
      }

      calculatedDayCalories += meal.calories;
      calculatedDayProtein += meal.protein_g;
      calculatedDayCarbs += meal.carbs_g;
      calculatedDayFat += meal.fat_g;
    }

    // Day sum math check
    if (Math.abs(calculatedDayCalories - day.total_calories) > opts.day_math_tolerance_kcal) {
      hard_violations.push({
        code: 'DAY_CALORIE_SUM_MISMATCH',
        message: `Day ${day.day_number} total calories (${day.total_calories}) does not match sum of meals (${calculatedDayCalories})`,
        severity: 'hard',
        path: dayPath,
        actual: day.total_calories,
        expected: calculatedDayCalories,
      });
    }
    if (Math.abs(calculatedDayProtein - day.total_protein_g) > opts.day_math_tolerance_g) {
      hard_violations.push({
        code: 'DAY_PROTEIN_SUM_MISMATCH',
        message: `Day ${day.day_number} total protein (${day.total_protein_g}g) does not match sum of meals (${Math.round(calculatedDayProtein * 10) / 10}g)`,
        severity: 'hard',
        path: dayPath,
        actual: day.total_protein_g,
        expected: Math.round(calculatedDayProtein * 10) / 10,
      });
    }
    if (Math.abs(calculatedDayCarbs - day.total_carbs_g) > opts.day_math_tolerance_g) {
      hard_violations.push({
        code: 'DAY_CARBS_SUM_MISMATCH',
        message: `Day ${day.day_number} total carbs (${day.total_carbs_g}g) does not match sum of meals (${Math.round(calculatedDayCarbs * 10) / 10}g)`,
        severity: 'hard',
        path: dayPath,
        actual: day.total_carbs_g,
        expected: Math.round(calculatedDayCarbs * 10) / 10,
      });
    }
    if (Math.abs(calculatedDayFat - day.total_fat_g) > opts.day_math_tolerance_g) {
      hard_violations.push({
        code: 'DAY_FAT_SUM_MISMATCH',
        message: `Day ${day.day_number} total fat (${day.total_fat_g}g) does not match sum of meals (${Math.round(calculatedDayFat * 10) / 10}g)`,
        severity: 'hard',
        path: dayPath,
        actual: day.total_fat_g,
        expected: Math.round(calculatedDayFat * 10) / 10,
      });
    }

    // Target vs actual day totals tolerances (Boundary checks: <= tolerance passes, > tolerance fails)
    const calDelta = Math.abs(day.total_calories - profile.target_calories);
    const proteinDelta = Math.abs(day.total_protein_g - profile.target_protein_g);
    const carbsDelta = Math.abs(day.total_carbs_g - profile.target_carbs_g);
    const fatDelta = Math.abs(day.total_fat_g - profile.target_fat_g);

    if (calDelta > maxCalorieDelta) maxCalorieDelta = calDelta;
    if (proteinDelta > maxProteinDelta) maxProteinDelta = proteinDelta;
    if (carbsDelta > maxCarbsDelta) maxCarbsDelta = carbsDelta;
    if (fatDelta > maxFatDelta) maxFatDelta = fatDelta;

    if (calDelta > opts.calorie_tolerance_kcal) {
      hard_violations.push({
        code: 'CALORIE_TOLERANCE_EXCEEDED',
        message: `Day ${day.day_number} calories (${day.total_calories}) differs from target (${profile.target_calories}) by ${calDelta} kcal (limit ±${opts.calorie_tolerance_kcal} kcal)`,
        severity: 'hard',
        path: `${dayPath}.total_calories`,
        actual: day.total_calories,
        expected: profile.target_calories,
      });
    }

    if (proteinDelta > opts.protein_tolerance_g) {
      hard_violations.push({
        code: 'PROTEIN_TOLERANCE_EXCEEDED',
        message: `Day ${day.day_number} protein (${day.total_protein_g}g) differs from target (${profile.target_protein_g}g) by ${Math.round(proteinDelta * 10) / 10}g (limit ±${opts.protein_tolerance_g}g)`,
        severity: 'hard',
        path: `${dayPath}.total_protein_g`,
        actual: day.total_protein_g,
        expected: profile.target_protein_g,
      });
    }

    if (carbsDelta > opts.carbs_tolerance_g) {
      hard_violations.push({
        code: 'CARBS_TOLERANCE_EXCEEDED',
        message: `Day ${day.day_number} carbs (${day.total_carbs_g}g) differs from target (${profile.target_carbs_g}g) by ${Math.round(carbsDelta * 10) / 10}g (limit ±${opts.carbs_tolerance_g}g)`,
        severity: 'hard',
        path: `${dayPath}.total_carbs_g`,
        actual: day.total_carbs_g,
        expected: profile.target_carbs_g,
      });
    }

    if (fatDelta > opts.fat_tolerance_g) {
      hard_violations.push({
        code: 'FAT_TOLERANCE_EXCEEDED',
        message: `Day ${day.day_number} fat (${day.total_fat_g}g) differs from target (${profile.target_fat_g}g) by ${Math.round(fatDelta * 10) / 10}g (limit ±${opts.fat_tolerance_g}g)`,
        severity: 'hard',
        path: `${dayPath}.total_fat_g`,
        actual: day.total_fat_g,
        expected: profile.target_fat_g,
      });
    }
  }

  return {
    valid: hard_violations.length === 0,
    hard_violations,
    soft_warnings,
    metrics: {
      max_calorie_delta: maxCalorieDelta,
      max_protein_delta: Math.round(maxProteinDelta * 10) / 10,
      max_carbs_delta: Math.round(maxCarbsDelta * 10) / 10,
      max_fat_delta: Math.round(maxFatDelta * 10) / 10,
      hard_violation_count: hard_violations.length,
      soft_warning_count: soft_warnings.length,
    },
  };
}
