import type React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'default' | 'small';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'default',
  icon,
  iconPosition = 'right',
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'small' ? 'btn-small' : '',
    loading ? 'btn-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="btn-icon">{icon}</span>}
          {children && <span className="btn-label">{children}</span>}
          {icon && iconPosition === 'right' && <span className="btn-icon">{icon}</span>}
        </>
      )}
    </button>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet';
  'aria-label': string;
  icon: React.ReactNode;
}

export function IconButton({
  variant = 'quiet',
  icon,
  className = '',
  'aria-label': ariaLabel,
  ...props
}: IconButtonProps) {
  const classes = ['btn', 'btn-icon-only', `btn-${variant}`, className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} aria-label={ariaLabel} {...props}>
      {icon}
    </button>
  );
}
