# Implementation handoff

## Web application

Use the existing React/Vite architecture. Bring semantic tokens into the existing stylesheet before replacing individual views. Keep data behind the current repository boundary; these prototype scripts are intentionally independent of the product runtime and should not be copied wholesale into React.

Suggested component mapping:

| Prototype component | Production component | Contract/source |
| --- | --- | --- |
| Shell, sidebar, topbar | AppShell, DestinationNav, SyncIndicator | Six frozen destinations |
| Cards, fields, actions | Surface, Field, Button, Notice | Shared accessible primitives |
| Today hero | NextWorkoutCard | Selected workout plan + session state |
| Nutrition ring/macros | NutritionSummary | Daily log vs accepted target |
| Daily log fields | DailyLogForm | `logUpdateSchema` |
| Measure baseline | MeasurementForm, EstimateDetails | `profileSchema`, domain calculations |
| Plan tabs/versions | PlanViewer, PlanVersionList | Plan payload and immutable version records |
| Workout rows | ExercisePrescription, MovementGuide | Exercise catalog and workout prescription |
| Set table/timer | ActiveSession, SetEditor, RestTimer | Training session and set schemas |
| Coach conversation | CoachThread, StreamStatus, CitationList | Coach stream event union |
| Form Lab camera | LocalCapture, LandmarkOverlay, ConfidenceNotice | P7 supported squat policy |
| Sync comparison | OutboxStatus, RevisionConflictDialog | Owner-scoped queue + base revision |
| Voice review | VoiceCapture, ExtractionReview | Discriminated voice payload |
| Privacy panels | ConsentControls, ExportJob, DeletionFlow | Consent purposes and lifecycle jobs |

Implement in dependency order: shared primitives and theme → progressive onboarding → Today/Measure/Plan/Progress → active workout → offline and lifecycle controls → Coach/Form Lab/voice and optional full-v1 features. Do not use a screen’s existence as permission to bypass its backend milestone gate.

The source mockups navigate between separate HTML pages. Production routes should use the existing router and preserve drafts while navigating. A clickthrough destination often depicts an end state; production must wait for actual acknowledged operations before showing the corresponding success screen.

## Future Android app

Reuse the product concepts, semantic tokens, API contracts, and verification boundaries. Native rendering is a separate implementation decision. A Compose implementation can map cards, fields, notices, and bottom navigation directly, while preserving the underlying behavior.

- Translate reference pixels to dp for layout, sp for type. The 412 dp screenshots are reference canvases, not hard-coded device dimensions.
- Use platform safe areas and actual system status/gesture insets; do not copy the simulated 9:41 chrome into app content.
- Use adaptive layout for tablets/foldables. A navigation rail can expose the six destinations where space permits.
- Scale touch bounds to at least the proposal’s 48 dp target. Test text scaling and small devices before finalizing geometry.
- Preserve an active workout draft across process death. A session timer follows timestamps rather than a fragile foreground interval.
- Request camera/microphone permission at use time. Release capture on exit, lifecycle stop, cancellation, and denial.
- Native reminders need permission and delivery semantics; the web in-app reminder promise should not be reused for native scheduling.
- Use an account-scoped durable queue with mutation IDs and revisions. An Android background worker is an implementation option, not an existing project feature.
- Keep Form Lab camera processing local. Server verification is still mandatory for AI-generated plans on every client.

## Copy and state rules

1. **Numbers mean what they say.** A planned workout does not count as complete. Targets are estimates; measurements and logged values have units. Use data-derived totals in the product.
2. **Provenance stays visible.** A fixture says synthetic. An accepted generated plan says accepted only when server metadata supports it. Template and repaired plans identify their origin.
3. **Failure preserves useful work.** Keep prior plans, draft inputs, completed sets, and pending writes. Offer a specific next action.
4. **One action does one thing.** Saving locally and syncing are separate visible facts. Generation and acceptance are separate phases. Confirmation precedes voice extraction saves.
5. **Scope-sensitive privacy.** Plan shares expose one immutable version; photos require separate consent; local camera access is independent of storage consent.
6. **Honest uncertainty.** Low-confidence tracking hides numeric feedback. Charts with too few values explain why no trend is shown. No diagnostic or photo-based body-fat claims.

## Interaction acceptance before production

- Every primary route is keyboard navigable, with visible focus and correct heading order.
- Form errors link to fields, announce a summary, and preserve other values.
- Authentication and onboarding work without a camera permission request.
- The selected theme survives restart according to user preference, with a complete system-theme option.
- Manual logging works when microphone capture is unsupported.
- A workout interrupted by backgrounding retains completed sets and a truthful elapsed timer.
- Rejected generation cannot overwrite the last accepted plan.
- Offline logs replay once; conflicts retain both revisions until resolved.
- Sign-out/account switching cannot leak one account’s data or replay its queue into another account.
- Camera resources stop on every exit; uncertain feedback never looks precise.
- Export and deletion success states reflect actual completed jobs.
- Mobile layouts withstand 320 px web width and Android accessibility text scaling; scrollable screens keep actions reachable above platform insets.

## Explicit prototype limits

No persistence, service calls, AI generation, native permissions, live pose estimation, speech capture, timers, or lifecycle jobs are implemented in this design folder. Local selection and set-completion interactions demonstrate visual behavior only. Locally stored Pexels photographs illustrate exercise guides and Form Lab previews. They are labeled as stock references and never represent actual camera input. Dialog examples are represented as full screens/panels; production needs correct dialog focus management.
