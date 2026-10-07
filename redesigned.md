# Kinetra redesign implementation specification

Prepared: 7 October 2026.

## Purpose and delivery status

Implement the revised Kinetra design in the existing web application, using the completed design atlas as the visual reference. Prepare the same design system and interaction requirements for a future Android application.

The intended experience is minimal, monochromatic, and suited to a practical fitness journal. The revisions specifically address inconsistent text and button sizing, misaligned calendar labels and dates, narrow-screen layout problems, and unsuitable human diagrams in exercise and measurement areas.

This file is an implementation specification. The revised mockups already exist in `design/`; they are separate from the production React interface. Creating this document does not implement the redesign in `apps/web` or create an Android app.

### Reference assets

| Reference | Use |
| --- | --- |
| [Design atlas](design/README.md) | Preview instructions and artifact inventory |
| [Screen manifest](design/screen-manifest.json) | All 54 screen concepts and their delivery phases |
| [Design tokens](design/tokens.json) | Shared colors, typography, geometry, and spacing |
| [Design system](design/docs/DESIGN_SYSTEM.md) | Visual and interaction decisions |
| [Journeys](design/docs/FLOWS.md) | Screen coverage, transitions, and state requirements |
| [Implementation handoff](design/docs/HANDOFF.md) | Component mapping and platform requirements |
| [Verification report](design/docs/QA.md) | Existing prototype checks and their limitations |
| [Photo credits](design/assets/photos/CREDITS.md) | Local image files, authors, and source attribution |

Every screen has web and Android references in light and dark mode: 54 concepts, 216 primary PNGs, and 108 Android full-scroll companions. The HTML references demonstrate selected interactions; they are not application components or backend implementations.

## 1. Product scope and implementation boundaries

Keep the existing React/Vite web application, TanStack Router/Query setup, typed contracts, and repository abstraction. Implement production components rather than embedding the atlas or copying its DOM mutation scripts.

The frozen product destinations are Today, Measure, Plan, Coach, Form Lab, and Progress. On small screens, the design exposes Today, Plan, Coach, Progress, and More; More provides access to Measure, Form Lab, and account utilities. It is a navigation grouping, not an additional domain feature.

The current synthetic application has Today, Measure, Plan, Progress, and Foundation/Auth. Deliver the redesign for available features first. Coach, local camera analysis, active workout logging, offline synchronization, and account lifecycle operations must follow their existing project milestones. A mockup does not establish that a service exists.

Preserve persona switching and fixture reset in development. Keep Foundation/Auth available as development diagnostics, outside consumer navigation when the production shell is introduced. Label fixtures as synthetic. Use typed persona data instead of copying conflicting summaries or illustrative values from documentation.

Keep the repository’s domain policy: transparent estimates, server acceptance of generated plans, local camera processing, and no photo-based body-fat conclusions. This redesign changes presentation and interaction; it does not replace calculation rules or plan contracts.

## 2. Visual direction

Use calm surfaces, strong but limited typography, generous alignment, and a clear next action. Fitness character comes from exercise photographs, prescriptions, measurements, and progress records.

- Use neutral colors throughout both themes.
- Give primary actions a filled high-contrast treatment; use bordered or quiet treatments for secondary actions.
- Keep one clear primary action per task area.
- Use borders and spacing to separate information; avoid excessive nested cards.
- Keep geometry and hierarchy identical when switching themes.
- Communicate error, success, pending, and uncertainty with text and icons, not color alone.
- Preserve informational charts and meal-composition graphics. Replace human exercise and measurement illustrations with the approved photography.

## 3. Shared design tokens

### Theme colors

| Semantic role | Light | Dark |
| --- | --- | --- |
| Canvas | `#F6F6F4` | `#101211` |
| Surface | `#FFFFFF` | `#191C1A` |
| Subtle surface | `#EEEEEB` | `#242825` |
| Primary text | `#171918` | `#F1F3EE` |
| Secondary text | `#626663` | `#A2AAA3` |
| Decorative border | `#D9DCD7` | `#383E39` |
| Text on primary fill | `#FFFFFF` | `#111411` |

