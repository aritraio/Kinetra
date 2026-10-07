import type React from 'react';
import { type ThemePreference, useTheme } from '../../theme';
import { MoonIcon, SunIcon, SystemIcon } from './Icons';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const options: { id: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <SunIcon size={16} /> },
    { id: 'dark', label: 'Dark', icon: <MoonIcon size={16} /> },
    { id: 'system', label: 'System', icon: <SystemIcon size={16} /> },
  ];

  return (
    <fieldset className={`theme-toggle-group ${className}`}>
      <legend className="sr-only">Appearance Theme</legend>
      {options.map((opt) => {
        const isSelected = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isSelected}
            className={`theme-toggle-btn ${isSelected ? 'active' : ''}`}
            onClick={() => setTheme(opt.id)}
            title={`Set theme to ${opt.label}${opt.id === 'system' ? ` (currently ${resolvedTheme})` : ''}`}
          >
            <span className="theme-toggle-icon">{opt.icon}</span>
            <span className="theme-toggle-label">{opt.label}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
