import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Phase 9 — P9-08 Accessibility Audit (WCAG 2.1 AA Compliance)', () => {
  const root = process.cwd();

  describe('Dialog Primitives & Focus Management (WCAG 2.1.2, 2.4.3)', () => {
    it('Dialog component implements aria-modal, title labelling, focus trap, and escape key listener', () => {
      const dialogContent = readFileSync(
        resolve(root, 'apps/web/src/components/ui/Dialog.tsx'),
        'utf-8',
      );

      // ARIA semantics
      expect(dialogContent).toContain('role={role}');
      expect(dialogContent).toContain('aria-modal="true"');
      expect(dialogContent).toContain('aria-labelledby={titleId}');

      // Keyboard handling & focus management
      expect(dialogContent).toContain("e.key === 'Escape'");
      expect(dialogContent).toContain("e.key === 'Tab'");
      expect(dialogContent).toContain('previouslyFocusedElementRef.current?.focus?.()');

      // Accessible close button
      expect(dialogContent).toContain('aria-label="Close dialog"');
    });

    const featureModals = [
      'apps/web/src/features/SharedPlanModal.tsx',
      'apps/web/src/features/VoiceLogModal.tsx',
      'apps/web/src/features/RemindersModal.tsx',
      'apps/web/src/components/ConflictResolutionModal.tsx',
      'apps/web/src/components/UserControlsModal.tsx',
    ];

    it.each(featureModals)('modal %s utilizes the accessible Dialog primitive', (relPath) => {
      const content = readFileSync(resolve(root, relPath), 'utf-8');
      expect(content).toContain('<Dialog');
      expect(content).toContain('onClose=');
    });
  });

  describe('Streaming Coach Screen Reader Announcer (WCAG 4.1.3)', () => {
    it('uses role="log" and aria-live="polite" for live streaming output in CoachView', () => {
      const coachView = readFileSync(resolve(root, 'apps/web/src/features/CoachView.tsx'), 'utf-8');

      // Log region for stream
      expect(coachView).toContain('role="log"');
      expect(coachView).toContain('aria-live="polite"');
      expect(coachView).toContain('aria-atomic');
    });
  });

  describe('Voice Logger Accessibility & Non-Voice Fallback (WCAG 1.2.1, 2.1.1)', () => {
    it('provides clear speech recognition fallback and manual typed transcript input', () => {
      const voiceModal = readFileSync(
        resolve(root, 'apps/web/src/features/VoiceLogModal.tsx'),
        'utf-8',
      );

      // Fallback message for unsupported / denied speech recognition
      expect(voiceModal).toContain('Speech recognition is not supported in this browser');
      // Editable transcript textarea fallback
      expect(voiceModal).toContain('transcript');
      expect(voiceModal).toContain('placeholder=');
      // Editable structured preview fields
      expect(voiceModal).toContain('Extracted Fields (Editable)');
    });
  });

  describe('Design Tokens, Focus Rings, and Reduced Motion (CSS Audit)', () => {
    it('ensures visible focus indicators, tabular numerals, and reduced motion overrides in styles.css', () => {
      const css = readFileSync(resolve(root, 'apps/web/src/styles.css'), 'utf-8');

      // Focus visibility
      expect(css).toContain(':focus-visible');
      expect(css).toContain('outline:');

      // Reduced motion media query
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).toContain('animation-duration: 0.01ms');

      // Tabular figures for numbers
      expect(css).toContain('.tabular-nums');

      // Sizing tokens ensuring accessible touch target heights (>= 44px)
      expect(css).toContain('--control-height: 48px;');
      expect(css).toContain('min-height: var(--control-height);');
    });
  });
});