Introduce semantic CSS variables in `apps/web/src/styles.css`. Remove existing orange accent and page-specific hard-coded colors from redesigned areas. Essential control boundaries, selection, and keyboard focus must remain distinguishable; decorative border contrast alone is not sufficient for those states.

Offer Light, Dark, and System appearance choices. Persist the preference, resolve System through the operating-system preference, and apply it before the first visible render where possible. Theme changes must retain the route, selected date, and draft values. Handle unavailable browser storage without blocking the interface.

### Typography and controls

| Role | Size / line height | Application |
| --- | --- | --- |
| Page title / hero title | 32 / 38.4 | Main screen heading |
| Section title | 20 / 26 | Card and section headings |
| Item title | 16 / 24 | Meal and exercise names |
| Body | 14 / 21 | Main explanatory content |
| Control label | 14 / 20, weight 600 | Buttons, tabs, choices, inputs |
| Supporting / field label | 12 / 18 | Units, hints, captions, badges |
| Headline metric | 32 / 38.4 | Main numeric result |
| Rest timer | 48 / 57.6 | Functional timer exception |

Use Inter when bundled or available, with Arial/Helvetica fallbacks. Use tabular numerals for dates, timers, measurements, and aligned numeric columns. Android uses sp for text and supports user font scaling.

Ordinary action buttons have a 48 px reference height, 16 px horizontal padding, a 14 px semibold label, and 20 px icons. Icon buttons use the same minimum target. Choices and calendar tiles may be taller because they contain multiple lines; they must not use smaller labels to fit.

At default text size, ordinary action heights should match. At increased text size or with long translations, allow height to grow and rows to wrap. Never clip text to preserve a screenshot’s height. Width may follow content; equal height does not require every action to have equal width.

### Geometry

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, and 48.
- Card radius: 18; control radius: 10; badge radius: 6; media frame radius: 12.
- Reference desktop sidebar: 236 px; content inset: 44 px; grid gap: 20 px.
- Reference Android width: 412 dp; content inset: 20 dp.
- Collapse the desktop shell below the reference 900 px breakpoint.
- Use flexible grids with `minmax(0, 1fr)` and `min-width: 0` on text containers.
- Align titles, labels, inputs, and actions to shared edges within each section.

Treat these as responsive reference values. Do not hard-code entire pages to 1440 px or devices to 412 dp.

## 4. Reusable components

Build shared primitives before migrating screens.

| Component | Required behavior |
| --- | --- |
| AppShell / DestinationNav | Desktop navigation, compact navigation, route state, safe areas |
| Button / IconButton | Shared typography, target size, loading and disabled states, accessible names |
| Surface / SectionHeader | Consistent padding, heading alignment, optional secondary action |
| Field / SelectField | Visible label, units, help, error association, aligned input rows |
| Tabs | Accessible selection, keyboard movement, visible selected state |
| Notice / StatusBadge | Explicit state wording and consistent icon/text alignment |
| WeekSelector | One date source, equal tiles, accurate date selection |
| ExerciseReference / MeasurementReference | Approved image, crop, alt text, fallback, caption |
| Metric / NutritionSummary | Consistent numeric hierarchy and explicit units |
| SetEditor | Aligned headers and inputs, accessible per-set labels |
| EmptyState / LoadingState / ErrorState | Stable layout, specific recovery action |

Use variants for meaning, not arbitrary screen-specific sizes. Shared controls should not require local font-size, height, or padding overrides.

## 5. Calendar accuracy and alignment

### Problem addressed

The earlier prototype placed weekday labels and date numbers beside one another through generic button styling. It also changed the selected tile while retaining Monday’s content. The revised design stacks labels over numbers and synchronizes the selected content.

### Date model

Create one ordered list of date records for the displayed week. Each record supplies the local date key, weekday label, date number, and corresponding plan-day mapping. Use that record for the tile, selected heading, content query, and weekly summary.

