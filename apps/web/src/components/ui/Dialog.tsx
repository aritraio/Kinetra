import type React from 'react';
import { useEffect, useId, useRef } from 'react';
import { IconButton } from './Button';
import { CloseIcon } from './Icons';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  role?: 'dialog' | 'alertdialog';
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'medium',
  role = 'dialog',
  className = '',
}: DialogProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = description ? `${dialogId}-desc` : undefined;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Manage focus restoration and escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }

      // Simple focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on dialog or first focusable
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 20);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click handles outside click; Escape key is handled on document
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click dismisses dialog on outside click
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamically typed as dialog or alertdialog */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={`dialog-surface dialog-${size} ${className}`}
      >
        <div className="dialog-header">
          <div className="dialog-title-block">
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="dialog-description">
                {description}
              </p>
            )}
          </div>
          <IconButton
            variant="quiet"
            aria-label="Close dialog"
            icon={<CloseIcon />}
            onClick={onClose}
            className="dialog-close-btn"
          />
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
