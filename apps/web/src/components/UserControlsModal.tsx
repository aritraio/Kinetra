import type { ExportData } from '@kinetra/contracts';
import type React from 'react';
import { useState } from 'react';
import { clearAccountData } from '../offline/db';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';
import { Notice } from './ui/Notice';

export interface UserControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
  onExport: () => Promise<ExportData>;
  onDeleteAccount: (confirmation: 'DELETE_MY_ACCOUNT') => Promise<{ records_purged: number }>;
  onAccountDeleted?: () => void;
}

export function UserControlsModal({
  isOpen,
  onClose,
  ownerId,
  onExport,
  onDeleteAccount,
  onAccountDeleted,
}: UserControlsModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'delete'>('export');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const data = await onExport();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kinetra-export-${ownerId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation.trim() !== 'DELETE_MY_ACCOUNT') {
      setDeleteError('You must type DELETE_MY_ACCOUNT exactly to confirm');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount('DELETE_MY_ACCOUNT');
      // Wipe local IndexedDB account partition
      await clearAccountData(ownerId);
      setDeleteSuccess(true);
      setTimeout(() => {
        onAccountDeleted?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="User Privacy & Data Controls"
      description="Manage your personal data, portability export, and permanent erasure per Kinetra privacy principles."
      size="medium"
    >
      <div className="user-controls-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export Data
        </button>
        <button
          type="button"
          className={`tab-btn danger-tab ${activeTab === 'delete' ? 'active' : ''}`}
          onClick={() => setActiveTab('delete')}
        >
          Delete Account
        </button>
      </div>

      <div className="user-controls-content">
        {activeTab === 'export' && (
          <div className="export-panel">
            <p className="panel-desc">
              Download a complete, machine-readable JSON archive containing your owned profile, all
              daily weight and macro logs, training sessions, verified workout/meal plan versions,
              and consent records.
            </p>

            <div className="export-details-box">
              <span className="box-title">Format Specifications:</span>
              <ul>
                <li>
                  Schema Version: <strong>2026-10-01</strong>
                </li>
                <li>Preserves exact historical dates, units (metric/imperial), and timezones</li>
                <li>Excludes secrets, internal server budgets, and other tenants’ data</li>
              </ul>
            </div>

            {exportSuccess && (
              <Notice variant="success" title="Export Generated">
                Your data archive has been downloaded to your device.
              </Notice>
            )}

            {exportError && (
              <Notice variant="error" title="Export Failed">
                {exportError}
              </Notice>
            )}

            <div className="panel-actions">
              <Button variant="primary" onClick={() => void handleExport()} disabled={isExporting}>
                {isExporting ? 'Generating Archive...' : 'Download Data Archive (.json)'}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'delete' && (
          <div className="delete-panel">
            {deleteSuccess ? (
              <Notice variant="success" title="Account Deleted">
                All owned records and local caches have been permanently purged. Signing out...
              </Notice>
            ) : (
              <>
                <p className="panel-desc text-danger">
                  Warning: Account deletion is permanent and irreversible.
                </p>

                <div className="delete-warning-box">
                  <span className="box-title">What happens when you delete:</span>
                  <ul>
                    <li>
                      All profile data, logs, sessions, plans, and consent records are permanently
                      deleted.
                    </li>
                    <li>
                      Local IndexedDB caches and unsent outbox changes on this device are erased.
                    </li>
                    <li>Future writes are immediately blocked.</li>
                    <li>
                      <em>Note:</em> Devices remaining offline without reconnecting cannot be erased
                      remotely; their local caches are purged on the next verified connection or
                      logout.
                    </li>
                  </ul>
                </div>

                <div className="delete-confirm-input-wrap">
                  <Field
                    label="To confirm, type DELETE_MY_ACCOUNT below:"
                    value={deleteConfirmation}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDeleteConfirmation(e.target.value)
                    }
                    placeholder="DELETE_MY_ACCOUNT"
                    disabled={isDeleting}
                  />
                </div>

                {deleteError && (
                  <Notice variant="error" title="Deletion Error">
                    {deleteError}
                  </Notice>
                )}

                <div className="panel-actions">
                  <Button
                    variant="primary"
                    style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
                    onClick={() => void handleDelete()}
                    disabled={isDeleting || deleteConfirmation.trim() !== 'DELETE_MY_ACCOUNT'}
                  >
                    {isDeleting ? 'Erasing Account...' : 'Permanently Delete My Account'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
