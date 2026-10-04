import { screens } from './screens.js';
let current = 0;
const byId = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
current = Math.max(
  0,
  screens.findIndex((s) => s.id === params.get('screen')),
);
for (const k of ['platform', 'theme'])
  if (params.get(k) && [...byId(k).options].some((o) => o.value === params.get(k)))
    byId(k).value = params.get(k);
let group = '';
byId('screens').innerHTML = screens
  .map((s, i) => {
    const h = s.category !== group ? `<div class="group">${s.category}</div>` : '';
    group = s.category;
    return (
      h +
      `<button type="button" class="screen-button" data-index="${i}">${String(i + 1).padStart(2, '0')} / ${s.id.replaceAll('-', ' ')}<small>${s.stage}</small></button>`
    );
  })
  .join('');
function refresh() {
  const s = screens[current],
    p = byId('platform').value,
    t = byId('theme').value;
  const url = `mockups/${p}/${t}/${s.id}.html`;
  byId('preview').src = url;
  byId('frame').className = `frame ${p}`;
  byId('standalone').href = url;
  byId('png').href = `mockups/${p}/${t}/${s.id}.png`;
  byId('screen-title').textContent = `${String(current + 1).padStart(2, '0')} / ${s.title}`;
  byId('screen-status').textContent =
    `${screens.length} screens · ${s.stage} · future design, not shipped status`;
  document.querySelectorAll('[data-index]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.index) === current);
  });
  history.replaceState(null, '', `?screen=${s.id}&platform=${p}&theme=${t}`);
  byId('thumbs').innerHTML = ['light', 'dark']
    .map(
      (theme) =>
        `<a href="mockups/${p}/${theme}/${s.id}.png" target="_blank"><img loading="lazy" src="mockups/${p}/${theme}/${s.id}.png" alt="${s.title} ${p} ${theme} mockup">${p} / ${theme}</a>`,
    )
    .join('');
}
byId('screens').addEventListener('click', (e) => {
  const b = e.target.closest('[data-index]');
  if (b) {
    current = Number(b.dataset.index);
    refresh();
  }
});
for (const k of ['platform', 'theme']) byId(k).addEventListener('change', refresh);
byId('previous').onclick = () => {
  current = (current - 1 + screens.length) % screens.length;
  refresh();
};
byId('next').onclick = () => {
  current = (current + 1) % screens.length;
  refresh();
};
refresh();
