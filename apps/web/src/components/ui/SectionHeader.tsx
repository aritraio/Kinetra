import type React from 'react';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  level = 2,
  className = '',
}: SectionHeaderProps) {
  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3';

  return (
    <header className={`section-header ${className}`}>
      <div className="section-header-main">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <HeadingTag className={level === 1 ? 'page-title' : 'section-title'}>{title}</HeadingTag>
        {description && <p className="section-desc">{description}</p>}
      </div>
      {action && <div className="section-header-action">{action}</div>}
    </header>
  );
}
