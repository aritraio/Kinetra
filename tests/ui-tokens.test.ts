import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Design tokens and assets verification (Steps 1 & 2)', () => {
  it('preserves approved exercise photography and attribution credits in web public assets', () => {
    const publicPhotosDir = resolve(process.cwd(), 'apps/web/public/photos');
    expect(existsSync(resolve(publicPhotosDir, 'bench-press.jpg'))).toBe(true);
    expect(existsSync(resolve(publicPhotosDir, 'squat.jpg'))).toBe(true);
    expect(existsSync(resolve(publicPhotosDir, 'waist-measurement.jpg'))).toBe(true);
    expect(existsSync(resolve(publicPhotosDir, 'CREDITS.md'))).toBe(true);

    const credits = readFileSync(resolve(publicPhotosDir, 'CREDITS.md'), 'utf-8');
    expect(credits).toContain('Andrea Piacquadio');
    expect(credits).toContain('Gustavo Fring');
    expect(credits).toContain('MART PRODUCTION');
    expect(credits).toContain('Pexels');
  });

  it('defines required semantic color tokens for light and dark modes in apps/web/src/styles.css', () => {
    const cssPath = resolve(process.cwd(), 'apps/web/src/styles.css');
    const css = readFileSync(cssPath, 'utf-8');

    // Semantic roles in light mode
    expect(css).toContain('--bg: #f6f6f4');
    expect(css).toContain('--surface: #ffffff');
    expect(css).toContain('--soft: #eeeeeb');
    expect(css).toContain('--ink: #171918');
    expect(css).toContain('--muted: #626663');
    expect(css).toContain('--line: #d9dcd7');
    expect(css).toContain('--inverse: #ffffff');

    // Semantic roles in dark mode
    expect(css).toContain('--bg: #101211');
    expect(css).toContain('--surface: #191c1a');
    expect(css).toContain('--soft: #242825');
    expect(css).toContain('--ink: #f1f3ee');
    expect(css).toContain('--muted: #a2aaa3');
    expect(css).toContain('--line: #383e39');
    expect(css).toContain('--inverse: #111411');

    // Radii
    expect(css).toContain('--radius-card: 18px');
    expect(css).toContain('--radius-control: 10px');
    expect(css).toContain('--radius-badge: 6px');
    expect(css).toContain('--radius-media: 12px');

    // Control height 48px
    expect(css).toContain('--control-height: 48px');

    // Completely purged legacy orange accent
    expect(css.toLowerCase()).not.toContain('#e8a47f');
  });

  it('provides early theme initialization script in apps/web/index.html to eliminate theme flash', () => {
    const htmlPath = resolve(process.cwd(), 'apps/web/index.html');
    const html = readFileSync(htmlPath, 'utf-8');

    expect(html).toContain('kinetra-theme');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('data-theme');
  });

  it('defines motion tokens, reduced-motion accessibility, and visual primitive styles (P5-01)', () => {
    const cssPath = resolve(process.cwd(), 'apps/web/src/styles.css');
    const css = readFileSync(cssPath, 'utf-8');

    // Motion tokens
    expect(css).toContain('--motion-duration-fast');
    expect(css).toContain('--motion-duration-normal');
    expect(css).toContain('--motion-ease-standard');

    // Reduced motion media query
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms');

    // Dialog & Chart primitives
    expect(css).toContain('.dialog-backdrop');
    expect(css).toContain('.dialog-surface');
    expect(css).toContain('.chart-summary');
    expect(css).toContain('.chart-data-table');

    // Tabular numerals
    expect(css).toContain('.tabular-nums');
  });

  it('updates branding to Phase 05 and eliminates stale phase markers (P5-08)', () => {
    const headerPath = resolve(process.cwd(), 'apps/web/src/components/DemoHeader.tsx');
    const header = readFileSync(headerPath, 'utf-8');

    expect(header).toMatch(/PHASE 0[567] \//);
    expect(header).not.toContain('PHASE 03 / DOMAIN CONTRACTS & DEMO');
  });
});
