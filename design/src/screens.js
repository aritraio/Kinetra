/* Editable product design concepts. No API, camera, storage, or account operations. */
const paths = {
  today: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  measure: 'M5 3h14v18H5ZM5 7h5M5 11h3M5 15h5M5 19h3',
  plan: 'M6 3h12v18H6ZM9 7h6M9 11h6M9 15h4',
  coach: 'M21 12a8 8 0 0 1-8 8H6l-4 2 1-6a8 8 0 1 1 18-4ZM7 11h10M7 15h6',
  lab: 'M3 7h5l2-3h4l2 3h5v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  progress: 'M3 20h18M5 16l5-6 4 3 6-9',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 5l3 1 2-3h6l2 3 3-1 2 5-2 2 2 2-2 5-3-1-2 3H9l-2-3-3 1-2-5 2-2-2-2Z',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  check: 'm5 12 4 4L20 5',
  plus: 'M12 4v16M4 12h16',
  more: 'M4 5h16M4 12h16M4 19h16',
  weight: 'M3 8h18v13H3ZM8 8V4h8v4M12 11v4',
  dumbbell: 'M2 8v8M5 5v14M19 5v14M22 8v8M5 12h14',
  shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-4 10 3 3 5-6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v6l4 2',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  offline: 'M3 3l18 18M4 10c3-3 6-4 10-3M2 6c6-4 13-4 20 1M8 14l3-1M12 18v1',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  trash: 'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  mic: 'M9 3h6v11H9ZM5 11v2a7 7 0 0 0 14 0v-2M12 20v3',
  back: 'M20 12H4m6-6-6 6 6 6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 10v7M12 7v.1',
  mail: 'M3 5h18v14H3ZM3 5l9 7 9-7',
  pause: 'M8 5v14M16 5v14',
  bolt: 'M13 2 4 14h7l-1 8 10-13h-8Z',
  photo: 'M3 3h18v18H3Zm0 14 5-5 4 4 3-3 6 6M16 7h.1',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11v2',
};
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`;
const exercisePhotos = {
  bench: {
    file: 'bench-press.jpg',
    alt: 'Athlete performing a bench press in a gym',
    credit: 'Andrea Piacquadio',
    source:
      'https://www.pexels.com/photo/strong-sportsman-doing-bench-press-during-workout-in-modern-gym-3837743/',
  },
  squat: {
    file: 'squat.jpg',
    alt: 'Side view of an athlete performing a bodyweight squat at home',
    credit: 'MART PRODUCTION',
    source: 'https://www.pexels.com/photo/a-woman-exercising-8846530/',
  },
};
export const movement = (mode = 'squat', variant = 'exercise-photo') => {
  if (mode === 'tape')
    return `<svg class="diagram" viewBox="0 0 400 260" role="img" aria-label="Tape placement at neck, waist, and hips"><path class="body" d="M185 54c-30 12-42 41-38 69l10 83m28-143-13 71 4 101m40-181c30 12 42 41 38 69l-10 83m-28-143 13 71-4 101M176 133h52"/><circle class="body" cx="201" cy="31" r="19"/><path class="guide" d="M167 62h70M162 112h77M155 151h88"/><path class="guide" d="M55 62h110M55 112h105M55 151h98"/><text x="52" y="52">01 / NECK</text><text x="52" y="102">02 / WAIST</text><text x="52" y="141">03 / HIPS</text><text x="272" y="214">TAPE LEVEL</text></svg>`;
  const photo = exercisePhotos[mode] || exercisePhotos.squat;
  if (variant === 'hero-figure')
    return `<div class="hero-photo photo-${mode}" aria-hidden="true"><img src="../../../assets/photos/${photo.file}" alt=""></div>`;
  return `<figure class="exercise-photo photo-${mode}"><div class="exercise-photo-frame"><img src="../../../assets/photos/${photo.file}" alt="${photo.alt}" width="${mode === 'bench' ? 1600 : 1200}" height="${mode === 'bench' ? 1067 : 1800}"></div><figcaption><span>${mode === 'bench' ? 'Bench press' : 'Side-view squat'} · reference photo</span><a href="${photo.source}" target="_blank" rel="noreferrer">${photo.credit} / Pexels ↗</a></figcaption></figure>`;
};
export const chart = (strength = false) =>
  `<svg class="chart" viewBox="0 0 620 205" role="img" aria-label="${strength ? 'Bench press load increases from 40 to 42.5 kilograms over four sessions' : 'Illustrative 14-day weight trend from 68.8 to 68.0 kilograms, with daily fluctuation'}"><path class="axis" d="M45 30h552M45 85h552M45 140h552M45 177h552"/><text x="3" y="34">${strength ? '45 kg' : '69 kg'}</text><text x="3" y="89">${strength ? '42.5' : '68.5'}</text><text x="3" y="144">${strength ? '40' : '68 kg'}</text><path class="trend" opacity=".35" stroke-dasharray="5 5" d="M48 45C210 70 350 117 595 137"/><path class="trend" d="${strength ? 'M48 142 202 142 370 88 594 88' : 'M48 50 90 63 132 63 174 80 216 92 258 88 300 108 342 98 384 112 426 132 468 124 510 138 552 142 594 142'}"/><circle class="point" cx="594" cy="${strength ? 88 : 142}" r="5"/><text x="45" y="199">18 SEP</text><text x="205" y="199">22 SEP</text><text x="370" y="199">26 SEP</text><text x="559" y="199">01 OCT</text></svg>`;
const badge = (s) => `<span class="badge">${s}</span>`;
const btn = (s, to, primary = false, ico = 'arrow') =>
  `<a class="btn ${primary ? 'primary' : ''}" href="${to || '#'}" ${to ? '' : 'data-demo="true"'}>${s}${icon(ico)}</a>`;
const field = (label, value, type = 'text', note = '') =>
  `<label class="field">${label}<input type="${type}" value="${value}" ${type === 'number' ? 'step="any"' : ''}>${note ? `<small>${note}</small>` : ''}</label>`;
const select = (label, opts) =>
  `<label class="field">${label}<select>${opts.map((x) => `<option>${x}</option>`).join('')}</select></label>`;
const card = (title, body, aside = '', extra = '') =>
  `<section class="card ${extra}">${title ? `<div class="card-head"><h2>${title}</h2>${aside}</div>` : ''}${body}</section>`;
const stat = (v, label, unit = '') =>
  `<div><div class="stat">${v}${unit ? ` <small>${unit}</small>` : ''}</div><p>${label}</p></div>`;
const notice = (title, body) => `<div class="notice"><strong>${title}</strong><p>${body}</p></div>`;
const row = (title, sub, right = '', n = '') =>
  `<div class="list-row">${n ? `<span class="number">${n}</span>` : ''}<div class="list-main"><h3>${title}</h3><p>${sub}</p></div>${right}</div>`;
const tabs = (labels, active) =>
  `<div class="tabs">${labels.map(([s, to]) => `<a class="${s === active ? 'active' : ''}" href="${to}">${s}</a>`).join('')}</div>`;
const days = () =>
  `<div class="days">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<button class="day ${i === 0 ? 'active' : ''}" data-day>${d}<b>${21 + i}</b></button>`).join('')}</div>`;
const check = (s, checked = true) =>
  `<label class="check-row"><input type="checkbox" ${checked ? 'checked' : ''}>${s}</label>`;
const macro = () =>
  `<div class="macro">${[
    ['Protein', '82 / 135 g', 61],
    ['Carbs', '112 / 160 g', 70],
    ['Fat', '31 / 48 g', 65],
  ]
    .map(
      ([t, v, p]) =>
        `<div><p>${t}</p><strong>${v}</strong><div class="meter"><span style="width:${p}%"></span></div></div>`,
    )
    .join('')}</div>`;
const nutrition = () =>
  `<div class="row"><div class="ring"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70"/><circle class="fill" cx="80" cy="80" r="70"/></svg><div><strong>1,240</strong><small>KCAL LOGGED</small></div></div><div><p class="eyebrow">DAILY TARGET</p><div class="stat">1,750</div><p class="small">510 kcal remaining</p>${badge('Estimated target')}</div></div>${macro()}`;
