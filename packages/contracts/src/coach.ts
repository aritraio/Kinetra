import { z } from 'zod';

export const coachEventPhaseSchema = z.enum(['analyzing', 'synthesizing', 'reviewing']);
export type CoachEventPhase = z.infer<typeof coachEventPhaseSchema>;

export const coachStreamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('started'),
    protocolVersion: z.literal(1),
    operation_id: z.string().uuid().optional(),
  }),
  z.strictObject({
    type: z.literal('status'),
    phase: coachEventPhaseSchema,
    message: z.string().trim().min(1).max(200),
  }),
  z.strictObject({
    type: z.literal('text_delta'),
    text: z.string().max(500),
  }),
  z.strictObject({
    type: z.literal('citation'),
    source: z.string().trim().min(1).max(200),
    url: z.string().url().max(300).optional(),
  }),
  z.strictObject({
    type: z.literal('action_suggestion'),
    action: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(100),
    payload: z.unknown().optional(),
  }),
  z.strictObject({
    type: z.literal('error'),
    code: z.string().trim().min(1).max(50),
    message: z.string().trim().min(1).max(300),
    retryable: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('done'),
  }),
]);
export type CoachStreamEvent = z.infer<typeof coachStreamEventSchema>;

export const coachRoleSchema = z.enum(['user', 'assistant', 'system']);
export type CoachRole = z.infer<typeof coachRoleSchema>;

export const coachMessageSchema = z.strictObject({
  id: z.string().uuid(),
  role: coachRoleSchema,
  content: z.string().trim().min(1).max(4000),
  created_at: z.string(),
});
export type CoachMessage = z.infer<typeof coachMessageSchema>;

export const coachConversationContextSchema = z.strictObject({
  messages: z.array(coachMessageSchema).max(20),
  active_plan_id: z.string().uuid().optional(),
  active_workout_focus: z.string().max(100).optional(),
});
export type CoachConversationContext = z.infer<typeof coachConversationContextSchema>;
