import { useState } from 'react';
import { useRepositoryControls } from '../repositories';
import { ThemeToggle } from './ui';

export type NavigationTab = 'today' | 'measure' | 'plan' | 'progress' | 'foundation';

export function DemoHeader({
  activeTab,
  onSelectTab,
}: {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}) {
  const { activePersonaId, setPersona, resetDemo } = useRepositoryControls();
  const [resetStatus, setResetStatus] = useState<string | null>(null);

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
          <span className="phase">PHASE 03 / DOMAIN CONTRACTS & DEMO</span>
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
          className={`nav-tab ${activeTab === 'foundation' ? 'active' : ''}`}
          onClick={() => onSelectTab('foundation')}
        >
          Foundation & Auth
        </button>
      </nav>
    </header>
  );
}