const workouts = () =>
  row('Barbell bench press', '3 sets × 8–10 reps · 42.5 kg', btn('View', 'exercise'), '01') +
  row('Dumbbell row', '3 sets × 10 reps · 18 kg', badge('90 s rest'), '02') +
  row('Lat pulldown', '3 sets × 10–12 reps', badge('90 s rest'), '03') +
  row('Dumbbell shoulder press', '3 sets × 10 reps · 12 kg', badge('90 s rest'), '04');
const mealrows = () =>
  row('Greek yogurt & oats', 'Breakfast · 07:30 · planned', btn('View', 'meal'), '01') +
  row('Tofu & quinoa bowl', 'Lunch · 12:30 · planned', badge('Pescatarian'), '02') +
  row('Salmon & rice', 'Dinner · 19:00 · planned', btn('View', 'meal'), '03');
const options = (data) =>
  data
    .map(
      ([title, sub, ico, on]) =>
        `<button class="option ${on ? 'selected' : ''} full" data-option>${icon(ico)}<span class="list-main" style="text-align:left"><h3>${title}</h3><p>${sub}</p></span><span class="radio"></span></button>`,
    )
    .join('');
const chips = (data) =>
  `<div class="chips">${data.map(([s, on]) => `<button class="chip ${on ? 'selected' : ''}" data-chip>${s}</button>`).join('')}</div>`;
const onward = (to, back = 'welcome') =>
  `<div class="actions">${btn('Back', back, false, 'back')}${btn('Continue', to, true)}</div>`;
const onboarding = (step, body, why) =>
  `<div class="onboarding"><div class="row"><span class="eyebrow">YOUR FOUNDATION</span><span class="mono small">0${step} / 04</span></div><div class="stepper">${[1, 2, 3, 4].map((i) => `<span class="${i <= step ? 'done' : ''}"></span>`).join('')}</div><div class="grid">${card('', body)}${card('Built around you', `<p>${why}</p><div class="privacy-symbol">${icon('shield')}</div><p class="note">Your inputs help shape estimates. You can change them later in Settings.</p>`, '', 'aside-card')}</div></div>`;
const settable = () =>
  `<table class="table"><thead><tr><th>Set</th><th>kg</th><th>Reps</th><th>RPE</th><th>Done</th></tr></thead><tbody>${[1, 2, 3].map((n) => `<tr class="${n === 1 ? 'completed' : n === 2 ? 'current' : ''}"><td>${String(n).padStart(2, '0')}</td><td><input aria-label="Set ${n} load in kilograms" value="42.5"></td><td><input aria-label="Set ${n} repetitions" value="${n === 1 ? '10' : n === 2 ? '9' : '8'}"></td><td><input aria-label="Set ${n} effort RPE" value="${n === 1 ? '7.5' : '8'}"></td><td><button aria-label="Complete set ${n}" data-set>${icon(n === 1 ? 'check' : 'plus')}</button></td></tr>`).join('')}</tbody></table>`;
const camera = (low = false) =>
  `<div class="camera ${low ? 'tracking-paused' : ''}">${badge(low ? '! Tracking paused · demo' : 'Stock photo · demo preview')}${movement()}<div class="stats">${stat(low ? '—' : '06', 'Reps')}${stat(low ? '—' : '2.8', 'Tempo', 's')}${stat(low ? 'Low' : 'Good', 'Visibility')}</div></div>`;
const settingsRows = () =>
  [
    ['Profile & preferences', 'Measurements, goals, diet, equipment', 'onboard-body', 'measure'],
    ['Appearance', 'Light, dark, or system', 'appearance', 'sun'],
    ['Reminders', 'In-app reminders and timezone', 'reminders', 'clock'],
    ['Offline & sync', 'Saved plans and pending changes', 'sync', 'offline'],
    ['Privacy & data', 'Consent, export, and deletion', 'privacy', 'shield'],
  ]
    .map(
      ([t, s, to, i]) =>
        `<a class="setting-link" href="${to}">${icon(i)}<div class="list-main"><h3>${t}</h3><p>${s}</p></div>${icon('arrow')}</a>`,
    )
    .join('');
