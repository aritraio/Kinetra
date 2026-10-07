import { Button } from './Button';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading data...', className = '' }: LoadingStateProps) {
  return (
    <div className={`feedback-state loading-state ${className}`} role="status">
      <span className="feedback-spinner" aria-hidden="true" />
      <p className="feedback-message">{message}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`feedback-state empty-state ${className}`}>
      <h3 className="feedback-title">{title}</h3>
      <p className="feedback-message">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction} className="feedback-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  error,
  onRetry,
  className = '',
}: ErrorStateProps) {
  const message = error instanceof Error ? error.message : error;

  return (
    <div className={`feedback-state error-state ${className}`} role="alert">
      <h3 className="feedback-title">{title}</h3>
      <p className="feedback-message">{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} className="feedback-action">
          Try Again
        </Button>
      )}
    </div>
  );
}
