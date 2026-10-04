# Visual and interaction system

## Direction: quiet athletic precision

Kinetra should feel like a considered training journal: calm, clear, and practical. The fitness character comes from monochrome exercise photography, workout prescriptions, a strong typographic hierarchy, and prominent progress data. No neon accent, decorative gradient, competitive leaderboard, or stock transformation photo is needed.

Use monochrome throughout. Light mode pairs warm white backgrounds with charcoal text; dark mode pairs a near-black background with soft white text. A filled high-contrast action and one expressive workout hero establish priority. Most secondary surfaces use a thin border rather than a shadow. Avoid surrounding every text block with another card.

## Semantic color tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| background | `#F6F6F4` | `#101211` | Canvas |
| surface | `#FFFFFF` | `#191C1A` | Cards and navigation |
| surface-subtle | `#EEEEEB` | `#242825` | Inputs, tracks, preview areas |
| text-primary | `#171918` | `#F1F3EE` | Headings, numbers, primary action fill |
| text-secondary | `#626663` | `#A2AAA3` | Supporting text |
| border | `#D9DCD7` | `#383E39` | Separators and boundaries |
| text-on-primary | `#FFFFFF` | `#111411` | Primary button text |

These values are encoded in `src/styles.css` and `tokens.json`. The low-contrast border is decorative; actionable boundaries, selected states, and focus outlines need the primary ink where their shape must communicate meaning.

Error, success, uncertainty, and offline feedback stay monochromatic using explicit words, an icon, and a clear boundary. For example: “Saved locally · 2 pending”, “Feedback paused”, or “Weight needs a valid value”. Tone alone never conveys a state.

## Typography

Use Inter when available, with Arial/Helvetica as local fallbacks. The delivered mockups make no external font request. Font licensing and bundling can be settled during implementation. Numeric values use tabular figures; identifiers and equations use a local monospace stack.

| Role | Web | Android | Notes |
| --- | --- | --- | --- |
| Page and hero title | 32 / 38.4 px | 32 / 38.4 dp | Same size and weight in both layouts |
| Section title | 20 / 26 px | 20 / 26 dp | Includes every card heading |
| Item title | 16 / 24 px | 16 / 24 dp | List item hierarchy |
| Body and control label | 14 / 20–21 px | 14 / 20–21 dp | Buttons, tabs, chips, inputs share 14 px labels |
| Supporting and field label | 12 / 18 px | 12 / 18 dp | Help, units, badges, chart labels, navigation captions |
| Numeric headline | 32 / 38.4 px | 32 / 38.4 dp | No component-specific metric size variants |
| Rest timer | 48 / 57.6 px | 48 / 57.6 dp | Single functional exception for time visibility |

Mockup annotations use smaller type outside essential content. Production must support browser zoom and Android font scaling without clipping controls or hiding errors.

## Geometry and spacing

- Spacing base: 4. Prefer 8, 12, 16, 20, 24, 32, and 40.
- Web sidebar: 236 px; top bar: 85 px; content inset: 44 px.
- Web content: maximum 1380 px with a 20 px grid gap.
- Desktop grids: 1.45:1 for a main action and supporting context; 1:1 for comparison; 1:1:1 only for short metrics.
- Narrow web: below 900 px, collapse the sidebar into bottom navigation and stack main/supporting regions.
- Android: 412 dp reference width; 20 dp inset; bottom navigation includes a system gesture area.
- Card radius: 18; controls: 9–10; badges: 6; diagram surface: 12.
- Web and Android action controls share a 48 px/dp minimum height, 14 px/dp semibold labels, 20 px/dp label line height, 12 px/dp vertical padding, and 16 px/dp horizontal padding. Buttons, tabs, and chips use this same baseline. Choice cards and date tiles retain their content layout; their type uses the same tokens. Native Android implementation should preserve at least 48 dp interactive bounds, including invisible padding around small icons.

## Navigation and priority

Desktop preserves all six destinations in the sidebar: Today, Measure, Plan, Coach, Form Lab, Progress. Settings sits in the account area.

Android exposes Today, Plan, Coach, Progress, and More in bottom navigation. More opens a toolkit with **Measure** and **Form Lab**, followed by account settings. Both destinations remain a single additional tap away, and their selected bottom-navigation parent is More. This avoids six compressed labels in a small bar while retaining the frozen product scope.

A page should have one clear next action. Today emphasizes the planned workout; logging and nutrition sit beside or below it. Workout sessions suppress unnecessary exploration in native implementation and keep set entry, effort, timer, and completion within reach. Today’s hero describes planned work; Progress only counts completed records.

## Shared components and states

| Component | Required variants |
| --- | --- |
| Button | Primary, secondary, quiet, icon with accessible name, disabled, loading |
| Input | Default, focused, filled, optional blank, invalid, disabled |
| Choice | Unselected, selected, keyboard focused; single vs multiple semantics |
| Status | Synced, local/pending, offline, retrying, conflict, auth paused |
| Plan provenance | Synthetic fixture, generated accepted, repaired accepted, approved template |
| Chart | Data, insufficient data, loading, failure; textual summary for all data states |
| Camera | Not requested, consent granted, denied, unsupported, loading model, active, uncertain, stopped |
| Conversation | Empty, analyzing, streaming, done, stopped/incomplete, interrupted, retryable error |
| Modal/sheet | Clear title, close/cancel, focus containment, return focus, explicit destructive confirmation |

HTML concepts show the visual choices. Production semantics for radio groups, switches, dialogs, and live regions must be implemented in the actual UI framework rather than inferred from prototype classes.

## Exercise photography and supporting diagrams

Exercise demos use locally stored photographs from Pexels: bench press by Andrea Piacquadio and a side-view bodyweight squat by MART PRODUCTION. See [source and license credits](../assets/photos/CREDITS.md). The images use a shared grayscale treatment, rounded frames, and readable dark overlays in hero cards. Both themes use the same image treatment. No endorsement or identity relationship with the synthetic persona is implied.

Bench-press reference imagery appears in Today and the exercise guide. The side-view squat reference appears in the welcome hero, Form Lab setup, preview, and summary. Form Lab explicitly labels a stock photo preview; sample observations are illustrative, with no live tracking or fabricated landmark overlay. Production will replace that preview with the actual local camera view.

Measurement tape placement, meal composition, and data charts keep their informational vectors. These are functional explanations rather than exercise demo illustrations. The removed bench/squat vector assets are no longer part of the handoff.

## Accessibility and motion

Keyboard focus uses a visible 3 px outline. Persistent navigation includes named landmarks; icon-only actions have labels. Charts include a plain-language summary. Pending saves and streamed response status should use polite live announcements without reading every token. Camera cues need a text alternative.

Honor reduced motion. Use brief state transitions during implementation; avoid looping skeleton shimmer, pulsing health metrics, and competitive progress animations. Dark and light layouts share geometry so switching modes does not move controls.

## Consistency revision

The type scale is shared across web and Android and both themes. Page-specific control font sizes and smaller hero action labels have been removed. All card titles use the section role; all grouped metrics use the metric role. Macro values use the body/control role to keep three-column summaries readable without introducing an extra intermediate size. The logo and simulated system chrome sit outside the content hierarchy.

Widths follow label content and available space; action heights, label size, padding, weight, and icon size are consistent. Long action rows wrap as whole controls rather than squeezing the text. Selected choice cards preserve their outer size by compensating for the additional border width.
