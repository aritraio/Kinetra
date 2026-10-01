import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forbidden = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'DATABASE_URL',
  'kinetra-build-sentinel-private',
];
export function scanText(content: string, secretValues: Record<string, string> = {}): string[] {
  return [
    ...forbidden.filter((value) => content.includes(value)),
    ...Object.entries(secretValues)
      .filter(([, value]) => value.length >= 8 && content.includes(value))
      .map(([name]) => `configured secret value: ${name}`),
  ];
}
function artifacts(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = `${path}/${entry.name}`;
    return entry.isDirectory() ? artifacts(file) : [file];
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const local = existsSync('apps/api/.env.local')
    ? readFileSync('apps/api/.env.local', 'utf8')
    : '';
  const secrets: Record<string, string> = {};
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'DATABASE_URL']) {
    const value =
      process.env[name] ??
      local
        .split('\n')
        .find((line) => line.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    if (value) secrets[name] = value;
  }
  const failures = artifacts('apps/web/dist').flatMap((file) =>
    scanText(readFileSync(file, 'utf8'), secrets).map(
      (value) => `${file}: forbidden server marker ${value}`,
    ),
  );
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Web artifacts contain no configured server secret markers.');
}
