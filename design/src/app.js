import { screens, icon, planDay, planWeek } from './screens.js';
const { screen: id = 'today', platform = 'web', theme = 'light' } = document.body.dataset;
const screen = screens.find((s) => s.id === id) || screens.find((s) => s.id === 'today');
const destinations = [
  ['Today', 'today', 'today'],
  ['Measure', 'measure', 'measure'],
  ['Plan', 'nutrition', 'plan'],
  ['Coach', 'coach', 'coach'],
  ['Form Lab', 'form-setup', 'lab'],
  ['Progress', 'progress', 'progress'],
];
const bottom = [
  ['Today', 'today', 'today'],
  ['Plan', 'nutrition', 'plan'],
  ['Coach', 'coach', 'coach'],
  ['Progress', 'progress', 'progress'],
  ['More', 'more', 'more'],
];
const active = screen.nav;
const nav = (items, mobile = false) =>
  items
    .map(
      ([label, to, key]) =>
        `<a href="${to}" class="${(mobile ? (['measure', 'lab'].includes(active) ? key === 'more' : key === active) : key === active) ? 'active' : ''}" ${key === active ? 'aria-current="page"' : ''}>${icon(key)}<span>${label}</span></a>`,
    )
    .join('');
document.body.className = `${platform} ${theme}`;
document.getElementById('app').innerHTML =
  `<div class="phone-status"><span>9:41</span><span aria-label="Signal, Wi-Fi, battery">▴▴ &nbsp; ◉ &nbsp; ▰</span></div><div class="shell"><aside class="sidebar"><a class="brand" href="today"><span class="brand-mark"></span>Kinetra</a><div><p class="eyebrow" style="padding:0 15px;margin-bottom:15px">YOUR DAILY PRACTICE</p><nav class="nav" aria-label="Primary">${nav(destinations)}</nav></div><div class="side-bottom"><div class="notice" style="margin:0"><span class="eyebrow">A STEADY ROUTINE</span><p>One intentional step,<br>every day.</p></div><nav class="nav"><a href="settings" class="${active === 'more' ? 'active' : ''}">${icon('settings')}Settings</a></nav><div class="row start"><div class="avatar">ML</div><div><strong class="small">Maya Lin</strong><p class="small">Synthetic demo</p></div></div></div></aside><header class="topbar"><div><span class="eyebrow web-label">${screen.category} / ${screen.nav === 'lab' ? 'FORM LAB' : screen.nav.toUpperCase()}</span><a class="brand mobile-brand" href="today"><span class="brand-mark"></span>Kinetra</a></div><div class="right"><a href="sync" class="status"><span class="dot"></span>${['sync', 'conflict'].includes(id) ? 'Offline · 2 pending' : id === 'expired' ? 'Sync paused' : 'All changes synced'}</a><a href="settings" class="avatar" aria-label="Open account settings">ML</a></div></header><main class="main" id="main"><header class="page-head"><div><div class="eyebrow">${['welcome', 'signin'].includes(id) ? 'BUILD A SUSTAINABLE ROUTINE' : `KINETRA / ${screen.category.toUpperCase()}`}</div><h1>${screen.title}</h1><p>${screen.sub}</p></div>${id === 'today' ? `<a class="btn" href="daily-log">${icon('plus')}Quick log</a>` : id === 'progress' ? `<a class="btn" href="history">${icon('plan')}View history</a>` : ''}</header>${screen.body()}<footer class="page-footer"><span>DESIGN CONCEPT · SYNTHETIC DATA</span><span>${platform === 'android' ? 'ANDROID CONCEPT' : 'WEB APPLICATION'} / ${theme.toUpperCase()} / ${screen.stage.toUpperCase()}</span></footer></main></div><nav class="bottom-nav" aria-label="Primary mobile navigation">${nav(bottom, true)}</nav><div class="system-nav"></div>`;
const style = document.createElement('style');
style.textContent =
  '.mobile-brand{display:none}@media(max-width:900px){.web-label{display:none}.mobile-brand{display:flex}}';
document.head.append(style);
for (const button of document.querySelectorAll('button')) button.type = 'button';
// Relative links preserve the current platform and theme. Clickthrough is illustrative.
function linkScreens(root = document) {
  for (const a of root.querySelectorAll('a[href]')) {
    const target = a.getAttribute('href');
    if (screens.some((s) => s.id === target)) a.href = `${target}.html`;
    else if (target === '#') a.setAttribute('data-demo', 'true');
  }
  for (const button of root.querySelectorAll('button')) button.type = 'button';
}
linkScreens();
function toast(message) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.role = 'status';
  t.textContent = message;
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
document.addEventListener('click', (e) => {
  const c = e.target.closest(
    '[data-demo], [data-option], [data-chip], [data-set], [data-day], [data-chat]',
  );
  if (!c) return;
  e.preventDefault();
  if (c.hasAttribute('data-option')) {
    c.parentElement.querySelectorAll('[data-option]').forEach((x) => {
      x.classList.remove('selected');
    });
    c.classList.add('selected');
  } else if (c.hasAttribute('data-chip')) {
    c.classList.toggle('selected');
  } else if (c.hasAttribute('data-set')) {
    c.innerHTML = icon('check');
    c.closest('tr').classList.add('completed');
    toast('Prototype: set marked complete.');
  } else if (c.hasAttribute('data-day')) {
    c.parentElement.querySelectorAll('[data-day]').forEach((x) => {
      x.classList.remove('active');
      x.setAttribute('aria-pressed', 'false');
    });
    c.classList.add('active');
    c.setAttribute('aria-pressed', 'true');
    const index = Number(c.dataset.day);
    const day = planWeek[index];
    const content = document.querySelector('[data-plan-day]');
    if (content) {
      content.innerHTML = planDay(content.dataset.planDay, index);
      linkScreens(content);
    }
    for (const entry of document.querySelectorAll('[data-week-date]')) {
      const selected = entry.dataset.weekDate === day.iso;
      entry.classList.toggle('selected', selected);
      entry.querySelector('.week-selection').classList.toggle('hidden', !selected);
    }
  } else {
    toast('Design prototype: this action does not save or send data.');
  }
});
