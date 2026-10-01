import { localDateSchema, timezoneSchema } from '@kinetra/contracts';

export function localDateAt(timestamp: string, timezone: string): string {
  timezoneSchema.parse(timezone);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return localDateSchema.parse(`${get('year')}-${get('month')}-${get('day')}`);
}
export function weightInKg(value: number, unit: 'kg' | 'lb'): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid weight');
  const kg = unit === 'lb' ? value * 0.45359237 : value;
  if (kg < 20 || kg > 500) throw new Error('Weight outside supported range');
  return Math.round(kg * 1_000_000) / 1_000_000;
}