export const screens = [
  {
    id: 'welcome',
    title: 'Move with intention.',
    sub: 'A clear plan. A steady routine. Progress you can see.',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      `<div class="auth grid equal">${card('', `<div class="hero-copy"><span class="eyebrow">KINETRA / TRAIN WITH CLARITY</span><h2>Small steps.<br>Stronger you.</h2><p>Nutrition and training, built around your life.</p></div>${movement('squat', 'hero-figure')}<div class="quote"><p>Less noise.<br>More consistency.</p></div>`, '', 'hero')}${card('Your next chapter', `<p>Start with your goals. Build a routine that fits.</p><div class="mt">${btn('Create an account', 'signup', true)}</div><div class="mt">${btn('Sign in', 'signin')}</div><div class="divider"></div>${btn('Explore the synthetic demo', 'today', false, 'arrow')}<p class="note">Kinetra is not a medical device and does not offer medical advice.</p><div class="quote"><span class="eyebrow">THE DAILY LOOP</span><p class="mt">Plan → Train → Log → Learn</p></div>`)}</div>`,
  },
  {
    id: 'signin',
    title: 'Welcome back.',
    sub: 'Pick up where you left off.',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 2 / 5',
    body: () =>
      `<div class="onboarding">${card('Sign in to Kinetra', `<p>Your routine, ready when you are.</p><div class="fields">${field('Email address', 'maya@example.test', 'email')}</div><div class="fields">${field('Password', 'illustrative', 'password')}</div><div class="row">${check('Keep me signed in', false)}<a href="reset" class="small">Forgot password?</a></div>${btn('Sign in', 'today', true)}<p class="note">New here? <a href="signup">Create an account →</a></p>`)}<p class="note">Design prototype · synthetic information only</p></div>`,
  },
  {
    id: 'reset',
    title: 'A fresh start.',
    sub: 'Get back to your routine.',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      `<div class="onboarding">${card('Reset password', `<p>We’ll send a reset link to your account email.</p><div class="fields">${field('Email address', 'maya@example.test', 'email')}</div>${btn('Send reset link', 'reset-sent', true, 'mail')}${onward('signin', 'signin')}`)}</div>`,
  },
  {
    id: 'reset-sent',
    title: 'Check your inbox.',
    sub: 'Your next step is in your email.',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      card(
        '',
        `<div class="empty">${icon('mail')}<h2>Reset link requested</h2><p>If an account exists for maya@example.test, a link will arrive shortly. Check your spam folder too.</p>${btn('Back to sign in', 'signin', true, 'back')}<p class="note">Link expired? Request a new one.</p></div>`,
      ),
  },
  {
    id: 'onboard-goal',
    title: 'What are you working toward?',
    sub: 'Choose the direction that fits you today.',
    category: 'Onboarding',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      onboarding(
        1,
        `<h2>Choose your goal</h2>${options([
          ['Maintain', 'Build a sustainable routine.', 'target', false],
          ['Cut', 'Aim for a gradual weight reduction.', 'progress', true],
          ['Bulk', 'Support muscle and strength gains.', 'dumbbell', false],
        ])}${field('Target weight · kg', '62', 'number', 'You can revisit this goal anytime.')}${onward('onboard-body')}`,
        'One goal keeps your daily plan focused. Targets remain estimates, with their assumptions visible.',
      ),
  },
  {
    id: 'onboard-body',
    title: 'Set your starting point.',
    sub: 'A few measurements help us estimate your needs.',
    category: 'Onboarding',
    nav: 'measure',
    stage: 'Phase 5',
    body: () =>
      onboarding(
        2,
        `${tabs(
          [
            ['Metric', '#'],
            ['Imperial', '#'],
          ],
          'Metric',
        )}<div class="fields">${field('Height · cm', '168', 'number')}${field('Weight · kg', '68', 'number')}</div><div class="fields">${field('Age · years', '28', 'number')}${select('Sex used in equation', ['Female', 'Male', 'Skip for now'])}</div><p class="note">Age and sex are optional profile fields. An energy estimate needs equation inputs; skip to continue without one.</p><div class="fields">${select('Activity level', ['Moderate · 3–5 days/week', 'Sedentary', 'Light', 'Very active', 'Extra active'])}</div><div class="fields">${select('Timezone', ['America/New_York', 'Asia/Kolkata'])}</div>${onward('onboard-preferences', 'onboard-goal')}`,
        'Weight and height establish a baseline. Daily energy needs vary; we show the calculation instead of hiding it.',
      ),
  },
  {
    id: 'onboard-preferences',
    title: 'Make it fit your life.',
    sub: 'Your food preferences and available equipment.',
    category: 'Onboarding',
    nav: 'plan',
    stage: 'Phase 5',
    body: () =>
      onboarding(
        3,
        `<h2>Food preferences</h2>${chips([
          ['Pescatarian', true],
          ['Vegetarian', false],
          ['Omnivore', false],
        ])}${field('Allergies and exclusions', 'Shellfish', 'text', 'Allergies are hard constraints for a plan.')}<div class="divider"></div><h2>Training setup</h2>${chips(
          [
            ['Barbell', true],
            ['Dumbbells', true],
            ['Bench', true],
            ['Cable machine', true],
            ['Pull-up bar', true],
            ['Bodyweight', false],
          ],
        )}<div class="fields">${select('Experience', ['Intermediate', 'Beginner', 'Advanced'])}</div>${onward('onboard-review', 'onboard-body')}`,
        'Available equipment and food exclusions guide the plan. Optional preferences can be added later.',
      ),
  },
  {
    id: 'onboard-review',
    title: 'Your foundation is ready.',
    sub: 'Review your inputs before creating a plan.',
    category: 'Onboarding',
    nav: 'plan',
    stage: 'Phase 5',
    body: () =>
      onboarding(
        4,
        `${row('Goal', 'Cut · 68 kg → 62 kg', btn('Edit', 'onboard-goal'))}${row('Baseline', '168 cm · 28 years · moderate activity', btn('Edit', 'onboard-body'))}${row('Preferences', 'Pescatarian · no shellfish', btn('Edit', 'onboard-preferences'))}<div class="divider"></div>${notice('Estimated energy target', 'Shown after calculation and safety bounds are checked. You can inspect all assumptions in Measure.')}${check('I understand that Kinetra provides fitness estimates, not medical advice.', false)}${check('Allow my selected profile inputs to be processed by the plan provider.', false)}${btn('Create my plan', 'generating', true)}<p class="note">Provider consent is required only for AI generation. Use the synthetic demo without sharing real inputs.</p>`,
        'Review now, revise later. Plans have a version history, so accepted changes never erase your previous plan.',
      ),
  },
  {
    id: 'today',
    title: 'Find your rhythm, Maya.',
    sub: 'Monday, 21 September · Week 1 of your routine',
    category: 'Daily',
    nav: 'today',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid"><div class="stack">${card('', `<div class="hero-copy"><span class="eyebrow">YOUR NEXT MOVE</span><h2>Upper body.<br>Steady progress.</h2><p>4 exercises · planned session</p><div class="row start">${btn('Start workout', 'session', true)}${badge('Plan v1')}</div></div>${movement('bench', 'hero-figure')}`, '', 'hero')}${card('On the menu', mealrows(), btn('Full plan', 'nutrition'))}${card('Daily check-in', `<div class="fields">${field('Weight · kg', '68.6', 'number')}${field('Water · ml', '1800', 'number')}</div><div class="row"><p class="small">Keep a simple record of today.</p>${btn('Log today', 'daily-log', true, 'plus')}</div>`)}</div><div class="stack">${card('Fuel for today', nutrition(), btn('Log', 'daily-log', false, 'plus'))}${card('Your consistency', `<div class="stats">${stat('3 / 4', 'Sessions this week')}${stat('12 / 14', 'Days logged')}</div><div class="heatmap">${Array.from({ length: 14 }, (_, i) => `<span class="${i !== 3 && i !== 10 ? 'filled' : ''}"></span>`).join('')}</div><p class="note">A missed day is a chance to reset. Keep going.</p>`, badge('Last 14 days'))}${card('A little perspective', `<p>Your daily weight can fluctuate. Look at the trend across several days.</p><div class="mt">${btn('See your progress', 'progress')}</div>`)}</div></div>`,
  },
  {
    id: 'daily-log',
    title: 'Capture today.',
    sub: '21 September · America/New_York · draft preserved',
    category: 'Daily',
    nav: 'today',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid">${card(
        'Daily log',
        `${tabs(
          [
            ['Manual', 'daily-log'],
            ['Voice', 'voice'],
          ],
          'Manual',
        )}<div class="fields">${field('Weight · kg', '68.6', 'number')}${field('Calories · kcal', '1750', 'number')}</div><div class="fields">${field('Protein · g', '135', 'number')}${field('Carbs · g', '160', 'number')}${field('Fat · g', '48', 'number')}</div><div class="fields">${field('Water · ml', '2600', 'number')}</div><label class="field">Notes<textarea>Good energy during training.</textarea></label><div class="actions">${btn('Cancel', 'today')}${btn('Save log', 'log-saved', true, 'check')}</div>`,
      )}${card('A record, not a score', `<p>Only log what you know. Nutrition and water are optional; weight is required by the current daily-log contract.</p><div class="divider"></div>${row('Date and timezone', 'Your entries belong to the selected local day.')}${row('Edit anytime', 'Saved changes update the existing day.')}${row('Works offline', 'A local save is labeled pending until synced.')}`)}</div>`,
  },
  {
    id: 'log-saved',
    title: 'One more day recorded.',
    sub: 'Daily log · 21 September',
    category: 'Daily',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      card(
        '',
        `<div class="empty">${icon('check')}<h2>Log saved and synced</h2><p>68.6 kg · 1,750 kcal · 2,600 ml water<br>Your latest entry is ready in Progress.</p>${btn('View history', 'history', true)}<div class="mt">${btn('Back to today', 'today', false, 'back')}</div></div>`,
      ),
  },
  {
    id: 'nutrition',
    title: 'A plan for your plate.',
    sub: 'Pescatarian · shellfish excluded · version 1',
    category: 'Plan',
    nav: 'plan',
    stage: 'Phase 3 / 5',
    body: () =>
      `${tabs(
        [
          ['Nutrition', 'nutrition'],
          ['Training', 'training'],
        ],
        'Nutrition',
      )}${days()}<div class="grid"><div class="stack">${card('Monday’s meals', mealrows(), badge('Planned'))}${card('Keep your plan flexible', `<p>Changes create a new version after review. Keep this plan available while a revision is prepared.</p><div class="mt row wrap">${btn('Request revision', 'plan-revision')}${btn('Version history', 'versions')}</div>`)}</div><div class="stack">${card('Daily targets', `<div class="stat">1,750 <small>kcal</small></div><p class="note">Illustrative estimated target</p><div class="divider"></div><div class="stats">${stat('135', 'Protein', 'g')}${stat('160', 'Carbs', 'g')}${stat('48', 'Fat', 'g')}</div>`)}${card('Plan provenance', `${row('Synthetic fixture', 'Demo content · not an AI verification result', badge('Demo'))}${row('Source ingredients', 'Catalog provenance can be inspected per meal.')}${btn('View meal details', 'meal')}`)}</div></div>`,
  },
  {
    id: 'meal',
    title: 'Greek yogurt & oats.',
    sub: 'Breakfast · Monday · planned meal',
    category: 'Plan',
    nav: 'plan',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid">${card('Ingredients', `${row('Greek yogurt, plain', '200 g · catalog ingredient', '01')}${row('Rolled oats', '45 g · catalog ingredient', '02')}${row('Blueberries', '80 g · catalog ingredient', '03')}<p class="note">Portions shown for layout only. Nutrition totals must come from resolved catalog entries in implementation.</p><div class="actions">${btn('Back to plan', 'nutrition', false, 'back')}${btn('Open daily log', 'daily-log', true, 'plus')}</div>`)}${card('Meal composition', `<svg class="diagram" viewBox="0 0 400 260" role="img" aria-label="Illustrative bowl showing yogurt, oats, and fruit"><circle cx="200" cy="130" r="88" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="200" cy="130" r="69" fill="none" stroke="currentColor" stroke-width="1"/><path d="M200 61v69l60 34M200 130l-65 24" stroke="currentColor" fill="none" stroke-dasharray="4 4"/><text x="218" y="111">YOGURT</text><text x="146" y="105">OATS</text><text x="170" y="174">FRUIT</text></svg><p class="caption">A portion diagram, not a nutrition ratio.</p><div class="divider"></div><p class="eyebrow">INGREDIENT PROVENANCE</p><p class="note">USDA FoodData Central catalog references appear beside resolved ingredients. Allergy checks apply to every item.</p>`)}</div>`,
  },
  {
    id: 'training',
    title: 'Train with a clear plan.',
    sub: '4-day Upper / Lower · intermediate · version 1',
    category: 'Plan',
    nav: 'plan',
    stage: 'Phase 3 / 5',
    body: () =>
      `${tabs(
        [
          ['Nutrition', 'nutrition'],
          ['Training', 'training'],
        ],
        'Training',
      )}${days()}<div class="grid"><div class="stack">${card('Upper body A', workouts(), badge('4 exercises'))}${card('Ready when you are', `<div class="row"><p>Log sets, load, reps, and effort.</p>${btn('Start session', 'session', true)}</div>`)}</div><div class="stack">${card('This week', `${row('Monday', 'Upper body A', badge('Today'))}${row('Tuesday', 'Lower body A')}${row('Wednesday', 'Rest')}${row('Thursday', 'Upper body B')}${row('Friday', 'Lower body B')}`)}${card(
        'Your equipment',
        chips([
          ['Barbell', true],
          ['Dumbbells', true],
          ['Bench', true],
        ]),
      )}</div></div>`,
  },
  {
    id: 'exercise',
    title: 'Barbell bench press.',
    sub: 'Upper body A · exercise 01 of 04',
    category: 'Training',
    nav: 'plan',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('Movement guide', `${movement('bench')}<p class="caption">Reference imagery · follow your plan’s movement guidance.</p><div class="divider"></div>${row('01 · Set up', 'Plant your feet and position yourself securely.')}${row('02 · Control', 'Follow your plan’s range and controlled tempo.')}${row('03 · Record', 'Log the reps you actually completed.')}`)}${card('Your prescription', `<div class="stats">${stat('3', 'Sets')}${stat('8–10', 'Reps')}</div><div class="divider"></div>${row('Prescribed load', '42.5 kg')}${row('Rest', '120 seconds between sets')}${row('Effort', 'RPE 8 · illustrative prescription')}<div class="actions">${btn('Start session', 'session', true)}</div><div class="mt">${btn('See load history', 'strength')}</div>`)}</div>`,
  },
  {
    id: 'session',
    title: 'Focus on this set.',
    sub: 'Upper body A · 12:36 elapsed · session draft',
    category: 'Training',
    nav: 'plan',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid"><div class="stack">${card('Barbell bench press', settable(), badge('01 / 04'))}${card('Up next', `${row('Dumbbell row', '3 × 10 · 18 kg · 90 s rest', btn('Movement', 'exercise'))}<div class="actions">${btn('Finish workout', 'session-complete', true, 'check')}</div>`)}</div><div class="stack">${card('Rest between sets', `<div class="center"><div class="timer">01:30</div><p>of 02:00 prescribed rest</p><div class="actions"><button data-demo>${icon('pause')}Pause</button><button data-demo>+30 s</button></div></div>`)}${card('Effort, in your words', `<p>RPE rates how hard a set felt on a 1–10 scale. Log your actual effort.</p><div class="mt">${btn('Voice entry', 'voice', false, 'mic')}</div><p class="note">Completed sets stay in this draft until you finish or save the session.</p>`)}</div></div>`,
  },
  {
    id: 'session-complete',
    title: 'Good work. Take a breath.',
    sub: 'Upper body A · Monday, 21 September',
    category: 'Training',
    nav: 'progress',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('', `<div class="center">${icon('check')}<h2 class="mt">Session complete</h2><p class="note">Your completed sets are ready to save.</p><div class="divider"></div><div class="stats">${stat('48', 'Duration', 'min')}${stat('12', 'Sets')}${stat('4', 'Exercises')}</div><div class="fields">${field('Session notes', 'Felt strong on the final set.')}</div>${btn('Save session', 'progress', true, 'check')}<div class="mt">${btn('Review sets', 'session', false, 'back')}</div></div>`)}${card('Training summary', `${row('Barbell bench press', '42.5 kg · 10 / 9 / 8 reps')}${row('Dumbbell row', '18 kg · 10 / 10 / 10 reps')}${row('Lat pulldown', 'Completed · 3 sets')}${row('Dumbbell shoulder press', '12 kg · 3 sets')}<p class="note">Illustrative completion state. Incomplete sets must stay visible when reviewing a session.</p>`)}</div>`,
  },
  {
    id: 'measure',
    title: 'Understand your baseline.',
    sub: 'Measurements and transparent energy estimates',
    category: 'Measure',
    nav: 'measure',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid"><div class="stack">${card('Your measurements', `<div class="fields">${field('Weight · kg', '68', 'number')}${field('Height · cm', '168', 'number')}</div><div class="fields">${field('Age · years', '28', 'number')}${select('Activity', ['Moderate · PAL 1.55', 'Light · PAL 1.375'])}</div>${btn('Calculation details', 'calculation')}`)}${card('Circumference estimate', `${movement('tape')}<div class="fields">${field('Neck · cm', '33', 'number')}${field('Waist · cm', '76', 'number')}${field('Hips · cm', '98', 'number')}</div><p class="caption">US Navy estimate · depends on correct tape placement and equation inputs. No photo-based body-fat estimate.</p>`)}</div><div class="stack">${card('Estimated energy needs', `<div class="stat">2,211 <small>kcal / day</small></div><p>Total daily energy expenditure</p><div class="divider"></div>${row('Resting estimate', 'Mifflin-St Jeor', badge('1,427 kcal'))}${row('Activity multiplier', 'Moderate activity', badge('× 1.55'))}<p class="note">Rounded illustrative calculation: 1,426.5 × 1.55 ≈ 2,211 kcal. Your activity estimate adds uncertainty.</p>`)}${card('Current plan target', `<div class="stat">1,750 <small>kcal / day</small></div><p class="note">Synthetic plan target. It is shown separately from the calculated baseline.</p>${macro()}`)}</div></div>`,
  },
  {
    id: 'calculation',
    title: 'See what’s behind the number.',
    sub: 'Calculation assumptions · inspectable estimates',
    category: 'Measure',
    nav: 'measure',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid">${card('Energy calculation', `<span class="eyebrow">MIFFLIN-ST JEOR / FEMALE EQUATION</span><div class="quote"><p class="mono">10 × 68 + 6.25 × 168<br>− 5 × 28 − 161</p></div><div class="divider"></div><div class="stat">1,426.5 <small>kcal / day</small></div><p class="note">Resting estimate × PAL 1.55 = 2,211 kcal/day, rounded.</p>${row('Inputs used', '68 kg · 168 cm · age 28 · female equation')}${row('Activity assumption', 'Moderate · PAL 1.55')}${btn('Edit measurements', 'measure')}`)}${card('How to interpret it', `${notice('An estimate, with uncertainty', 'Activity multipliers and equations cannot capture every individual difference.')}<p>Use the baseline alongside a longer-term weight trend. A plan target also needs the project’s safety bounds and goal policy.</p><div class="divider"></div><h3>Source shown in-product</h3><p class="note">Mifflin-St Jeor (1990) · source metadata should be rendered from the calculation module. Protein and circumference models have their own source panels.</p>`)}</div>`,
  },
  {
    id: 'progress',
    title: 'Progress, with perspective.',
    sub: '18 September – 1 October · synthetic 14-day history',
    category: 'Progress',
    nav: 'progress',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid thirds mb">${card('', stat('68.0', 'Latest weight', 'kg'))}${card('', stat('−0.8', 'Change over 14 days', 'kg'))}${card('', stat('12 / 14', 'Days with a log'))}</div><div class="grid"><div class="stack">${card('Weight over time', `${chart()}<div class="legend"><span>Daily weight</span><span>Illustrative trend</span></div><p class="plot-summary">From 68.8 to 68.0 kg across 14 days. Daily fluctuations are expected.</p>`, badge('14 days'))}${card('Your records', `${row('Daily logs', 'View, edit, or delete an entry', btn('History', 'history'))}${row('Training sessions', 'Completed sets and load history', btn('Strength', 'strength'))}`)}</div><div class="stack">${card('Consistency', `<div class="stat">3 / 4</div><p>Weekly planned sessions completed</p><div class="heatmap">${Array.from({ length: 28 }, (_, i) => `<span class="${i % 5 !== 0 ? 'filled' : ''}"></span>`).join('')}</div><p class="note">A check-in pattern, not a performance score.</p>`)}${card('Review the next step', `<p>Proposed training changes show what changed and why before you accept them.</p><div class="mt">${btn('Review progression', 'progression')}</div>`)}</div></div>`,
  },
  {
    id: 'history',
    title: 'Every entry tells a little story.',
    sub: 'Your daily log history · edit without losing context',
    category: 'Progress',
    nav: 'progress',
    stage: 'Phase 3 / 5',
    body: () =>
      `${tabs(
        [
          ['Daily logs', 'history'],
          ['Training', 'strength'],
        ],
        'Daily logs',
      )}<div class="grid">${card(
        'Recent logs',
        `${[
          ['01 Oct', '68.0 kg', '1,755 kcal'],
          ['30 Sep', '68.0 kg', '1,730 kcal'],
          ['29 Sep', '68.1 kg', '1,760 kcal'],
          ['28 Sep', '68.2 kg', '1,740 kcal'],
          ['27 Sep', '68.2 kg', '1,750 kcal'],
        ]
          .map(([d, w, c]) => row(d, `${w} · ${c} · synced`, btn('Edit', 'daily-log')))
          .join('')}<div class="mt">${btn('Add a daily log', 'daily-log', true, 'plus')}</div>`,
      )}${card('Manage an entry', `<p>Select a day to inspect nutrition, water, and notes. Editing keeps the same local date and displays its sync status.</p><div class="divider"></div><h3>Delete 01 October?</h3><p class="note">A confirmation identifies the exact day. Cancel keeps the entry intact.</p><div class="actions">${btn('Keep entry', 'history')}<button data-demo>${icon('trash')}Delete entry</button></div>`)}</div>`,
  },
  {
    id: 'strength',
    title: 'Strength in the details.',
    sub: 'Training history · completed work only',
    category: 'Progress',
    nav: 'progress',
    stage: 'Phase 3 / 5',
    body: () =>
      `<div class="grid">${card('Bench press load', `${chart(true)}<p class="plot-summary">Illustrative last four sessions: 40, 40, 42.5, 42.5 kg. Reps and effort explain the change.</p>`)}${card('Latest session', `${row('Upper body A', '19 September · completed')}${row('Set 1', '42.5 kg × 10 · RPE 7.5')}${row('Set 2', '42.5 kg × 9 · RPE 8')}${row('Set 3', '42.5 kg × 8 · RPE 8.5')}${btn('Review proposed changes', 'progression')}`)}</div>`,
  },
  {
    id: 'coach',
    title: 'A little guidance goes a long way.',
    sub: 'Coach · context from your selected plan and recent logs',
    category: 'Coach',
    nav: 'coach',
    stage: 'Phase 4 / 9',
    body: () =>
      `<div class="grid"><div>${card('', `<div class="bubble user"><p>How should I think about a day when my weight goes up?</p></div><div class="bubble"><div class="eyebrow">KINETRA COACH / RESPONSE COMPLETE</div><p>A single check-in is one data point. Look at the pattern across your recent logs before deciding whether your plan needs a review.</p><p class="mt">Your 14-day demo history shows a downward trend despite daily changes. You can inspect the full history below.</p><div class="mt">${btn('Open weight trend', 'progress')}</div><div class="divider"></div><p class="small">Context: 14-day logs · nutrition plan v1</p></div><div class="composer"><input aria-label="Message Coach" placeholder="Ask about your routine…"><button data-chat aria-label="Send message">${icon('arrow')}</button></div><p class="note">AI guidance may be incomplete. Numeric plan changes require a separate review.</p>`)}</div>${card('Start with a question', `${row('My routine', 'How can I stay consistent this week?')}${row('My training', 'Help me review my last session.')}${row('My nutrition', 'Explain the assumptions in my target.')}<div class="divider"></div><h3>Sources and context</h3><p class="note">Research citations appear when supported by retrieved source metadata. Sample conversational text here is a design concept.</p>${btn('Calculation source panel', 'calculation')}`)}</div>`,
  },
  {
    id: 'coach-streaming',
    title: 'Coach is reviewing your context.',
    sub: 'Streaming response · cancellation is always available',
    category: 'Coach',
    nav: 'coach',
    stage: 'Phase 4 / 9',
    body: () =>
      `<div class="grid">${card('', `<div class="bubble user"><p>Help me understand my latest session.</p></div><div class="bubble"><span class="eyebrow">REVIEWING</span><p>Your latest session includes three completed bench press sets. I’m comparing reps and effort with the selected plan…</p><span class="mono">▍</span></div><div class="row"><span class="status"><span class="dot"></span>Receiving response</span>${btn('Stop response', 'coach', false, 'pause')}</div><div class="composer"><input aria-label="Next message" placeholder="Wait for this response to finish…" disabled><button disabled>${icon('arrow')}</button></div>`)}${card('Your context', `${row('Training plan', 'Upper / Lower · version 1')}${row('History window', 'Recent completed sessions only')}<p class="note">Stopping preserves text already received and marks the response incomplete. A retry creates one new response.</p>`)}</div>`,
  },
  {
    id: 'form-setup',
    title: 'Move. See. Adjust.',
    sub: 'Form Lab · squat only · local camera analysis',
    category: 'Form Lab',
    nav: 'lab',
    stage: 'Phase 7',
    body: () =>
      `<div class="grid">${card('Set up your view', `${movement()}<div class="caption">Full body in view · camera to your side · clear space</div><div class="divider"></div>${row('01 · Place the camera', 'Stable, side-on view with feet and head visible.')}${row('02 · Check the space', 'Use good light and leave room around you.')}${row('03 · Start when ready', 'Only supported squat conditions are analyzed.')}`)}${card('You control the camera', `<div class="privacy-symbol">${icon('shield')}</div><p>Frames are processed on this device. This session does not upload or save video.</p>${check('Allow camera access for local squat analysis.', false)}${btn('Enable camera', 'form-active', true, 'lab')}<p class="note">Form feedback is an estimate, not a diagnosis. Camera access is optional.</p><div class="mt">${btn('Continue without camera', 'training')}</div>`)}</div>`,
  },
  {
    id: 'form-active',
    title: 'Keep the movement in view.',
    sub: 'Squat session · camera active on this device',
    category: 'Form Lab',
    nav: 'lab',
    stage: 'Phase 7',
    body: () =>
      `<div class="grid">${card('', `${camera()}<div class="actions">${btn('Pause', 'form-low', false, 'pause')}${btn('End session', 'form-summary', true, 'check')}</div><p class="caption">Stock photo preview · no live camera or analysis in this mockup.</p>`)}${card('One cue at a time', `${badge('Visibility sufficient')}<h2 class="mt">Stay fully in frame.</h2><p class="note">Keep hip, knee, and ankle landmarks visible from the supported side view.</p><div class="divider"></div><h3>What you’re seeing</h3><p class="note">In the app, this area shows your local camera view. This design uses a reference photograph; session metrics are illustrative.</p>${btn('View setup', 'form-setup')}`)}</div>`,
  },
  {
    id: 'form-low',
    title: 'Let’s get a clearer view.',
    sub: 'Form Lab · tracking paused',
    category: 'Form Lab',
    nav: 'lab',
    stage: 'Phase 7',
    body: () =>
      `<div class="grid">${card('', `${camera(true)}<div class="actions">${btn('End session', 'form-summary')}${btn('Adjust camera', 'form-setup', true, 'lab')}</div>`)}${card('Not enough visibility', `${notice('Feedback paused', 'Your knee or ankle is outside the supported view. Reps and tempo are not being estimated.')}<p>Move the camera back, improve lighting, and show your full body from the side.</p><div class="mt">${btn('Try again', 'form-active', true)}</div><p class="note">Uncertain tracking should never look like a precise score.</p>`)}</div>`,
  },
  {
    id: 'form-summary',
    title: 'A moment to reflect.',
    sub: 'Form Lab session ended · camera released',
    category: 'Form Lab',
    nav: 'lab',
    stage: 'Phase 7',
    body: () =>
      `<div class="grid">${card('Session observations', `<div class="stats">${stat('6', 'Estimated reps')}${stat('2.8', 'Average tempo', 's')}</div><div class="divider"></div>${movement()}<div class="divider"></div>${row('Supported view', 'Side-on squat · sufficient visibility')}${row('Tracking interruption', 'One period omitted from analysis')}<p class="note">Observations are limited to the visible movement. No universal form score is assigned.</p><div class="actions">${btn('Return to training', 'training', true)}</div>`)}${card('Camera is off', `<div class="privacy-symbol">${icon('shield')}</div><p>No video was saved or uploaded. This concept shows a temporary session summary only.</p><div class="mt">${btn('New local session', 'form-setup', false, 'lab')}</div>`)}</div>`,
  },
  {
    id: 'more',
    title: 'Your toolkit.',
    sub: 'A few more ways to understand your routine.',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 5 / Android concept',
    body: () =>
      `<div class="grid equal">${card('Measure', `<p>Inspect your measurements, targets, and assumptions.</p><div class="mt">${btn('Open Measure', 'measure', true, 'measure')}</div>`)}${card('Form Lab', `<p>Explore local camera feedback for the supported squat.</p><div class="mt">${btn('Open Form Lab', 'form-setup', true, 'lab')}</div>`)}</div><div class="mt">${card('Your account', settingsRows())}</div>`,
  },
  {
    id: 'settings',
    title: 'Make Kinetra yours.',
    sub: 'Maya Lin · synthetic account',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 5 / 6',
    body: () =>
      `<div class="grid">${card('Settings', settingsRows())}${card('Your profile', `<div class="row start"><div class="avatar">ML</div><div><h3>Maya Lin</h3><p class="small">maya@example.test</p></div></div><div class="divider"></div>${row('Goal', 'Cut · metric units')}${row('Timezone', 'America/New_York')}${row('Demo mode', 'All data is synthetic', badge('Active'))}<div class="mt">${btn('Sign out', 'signin', false, 'back')}</div><p class="note">Production sign-out clears account-scoped caches. Pending drafts need a review before leaving.</p>`)}</div>`,
  },
  {
    id: 'appearance',
    title: 'Clarity in any light.',
    sub: 'Appearance · consistent across every destination',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card(
        'Choose your theme',
        `${options([
          ['Light', 'Warm white surfaces and charcoal text.', 'sun', true],
          ['Dark', 'Near-black surfaces and soft white text.', 'moon', false],
          ['Use device setting', 'Follow your system preference.', 'settings', false],
        ])}<p class="note">The gallery theme switch previews every screen in both themes.</p>`,
      )}${card('Keep it comfortable', `${row('Contrast', 'Text and controls use the same semantic tokens.')}${row('Motion', 'Honor reduced-motion preferences.')}${row('Charts', 'Labels, patterns, and summaries supplement tones.')}<div class="mt">${btn('Back to settings', 'settings', false, 'back')}</div>`)}</div>`,
  },
  {
    id: 'reminders',
    title: 'A gentle nudge.',
    sub: 'Reminders follow your local day.',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('Reminder preferences', `${check('Daily check-in reminder')}<div class="fields">${field('Reminder time', '20:00', 'time')}${select('Timezone', ['America/New_York', 'Asia/Kolkata'])}</div>${check('Workout reminder', false)}<div class="fields">${field('Workout time', '17:30', 'time')}</div>${btn('Save preferences', 'settings', true, 'check')}`)}${card('What to expect', `<p>Web reminders appear while Kinetra is open and after you return following a missed window.</p><div class="divider"></div><p>Future Android notification delivery will need native scheduling and permission. Permission denial keeps in-app reminders available.</p><p class="note">No background push reliability claim is implied by this design.</p>`)}</div>`,
  },
  {
    id: 'privacy',
    title: 'Your data. Your choices.',
    sub: 'Account controls and transparent consent',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 6',
    body: () =>
      `<div class="grid">${card('Permissions', `${check('Plan provider processing', false)}<p class="small">Allow selected inputs to be used for AI plan generation.</p><div class="divider"></div>${check('Local camera analysis', false)}<p class="small">Camera frames stay on this device.</p><div class="divider"></div>${check('Private progress photo storage', false)}<p class="small">Optional, separate consent. Disabled in the current release.</p><p class="note">Withdrawal stops future processing for that purpose.</p>`)}${card('Manage your data', `${row('Export a copy', 'Profile, logs, sessions, plans, and preferences', btn('Export', 'export', false, 'download'))}${row('Delete your account', 'Review the scope and confirm your identity', btn('Review', 'delete-account', false, 'trash'))}${row('Private photos', 'Future feature · separate storage consent', btn('Preview', 'photos', false, 'photo'))}`)}</div>`,
  },
  {
    id: 'export',
    title: 'Take your records with you.',
    sub: 'Portable account export',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 6',
    body: () =>
      `<div class="grid">${card('What’s included', `${['Profile and preferences', 'Daily logs with dates and units', 'Completed training sessions', 'Plans and immutable versions', 'Consent metadata, when applicable'].map((s) => row(s, 'Owned account records', icon('check'))).join('')}<div class="actions"><button class="primary" data-demo>${icon('download')}Prepare export</button></div>`)}${card('Export status', `${notice('Ready state · design example', 'A completed export offers a clearly named file and an expiry time.')}<p class="mono small">kinetra-export-2026-10-04.json</p><div class="mt"><button data-demo>${icon('download')}Download JSON</button></div><p class="note">Large exports show preparing, ready, and failed states. A failed job offers retry without losing data.</p>`)}</div>`,
  },
  {
    id: 'delete-account',
    title: 'Review before you leave.',
    sub: 'Account deletion · explicit confirmation',
    category: 'Account',
    nav: 'more',
    stage: 'Phase 6',
    body: () =>
      `<div class="grid">${card('Delete your account', `${notice('This action is permanent', 'Your profile, logs, sessions, plans, and private objects will be removed according to the published policy.')}<p>Deletion also revokes plan shares. Local caches on other offline devices clear when those devices reconnect; backup retention follows the policy.</p><div class="fields">${field('Confirm account email', 'maya@example.test', 'email')}</div><div class="fields">${field('Type DELETE to confirm', '', 'text')}</div>${check('I understand the deletion scope.', false)}<div class="actions">${btn('Keep my account', 'settings')}<button class="primary" data-demo>${icon('trash')}Confirm identity & delete</button></div>`)}${card('Before confirming', `<p>You can export your records first. Recent identity confirmation is required before deletion begins.</p><div class="mt">${btn('Export my data', 'export', false, 'download')}</div><div class="divider"></div><h3>If deletion is interrupted</h3><p class="note">Show pending progress and retry status. Do not show “deleted” until the lifecycle job has actually completed.</p>`)}</div>`,
  },
  {
    id: 'sync',
    title: 'Stay connected to your routine.',
    sub: 'Offline status and pending changes',
    category: 'Offline',
    nav: 'more',
    stage: 'Phase 6',
    body: () =>
      `<div class="grid">${card('Saved on this device', `${notice('You’re offline · 2 changes pending', 'Last successful sync: today at 14:32. Cached plans and logs remain available.')}<div class="stats">${stat('2', 'Pending changes')}${stat('1', 'Cached plan version')}</div><div class="divider"></div>${row('21 Sep · daily log', 'Saved locally · waiting for connection', badge('Pending'))}${row('Upper body A', 'Session draft · saved locally', badge('Pending'))}<div class="mt">${btn('Review a conflict', 'conflict')}</div>`)}${card('When you’re back online', `<p>Changes replay in order. Failed writes remain visible with a retry action; conflicting edits need your review.</p><div class="divider"></div><button data-demo>${icon('progress')}Retry sync</button><p class="note">Cloud-only generation, Coach, export, and sharing require a connection.</p>`)}</div>`,
  },
  {
    id: 'conflict',
    title: 'Keep the right version.',
    sub: '21 September · this day changed on another device',
    category: 'Offline',
    nav: 'more',
    stage: 'Phase 6',
    body: () =>
      `${notice('Both entries are preserved', 'Choose which values to keep. Nothing is overwritten until you confirm.')}<div class="grid equal">${card('This device', `<div class="comparison"><span class="eyebrow">LOCAL EDIT / 14:36</span><div class="stat">68.6 <small>kg</small></div><p>1,750 kcal · 2,600 ml water</p><p class="note">“Good energy during training.”</p></div><div class="mt">${btn('Keep this device’s entry', 'sync', true, 'check')}`)}${card('Other device', `<div class="comparison"><span class="eyebrow">SERVER ENTRY / 14:40</span><div class="stat">68.5 <small>kg</small></div><p>1,720 kcal · 2,400 ml water</p><p class="note">“Corrected morning weight.”</p></div><div class="mt">${btn('Keep the other entry', 'sync', true, 'check')}`)}</div><p class="note">For a custom combination, open an editable comparison before submitting a new revision.</p>`,
  },
  {
    id: 'generating',
    title: 'Building a plan you can inspect.',
    sub: 'Your previous accepted plan stays available.',
    category: 'Plan states',
    nav: 'plan',
    stage: 'Phase 4',
    body: () =>
      `<div class="grid">${card('Preparing your plan', `${row('Profile and constraints', 'Diet, exclusions, equipment', icon('check'), '01')}${row('Create candidate', 'Provider response in progress', badge('Working'), '02')}${row('Verify candidate', 'Nutrition and training policy checks', badge('Waiting'), '03')}${row('Ready for review', 'Only accepted content is presented', badge('Waiting'), '04')}<div class="meter"><span style="width:45%"></span></div><div class="actions">${btn('Cancel', 'nutrition')}${btn('Preview failure state', 'generation-failed')}</div>`)}${card('Still available', `<h2>Nutrition plan v1</h2><p class="note">Generation never replaces a saved plan until an accepted new version is created.</p><div class="mt">${btn('Open current plan', 'nutrition', true)}</div>`)}</div>`,
  },
  {
    id: 'generation-failed',
    title: 'Your current plan is still here.',
    sub: 'A new plan could not be accepted.',
    category: 'Plan states',
    nav: 'plan',
    stage: 'Phase 4',
    body: () =>
      `<div class="grid">${card('Revision unavailable', `${notice('A plan constraint was not met', 'The candidate contained an unresolved ingredient. It was not saved or presented as accepted.')}<p>You can try again or continue with your current plan. If the provider is unavailable, an approved template may be offered with its provenance.</p><div class="actions">${btn('Keep current plan', 'nutrition')}${btn('Try again', 'generating', true)}</div>`)}${card('Your saved version', `${row('Version 1', 'Synthetic fixture · unchanged', badge('Available'))}${btn('View saved plan', 'nutrition')}`)}</div>`,
  },
  {
    id: 'plan-revision',
    title: 'Adjust with intention.',
    sub: 'Nutrition plan v1 · revision request',
    category: 'Plan',
    nav: 'plan',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('What should change?', `${field('Revision note', 'More variety at breakfast.')}<div class="divider"></div><h3>Preserved constraints</h3>${row('Exclusions', 'Shellfish')}${row('Diet', 'Pescatarian')}${row('Target', 'Uses the accepted goal policy')}<div class="actions">${btn('Cancel', 'nutrition')}${btn('Request new version', 'generating', true)}</div>`)}${card('A separate version', `<p>The previous plan remains available. A revised plan must pass the same checks before it can become the active version.</p><div class="mt">${btn('See version history', 'versions')}</div>`)}</div>`,
  },
  {
    id: 'versions',
    title: 'Keep the story of your plan.',
    sub: 'Immutable versions · nutrition',
    category: 'Plan',
    nav: 'plan',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('Version history', `${row('Version 2', '04 October · accepted revision · concept', badge('Active'))}${row('Version 1', '17 September · synthetic fixture', btn('Inspect', 'nutrition'))}<div class="mt">${btn('Share selected version', 'share', false, 'arrow')}</div>`)}${card('What changed in v2', `${row('Breakfast variety', 'Ingredient selections revised')}${row('Diet and exclusions', 'Pescatarian · shellfish excluded · preserved')}${row('Verification', 'Show policy and accepted result metadata')}<p class="note">Version 2 is an illustrative future state, not an existing repository fixture. Pinning or selecting a version does not mutate its contents.</p>`)}</div>`,
  },
  {
    id: 'share',
    title: 'Share just the plan.',
    sub: 'Nutrition · immutable version 2',
    category: 'Plan',
    nav: 'plan',
    stage: 'Phase 9',
    body: () =>
      `<div class="grid">${card('Create a share link', `${notice('Only this plan version is shared', 'Your profile, logs, photos, and unrelated records are excluded.')}<div class="fields">${select('Link lifetime', ['7 days', '1 day', '30 days'])}</div><button class="primary" data-demo>Create expiring link ${icon('arrow')}</button><div class="divider"></div><span class="eyebrow">ACTIVE GRANT / DESIGN STATE</span><p class="note">Version 2 · expires 11 October 2026</p><div class="mt row wrap"><button data-demo>Copy link</button><button data-demo>Revoke access</button></div>`)}${card('Shared view', `<h2>Nutrition plan · v2</h2><p class="note">Recipients see the selected plan and its provenance. Revocation or expiry shows an unavailable screen with no private metadata.</p>${mealrows()}`)}</div>`,
  },
  {
    id: 'voice',
    title: 'Say it. Review it. Save it.',
    sub: 'Voice entry · editable confirmation before any save',
    category: 'Daily',
    nav: 'today',
    stage: 'Phase 9',
    body: () =>
      `<div class="grid">${card('Review extracted entry', `${badge('Needs your confirmation')}<div class="quote"><p>“My morning weight was sixty-eight point six kilos.”</p></div><div class="fields">${field('Weight · kg', '68.6', 'number')}${field('Local date', '2026-09-21', 'date')}</div>${notice('Extraction is an estimate', 'Confirm the values and local date. Unclear amounts stay unresolved instead of being guessed.')}<div class="actions">${btn('Type instead', 'daily-log')}${btn('Confirm entry', 'daily-log', true, 'check')}</div>`)}${card('Microphone control', `<div class="privacy-symbol">${icon('mic')}</div><p>Request permission when recording starts. Stop capture immediately when you leave.</p><div class="mt"><button data-demo>${icon('mic')}Record again</button></div><p class="note">If voice is unsupported or permission is denied, manual logging remains available.</p>`)}</div>`,
  },
  {
    id: 'progression',
    title: 'Review your next step.',
    sub: 'Proposed training adjustment · no automatic change',
    category: 'Training',
    nav: 'progress',
    stage: 'Phase 8',
    body: () =>
      `<div class="grid">${card('Bench press proposal', `<div class="stats">${stat('42.5', 'Current load', 'kg')}${stat('45', 'Proposed load', 'kg')}</div><div class="divider"></div>${row('Reason', 'Illustrative rule outcome from completed sets and effort.')}${row('Evidence window', 'Recent comparable sessions · inspect history')}${row('Policy', 'Versioned progression policy · pending domain review')}${notice('Design example only', 'These numbers illustrate a review UI. They are not a recommendation or an evaluated rule output.')}<div class="actions">${btn('Keep current load', 'training')}${btn('Accept new version', 'versions', true, 'check')}</div>`)}${card('Understand the evidence', `${chart(true)}<p class="note">Implementation must show actual qualifying history, confidence, and policy bounds. Insufficient evidence keeps the current prescription.</p>${btn('Inspect session history', 'strength')}`)}</div>`,
  },
  {
    id: 'photos',
    title: 'Private, and entirely optional.',
    sub: 'Progress photos · future feature preview',
    category: 'Progress',
    nav: 'progress',
    stage: 'Phase 9',
    body: () =>
      `<div class="grid">${card('Your private timeline', `<div class="crop-box">${icon('photo')}</div><p class="note">No progress photos yet. This feature remains disabled until private storage and deletion controls are ready.</p>${check('I consent to private photo storage.', false)}<button data-demo>${icon('plus')}Add a photo</button>`)}${card('Consent comes first', `<p>Photos require separate storage consent. Access is private and time-limited; each image has a delete action and a documented retention policy.</p><div class="divider"></div><h3>For visual comparison only</h3><p class="note">No photo-based body-fat estimates, diagnosis, or automated physique rating.</p>${btn('Review privacy settings', 'privacy')}`)}</div>`,
  },
  {
    id: 'empty',
    title: 'Your routine starts here.',
    sub: 'Today · new account with no accepted plan',
    category: 'System states',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('', `<div class="empty">${icon('plan')}<h2>Build your first plan</h2><p>Finish your profile to prepare a nutrition or training plan.</p>${btn('Continue setup', 'onboard-goal', true)}</div>`)}${card('', `<div class="empty">${icon('progress')}<h2>No entries yet</h2><p>A single daily log is enough to begin your history. Trends appear when there’s enough data.</p>${btn('Log today', 'daily-log', false, 'plus')}</div>`)}</div>`,
  },
  {
    id: 'loading',
    title: 'Your day is coming into focus.',
    sub: 'Today · loading your saved records',
    category: 'System states',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid"><div class="stack">${card('', `<div class="skeleton" style="width:45%"></div><div class="skeleton big"></div><div class="skeleton" style="width:70%"></div>`)}${card('', `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton" style="width:60%"></div>`)}</div>${card('', `<div class="skeleton" style="width:50%"></div><div class="skeleton big"></div><div class="skeleton"></div><p class="note">Loading saved data…</p>`)}</div>`,
  },
  {
    id: 'error',
    title: 'Let’s reconnect.',
    sub: 'Saved content remains available when cached.',
    category: 'System states',
    nav: 'today',
    stage: 'Phase 5 / 6',
    body: () =>
      `<div class="grid">${card('', `<div class="empty">${icon('offline')}<h2>Couldn’t load the latest records</h2><p>Your draft is preserved. Retry when connected, or continue with a cached plan.</p>${btn('Retry', 'today', true)}<div class="mt">${btn('Open saved plan', 'nutrition')}</div></div>`)}${card('Connection status', `${notice('Server unavailable', 'We could not confirm your latest sync status.')}<p>Never label a local-only save as synced. Pending writes remain visible until acknowledged.</p><div class="mt">${btn('Review pending changes', 'sync')}</div>`)}</div>`,
  },
  {
    id: 'validation',
    title: 'A small correction, then you’re set.',
    sub: 'Daily log · validation preserves the rest of your draft',
    category: 'System states',
    nav: 'today',
    stage: 'Phase 5',
    body: () =>
      `<div class="grid">${card('Correct the highlighted field', `${notice('Weight needs a valid value', 'Enter a weight greater than zero in your selected unit.')}<div class="fields"><label class="field">Weight · kg<input aria-invalid="true" aria-describedby="weight-error" value="-2" type="number" style="border:2px solid var(--ink)"><small id="weight-error">! Enter a positive weight.</small></label>${field('Calories · kcal', '1750', 'number')}</div>${field('Notes', 'Good energy during training.')}<div class="actions">${btn('Return to draft', 'daily-log', true)}</div>`)}${card('Draft intact', `<p>Errors appear next to the relevant field and in a linked summary. Move focus to the summary on submit. Keep all other entered values.</p><p class="note">Save remains unavailable until required errors are resolved. Optional blank values are not converted into zero.</p>`)}</div>`,
  },
  {
    id: 'permission',
    title: 'You can continue without a camera.',
    sub: 'Form Lab · camera permission denied',
    category: 'System states',
    nav: 'lab',
    stage: 'Phase 7',
    body: () =>
      `<div class="grid">${card('', `<div class="empty">${icon('lab')}<h2>Camera access isn’t available</h2><p>Allow camera access in your device settings, or keep training with the written movement guide.</p>${btn('Open movement guide', 'exercise', true)}<div class="mt">${btn('Try camera again', 'form-setup')}</div></div>`)}${card('Your choice is respected', `<p>No recording starts. On unsupported devices, show the same manual alternative with a device-specific explanation.</p><div class="divider"></div><h3>Future Android</h3><p class="note">Request native camera permission at the moment of use. After permanent denial, provide a clear link to app permissions.</p>`)}</div>`,
  },
  {
    id: 'expired',
    title: 'Sign in to finish syncing.',
    sub: 'Session expired · local changes remain preserved',
    category: 'System states',
    nav: 'more',
    stage: 'Phase 6',
    body: () =>
      `<div class="grid">${card('Sync paused', `${notice('Your session has expired', 'Two local changes are waiting. Reauthenticate the same account to resume sync.')}<div class="mt">${btn('Sign in again', 'signin', true)}<div class="mt">${btn('Review local changes', 'sync')}</div></div><p class="note">Switching accounts must never replay one account’s pending writes into another.</p>`)}${card('Pending on this device', `${row('Daily log', '21 September · saved locally', badge('Paused'))}${row('Workout session', 'Upper body A · saved locally', badge('Paused'))}`)}</div>`,
  },
];
// Complete account creation and email-link recovery alongside the entry screens.
screens.splice(
  1,
  0,
  {
    id: 'signup',
    title: 'Start your daily practice.',
    sub: 'Create an account before setting up your routine.',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 2 / 5',
    body: () =>
      `<div class="onboarding">${card('Create your account', `<div class="fields">${field('Display name', 'Maya Lin')}</div><div class="fields">${field('Email address', 'maya@example.test', 'email')}</div><div class="fields">${field('Password', '', 'password', 'Use a strong password. Production rules must match the auth provider.')}</div>${check('I have read the privacy policy and understand how account data is handled.', false)}${btn('Create account', 'verify-email', true)}<p class="note">Already have an account? <a href="signin">Sign in →</a></p>`)}</div>`,
  },
  {
    id: 'verify-email',
    title: 'Confirm your email.',
    sub: 'One step before your profile setup.',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 2 / 5',
    body: () =>
      `<div class="onboarding">${card('', `<div class="empty">${icon('mail')}<h2>A confirmation link is on its way</h2><p>Check the inbox for maya@example.test. Open the link to confirm your account and continue.</p><button data-demo>${icon('mail')}Resend confirmation</button><div class="mt">${btn('Change email', 'signup', false, 'back')}</div></div>`)}${card('Email confirmed · preview state', `<p>After a valid email link, resume your saved onboarding step.</p><div class="mt">${btn('Continue to your goals', 'onboard-goal', true)}</div>`)}</div>`,
  },
  {
    id: 'new-password',
    title: 'Choose a new password.',
    sub: 'Password recovery · valid email-link state',
    category: 'Start',
    nav: 'today',
    stage: 'Phase 2 / 5',
    body: () =>
      `<div class="onboarding">${card('Reset your password', `<div class="fields">${field('New password', '', 'password')}</div><div class="fields">${field('Confirm new password', '', 'password')}</div>${notice('A valid recovery link is required', 'Expired or used links offer a fresh reset request. Do not expose account details.')}<div class="actions">${btn('Request another link', 'reset')}${btn('Save password', 'signin', true, 'check')}</div><p class="note">On successful reset, show confirmation before returning to sign in. Mismatched fields use the validation pattern.</p>`)}</div>`,
  },
);
