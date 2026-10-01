import { createClient } from '@supabase/supabase-js';
import { webEnvironment } from './env';
export const auth =
  webEnvironment.VITE_SUPABASE_URL && webEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(webEnvironment.VITE_SUPABASE_URL, webEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

let sessionSuppressed = false;
export function suppressSession() {
  sessionSuppressed = true;
  auth?.auth.stopAutoRefresh();
}
export function resumeSession() {
  sessionSuppressed = false;
  auth?.auth.startAutoRefresh();
}
export function isSessionSuppressed() {
  return sessionSuppressed;
}
export async function accessToken() {
  if (sessionSuppressed) return null;
  const session = await auth?.auth.getSession();
  return sessionSuppressed ? null : (session?.data.session?.access_token ?? null);
}
