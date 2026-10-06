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
await Promise.all(
  ['web', 'android'].flatMap((platform) =>
    ['light', 'dark'].map(async (theme) => {
      const page = await browser.newPage();
      for (const width of platform === 'web' ? [320, 390, 1440] : [320, 360, 412]) {
        await page.setViewportSize({ width, height: 915 });
        for (const screen of screens) {
          await page.goto(`${base}/mockups/${platform}/${theme}/${screen.id}.html`, {
            waitUntil: 'load',
          });
          const checks = await page.evaluate(() => {
            const overflow = [...document.querySelectorAll('main *,nav *')]
              .filter((element) => {
                const r = element.getBoundingClientRect();
                return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
              })
              .map((element) => ({ tag: element.tagName, classes: element.getAttribute('class') }));
            const fields = [...document.querySelectorAll('.fields')].flatMap((group) => {
              const controls = [...group.querySelectorAll('input,select')].filter(
                (control) => control.getClientRects().length > 0,
              );
              const tops = controls.map((control) => control.getBoundingClientRect().top);
              return tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 1
                ? [
                    {
                      labels: controls.map((control) =>
                        control.closest('label').textContent.trim(),
                      ),
                      tops,
                    },
                  ]
                : [];
            });
            return { overflow, misalignedFields: fields };
          });
          results.push({ platform, theme, width, id: screen.id, ...checks });
        }
      }
      await page.close();
    }),
  ),
);
await browser.close();
const issues = results.filter((result) => result.overflow.length || result.misalignedFields.length);
fs.writeFileSync(
  path.join(root, 'docs', 'alignment-results.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), checkedLayouts: results.length, issues, results }, null, 2)}\n`,
);
console.log(JSON.stringify({ checkedLayouts: results.length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
