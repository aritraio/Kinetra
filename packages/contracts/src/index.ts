import { z } from 'zod';

export const protocolVersion = 1;
export const echoInputSchema = z.strictObject({ message: z.string().trim().min(1).max(120) });
export const echoResultSchema = z.strictObject({
  message: z.string(),
  protocolVersion: z.literal(1),
});
export const streamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('started'), protocolVersion: z.literal(1) }),
  z.strictObject({ type: z.literal('text_delta'), text: z.string().max(120) }),
  z.strictObject({ type: z.literal('done') }),
]);
export type StreamEvent = z.infer<typeof streamEventSchema>;

export * from './account';
export * from './plans';
export * from './sessions';
export * from './coach';
export * from './voice';
export * from './repositories';
export * from './export';
export * from './photos';
export * from './posture';
export * from './progression';