- Use ISO local dates (`YYYY-MM-DD`) as stable selection keys.
- Derive the relevant current local date using the account timezone and existing `localDateAt` helper in `packages/domain/src/dates.ts`.
- Do not derive the account’s date by truncating an arbitrary UTC timestamp.
- Treat a date-only string as a calendar date, not an instant that changes with viewer timezone.
- Advance calendar dates by calendar arithmetic; avoid adding 24 hours across daylight-saving transitions.
- Format weekday and numeric labels from the same date value and locale.
- Keep the week range, month, and year visible; handle weeks crossing month and year boundaries.

The atlas uses the explicitly labeled synthetic week **21–27 September 2026**. Monday is 21 and Sunday is 27. Retain that fixed week only in a deterministic demo or visual fixture. Production must use the applicable plan schedule and account date.

Existing plan payloads expose ordered `day_number` and `day_name` records. Establish an explicit mapping between those records and a week start date. Do not assume an array index or user-facing day name is a reliable date identifier. If the contract lacks a scheduling anchor, resolve that through the existing contract workflow; do not silently invent dates or new API fields.

### Layout and selection

- Render seven equal-width columns with centered content.
- Stack weekday above date number; keep the same vertical gap and baselines in every tile.
- Reference tile minimum height: 64 px. Gap: 6 px, reduced to 4 px at narrow widths where needed.
- Apply tabular numerals and consistent label sizes.
- Keep selected borders from changing outer dimensions.
- Expose a full accessible label such as “Monday, 21 September 2026” and the selected state.
- Selecting a day updates the heading, full date, meals or exercises, training/rest state, and weekly-summary highlight together.
- Preserve selection when switching Nutrition and Training within the same displayed week.
- Show an explicit unavailable/empty state if the selected date has no matching plan content; never retain another date’s content under the new heading.
- Do not mark a planned day completed merely because it is selected.

If a prototype action opens a fixed Monday session, identify it as a Monday demo. In production, session actions must open the workout associated with the selected date and actual plan version.

## 6. Forms, lists, and workout tables

### Fields

Use a separate label element or label span above each input. Paired controls must begin on the same baseline even when one label wraps. The revised narrow reference reserves two label lines where required. Production may instead stack the group when translations or font scaling exceed the available space.

Keep error text below its input; it must not shift the neighboring input’s starting position. Preserve entered values on validation failure. Optional blank values remain absent rather than becoming zero. Do not replace cleared or invalid numeric input with an unrelated fallback measurement.

Use concise selected labels such as “Moderate” for activity. Put frequency assumptions and multipliers in supporting text or calculation details so the select remains readable.

### Lists and actions

Allow long meal names, exercise names, and supporting descriptions to wrap in their text column. Keep action controls and badges from shrinking. Align rows consistently and let entire controls move to a new row when space is insufficient.

### Workout data

Compact set-entry tables must keep column headings and values centered on the same axes. Inputs fit their columns, retain explicit units, and have accessible labels such as “Set 2, repetitions.”

The atlas’s narrow set editor uses a fixed table layout, constrained padding, and full-column inputs. The current production Plan view contains a different, six-column exercise-prescription table with long instructions. Do not apply the compact set-editor widths indiscriminately to that table. On narrow screens, convert prescriptions to structured exercise cards or provide a deliberate, labeled horizontal table scroller if necessary. Page-level horizontal overflow is not acceptable.

Completion indicators must match the actual set state. Preserve completed sets and draft edits when navigating or recovering from an interruption.

## 7. Photography and informational graphics

### Approved local assets

| File | Placement | Content |
| --- | --- | --- |
| `design/assets/photos/bench-press.jpg` | Today hero and exercise reference | Bench-press reference |
| `design/assets/photos/squat.jpg` | Welcome and Form Lab reference screens | Side-view squat reference |
| `design/assets/photos/waist-measurement.jpg` | Measure circumference section | Tape-measure reference |

Author and source information is recorded in [photo credits](design/assets/photos/CREDITS.md). Carry that attribution record with the assets when moving them into the production asset directory.

### Image presentation

