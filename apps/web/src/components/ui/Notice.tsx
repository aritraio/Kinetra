import type React from 'react';

export interface NoticeProps {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'subtle' | 'bordered';
  className?: string;
}

export function Notice({ title, children, icon, variant = 'subtle', className = '' }: NoticeProps) {
  return (
    <aside className={`notice-box notice-${variant} ${className}`} role="status">
      {icon && <div className="notice-icon">{icon}</div>}
      <div className="notice-content">
        {title && <strong className="notice-title">{title}</strong>}
        <div className="notice-body">{children}</div>
      </div>
    </aside>
  );
}
