import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { screens } from './screens.js';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/Users/aritra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.KINETRA_DESIGN_URL || 'http://127.0.0.1:4175/design';
const browser = await playwright.chromium.launch({ headless: true });
const results = [];
let completed = 0;
await Promise.all(
  ['web', 'android'].flatMap((platform) =>
    ['light', 'dark'].map(async (theme) => {
      const page = await browser.newPage({
        viewport: platform === 'web' ? { width: 1440, height: 1000 } : { width: 412, height: 915 },
        deviceScaleFactor: 1,
      });
      for (const s of screens) {
        const errors = [];
        const onError = (err) => errors.push(err.message);
        page.on('pageerror', onError);
        await page.goto(`${base}/mockups/${platform}/${theme}/${s.id}.html`, {
          waitUntil: 'load',
        });
        await page.screenshot({
          path: path.join(root, 'mockups', platform, theme, `${s.id}.png`),
          fullPage: platform === 'web',
        });
        if (platform === 'android')
          await page.screenshot({
            path: path.join(root, 'mockups', platform, theme, `${s.id}-scroll.png`),
            fullPage: true,
          });
        const checks = await page.evaluate(() => ({
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          heading: document.querySelector('h1')?.textContent,
          emptyLinks: [...document.querySelectorAll('a')].filter(
            (a) => !a.textContent.trim() && !a.getAttribute('aria-label'),
          ).length,
          bodyHeight: document.documentElement.scrollHeight,
          brokenImages: [...document.images]
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => img.getAttribute('src')),
          inconsistentControls: [...document.querySelectorAll('.btn, .tabs a, button')].flatMap(
            (control) => {
              if (control.getClientRects().length === 0) return [];
              const style = getComputedStyle(control);
              const invalid =
                style.fontSize !== '14px' ||
                style.fontWeight !== '600' ||
                style.lineHeight !== '20px' ||
                parseFloat(style.minHeight) < 48;
              const icons = [...control.querySelectorAll('.icon')];
              const isAction = !control.matches('.option, .day');
              const invalidHeight =
                isAction && Math.abs(control.getBoundingClientRect().height - 48) > 1;
              const invalidIcon = icons.some(
                (icon) =>
                  getComputedStyle(icon).width !== '20px' ||
                  getComputedStyle(icon).height !== '20px',
              );
              return invalid || invalidIcon || invalidHeight
                ? [
                    {
                      label: control.textContent.trim() || control.getAttribute('aria-label'),
                      fontSize: style.fontSize,
                      fontWeight: style.fontWeight,
                      lineHeight: style.lineHeight,
                      minHeight: style.minHeight,
                      invalidIcon,
                      height: control.getBoundingClientRect().height,
                    },
                  ]
                : [];
            },
          ),
        }));
        results.push({ id: s.id, platform, theme, ...checks, errors });
        page.off('pageerror', onError);
        completed++;
        if (completed % 25 === 0) console.log(`Rendered ${completed}/${screens.length * 4}`);
      }
      await page.close();
    }),
  ),
);
// Gallery interactions and narrow responsive web check.
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${base}/index.html`, { waitUntil: 'load' });
await page.selectOption('#platform', 'android');
await page.selectOption('#theme', 'dark');
await page.locator(`[data-index="${screens.findIndex((s) => s.id === 'today')}"]`).click();
await page.waitForTimeout(200);
const gallery = await page.evaluate(() => ({
  platform: document.querySelector('#platform').value,
  theme: document.querySelector('#theme').value,
  iframe: document.querySelector('#preview').getAttribute('src'),
  png: document.querySelector('#png').getAttribute('href'),
}));
await page.screenshot({ path: path.join(root, 'gallery-preview.png'), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
const narrow = [];
for (const id of [
  'today',
  'session',
  'measure',
  'coach',
  'conflict',
  'onboard-body',
  'nutrition',
  'training',
]) {
  await page.goto(`${base}/mockups/web/light/${id}.html`, { waitUntil: 'load' });
  narrow.push({
    id,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  });
}
await page.goto(`${base}/mockups/android/light/session.html`, { waitUntil: 'load' });
await page.locator('[data-set]').nth(1).click();
const setInteraction = (await page.locator('tr.completed').count()) === 2;
const calendarChecks = [];
for (const platform of ['web', 'android'])
  for (const theme of ['light', 'dark'])
    for (const id of ['nutrition', 'training']) {
      await page.setViewportSize(
        platform === 'web' ? { width: 1440, height: 1000 } : { width: 412, height: 915 },
      );
      await page.goto(`${base}/mockups/${platform}/${theme}/${id}.html`, { waitUntil: 'load' });
      for (let index = 0; index < 7; index++) {
        await page.locator('[data-day]').nth(index).click();
        const check = await page.evaluate(() => {
          const buttons = [...document.querySelectorAll('[data-day]')];
          const selected = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
          const date = document.querySelector('[data-plan-day] time');
          const heading = document.querySelector('[data-selected-day]');
          const labelTops = buttons.map(
            (button) => button.querySelector('.day-label').getBoundingClientRect().top,
          );
          const numberTops = buttons.map(
            (button) => button.querySelector('time').getBoundingClientRect().top,
          );
          const widths = buttons.map((button) => button.getBoundingClientRect().width);
          const validDates = buttons.every((button) => {
            const iso = button.dataset.date;
            const date = new Date(`${iso}T12:00:00Z`);
            return (
              button.querySelector('.day-label').textContent ===
                new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(date) &&
              Number(button.querySelector('time').textContent) === date.getUTCDate()
            );
          });
          return {
            validDates,
            matchedSelection:
              selected.dataset.date === date.getAttribute('datetime') &&
              selected.dataset.date === heading.dataset.selectedDay,
            aligned:
              Math.max(...labelTops) - Math.min(...labelTops) < 1 &&
              Math.max(...numberTops) - Math.min(...numberTops) < 1 &&
              Math.max(...widths) - Math.min(...widths) < 1,
          };
        });
        calendarChecks.push({ platform, theme, id, index, ...check });
      }
    }
await browser.close();
const issues = results.filter(
  (r) =>
    r.brokenImages.length ||
    r.horizontalOverflow ||
    r.errors.length ||
    !r.heading ||
    r.emptyLinks ||
    r.inconsistentControls.length,
);
fs.writeFileSync(
  path.join(root, 'docs', 'qa-results.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      screenCount: screens.length,
      mockupCount: results.length,
      issues,
      gallery,
      narrow,
      setInteraction,
      calendarChecks,
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({ mockups: results.length, issues, narrow, setInteraction, gallery }, null, 2),
);
if (
  issues.length ||
  narrow.some((r) => r.overflow) ||
  !setInteraction ||
  calendarChecks.some((c) => !c.validDates || !c.matchedSelection || !c.aligned)
)
  process.exitCode = 1;
