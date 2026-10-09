import type { OutboxMutation } from '@kinetra/contracts';
import type React from 'react';
import { useState } from 'react';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

export interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: OutboxMutation[];
  onResolve: (
    mutationId: string,
    resolution: 'keep_local' | 'keep_remote',
    remoteRevision: number,
    remoteRecord?: unknown,
  ) => Promise<void>;
}

interface ConflictEntityData {
  weight_kg?: number;
  weight?: { value?: number; unit?: string };
  calories?: number;
  display_name?: string;
  goal?: string;
  updated_at?: string;
  revision?: number;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  onResolve,
}: ConflictResolutionModalProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const currentConflict = conflicts[0];
  if (!currentConflict || !isOpen) return null;

  const payload = (currentConflict.payload ?? {}) as ConflictEntityData;
  const remoteRecord = (currentConflict.conflictRecord ?? undefined) as
    | ConflictEntityData
    | undefined;
  const remoteRevision =
    typeof remoteRecord?.revision === 'number'
      ? remoteRecord.revision
      : currentConflict.baseRevision + 1;

  const handleResolve = async (resolution: 'keep_local' | 'keep_remote') => {
    setResolvingId(currentConflict.id);
    try {
      await onResolve(currentConflict.id, resolution, remoteRevision, remoteRecord);
      if (conflicts.length <= 1) {
        onClose();
      }
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Data Conflict"
      description={`A cross-device conflict was detected for ${currentConflict.entity} (${currentConflict.entityId}). Select which version to keep:`}
      size="medium"
    >
      <div className="conflict-modal-body">
        <div className="conflict-comparison-grid">
          {/* Remote Server Version */}
          <div className="conflict-card remote-card">
            <div className="conflict-card-header">
              <span className="badge-tag">Server Record</span>
              <span className="revision-tag tabular-nums">Rev {remoteRevision}</span>
            </div>
            <div className="conflict-card-content">
              {remoteRecord ? (
                <div className="conflict-details">
                  {currentConflict.entity === 'log' && (
                    <>
                      <div className="detail-row">
                        <span className="lbl">Weight:</span>
                        <strong className="val tabular-nums">{remoteRecord.weight_kg} kg</strong>
                      </div>
                      {remoteRecord.calories !== undefined && (
                        <div className="detail-row">
                          <span className="lbl">Calories:</span>
                          <span className="val tabular-nums">{remoteRecord.calories} kcal</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="lbl">Recorded:</span>
                        <span className="val">
                          {new Date(remoteRecord.updated_at ?? Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </>
                  )}
                  {currentConflict.entity === 'profile' && (
                    <>
                      <div className="detail-row">
                        <span className="lbl">Name:</span>
                        <strong className="val">{remoteRecord.display_name}</strong>
                      </div>
                      <div className="detail-row">
                        <span className="lbl">Goal:</span>
                        <span className="val">{remoteRecord.goal}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="conflict-missing-msg">
                  Remote server version modified by another device.
                </p>
              )}
            </div>
            <div className="conflict-card-footer">
              <Button
                variant="secondary"
                size="small"
                disabled={resolvingId !== null}
                onClick={() => void handleResolve('keep_remote')}
              >
                Accept Server Version
              </Button>
            </div>
          </div>

          {/* Local Edit Version */}
          <div className="conflict-card local-card">
            <div className="conflict-card-header">
              <span className="badge-tag tag-accent">Your Local Edit</span>
              <span className="revision-tag tabular-nums">
                Base Rev {currentConflict.baseRevision}
              </span>
            </div>
            <div className="conflict-card-content">
              <div className="conflict-details">
                {currentConflict.entity === 'log' && (
                  <>
                    <div className="detail-row">
                      <span className="lbl">Weight:</span>
                      <strong className="val tabular-nums">
                        {payload?.weight?.value ?? payload?.weight_kg}{' '}
                        {payload?.weight?.unit ?? 'kg'}
                      </strong>
                    </div>
                    {payload?.calories !== undefined && (
                      <div className="detail-row">
                        <span className="lbl">Calories:</span>
                        <span className="val tabular-nums">{payload.calories} kcal</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="lbl">Queued:</span>
                      <span className="val">
                        {new Date(currentConflict.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </>
                )}
                {currentConflict.entity === 'profile' && (
                  <>
                    <div className="detail-row">
                      <span className="lbl">Name:</span>
                      <strong className="val">{payload?.display_name}</strong>
                    </div>
                    <div className="detail-row">
                      <span className="lbl">Goal:</span>
                      <span className="val">{payload?.goal}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="conflict-card-footer">
              <Button
                variant="primary"
                size="small"
                disabled={resolvingId !== null}
                onClick={() => void handleResolve('keep_local')}
              >
                Keep My Local Version
              </Button>
            </div>
          </div>
        </div>

        <p className="conflict-footer-notice">
          Zero silent data loss: Your edits remain stored locally until you select an option.
        </p>
      </div>
    </Dialog>
  );
}
