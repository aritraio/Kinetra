import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { screens, chart } from './screens.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const platform of ['web', 'android'])
  for (const theme of ['light', 'dark']) {
    const dir = path.join(root, 'mockups', platform, theme);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of screens)
      fs.writeFileSync(
        path.join(dir, `${s.id}.html`),
        `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kinetra — ${s.title} — ${platform} ${theme}</title><link rel="stylesheet" href="../../../src/styles.css"></head><body data-screen="${s.id}" data-platform="${platform}" data-theme="${theme}"><div id="app"></div><script type="module" src="../../../src/app.js"></script></body></html>`,
      );
  }
fs.writeFileSync(
  path.join(root, 'screen-manifest.json'),
  `${JSON.stringify(
    screens.map(({ body, ...s }) => s),
    null,
    2,
  )}\n`,
);
for (const [name, svg] of [
  ['weight-trend', chart()],
  ['strength-trend', chart(true)],
]) {
  fs.writeFileSync(
    path.join(root, 'assets', `${name}.svg`),
    svg
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace(
        '</svg>',
        `<style>.body{fill:none;stroke:#252925;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.guide{stroke:#747b74;stroke-width:1;stroke-dasharray:4 5;fill:none}.joint{fill:#fff;stroke:#252925;stroke-width:2}text{fill:#525a52;font:12px Arial,sans-serif}.axis{stroke:#d5dad5;stroke-width:1}.trend{fill:none;stroke:#252925;stroke-width:2.6}.point{fill:#fff;stroke:#252925;stroke-width:2}</style></svg>`,
      ),
  );
}
console.log(
  `${screens.length} screens × 2 platforms × 2 themes = ${screens.length * 4} editable mockups`,
);
