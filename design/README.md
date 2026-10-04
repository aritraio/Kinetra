# Kinetra design atlas

A complete monochrome product design proposal for the web application and a future Android app. **54 screen concepts × 2 platforms × 2 themes = 216 mockups.** Every mockup is available as editable HTML and a rendered PNG. These assets do not change the current application.

## Review the designs

From the project root:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

Open [the design atlas](http://127.0.0.1:4175/design/index.html) when serving the project root. If serving from inside `design`, use `http://127.0.0.1:4175/index.html` instead. The preview for this task serves the project root.

Use the left screen list, platform selector, and theme selector. Each screen offers a standalone view and PNG export. Links inside screens follow the same platform and theme. Forms are editable; chips, options, set completion, and day selection demonstrate local UI behavior. Backend actions show a prototype notice. No account operation, AI request, camera capture, microphone recording, or persistence occurs.

- `mockups/web/light/` and `mockups/web/dark/`: 1440 px desktop mockups, with responsive HTML.
- `mockups/android/light/` and `mockups/android/dark/`: 412 dp Android concepts, rendered at 1 px/dp. Each `.png` shows the 412 × 915 viewport; `-scroll.png` companions show all scrollable content.
- `overview-*.jpg`: contact sheets for all four combinations.
- `direction-board.png`: side-by-side light/dark web and Android Today previews.
- `assets/`: local exercise photographs with [source credits](assets/photos/CREDITS.md), plus editable measurement diagrams and charts.
- `src/`: shared source for the atlas, screen content, layouts, and rendering.
- `screen-manifest.json`: complete screen inventory with category and planned project phase.
- `docs/`: rationale, design system, flows, implementation handoff, and verification evidence.

Start with **Today**, then compare **Training → Exercise → Session → Session complete**, **Measure**, **Progress**, and **Form Lab**. The Start and Onboarding groups cover the new-account path. System states cover empty, loading, connection failure, validation, camera denial, and expired authentication.

## Grounded in this repository

The proposal follows [the frozen six destinations](../docs/decisions/0004-scope-governance-and-domain-policy.md), [the roadmap](../docs/PROJECT_PLAN.md), [canonical contracts](../packages/contracts/src/), [calculation code](../packages/domain/src/calculations.ts), and [synthetic persona fixtures](../packages/domain/src/personas.ts).

The current build contains Today, Measure, Plan, Progress, and a developer Foundation/Auth panel. Coach, active training logging, Form Lab, offline outbox, lifecycle controls, and supporting v1 features are future concepts. The Foundation panel stays a development utility; it is not a consumer navigation destination.

Maya’s **source profile is 68 kg, 168 cm, age 28**, with a cut goal, pescatarian diet, and shellfish exclusion. The repository README has some conflicting persona summaries; this proposal uses the typed fixtures rather than those summaries. Every displayed number is illustrative synthetic data. Future generated plans must display real acceptance metadata; a synthetic fixture is never mislabeled as verified AI output.

## Scope

This is a visual and interaction design handoff, not production implementation or Android source. All six product destinations, supporting account flows, and key recovery states have a concrete screen. The HTML adapts to narrow web viewports; Android deliberately uses a different shell and system chrome.

Optional future progress photos and plan sharing are included because the full-v1 roadmap includes them, clearly marked by phase. Social feeds, wearable integrations, food scanning, skincare, and photo-based body-fat claims are excluded.

## Edit and regenerate

Edit `src/screens.js` for content/image placements and `src/styles.css` for shared tokens and layout. Edit `src/app.js` for the product shell and lightweight interactions.

```sh
node design/src/build.mjs
```

Render from a server whose root is the project directory:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

In another terminal at the repository root:

```sh
node design/src/render.mjs
```

Generate the contact sheets with `python3 design/src/render-boards.py` in a Python environment with Pillow.

Rendering requires Playwright and Chromium. The renderer first checks for a local Playwright package, then uses the bundled Codex runtime available on this computer. Set `KINETRA_DESIGN_URL` to override the preview URL. On another machine, install Playwright in your chosen tooling environment and adjust its import if required.

See [design system](docs/DESIGN_SYSTEM.md), [journeys and coverage](docs/FLOWS.md), [implementation handoff](docs/HANDOFF.md), and [verification](docs/QA.md).
