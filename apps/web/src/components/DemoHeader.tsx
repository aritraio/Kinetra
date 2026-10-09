import { useState } from 'react';
import { RemindersModal } from '../features/RemindersModal';
import { useRepositoryControls } from '../repositories';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { UserControlsModal } from './UserControlsModal';
import { Button, ThemeToggle } from './ui';
import { SyncStatusBadge } from './ui/SyncStatusBadge';

export type NavigationTab =
  | 'today'
  | 'measure'
  | 'plan'
  | 'progress'
  | 'posture'
  | 'onboarding'
  | 'foundation';

export function DemoHeader({
  activeTab,
  onSelectTab,
}: {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}) {
  const {
    activePersonaId,
    setPersona,
    resetDemo,
    syncStatus,
    triggerSync,
    conflicts,
    resolveConflict,
    exportData,
    deleteAccount,
  } = useRepositoryControls();
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [isUserControlsOpen, setIsUserControlsOpen] = useState(false);
  const [isConflictsOpen, setIsConflictsOpen] = useState(false);

  const handleReset = async () => {
    setResetStatus('Resetting...');
    await resetDemo();
    setResetStatus('Restored to defaults');
    setTimeout(() => setResetStatus(null), 2500);
  };

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="branding">
          <span className="wordmark">KINETRA</span>
          <span className="phase">PHASE 07 / LOCAL POSTURE & FORM LAB</span>
        </div>

        {/* Sync Status Feedback & Controls */}
        <div className="header-sync-area">
          <SyncStatusBadge
            status={syncStatus}
            onSyncNow={() => void triggerSync()}
            onOpenConflicts={() => setIsConflictsOpen(true)}
          />
        </div>

        {/* Demo Mode / Persona Selector Bar */}
        <div className="demo-controls-bar">
          <span className="demo-label">Synthetic Persona:</span>
          <div className="persona-pills">
            <button
              type="button"
              className={`pill-btn ${activePersonaId === 'maya' ? 'pill-active' : ''}`}
              onClick={() => setPersona('maya')}
            >
              Maya Lin (Cut)
            </button>
            <button
              type="button"
              className={`pill-btn ${activePersonaId === 'marcus' ? 'pill-active' : ''}`}
              onClick={() => setPersona('marcus')}
            >
              Marcus Vance (Bulk)
            </button>
          </div>

          <Button
            size="small"
            variant="quiet"
            onClick={() => setIsRemindersOpen(true)}
            title="Configure in-app schedule reminders"
          >
            Reminders
          </Button>

          <Button
            size="small"
            variant="quiet"
            onClick={() => setIsUserControlsOpen(true)}
            title="Export personal data or request deletion"
          >
            Data & Privacy
          </Button>

          <button
            type="button"
            onClick={handleReset}
            className="btn-reset"
            title="Reset in-memory state to pristine synthetic fixtures"
          >
            {resetStatus || 'Reset Fixtures'}
          </button>

          <ThemeToggle />
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => onSelectTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'measure' ? 'active' : ''}`}
          onClick={() => onSelectTab('measure')}
        >
          Measure
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => onSelectTab('plan')}
        >
          Plan
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => onSelectTab('progress')}
        >
          Progress
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'posture' ? 'active' : ''}`}
          onClick={() => onSelectTab('posture')}
        >
          Posture & Form Lab
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'onboarding' ? 'active' : ''}`}
          onClick={() => onSelectTab('onboarding')}
        >
          Onboarding
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'foundation' ? 'active' : ''}`}
          onClick={() => onSelectTab('foundation')}
        >
          Foundation & Auth
        </button>
      </nav>

      <RemindersModal isOpen={isRemindersOpen} onClose={() => setIsRemindersOpen(false)} />

      <ConflictResolutionModal
        isOpen={isConflictsOpen}
        onClose={() => setIsConflictsOpen(false)}
        conflicts={conflicts}
        onResolve={resolveConflict}
      />

      <UserControlsModal
        isOpen={isUserControlsOpen}
        onClose={() => setIsUserControlsOpen(false)}
        ownerId={`user-${activePersonaId}`}
        onExport={exportData}
        onDeleteAccount={deleteAccount}
        onAccountDeleted={() => {
          setResetStatus('Account deleted & local data erased');
          setTimeout(() => setResetStatus(null), 3000);
        }}
      />
    </header>
  );
}