- Use the same grayscale treatment in light and dark mode.
- Use a shared rounded media frame and purposeful `object-fit` / `object-position` values.
- Preserve the relevant movement or tape placement in responsive crops.
- Use a dark overlay when placing text on hero photography, with readable text in both themes.
- Reserve image space before loading to prevent layout movement.
- Provide concise descriptive alt text for instructional reference images; decorative duplicates can have empty alt text.
- Provide a text fallback if an image fails to load. Measurements and logging must still work.
- Serve local assets rather than depending on third-party image hotlinks.

Remove the old human silhouette and exercise-vector artwork from user-facing exercise and measurement areas. Do not reintroduce the deleted bench, squat, or tape-placement illustration assets.

The measurement photograph is a visual reference, not a complete guide for every circumference measurement or equation variant. Pair it with correct written instructions. Do not infer body composition from the photo or claim the person pictured is the synthetic persona.

Keep functional trend charts, macro bars, and meal-composition graphics. Supply units, summaries, and accessible data alternatives. Form Lab stock previews remain clearly labeled; real camera analysis replaces the reference image only when the local capture feature is implemented. Illustrative metrics never masquerade as live tracking.

## 8. Screen-by-screen implementation

| Area | Required redesign | Implementation target |
| --- | --- | --- |
| Shell | Shared theme, desktop sidebar, compact bottom navigation, consistent header | `main.tsx`, `components/DemoHeader.tsx`, shared shell components |
| Today | Clear next workout, monochrome hero, nutrition summary, aligned quick log | `features/TodayView.tsx` |
| Measure | Aligned baseline fields, concise activity select, estimate hierarchy, measurement photo | `features/MeasureView.tsx` |
| Plan | Nutrition/Training tabs, accurate week selector, selected-day content, provenance | `features/PlanView.tsx` |
| Progress | Consistent metrics, readable trends and log history, units and empty states | `features/ProgressView.tsx` |
| Appearance/account | Light/Dark/System choice and shared fields/actions | Existing account panel plus milestone-gated routes |
| Exercise/session | Photo reference, prescription cards, compact set editor and timer | New components when session feature is implemented |
| Coach | Consistent conversation layout and honest stream states | Future Coach milestone |
| Form Lab | Labeled reference imagery, permission and uncertainty states | Future local-camera milestone |
| Sync/lifecycle | Pending, conflict, expired auth, export and deletion states | Future offline/account milestones |

For Measure, continue using the existing domain calculation functions. Distinguish baseline estimates from the active plan target. Validate inputs before calculating; show assumptions or a recoverable error instead of a misleading numeric result.

For Plan, read actual payloads and immutable-version metadata. A synthetic plan must retain its provenance; do not label it accepted AI output. Loading, failed reads, missing plans, and persona switches must not leave stale data displayed under a new identity.

For Progress, derive summaries from actual logs and completed sessions. Do not copy screenshot totals into product code. Explain when there are too few observations to show a meaningful trend.

## 9. Future Android adaptation

Use the same semantic roles, hierarchy, imagery, and calendar rules. Choose the native implementation stack separately; these requirements do not mandate a new Android repository now.

- Use dp for geometry and sp for text, with a minimum 48 dp touch target.
- Replace simulated status and gesture bars with actual platform insets.
- Keep actions reachable above navigation and the software keyboard.
- Test 320, 360, and 412 dp references, landscape, enlarged text, and adaptive tablet layouts.
- Use platform date handling consistent with account timezone and ISO local-date keys.
- Preserve drafts and active workouts across recreation and process death.
- Derive elapsed timers from timestamps, not a foreground interval alone.
- Request camera and microphone access at the point of use, with manual alternatives.
- Stop capture on cancellation, exit, and applicable lifecycle transitions.
- Keep queued mutations account-scoped and durable when offline functionality is introduced.

## 10. Implementation sequence

