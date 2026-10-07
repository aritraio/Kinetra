import type React from 'react';

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'muted' | 'success';
  className?: string;
}

export function StatusBadge({ children, variant = 'default', className = '' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${variant} ${className}`}>{children}</span>;
}
