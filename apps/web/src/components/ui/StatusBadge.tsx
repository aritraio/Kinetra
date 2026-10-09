import type React from 'react';

export interface StatusBadgeProps {
  children?: React.ReactNode;
  label?: string;
  status?: 'verified' | 'stale' | 'pending' | string;
  variant?: 'default' | 'accent' | 'muted' | 'success';
  className?: string;
}

export function StatusBadge({
  children,
  label,
  status,
  variant = 'default',
  className = '',
}: StatusBadgeProps) {
  const effectiveVariant =
    status === 'verified' ? 'success' : status === 'stale' ? 'muted' : variant;

  return (
    <span className={`status-badge status-badge-${effectiveVariant} ${className}`}>
      {children ?? label ?? status}
    </span>
  );
}
