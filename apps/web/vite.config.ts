import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const origins = [env.VITE_API_BASE_URL, env.VITE_SUPABASE_URL].flatMap((value) => {
    try {
      return value ? [new URL(value).origin] : [];
    } catch {
      return [];
    }
  });
  const policy = (development: boolean) =>
    [
      "default-src 'none'",
      `script-src 'self'${development ? " 'unsafe-inline'" : ''}`,
      `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
      "img-src 'self'",
      "font-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `connect-src 'self' ${origins.join(' ')}${development ? ' ws://127.0.0.1:5173' : ''}`,
    ].join('; ');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      headers: { 'Content-Security-Policy': policy(true), 'Referrer-Policy': 'no-referrer' },
      proxy: { '/api': 'http://127.0.0.1:3001' },
    },
    preview: {
      port: 4173,
      strictPort: true,
      headers: { 'Content-Security-Policy': policy(false), 'Referrer-Policy': 'no-referrer' },
      proxy: { '/api': 'http://127.0.0.1:3001' },
    },
  };
});
