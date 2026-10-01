import { echoInputSchema, echoResultSchema, protocolVersion } from '@kinetra/contracts';

// A transport spike only; no health calculations or provider calls in Phase 1.
export function echoMessage(input: unknown) {
  const { message } = echoInputSchema.parse(input);
  return echoResultSchema.parse({ message, protocolVersion });
}

export * from './dates';
