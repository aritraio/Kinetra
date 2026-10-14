import { describe, expect, it } from 'vitest';
import { extractFromVoiceTranscript } from '../packages/domain/src/voice/voice-parser';

describe('Phase 9 — P9-02 Voice Logging & Natural Parsing', () => {
  describe('Weight Check-In Parsing', () => {
    it('parses metric weight expressions accurately', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'Weighed 74.5 kg this morning after waking up',
      });

      expect(res.extraction).not.toBeNull();
      if (res.extraction?.kind === 'weight_log') {
        expect(res.extraction.weight_kg).toBe(74.5);
        expect(res.confidence).toBeGreaterThanOrEqual(0.9);
        expect(res.ambiguities).toHaveLength(0);
      } else {
        expect.fail('Expected weight_log extraction');
      }
    });

    it('parses imperial weight expressions and converts to kg', () => {
      // 160 lbs * 0.45359237 = 72.5747... rounded to 72.6 kg
      const res = extractFromVoiceTranscript({
        transcript: 'Body weight 160 lbs on the bathroom scale',
      });

      expect(res.extraction).not.toBeNull();
      if (res.extraction?.kind === 'weight_log') {
        expect(res.extraction.weight_kg).toBe(72.6);
        expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      } else {
        expect.fail('Expected weight_log extraction');
      }
    });

    it('rejects biologically impossible or out-of-range weights', () => {
      const resTooLow = extractFromVoiceTranscript({
        transcript: 'Weighed 12 kg today',
      });
      expect(resTooLow.extraction).toBeNull();
      expect(resTooLow.confidence).toBeLessThan(0.5);

      const resTooHigh = extractFromVoiceTranscript({
        transcript: 'Weighed 650 kg today',
      });
      expect(resTooHigh.extraction).toBeNull();
      expect(resTooHigh.confidence).toBeLessThan(0.5);
    });
  });

  describe('Workout Logging Parsing', () => {
    it('parses uniform set format for multi-set compounds', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'Barbell squat 3 sets of 8 reps at 100 kg rpe 8',
      });

      expect(res.extraction).not.toBeNull();
      if (res.extraction?.kind === 'workout_log') {
        expect(res.extraction.exercise_name).toBe('Barbell Squat');
        expect(res.extraction.sets).toHaveLength(3);
        expect(res.extraction.sets[0]).toEqual({
          set_number: 1,
          reps: 8,
          load_kg: 100,
          rpe: 8,
        });
        expect(res.extraction.sets[2]).toEqual({
          set_number: 3,
          reps: 8,
          load_kg: 100,
          rpe: 8,
        });
        expect(res.confidence).toBe(0.95);
      } else {
        expect.fail('Expected workout_log extraction');
      }
    });

    it('parses detailed sequential set transcripts', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'Bench press set 1 10 reps at 80 kg rpe 7, set 2 8 reps at 85 kg rpe 8.5',
      });

      expect(res.extraction).not.toBeNull();
      if (res.extraction?.kind === 'workout_log') {
        expect(res.extraction.exercise_name).toBe('Bench Press');
        expect(res.extraction.sets).toHaveLength(2);
        expect(res.extraction.sets[0]?.reps).toBe(10);
        expect(res.extraction.sets[0]?.load_kg).toBe(80);
        expect(res.extraction.sets[0]?.rpe).toBe(7);
        expect(res.extraction.sets[1]?.reps).toBe(8);
        expect(res.extraction.sets[1]?.load_kg).toBe(85);
        expect(res.extraction.sets[1]?.rpe).toBe(8.5);
      } else {
        expect.fail('Expected workout_log extraction');
      }
    });

    it('flags ambiguity when exercise is mentioned without rep/load breakdown', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'I did some heavy deadlifts this afternoon',
      });

      expect(res.extraction).toBeNull();
      expect(res.ambiguities.length).toBeGreaterThan(0);
      expect(res.ambiguities[0]).toContain('Deadlift');
    });
  });

  describe('Nutrition / Meal Logging Parsing', () => {
    it('parses multi-item meal transcript with macronutrient densities', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'Had 200g chicken breast and 150g white rice for lunch',
      });

      expect(res.extraction).not.toBeNull();
      if (res.extraction?.kind === 'meal_log') {
        expect(res.extraction.meal_name).toBe('Lunch');
        expect(res.extraction.items).toHaveLength(2);

        const chicken = res.extraction.items.find((i) => i.name.toLowerCase().includes('chicken'));
        expect(chicken).toBeDefined();
        expect(chicken?.amount).toBe(200);
        expect(chicken?.estimated_protein_g).toBe(62); // 31 * 2

        const rice = res.extraction.items.find((i) => i.name.toLowerCase().includes('rice'));
        expect(rice).toBeDefined();
        expect(rice?.amount).toBe(150);

        expect(res.extraction.total_estimated_calories).toBeGreaterThan(400);
      } else {
        expect.fail('Expected meal_log extraction');
      }
    });

    it('handles count-based foods like eggs correctly', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'Ate 3 eggs and 2 slices bread for breakfast',
      });

      expect(res.extraction).not.toBeNull();
      if (res.extraction?.kind === 'meal_log') {
        expect(res.extraction.meal_name).toBe('Breakfast');
        const eggs = res.extraction.items.find((i) => i.name.toLowerCase().includes('egg'));
        expect(eggs).toBeDefined();
        // 3 eggs * 50g = 150g
        expect(eggs?.amount).toBe(150);
        expect(eggs?.unit).toBe('count');
      } else {
        expect.fail('Expected meal_log extraction');
      }
    });
  });

  describe('Ambiguity and Fallback Handling', () => {
    it('handles completely unrecognized transcripts gracefully with guidance tips', () => {
      const res = extractFromVoiceTranscript({
        transcript: 'The weather in the mountains was nice and sunny',
      });

      expect(res.extraction).toBeNull();
      expect(res.confidence).toBeLessThan(0.3);
      expect(res.ambiguities.length).toBeGreaterThan(0);
      expect(res.ambiguities[1]).toContain('Try stating:');
    });
  });
});