1. **Establish the baseline.** Capture current synthetic views for both personas; record existing logging, calculation, navigation, and reset behavior. Review the corresponding atlas references.
2. **Introduce tokens and primitives.** Add semantic theme variables, the limited type scale, shared actions, fields, cards, and notices. Check representative controls in both modes before migrating all screens.
3. **Replace the application shell.** Introduce responsive navigation through the existing router and preserve the development controls. Retain drafts during navigation.
4. **Migrate existing core views.** Implement Today, Measure, Plan, and Progress using their real repositories and domain functions. Move approved photography into production assets with credits.
5. **Implement calendar behavior.** Add the date model and schedule mapping, selected-day state, accessible tiles, and synchronized content. Handle unavailable dates and persona/version changes explicitly.
6. **Resolve responsive details.** Align field groups and lists; adapt prescription tables separately from compact session tables. Verify narrow widths and enlarged text.
7. **Add later features within their milestones.** Implement supporting screens only when their service and state requirements are available. Use the atlas as the visual target.
8. **Validate and document.** Run appropriate repository gates, inspect representative screenshots, and update the delivery status. Report any intentionally deferred screens and the milestone they depend on.

Each implementation slice should be reviewable and preserve working product behavior. Avoid a single stylesheet rewrite that changes unrelated diagnostics without verification.

## 11. Acceptance criteria

### Visual consistency

- [ ] All ordinary actions share the control typography, reference height, padding, and icon scale.
- [ ] Section titles, item titles, metrics, labels, and captions use their assigned roles.
- [ ] No page-specific size variants are introduced without a functional reason.
- [ ] Both themes use semantic tokens and retain the same geometry.
- [ ] Long content wraps without shrinking controls or hiding labels.

### Dates and plans

- [ ] Weekday names and date numbers are derived from the same date records.
- [ ] Tile labels and numbers align across all seven columns.
- [ ] Selection updates every related heading, date, panel, and summary indicator.
- [ ] Rest-day, no-plan, and loading states cannot show stale selected-day content.
- [ ] Week/month/year boundaries, leap dates, and differing account timezones behave correctly.
- [ ] Synthetic fixed dates are labeled; production dates are not hard-coded to the atlas week.

### Layout and media

- [ ] No page-level horizontal overflow at the reference viewport sizes.
- [ ] Paired inputs align despite wrapped labels or error text.
- [ ] Tables/cards retain readable headers, values, units, and actions.
- [ ] Exercise and measurement areas use the approved photos, with correct crops and fallbacks.
- [ ] No human vector illustrations remain in those areas.
- [ ] Image attribution is retained and loading does not move surrounding controls.

### Behavior and accessibility

- [ ] Existing persona switching, fixture reset, logging, and calculation behavior still works.
- [ ] Theme preference persists; System follows the device preference.
- [ ] Keyboard navigation, visible focus, field labels, and error associations work.
- [ ] Enlarged text and browser zoom do not clip required information or controls.
- [ ] Chart data and camera status have text alternatives.
- [ ] Pending, saved, completed, estimated, and synthetic states are truthful.
- [ ] Future features remain gated by their actual implementation status.

## 12. Verification and evidence

The revised atlas has recorded checks for 216 primary renderings, 648 layout combinations, and 56 calendar selection interactions. See [render evidence](design/docs/qa-results.json) and [alignment evidence](design/docs/alignment-results.json). Those results describe the independent HTML prototype, not the React application or a native Android build.

For production implementation, add meaningful behavioral tests for date mapping, selected-day updates, timezone boundaries, preserved drafts, and calculation validation. Verify shared visual sizing with computed-style or screenshot checks rather than duplicating implementation details in unit tests.

Run the repository quality gate for application changes:

```sh
pnpm check
```

When changing the atlas itself, use the existing regeneration workflow from the project root, with the design preview server available:

```sh
node design/src/build.mjs
node design/src/render.mjs
node design/src/check-layout.mjs
python3 design/src/render-boards.py
pnpm exec biome format design
pnpm exec biome lint design
```

The renderer requires Playwright/Chromium; the contact-sheet script requires Pillow. See the atlas README for tooling and preview configuration.

A completed delivery includes migrated source, retained image credits, updated visual references where needed, passing relevant checks, and a clear list of any future milestone screens. Screenshots alone do not establish functioning persistence, permissions, synchronization, or lifecycle operations.
