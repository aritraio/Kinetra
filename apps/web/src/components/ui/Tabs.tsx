import type React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number | string;
}

export interface TabsProps<T extends string = string> {
  tabs: readonly TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel = 'Tabs',
  className = '',
}: TabsProps<T>) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex >= 0) {
      e.preventDefault();
      const nextTab = tabs[targetIndex];
      if (nextTab) {
        onChange(nextTab.id);
        const nextButton = document.getElementById(`tab-button-${nextTab.id}`);
        nextButton?.focus();
      }
    }
  };

  return (
    <div className={`tabs-container ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`tab-button-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`tab-item ${isSelected ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
