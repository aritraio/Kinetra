import type React from 'react';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'subtle' | 'plain';
  padding?: 'normal' | 'compact' | 'none';
  as?: 'div' | 'section' | 'article';
}

export function Surface({
  children,
  variant = 'card',
  padding = 'normal',
  as: Component = 'div',
  className = '',
  ...props
}: SurfaceProps) {
  const classes = [
    'surface-box',
    `surface-${variant}`,
    padding !== 'normal' ? `surface-pad-${padding}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

export const Card = Surface;
