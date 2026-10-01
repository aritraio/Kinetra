import { profileSchema, type Profile, type ProfileRecord } from '@kinetra/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { auth, isSessionSuppressed, resumeSession, suppressSession } from './auth';
import { rpc } from './client';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@kinetra/api/router';

const initial: Profile = {
  display_name: 'Synthetic profile',
  height_cm: 175,
  weight_kg: 75,
  goal: 'maintain',
  timezone: 'Asia/Kolkata',
  units: 'metric',
};
export function AccountPanel() {
  const queryClient = useQueryClient();
  const [owner, setOwner] = useState<string | null>(null);
  const [email, setEmail] = useState('foundation-cut@example.test');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile>(initial);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(
    'Local synthetic accounts only. Real-user collection is not enabled.',
  );
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveInFlight = useRef(false);
  const epoch = useRef(0);
  const activeOwner = useRef<string | null>(null);
  useEffect(() => {
    const subscription = auth?.auth.onAuthStateChange((_event, session) => {
      const nextOwner = isSessionSuppressed() ? null : (session?.user.id ?? null);
      if (nextOwner === activeOwner.current) return;
      activeOwner.current = nextOwner;
      epoch.current += 1;
      setBusy(false);
      setOwner(nextOwner);
      setProfile(initial);
      setRevision(0);
      setDirty(false);
      queryClient.clear();
      setMessage(
        session
          ? 'Signed in. Load or create your synthetic profile.'
          : 'Signed out. Local profile state cleared.',
      );
    });
    return () => {
      epoch.current += 1;
      subscription?.data.subscription.unsubscribe();
    };
  }, [queryClient]);
  function apply(record: ProfileRecord | null) {
    setProfile(
      record
        ? profileSchema.parse({
            display_name: record.display_name,
            height_cm: record.height_cm,
            weight_kg: record.weight_kg,
            goal: record.goal,
            timezone: record.timezone,
            units: record.units,
          })
        : initial,
    );
    setRevision(record?.revision ?? 0);
    setDirty(false);
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    try {
      const result = await auth.auth.signInWithPassword({ email, password });
      setPassword('');
      if (result.error) setMessage('Sign-in failed. Check your local account credentials.');
      else {
        resumeSession();
        activeOwner.current = result.data.user.id;
        setOwner(result.data.user.id);
        setMessage('Signed in. Load or create your synthetic profile.');
      }
    } catch {
      setMessage('Sign-in service unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    const current = epoch.current;
    setBusy(true);
    try {
      const row = await rpc.profile.read.query();
      if (current === epoch.current) {
        apply(row);
        setMessage(row ? 'Profile loaded.' : 'Create a synthetic profile.');
      }
    } catch (error) {
      if (current !== epoch.current) return;
      if (
        error instanceof TRPCClientError &&
        (error as TRPCClientError<AppRouter>).data?.code === 'UNAUTHORIZED'
      ) {
        await signOut();
        setMessage('Session expired. Sign in again.');
      } else if (current === epoch.current)
        setMessage('Profile unavailable. Try again when the service is available.');
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }
  // Coalesce draft changes into one explicit save. No per-keystroke network writes.
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    const current = epoch.current;
    setBusy(true);
    try {
      const row = await rpc.profile.save.mutate({ expected_revision: revision, profile });
      if (current === epoch.current) {
        apply(row);
        setMessage('Saved with revision protection.');
      }
    } catch (error) {
      if (current !== epoch.current) return;
      if (
        error instanceof TRPCClientError &&
        (error as TRPCClientError<AppRouter>).data?.code === 'UNAUTHORIZED'
      ) {
        await signOut();
        setMessage('Session expired. Sign in again.');
      } else if (current === epoch.current)
        setMessage(
          'Save failed or changed elsewhere. Your draft is preserved; load the latest before retrying.',
        );
    } finally {
      saveInFlight.current = false;
      if (current === epoch.current) setBusy(false);
    }
  }
  async function signOut() {
    suppressSession();
    epoch.current += 1;
    activeOwner.current = null;
    setOwner(null);
    setProfile(initial);
    setRevision(0);
    setDirty(false);
    setBusy(true);
    const current = epoch.current;
    setPassword('');
    queryClient.clear();
    setMessage('Signed out. Local profile state cleared.');
    try {
      await auth?.auth.signOut({ scope: 'local' });
    } catch {
      if (current === epoch.current)
        setMessage('Signed out locally. The sign-in service is unavailable.');
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }

  if (!auth)
    return (
      <section className="instrument">
        <h2>Account security</h2>
        <p>Start local Supabase and run the documented local setup to enable synthetic sign-in.</p>
      </section>
    );
  return (
    <section className="instrument">
      <h2>Account security</h2>
      <p role="status">{message}</p>
      {!owner ? (
        <form onSubmit={(event) => void signIn(event)}>
          <label>
            Email
            <input
              disabled={busy}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              disabled={busy}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Sign in
          </button>
        </form>
      ) : (
        <>
          <div className="actions">
            <button type="button" onClick={() => void load()} disabled={busy || dirty}>
              Load profile
            </button>
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
          <form onSubmit={(event) => void save(event)}>
            <label>
              Display name
              <input
                disabled={busy}
                value={profile.display_name}
                maxLength={80}
                required
                onChange={(event) => {
                  setProfile({ ...profile, display_name: event.target.value });
                  setDirty(true);
                }}
              />
            </label>
            <label>
              Height (cm)
              <input
                disabled={busy}
                type="number"
                min={50}
                max={250}
                value={profile.height_cm}
                onChange={(event) => {
                  setProfile({ ...profile, height_cm: Number(event.target.value) });
                  setDirty(true);
                }}
                required
              />
            </label>
            <label>
              Weight (kg)
              <input
                disabled={busy}
                type="number"
                min={20}
                max={500}
                step="0.1"
                value={profile.weight_kg}
                onChange={(event) => {
                  setProfile({ ...profile, weight_kg: Number(event.target.value) });
                  setDirty(true);
                }}
                required
              />
            </label>
            <label>
              Timezone
              <input
                disabled={busy}
                value={profile.timezone}
                onChange={(event) => {
                  setProfile({ ...profile, timezone: event.target.value });
                  setDirty(true);
                }}
                required
              />
            </label>
            <p>
              Display preview: <span>{profile.display_name}</span>
            </p>
            <p>
              Revision {revision}. {dirty ? 'Unsaved draft.' : 'No pending changes.'}
            </p>
            <div className="actions">
              <button type="submit" disabled={busy}>
                Save profile
              </button>
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={() => {
                  setDirty(false);
                  void load();
                }}
              >
                Discard draft and reload
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
