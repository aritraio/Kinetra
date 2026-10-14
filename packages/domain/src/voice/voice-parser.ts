import type {
  VoiceExtractionInput,
  VoiceExtractionResult,
  VoiceMealItemExtraction,
  VoiceWorkoutSetExtraction,
} from '@kinetra/contracts';

/**
 * Standard nutritional density estimates per 100g for common fitness foods
 */
const FOOD_NUTRITION_DATABASE: Record<
  string,
  { caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number }
> = {
  'chicken breast': { caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  chicken: { caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  'white rice': { caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  rice: { caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  oats: { caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66, fatPer100g: 6.9 },
  oatmeal: { caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66, fatPer100g: 6.9 },
  eggs: { caloriesPer100g: 143, proteinPer100g: 12.6, carbsPer100g: 0.7, fatPer100g: 9.5 },
  egg: { caloriesPer100g: 143, proteinPer100g: 12.6, carbsPer100g: 0.7, fatPer100g: 9.5 },
  salmon: { caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
  whey: { caloriesPer100g: 400, proteinPer100g: 80, carbsPer100g: 6, fatPer100g: 4 },
  'protein powder': { caloriesPer100g: 400, proteinPer100g: 80, carbsPer100g: 6, fatPer100g: 4 },
  milk: { caloriesPer100g: 50, proteinPer100g: 3.4, carbsPer100g: 5, fatPer100g: 1.5 },
  banana: { caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  peanut_butter: { caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50 },
  bread: { caloriesPer100g: 265, proteinPer100g: 9, carbsPer100g: 49, fatPer100g: 3.2 },
  beef: { caloriesPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 15 },
};

/**
 * Pure, deterministic voice logging parser extracting typed fitness data from voice transcripts.
 */
export function extractFromVoiceTranscript(input: VoiceExtractionInput): VoiceExtractionResult {
  const raw = input.transcript.trim();
  const lower = raw.toLowerCase();
  const ambiguities: string[] = [];

  // 1. Check for weight log (e.g. "Weighed 72.5 kg", "Body weight 160 lbs", "74.2 kg this morning")
  const weightKgMatch = lower.match(
    /(?:weighed|weight|scale|weigh in)?\s*(?:at\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kilos|kilograms)/i,
  );
  const weightLbMatch = lower.match(
    /(?:weighed|weight|scale|weigh in)?\s*(?:at\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:lb|lbs|pounds)/i,
  );

  const isExplicitWeight =
    lower.includes('weigh') ||
    lower.includes('scale') ||
    lower.includes('body weight') ||
    lower.endsWith('kg') ||
    lower.endsWith('lbs');

  if (
    weightKgMatch &&
    (isExplicitWeight ||
      (!lower.includes('set') &&
        !lower.includes('rep') &&
        !lower.includes('ate') &&
        !lower.includes('had')))
  ) {
    const val = Number.parseFloat(weightKgMatch[1]!);
    if (val >= 20 && val <= 500) {
      return {
        extraction: {
          kind: 'weight_log',
          weight_kg: Math.round(val * 10) / 10,
        },
        confidence: 0.95,
        ambiguities: [],
        raw_transcript: raw,
      };
    }
  }

  if (
    weightLbMatch &&
    (isExplicitWeight ||
      (!lower.includes('set') &&
        !lower.includes('rep') &&
        !lower.includes('ate') &&
        !lower.includes('had')))
  ) {
    const valLb = Number.parseFloat(weightLbMatch[1]!);
    const valKg = Math.round(valLb * 0.45359237 * 10) / 10;
    if (valKg >= 20 && valKg <= 500) {
      return {
        extraction: {
          kind: 'weight_log',
          weight_kg: valKg,
        },
        confidence: 0.95,
        ambiguities: [],
        raw_transcript: raw,
      };
    }
  }

  // 2. Check for workout logging (e.g. "Logged 3 sets of bench press: 8 reps at 80 kg...", "Squat 4 sets 5 reps 100 kg")
  const exerciseKeywords = [
    'bench press',
    'incline bench',
    'overhead press',
    'shoulder press',
    'barbell squat',
    'back squat',
    'front squat',
    'squat',
    'deadlift',
    'romanian deadlift',
    'barbell row',
    'pull up',
    'pull-up',
    'chin up',
    'bicep curl',
    'tricep extension',
    'lateral raise',
    'leg press',
    'leg curl',
  ];

  let matchedExercise: string | null = null;
  for (const ex of exerciseKeywords) {
    if (lower.includes(ex)) {
      matchedExercise = ex
        .split(' ')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      break;
    }
  }

  const hasWorkoutTokens =
    lower.includes('set') ||
    lower.includes('rep') ||
    lower.includes('rpe') ||
    Boolean(matchedExercise);

  if (hasWorkoutTokens && matchedExercise) {
    const sets: VoiceWorkoutSetExtraction[] = [];

    // Check for detailed per-set pattern: "set 1 8 reps at 80 kg rpe 8, set 2 8 reps at 80 kg..."
    const setPattern =
      /set\s*([0-9]+)?[:\s]*([0-9]+)\s*reps?\s*(?:at|@)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kilos)?(?:\s*rpe\s*([0-9]+(?:\.[0-9]+)?))?/gi;
    let match: RegExpExecArray | null;
    let setIndex = 1;

    match = setPattern.exec(lower);
    while (match !== null) {
      const explicitNum = match[1] ? Number.parseInt(match[1], 10) : setIndex;
      const reps = Number.parseInt(match[2]!, 10);
      const loadKg = Number.parseFloat(match[3]!);
      const rpe = match[4] ? Number.parseFloat(match[4]) : undefined;

      sets.push({
        set_number: explicitNum,
        reps,
        load_kg: loadKg,
        ...(rpe ? { rpe: Math.min(10, Math.max(1, rpe)) } : {}),
      });

      setIndex = explicitNum + 1;
      match = setPattern.exec(lower);
    }

    // Fallback: compact uniform pattern: "3 sets of 8 reps at 80 kg" or "4 sets 10 reps 60 kg"
    if (sets.length === 0) {
      const uniformMatch = lower.match(
        /([0-9]+)\s*sets?\s*(?:of\s*)?([0-9]+)\s*reps?\s*(?:at|@)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kilos)?(?:\s*rpe\s*([0-9]+(?:\.[0-9]+)?))?/i,
      );
      if (uniformMatch) {
        const numSets = Number.parseInt(uniformMatch[1]!, 10);
        const reps = Number.parseInt(uniformMatch[2]!, 10);
        const loadKg = Number.parseFloat(uniformMatch[3]!);
        const rpe = uniformMatch[4] ? Number.parseFloat(uniformMatch[4]) : undefined;

        for (let i = 1; i <= Math.min(numSets, 20); i++) {
          sets.push({
            set_number: i,
            reps,
            load_kg: loadKg,
            ...(rpe ? { rpe: Math.min(10, Math.max(1, rpe)) } : {}),
          });
        }
      }
    }

    if (sets.length > 0) {
      return {
        extraction: {
          kind: 'workout_log',
          exercise_name: matchedExercise,
          sets,
        },
        confidence: sets.length >= 2 ? 0.95 : 0.85,
        ambiguities: [],
        raw_transcript: raw,
      };
    }

    ambiguities.push(
      `Detected exercise '${matchedExercise}' but could not parse specific set numbers, reps, or load.`,
    );
  }

  // 3. Check for meal logging (e.g. "Had 200g chicken breast and 150g rice for lunch", "Ate 3 eggs and 2 slices bread")
  const mealIndicators = [
    'ate',
    'had',
    'lunch',
    'breakfast',
    'dinner',
    'snack',
    'meal',
    'calories',
    'grams',
    'protein',
  ];
  const hasMealIndicator = mealIndicators.some((w) => lower.includes(w));

  if (hasMealIndicator) {
    const mealItems: VoiceMealItemExtraction[] = [];

    // Parse food items: e.g. "200g chicken breast", "150g white rice", "30g peanut butter", "3 eggs"
    // Sort keys descending by length so "chicken breast" matches before "chicken"
    const sortedEntries = Object.entries(FOOD_NUTRITION_DATABASE).sort(
      ([a], [b]) => b.length - a.length,
    );

    const matchedFoods = new Set<string>();

    for (const [foodName, macros] of sortedEntries) {
      // If already matched a more specific variant (e.g., 'chicken' when 'chicken breast' matched)
      if (Array.from(matchedFoods).some((m) => m.includes(foodName) || foodName.includes(m))) {
        continue;
      }

      const itemPattern = new RegExp(
        `([0-9]+(?:\\.[0-9]+)?)\\s*(g|grams?|ml)?\\s*(?:of\\s*)?${foodName}`,
        'i',
      );
      const foodMatch = lower.match(itemPattern);

      if (foodMatch) {
        matchedFoods.add(foodName);
        let amount = Number.parseFloat(foodMatch[1]!);
        const explicitUnit = foodMatch[2]?.toLowerCase();
        let unit = explicitUnit ?? 'g';

        if (foodName === 'egg' || foodName === 'eggs') {
          // If specified without explicit grams, assume count of eggs (~50g per egg)
          if (!explicitUnit || (!explicitUnit.startsWith('g') && explicitUnit !== 'ml')) {
            amount = amount * 50;
            unit = 'count';
          }
        }

        const scale = amount / 100;
        const estimatedCalories = Math.round(macros.caloriesPer100g * scale);
        const estimatedProtein = Math.round(macros.proteinPer100g * scale * 10) / 10;
        const estimatedCarbs = Math.round(macros.carbsPer100g * scale * 10) / 10;
        const estimatedFat = Math.round(macros.fatPer100g * scale * 10) / 10;

        mealItems.push({
          name: foodName.charAt(0).toUpperCase() + foodName.slice(1),
          amount,
          unit,
          estimated_calories: estimatedCalories,
          estimated_protein_g: estimatedProtein,
          estimated_carbs_g: estimatedCarbs,
          estimated_fat_g: estimatedFat,
        });
      }
    }

    if (mealItems.length > 0) {
      let mealName = 'Meal Log';
      if (lower.includes('breakfast')) mealName = 'Breakfast';
      else if (lower.includes('lunch')) mealName = 'Lunch';
      else if (lower.includes('dinner')) mealName = 'Dinner';
      else if (lower.includes('snack')) mealName = 'Post-Workout Snack';

      const totalCalories = mealItems.reduce((acc, item) => acc + item.estimated_calories, 0);

      return {
        extraction: {
          kind: 'meal_log',
          meal_name: mealName,
          items: mealItems,
          total_estimated_calories: totalCalories,
        },
        confidence: 0.9,
        ambiguities: [],
        raw_transcript: raw,
      };
    }

    ambiguities.push(
      'Detected food or meal terms but could not match specific quantities with known foods.',
    );
  }

  // 4. Default: Low confidence / ambiguous
  return {
    extraction: null,
    confidence: 0.2,
    ambiguities:
      ambiguities.length > 0
        ? ambiguities
        : [
            'Transcript could not be recognized as a valid weight check-in, workout log, or meal entry.',
            'Try stating: "Weighed 74.2 kg" or "Bench press 3 sets 8 reps 80 kg" or "200g chicken and 150g rice for lunch".',
          ],
    raw_transcript: raw,
  };
}
