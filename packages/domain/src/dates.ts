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
export { weightInKg } from './units';
