import type { SyncStatus } from '@kinetra/contracts';
import type React from 'react';

export interface SyncStatusBadgeProps {
  status: SyncStatus;
  onSyncNow?: () => void;
  onOpenConflicts?: () => void;
  className?: string;
}

export function SyncStatusBadge({
  status,
  onSyncNow,
  onOpenConflicts,
  className = '',
}: SyncStatusBadgeProps) {
  const { isOnline, isSyncing, pendingCount, conflictCount, lastSyncedAt } = status;

  return (
    <div
      className={`sync-status-badge ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Synchronization and connectivity status"
    >
      <div className="sync-status-indicator">
        <span
          className={`sync-status-dot ${isOnline ? 'dot-online' : 'dot-offline'}`}
          aria-hidden="true"
        />
        <span className="sync-status-label">
          {conflictCount > 0 ? (
            <span className="sync-text-conflict">
              ⚠️ {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'}
            </span>
          ) : isSyncing ? (
            <span className="sync-text-syncing">Syncing changes...</span>
          ) : !isOnline ? (
            <span className="sync-text-offline">
              Offline {pendingCount > 0 ? `(${pendingCount} pending)` : ''}
            </span>
          ) : pendingCount > 0 ? (
            <span className="sync-text-pending">{pendingCount} changes queued</span>
          ) : (
            <span className="sync-text-synced">Synced {lastSyncedAt ? '· active' : ''}</span>
          )}
        </span>
      </div>

      <div className="sync-status-actions">
        {conflictCount > 0 && onOpenConflicts && (
          <button
            type="button"
            className="sync-action-btn sync-btn-conflict"
            onClick={onOpenConflicts}
            aria-label="Review and resolve data conflicts"
          >
            Review Conflict
          </button>
        )}

        {isOnline && !isSyncing && pendingCount > 0 && onSyncNow && (
          <button
            type="button"
            className="sync-action-btn"
            onClick={onSyncNow}
            aria-label="Sync pending changes now"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
}
