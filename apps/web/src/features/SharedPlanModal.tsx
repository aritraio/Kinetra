import { useEffect, useState } from 'react';
import { Button, Dialog, Notice } from '../components/ui';
import type { PlanShareGrant, PlanWithVersion } from '@kinetra/contracts';
import { useRepositories } from '../repositories';

interface SharedPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanWithVersion | null;
}

export function SharedPlanModal({ isOpen, onClose, plan }: SharedPlanModalProps) {
  const repos = useRepositories();
  const [durationDays, setDurationDays] = useState(7);
  const [grants, setGrants] = useState<PlanShareGrant[]>([]);
  const [createdGrant, setCreatedGrant] = useState<PlanShareGrant | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadGrants = async () => {
    if (!plan || !repos.plans.listShareGrants) return;
    try {
      const list = await repos.plans.listShareGrants(plan.plan.id);
      setGrants(list);
    } catch {
      // Ignore
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loads grants strictly upon modal opening
  useEffect(() => {
    if (isOpen) {
      void loadGrants();
      setCreatedGrant(null);
      setError(null);
    }
  }, [isOpen]);

  const handleCreateGrant = async () => {
    if (!plan || !repos.plans.createShareGrant) return;
    setIsLoading(true);
    setError(null);
    try {
      const grant = await repos.plans.createShareGrant({
        plan_id: plan.plan.id,
        version: plan.current_version.version,
        duration_days: durationDays,
      });
      setCreatedGrant(grant);
      await loadGrants();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    if (!repos.plans.revokeShareGrant) return;
    try {
      await repos.plans.revokeShareGrant(grantId);
      await loadGrants();
      if (createdGrant?.id === grantId) {
        setCreatedGrant(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
    }
  };

  const copyToClipboard = (token: string) => {
    const shareUrl = `${window.location.origin}/?shared_token=${token}`;
    void navigator.clipboard.writeText(shareUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!plan) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${plan.plan.kind === 'workout' ? 'Workout Routine' : 'Meal Schedule'} v${plan.current_version.version}`}
      description="Create a revocable, expiring link to share this verified routine. Strictly excludes biometrics, logs, and photos."
      size="medium"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Notice variant="error">{error}</Notice>}

        <Notice variant="info">
          <strong>Privacy guarantee:</strong> Anyone with the link can only see this specific
          verified plan version. Your name, email, daily weigh-ins, calorie logs, and private photos
          are never disclosed.
        </Notice>

        {/* Generate Grant Form */}
        <div
          style={{
            padding: '16px',
            background: 'var(--surface-secondary, #1e2230)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Expiration Duration:
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number.parseInt(e.target.value, 10))}
                style={{ marginLeft: '10px', padding: '6px 10px', borderRadius: '4px' }}
              >
                <option value={1}>1 Day (Expiring)</option>
                <option value={7}>7 Days (Standard)</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days (Maximum)</option>
              </select>
            </label>

            <Button variant="primary" size="small" onClick={handleCreateGrant} loading={isLoading}>
              Generate Share Link
            </Button>
          </div>

          {createdGrant && (
            <div
              style={{
                marginTop: '10px',
                padding: '12px',
                background: 'var(--surface)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <code style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                  {`${window.location.origin}/?shared_token=${createdGrant.token}`}
                </code>
                <Button
                  size="small"
                  variant="quiet"
                  onClick={() => copyToClipboard(createdGrant.token)}
                >
                  {copiedToken === createdGrant.token ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                Expires on {new Date(createdGrant.expires_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Active Shares List */}
        <div>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '8px' }}>
            Active Share Grants ({grants.filter((g) => !g.revoked_at).length})
          </h3>
          {grants.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              No active share links for this plan.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {grants.map((g) => {
                const isRevoked = Boolean(g.revoked_at);
                const isExpired = new Date(g.expires_at).getTime() < Date.now();
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span>Version {g.version}</span>
                        {isRevoked ? (
                          <span
                            className="badge badge-accent"
                            style={{ background: 'var(--color-danger, #e53935)' }}
                          >
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="badge">Expired</span>
                        ) : (
                          <span className="badge">Active</span>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Expires: {new Date(g.expires_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!isRevoked && !isExpired && (
                        <Button
                          size="small"
                          variant="quiet"
                          onClick={() => copyToClipboard(g.token)}
                        >
                          {copiedToken === g.token ? 'Copied!' : 'Copy Link'}
                        </Button>
                      )}
                      {!isRevoked && (
                        <Button size="small" variant="quiet" onClick={() => handleRevoke(g.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
