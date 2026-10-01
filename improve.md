# Metria (working name) — API, Stack & Design Migration Blueprint

**Companion to `ideas.improve.md`.** That document covers code quality, security debt and feature
ideas. This one covers the three things you asked about specifically:

1. **AI API provider** — replacing ZenMux, evaluating free/cheap options critically
2. **Tech stack** — replacing vanilla JS with something more impressive and hireable
3. **UI/theme** — replacing the current "Biopunk" design with a genuinely distinctive one

Nothing in the project was modified. This is a design document only.

---

## 0. Executive summary — the honest headline

You asked for a free/cheaper API. **Cost is not actually your problem.**

Estimated real usage for a portfolio deployment (50 active users, heavy usage):

| | Monthly tokens | Approx. cost on Flash-Lite |
|---|---|---|
| Meal plans (1500 in / 1200 out × 50 × 30) | 2.25M in / 1.8M out | $0.17 / $0.54 |
| Workout plans | 1.2M in / 1.35M out | $0.09 / $0.41 |
| Coach chat (3 turns/user/day) | 9M in / 3.6M out | $0.68 / $1.08 |
| Vision scans (2/user/month) | 0.15M in / 0.9M out | $0.01 / $0.27 |
| **Total** | **~12.6M in / ~7.7M out** | **~$0.95 / ~$2.30 → ~$3.25/mo** |

**Your entire AI bill is roughly the price of a coffee.** Even at 10× that traffic it is under
$35/month. Optimising for cost against Gemini is chasing a rounding error.

The problems you will *actually* hit are **availability and reliability**, not price:

- Free tiers publish **no SLA** and cut quotas without notice (Google cut Gemini free-tier quotas
  50–80% in Dec 2025; Cloudflare moved several models to paid-only in July 2026; Groq's RPD for
  `llama-3.3-70b` is 1,000/day and only ~100K tokens/day).
- Your app has a hard dependency: **streaming + structured outputs simultaneously**. That single
  requirement eliminates most of the "free" options (see §1.3).
- A portfolio project lives or dies on its demo working. A 429 during a screen-share is far more
  damaging than $3 of API spend.

**So the correct engineering answer is not "switch to a different provider."** It is:

> **Keep Gemini as the primary lane, and build a provider-abstraction layer with an automatic
> fallback chain + Zod validation + retry.** That is a better resume artifact than any single
> provider swap, and it fixes the reliability problem instead of the cost problem.

That said — there *is* a genuinely better answer for two of your features, and I'll cover it.

---

## 1. AI API Provider Evaluation

### 1.1 What you actually need (the requirements matrix)

Before comparing providers, here is what your app requires, ranked by how hard it is to get:

| # | Requirement | Where | Hardness |
|---|---|---|---|
| R1 | **Structured JSON output** conforming to a strict schema | All 6 generators | 🔴 Critical |
| R2 | **Vision / multimodal image input** (base64 JPEG) | `bodyscan.js`, `skincare.js` | 🔴 Critical |
| R3 | **SSE token streaming** | `coach.js` streaming | 🟠 High |
| R4 | **R1 + R3 simultaneously** (chat with typed data) | Future work | 🔴 Critical, and the killer |
| R5 | 1M context (14-day memory is only ~2K, so this is soft) | `coach.js` | 🟢 Low |
| R6 | Free tier, no card, no SLA | Cost | 🟡 Medium |
| R7 | OpenAI-compatible or clean SDK | Migration ease | 🟢 Low |

### 1.2 The candidates

| Provider | Free tier (verified, 2026) | Card? | Vision | Structured output | Streaming | Structured **+** streaming |
|---|---|---|---|---|---|---|
| **Google Gemini** | Flash/Flash-Lite free; ~15 RPM, 250–1000 RPD depending on tier; project limits vary, check AI Studio | No | ✅ Native, best-in-class | ✅ Native `responseSchema`, all Gemini 2.5+/3.x | ✅ | ✅ **Only one that does both** |
| **Groq** | 30 RPM, 1,000 RPD, ~100K TPD on `llama-3.3-70b`; 14,400 RPD only on small models | No | ✅ `qwen/qwen3.8-27b` (max 3 images) | ✅ `strict: true` on gpt-oss-20b/120b, qwen3.8-27b | ✅ (fastest: 300–1500 tok/s) | ❌ **Docs explicitly: "Streaming and tool use are not currently supported with Structured Outputs"** |
| **Cloudflare Workers AI** | 10,000 neurons/day free (= ~375K input tokens on a 7B), then $0.011/1K | No | ⚠️ LLaVA-class only | ⚠️ JSON Mode — docs warn *"can't guarantee the model responds according to the requested JSON Schema"* | ❌ *"JSON Mode currently doesn't support streaming"* | ❌ |
| **Cerebras** | ⚠️ **Contested** — some sources say permanent free tier at 30 RPM/14.4K RPD, others say it's now a 30-day $5 trial requiring a verified card | Unclear | ❌ | Not documented | ✅ Fastest in existence (~2000 tok/s) | ❌ |
| **OpenRouter (`:free`)** | **20 RPM / 50 RPD** unless you buy ≥$10 credits → then 1000 RPD | No | ⚠️ Varies by model | ⚠️ Provider-dependent | ✅ | ⚠️ |
| **Mistral** | ~1B tokens/month on open-weight models | No (phone verify) | ⚠️ Pixtral paid | ⚠️ JSON mode | ✅ | ⚠️ |
| **Together AI** | `-Free` suffixed models, chat + vision + reasoning + image gen on one key | No | ✅ Llama Vision Free | ⚠️ | ✅ | ⚠️ |
| **NVIDIA NIM** | 40 RPM, 91 free models | No | ⚠️ | ⚠️ | ✅ | ❌ |
| **GitHub Models** | 10–15 RPM, 50–150 RPD | No | ✅ | ⚠️ | ✅ | ⚠️ |
| OpenAI | 3 RPM, GPT-3.5 only on free. **Effectively unusable.** $5 deposit → 500 RPM | Yes | ✅ | ✅ Best-in-class | ✅ | ✅ |
| Anthropic | **No permanent free tier.** ~$5 expiring trial credits | Yes | ✅ | ✅ Tool-use based | ✅ | ⚠️ |

### 1.3 The critical finding — R4 kills the cheap options

This is the single most important technical fact in this document, and it's the reason a naive
provider swap will make your project worse.

**Groq is the obvious "free + fast" choice and it's wrong for your app.** From Groq's own
Structured Outputs docs:

> "Streaming and tool use are **not currently supported** with Structured Outputs."

And in Cloudflare Workers AI's JSON Mode docs:

> "Workers AI **can't guarantee** that the model responds according to the requested JSON Schema…
> an error `JSON Mode couldn't be met` is returned and must be handled."
> "JSON Mode currently **doesn't support streaming**."

Consequences:

- **Your 6 generators** (meal plan, workout split, cheat strategy, body scan, skincare, voice-log
  extraction) *require* strict schema conformance. Groq `strict: true` on gpt-oss works — but
  only 3 models qualify, and no optional fields are allowed (all fields `required`,
  `additionalProperties: false`). That's workable but restrictive, and it locks you to
  constrained-decoding models whose *nutrition* advice quality is meaningfully below Gemini 3.x.
- **Your coach tab** requires streaming. So it can't use structured mode.
- **The moment you want structured + streaming** (e.g. stream a meal plan card-by-card) — Groq
  and Cloudflare both say no. Gemini says yes.

**Conclusion: Gemini is the only free-tier provider that satisfies R1+R2+R3+R4 simultaneously.**
Switching away costs you either streaming, strict schemas, or vision. Every credible blog post
recommending "just use Groq" is solving for a chatbot, not for schema-constrained multimodal
generation.

### 1.4 Recommendation: multi-lane routing, not a provider swap

Build a **provider abstraction layer** in `api/ai/` and route per task class. This is strictly
better than any single provider and it's a strong interview story.

```
api/ai/
  provider.ts        ← interface: { stream(), generate(), generateJson(), visionJson() }
  gemini.ts          ← PRIMARY. vision + strict schemas + streaming
  groq.ts            ← FAST LANE. non-streaming structured tasks, huge token savings
  cloudflare.ts      ← EDGE FALLBACK. 10k neurons/day free
  router.ts          ← health scoring, weighted failover, circuit breaker
  schemas.ts         ← Zod schemas — SINGLE SOURCE OF TRUTH
  budget.ts          ← token accounting, per-user quota, cost telemetry
```

**The routing policy:**

| Task class | Primary | Fallback 1 | Fallback 2 | Why |
|---|---|---|---|---|
| Vision (body scan, skin, photo timeline) | **Gemini** | Groq `qwen3.8-27b` | — | Gemini vision is materially better; no fallback that matches quality |
| Structured generators (6 features) | **Gemini** `responseSchema` | Groq `strict: true` (gpt-oss-120b) | Cloudflare JSON Mode + Zod retry | Gemini quality; Groq is 10× cheaper |
| Coach chat streaming | **Gemini** SSE | Groq plain SSE (no schema) | Cloudflare | Both work; failover on 429 |
| Voice-log extraction | **Groq** | Gemini | — | Tiny output, schema is 4 fields — Groq is ideal and free |
| Long memory context | **Gemini** (1M ctx) | — | — | Only Gemini free |

**Why Groq earns a lane anyway:** structured generation is where your token volume actually
lives. Voice-log extraction and any "parse this into JSON" task is perfect Groq territory — small
outputs, strict schemas, no streaming needed, and 300–1500 tok/s makes it feel instant. Routing
those off Gemini means Gemini's free-tier quota only has to cover vision + chat, which is where
its quality is irreplaceable.

**The circuit breaker matters more than the routing.** Health score per provider:

```ts
interface ProviderHealth {
  consecutiveFailures: number;   // open circuit at 5
  cooldownUntil: number;         // 60s → 300s exponential
  p95LatencyMs: number;          // prefer provider under 1500ms
  tokensUsedToday: number;       // deprioritise near quota
}
```

### 1.5 Free-tier reality check (what to actually promise)

For a portfolio project, the only defensible promise is:

> "Runs free for ~30 daily active users. Beyond that, attach your own key or add a $5 credit."

Design the app so **the free tier is a feature, not an accident**:
- Groq lane absorbs ~60% of request volume (voice + structured + chat fallback) → Gemini quota
  only needs to cover vision.
- Cache aggressively. Meal/workout plans are deterministic given a profile — cache by a hash of
  `(profile, goal, macros, pantry, templateVersion)`. Repeat generations become free.
- Per-user daily quota with a visible counter. "3 generations left today, resets at 00:00 UTC" is
  honest product design and demos well.
- Prompt caching where available; keep system prompts stable so providers can cache them.

### 1.6 What to remove regardless

- **ZenMux** entirely — it was a compatibility shim for a provider you no longer want. Delete
  `normalizeGeminiModel()`'s alias table (`gpt-4o-mini`, `haiku`, `sonnet`, `pro`…).
- **The client-supplied API key path** (`api/chat.js:257`). This is a security hole *and* it means
  any user can drain your key. Non-negotiable.
- **`Access-Control-Allow-Origin: *`** on authenticated endpoints.
- The `model select` dropdown in the header — replace with the router (let the user pick
  "Fast / Balanced / Best quality" which maps to *lanes*, not model names).

### 1.7 Verdict table

| Option | Cost | Reliability | Meets R1–R4 | Verdict |
|---|---|---|---|---|
| **Multi-lane router (recommended)** | $0–5/mo | **High** (failover) | ✅ | ✅✅✅ **Ship this** |
| Gemini only (status quo) | $0–3/mo | Medium | ✅ | ✅ Acceptable, but leaves reliability on the table |
| Groq only | $0 | High for speed | ❌ no schema+stream | ❌ Rejected |
| Cloudflare only | ~$0 | Medium | ❌ no guarantee, no stream | ❌ Rejected |
| OpenRouter free | $0 | Low (50 RPD) | ⚠️ | ❌ Rejected for primary |
| OpenAI | ~$10-40/mo | High | ✅ | ✅ Best if you later have budget |
| Anthropic | ~$15-50/mo | High | ✅ | ✅ Best quality for nutrition |

**Bottom line:** Keep Gemini. Add Groq as a cost/rate-limit offload lane with automatic failover.
Build the router. That is the answer.

---

## 2. Tech Stack Migration

### 2.1 Why change at all

Your honest self-assessment in `ideas.improve.md` §2 was right: vanilla JS with 123 `window.*`
exports is impressive in a demo and exposed in a code review. Reviewers at most companies *don't
write vanilla JS*. Switching is about signalling, not capability.

### 2.2 The one hard constraint first

**Do not throw away working logic.** Of your 4,098 lines of browser JS, roughly **900 lines are
genuinely valuable and framework-agnostic**:

- `calc.js` (47) — BMR/TDEE/macros/timeline. Pure. Port verbatim, add types.
- `device.js` (166) — pure `resolveDeviceType()`. Port verbatim.
- `offline.js` (255) — IndexedDB queue + sync. Port the *logic*, replace the UI wiring.
- `camera.js` (96) — `getUserMedia` + canvas → JPEG. Port with a thin React hook.
- `api.js` (260) — SSE reader. Port as a typed fetch wrapper.
- The 6 `responseSchema` definitions — **rewrite as Zod**, keep them as the source of truth.
- Supabase SQL schema + serverless functions — keep entirely.

Everything else (`onboarding.js` 568, `progress.js` 518, `styles.css` 2379, the `window.*` export
blocks) is framework-coupled and should be rewritten, not ported. **Budget for a rewrite, not a
migration.**

### 2.3 Recommended stack

```
FRAMEWORK      React 19 + TypeScript (strict, no `any`)
BUILD          Vite 8 (Rolldown) — SPA, not Next.js. See 2.4.
ROUTING        TanStack Router       — fully typed params + search + loaders
SERVER STATE   TanStack Query v5     — caching, optimistic updates, dedup
CLIENT STATE   Zustand               — only for genuinely global UI state
UI             Tailwind CSS v4 + custom tokens (NOT default shadcn — see §3.5)
FORMS          React Hook Form + Zod
VALIDATION     Zod v4 at EVERY boundary (env, API response, AI output, forms)
API LAYER      tRPC v11  — end-to-end types, no OpenAPI codegen drift
SERVER         Hono on Vercel (or Cloudflare Workers) — replaces `api/*.js`
DB             Supabase Postgres + Drizzle ORM (typed queries, real migrations)
AUTH           Supabase Auth (drop Clerk) OR keep Clerk — see 2.5
TESTING        Vitest + React Testing Library + MSW + Playwright
LINT/FORMAT    Biome (fast) or oxlint+oxfmt
CI             GitHub Actions: lint → typecheck → test → e2e → preview → deploy
MONOREPO       pnpm workspaces + Turborepo
```

### 2.4 Why not Next.js

Your app is 100% behind auth, entirely a dashboard/consumer SPA with a serverless API. Next.js
App Router adds server components, RSC hydration boundaries, a build step and a whole category of
mental overhead for **zero benefit** here. Vite 8 + React + TanStack Router gives you:
- Sub-10s production builds (Rolldown)
- `vercel.json` → static build + serverless functions
- A simpler mental model you can explain in an interview

Choose Next.js only if you add public marketing pages, SEO, or SSR-heavy content. You don't have
those yet. (If you add a landing page later, put it on the same Vite app or a separate static
site — don't merge them.)

### 2.5 Why drop Clerk

Clerk is genuinely good, but:
- The vendored Clerk `<script>` via CDN is a **single point of failure** — you already wrote a
  5-case fallback chain with an 8-second timeout because of it. That's a smell.
- Custom theming requires fighting their CSS.
- Supabase Auth gives you email+password, magic link, and **OAuth for free**, is one fewer vendor,
  and integrates natively with your existing Supabase DB and RLS policies.
- You already have a Supabase service-role key on the server; adding Clerk means a second auth
  system to keep consistent.

Keep Clerk **only if** you want social login breadth you can't get elsewhere. Otherwise
Supabase Auth. This also removes ~400 lines of `auth.js` fallback code.

### 2.6 The Zod decision — this is the important one

Your 6 `responseSchema` objects are hand-written JSON Schema, and the renderers that consume them
are completely untyped. **Replace every schema with a Zod schema as the single source of truth:**

```ts
// schemas.ts — one definition, generates everything
export const MealPlanSchema = z.object({
  days: z.array(z.object({
    day: z.string(),
    meals: z.array(z.object({
      name: z.string().max(80),
      kcal: z.number().int().min(0).max(5000),
      macros: z.object({
        protein: z.number().int().min(0),
        carbs: z.number().int().min(0),
        fat: z.number().int().min(0),
      }),
      items: z.array(z.string().min(1).max(120)).max(20),
      tip: z.string().max(280).optional(),
    })).length(4),
  })).length(7),
}).strict();

export type MealPlan = z.infer<typeof MealPlanSchema>;
```

You get, for free:
- `z.toJSONSchema()` → the Gemini `responseSchema` payload (no hand-maintained duplicate)
- `type MealPlan` → the renderer's input type (TypeScript now checks the renderer)
- **Runtime validation of every model response** → this is the fix for the unsanitised-output
  bugs (`cheat.js`, `skincare.js`, `bodyscan.js`) because a malicious `<script>` in `meal.name`
  fails `.max(80)` or `.strict()` and gets rejected before it reaches `innerHTML`
- `.brand()` → Zod's branded types for IDs
- Testable with `fuzz()` — property-based testing on untrusted model output

Add `xss` escaping *still*, but now you have defence in depth instead of relying on remembering
to call `sanitize()`.

### 2.7 Suggested directory structure

```
apps/
  web/                        # React 19 + Vite SPA
    src/
      app/                    # router, providers, layout
      routes/                 # file-based (TanStack Router)
        onboarding/           # 6-step wizard as a state machine
        dashboard/
          overview/  nutrition/  training/  form-lab/
          coach/  progress/  timeline/
      features/               # vertical slices, each self-contained
        meal-plan/
          api.ts  schema.ts  components/  hooks/
      components/ui/          # your own primitives, themed
      lib/                    # pure logic — ported from vanilla
        calc.ts  device.ts  offline/  camera/  sse.ts
      server/                 # tRPC routers, typed
      styles/theme.css        # Tailwind v4 @theme tokens
  api/                        # Hono serverless
    src/routes/  ai/  db/  middleware/
packages/
  db/                         # Drizzle schema + migrations
  ui/                         # shared design-system components
  config/                     # shared tsconfig, eslint, vitest
```

### 2.8 What this buys you on a resume

| Signal | Why interviewers care |
|---|---|
| TypeScript `strict`, zero `any`, tRPC end-to-end types | "How do you prevent type drift across an API boundary?" — the #1 question |
| Zod at every trust boundary | Shows you know LLM output is **untrusted input**, not data |
| TanStack Query + optimistic updates + IndexedDB sync | Real offline-first engineering, provably |
| Playwright E2E | You can prove it works |
| pnpm monorepo + Biome + full CI | Professional engineering hygiene |
| Drizzle migrations | You know databases, not just JSON blobs |

**Do this migration in one focused 2–3 week push**, not incrementally. A half-migrated codebase
is worse than either endpoint — it's two architectures with neither's coherence.

---

## 3. UI / Theme Redesign

### 3.1 Diagnosing the current design

Your theme is described in your own code as **"Biopunk"** — dark base `#080c0f`, ambient glow
orbs, neon accents, pulse/spin animations. Honest assessment:

**What works:** the dark base is genuinely nice, your a11y work (ARIA tablist, live regions,
reduced-motion) is well ahead of most projects, and you built real SVG components (BMI gauge,
score rings) instead of pulling in a chart library for everything.

**What's wrong:**
- **Glow orbs + neon on near-black is the dominant aesthetic of AI-generated health apps in 2024–25.** It is now the fingerprint. It reads as "template," not "designed."
- Gradient-on-dark + pulse animations is exactly the "look busy without adding information" failure mode.
- Your 2,379-line `styles.css` means every change is a global-risk edit — no tokens, no cascade layers, no scoping discipline.
- No type system. 40+ CSS custom properties and no fluid scale means no typographic hierarchy.
- The design changes nothing about the *information design*. Ten tabs, all peers, no hierarchy telling the user what matters today.

### 3.2 First: what actually differentiates this app

Design should express the product. What's unique about Metria?

1. **It's an instrument, not a feed.** It measures you precisely — BMI, BMR, TDEE, macro split, weight trajectory, rep tempo.
2. **Precision over vibes.** Mifflin–St Jeor, projected completion dates, week-by-week milestones.
3. **It works in a basement gym with no signal.** Offline-first is a real constraint, not a feature checkbox.
4. **It's evidence-based.** Schema-validated output, computed targets, form analysis.
5. **The data is personal and sensitive.** Body photos, weight, skin analysis.

That points to: **clinical instrumentation × editorial typography.** A lab instrument crossed
with a well-set scientific journal — not a neon dashboard.

### 3.3 Direction A — "Clinical Instrument" ⭐ *recommended*

**Reference points:** Braun/Dieter Rams, lab equipment, Swiss technical documentation, *Nature*
figure plates, Things/Linear restraint, terminal-adjacent monospace numerics.

**Concept:** Near-monochrome. Structure communicated through **hairline rules and typographic
hierarchy**, not boxes. Exactly one accent colour, used only for "measurement" and "action."
Numbers are set in a mono face with tabular figures so columns align like an instrument readout.
Massive asymmetry — a dominant data region and a narrow annotation rail, like a figure plate.

**Why it works:** your product *is* measurement. This theme makes measurement the aesthetic. It
is the opposite of the neon-glow default, so it will read as designed by a person. And critically:
hairline rules and mono numerals are **more** accessible than glowing cards, not less.

**Palette — deliberately non-Tailwind:**

```css
@theme {
  /* Surfaces: warm-neutral greys, not blue-slate. This is the single
     most important choice — it breaks the slate-900 fingerprint instantly. */
  --color-surface-0:  oklch(17% 0.004 60);   /* #1a1a19 — warm near-black */
  --color-surface-1:  oklch(21% 0.004 60);
  --color-surface-2:  oklch(26% 0.005 60);
  --color-raised:    oklch(30% 0.005 60);

  /* Ink */
  --color-ink-1:     oklch(96% 0.004 60);   /* primary text */
  --color-ink-2:     oklch(74% 0.004 60);   /* secondary */
  --color-ink-3:     oklch(56% 0.004 60);   /* tertiary / axis labels */

  /* Hairlines — do the work that borders and shadows used to do */
  --color-rule:      oklch(32% 0.005 60);
  --color-rule-firm: oklch(45% 0.005 60);

  /* ONE accent. Not blue, not purple, not Tailwind green.
     Oxide orange: instrument-panel, high-contrast, unmistakable. */
  --color-accent:      oklch(68% 0.16 45);   /* #d2622f */
  --color-accent-dim:  oklch(52% 0.13 45);
  --color-accent-ink:  oklch(98% 0.01 45);   /* text on accent */

  /* Semantic: desaturated, never neon */
  --color-positive: oklch(62% 0.11 150);
  --color-warning:  oklch(72% 0.13 85);
  --color-critical: oklch(58% 0.16 25);
}
```

**Typography:**

| Role | Face | Rationale |
|---|---|---|
| Display / headings | **Newsreader** or **Instrument Serif** | Editorial, warm, unmistakably not Inter/Geist |
| Body / UI | **Public Sans** or **Archivo** | Neutral grotesque with character; free |
| Numerals / labels | **JetBrains Mono** or **IBM Plex Mono** | Tabular figures, instrument readout, axis labels |
| Optional accent display | **Departure Mono** (free) | For the wordmark only |

Fluid scale with `clamp()` — 5 steps, not 14:

```css
--text-micro:  clamp(0.6875rem, 0.64rem + 0.2vw,  0.75rem);   /* axis labels */
--text-body:   clamp(0.9375rem, 0.90rem + 0.2vw,  1.0625rem);
--text-lead:   clamp(1.125rem, 1.05rem + 0.4vw,  1.3125rem);
--text-title:  clamp(1.75rem, 1.4rem + 1.6vw,    3rem);
--text-display:clamp(2.75rem, 1.8rem + 4vw,      5.5rem);
```

Always set numerics with `font-variant-numeric: tabular-nums` — this single property makes charts,
tables and stat readouts feel like an instrument instead of a website.

**Layout — "figure plate":**

```
┌──────────────────────────────────────────────────────────────┐
│  METRIA          ·  week 6 of 14  ·        ◷ 04:12  ⌘K     │  48px rail, hairline under
├───────────────────────────────────────┬──────────────────────┤
│                                       │  ANNOTATION          │
│   DOMINANT DATA REGION                │  ─────────────       │
│   (chart / gauge / form overlay)       │  BMR      1,842 kcal │
│                                       │  TDEE     2,209 kcal │
│   Renders live, no card border,        │  Target   1,459 kcal │
│   hairline axes only                   │  Δ          −750     │
│                                       │                      │
│                                       │  ▸ next action       │
│                                       │    Lower session B    │
│                                       │    estimated −340 kcal│
├───────────────────────────────────────┴──────────────────────┤
│  ring  ring  ring   ← weight, water, adherence                │  64px, mono labels
└──────────────────────────────────────────────────────────────┘
```

Mobile: annotation rail collapses to a single summary line under the data region. **No bento grid** —
a bento of identical stat tiles is exactly the slop pattern; and this product has a hierarchy
(one thing matters *today*) that bento's equal-weight cells actively destroy.

**Radius & shadow — rules, not vibes:**

```css
--radius-none: 0;      /* data cells, tables, panels */
--radius-sm:   2px;    /* inputs, buttons */
--radius-pill: 999px;  /* progress arcs, chips ONLY */
--shadow-none: none;   /* the default. No drop shadows. */
```

Depth comes from **one** elevation: `surface-2` background + `--color-rule` hairline. No
`shadow-md`, no `shadow-lg`, no `backdrop-blur` over a solid colour (a filter that costs a compositing
layer and does literally nothing). This one rule alone removes the single strongest slop signal.

**Motion — purposeful only:**

```css
/* Only three motion patterns in the entire app. */
--ease-instrument: cubic-bezier(0.2, 0, 0, 1);   /* 180ms — state changes */
--ease-settle:     cubic-bezier(0.16, 1, 0.3, 1); /* 420ms — data transitions */

@keyframes value-tick {          /* numbers counting to new value */
  from { opacity: 0.35; }
  to   { opacity: 1; }
}
@keyframes scan-line {            /* for live camera/form capture */
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(400%); }
}
@keyframes ring-draw {            /* stroke-dashoffset draw-on */
  from { stroke-dashoffset: var(--circ); }
  to   { stroke-dashoffset: var(--target); }
}
```

No Framer Motion dependency. CSS handles these. Motion must *mean* something: a value changed, a
capture is live, a metric completed. Every other animation is removed. `prefers-reduced-motion`
collapses all three to opacity-only.

**Signature texture (optional, subtle):** a 1–2% opacity film-grain or dot-grid overlay on
`surface-0`, plus a very faint horizontal scanline on the camera view. It signals "instrument"
without touching contrast. Keep it under content, never over text.

### 3.4 Direction B — "Warm Paper"

**Reference points:** Kinfolk, editorial print, Dieter Rams Braun packaging, letterpress.

Cream paper (`oklch(94% 0.012 85)`) with ink-black type, one oxblood or forest accent. Serif
headings (Newsreader), oldstyle figures for prose, tabular mono for data. Hairline rules, generous
margins, wide leading. Dark mode inverted to ink-on-charcoal with paper-tinted accents.

**Best for:** if your target audience is readers/writers rather than gym-goers. Reads as considered
and premium. **Weakness:** fitness apps need high-energy data legibility; a quiet paper aesthetic
can feel low-contrast on a phone at the gym, and it's harder to make "streaks" and "PRs" feel
exciting.

### 3.5 Direction C — "Terminal / Monospace"

Full monospace UI. Phosphor-green or amber on near-black. `┌─┐│└┘` box drawing. ASCII progress bars.
Feels like a hacker's `htop`.

**Pros:** extremely distinctive, free to implement, zero image assets, and it pairs well with a
"CLI for your body" narrative. **Cons:** reads as a joke in a health context; hurts readability of
long nutrition text and numeric tables; poor for photo-heavy features; easy to look gimmicky rather
than designed.

Use it only if you lean fully into the developer-tool aesthetic — **and only if** you have the
taste to get spacing and hierarchy exactly right. High risk, moderate reward.

### 3.6 Do NOT ship these (2026 AI-slop fingerprint)

These specific patterns are now statistically detectable and read as "generated":

| ✗ Avoid | ✓ Do instead |
|---|---|
| `Inter` / `Geist` body text | Newsreader, Public Sans, Archivo, or any serif-adjacent choice |
| `#3b82f6` / `#8b5cf6` blue-purple | Oxide orange `#d2622f`, oxblood, oxide teal, or phosphor amber |
| `bg-gradient-to-br from-x-900 to-x-800` | Flat `surface-1`. One hairline. |
| `rounded-2xl` on every surface | `radius-none` for structure, `2px` for controls |
| `shadow-md` / `shadow-lg` cards | Elevation via surface tone + hairline |
| `backdrop-blur` over a solid bg | Only blur over *actual* content behind |
| Identical bento cells | Asymmetric figure-plate layout (Direction A) |
| Lucide `Sparkles`/`Zap`/`Shield` as decoration | One consistent icon set, used only where they carry meaning |
| Centered hero → 3-col features → logo wall → testimonials → pricing | Break the section sequence entirely |
| "Transform your X" copy | Specific, concrete language: "BMR → TDEE → 750 kcal deficit, recomputed daily" |

Note this cuts both ways: **Tailwind and shadcn are fine tools, but shipping their unmodified
defaults *is* the tell.** Rewrite the theme tokens, change the radius scale, replace the font stack.
shadcn is a starting point, not a destination.

### 3.7 Information design — the part that actually improves the product

The redesign should not be cosmetic. Restructure navigation around priority, not parity:

- **Today** (default landing) — one number that matters most (weight trend, or adherence), one
  recommended action, one primary CTA. Everything else below the fold.
- **Measure** — BMI gauge, BMR/TDEE/target readout, macro split, weight chart, habit heatmap.
- **Plan** — meal plan + workout split, pinnable, versioned with diffs.
- **Coach** — streaming conversation with your history visible as context.
- **Form Lab** — camera capture, landmark overlay, rep-by-rep form scoring, tempo curve.
- **Progress** — photos timeline, milestones, streaks, export.

That's **6 destinations, not 10 peers.** It also gives you fewer, deeper routes — better for both
design and for the interview story.

---

## 4. Putting It Together

### 4.1 Target architecture

```
┌────────────────────────────────────────────────────────────────┐
│  React 19 SPA (Vite 8, TS strict, Tailwind v4 custom tokens)    │
│  TanStack Router · TanStack Query · Zustand · RHF+Zod           │
│  Dexie (IndexedDB) · MediaPipe Pose · Web Speech · Workbox      │
└───────────────────────────┬────────────────────────────────────┘
                            │ tRPC (typed, end-to-end)
┌───────────────────────────▼────────────────────────────────────┐
│  Hono serverless (Vercel Edge)                                 │
│  /api/ai/*     → Provider Router (Gemini ⇄ Groq ⇄ CF)         │
│                  + Zod validation + SSE + circuit breaker       │
│  /api/logs/*   → Supabase (Drizzle) + RLS                      │
│  /api/profile/*→ Supabase + Storage (photos, not base64 JSONB)  │
│  /api/plans/*  → versioned, pinnable                           │
│  middleware     → Supabase Auth JWT, rate limit (atomic RPC)    │
└───────────────────────────┬────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Supabase          Groq (free)          Cloudflare
   Postgres+RLS      OpenAI-compatible    Workers AI
   + Storage         30 RPM/1K RPD         10K neurons/day
   + Auth
                            │
                            ▼
                    Google AI Studio
                    Gemini 3.x Flash
                    (vision + strict
                     schemas + streaming)
```

### 4.2 Phased plan

**Phase 1 — Foundations (week 1).** Fix P0 security. Add TypeScript config, Biome, Zod. Port the
900 lines of pure logic (`calc`, `device`, `offline`, `camera`, `sse`) into `apps/web/src/lib` with
full types and tests. *Deliverable: typed pure core, zero behaviour change.*

**Phase 2 — Stack (weeks 2–4).** Scaffold pnpm monorepo + Vite 8 + React 19 + TS strict. Port
`calc.ts`/`device.ts` to TS with tests passing. Swap Clerk → Supabase Auth. Migrate IndexedDB to
Dexie. Migrate SQL to Drizzle with real migrations. *Deliverable: 100% typed data layer, migration-tested.*

**Phase 3 — API layer (weeks 4–5).** Replace `api/*.js` with Hono. Build the provider router with
Gemini/Groq/Cloudflare adapters, circuit breaker, retry+backoff, token budget accounting.
Convert all 6 schemas to Zod as single source of truth. Atomic rate limiter via Postgres RPC.
*Deliverable: `tsc --noEmit` clean, Zod-validated every AI response.*

**Phase 4 — UI (weeks 5–8).** Tailwind v4 `@theme` tokens per Direction A. Build the figure-plate
layout and the 6-route information architecture. Rebuild all 10 tabs as vertical slices. Hand-rolled
instrument components (gauge, rings, heatmap, form overlay). Playwright E2E for the 6 critical paths.
*Deliverable: the design you actually wanted.*

**Phase 5 — Real features (weeks 8–11).** MediaPipe Pose Landmarker → posture metrics + squat form
scorer + tempo curve. Replace the fake "body scan" with it and rename to **Form Lab**. Versioned
plannable plans with diffs. Photo timeline with comparison slider. Conflict-resolved offline sync.
*Deliverable: features nobody can dismiss as fake.*

**Phase 6 — Ship (weeks 11–13).** Full CI. Lighthouse + axe in CI. Live URL + custom domain. README
rewrite with architecture diagram, eval scores, 2×30s screen recordings. Deploy previews on PR.
*Deliverable: the thing you put in your portfolio.*

### 4.3 What to cut

| Cut | Why |
|---|---|
| The 3 SKIN-related concerns (skincare tab, some onboarding) | Weakest feature-to-effort ratio; Form Lab supersedes the "photo analysis" idea honestly |
| The model-select dropdown | The router handles it; exposing model names is 2024 thinking |
| Neon glow orbs, pulse/spin keyframes | Replaced by the instrument aesthetic |
| `window.*` entirely | The whole point of Phase 2 |
| `css/desktop.css` dead rules | No markup ever emits those classes |

---

## 5. Naming (updated for the new direction)

From `ideas.improve.md` §6, unchanged by this migration — the design direction reinforces the same
conclusion: a name that describes the *instrument* quality, not the regional personality.

**Recommended: `Metria`** — metrics + metre. Sounds like infrastructure. Spells and says well over
a phone. Works for the clinical-instrument aesthetic.

Alternatives: `Kinetiq` (motion/adaptation), `Forme` (evokes exercise *form*, which is your killer
feature), `Ascend`, `Baseline` (from fitness programming).

Keep **Baba** as a character/subtitle if you want the warmth — `Metria, by FitnessBaba`. Don't
lead with it.

Design-system naming follows: colour tokens `surface-*` / `ink-*` / `rule` / `accent` are already
theme-agnostic, which is what you want if you ever ship a second theme.

---

## 6. Scorecard

| Dimension | Now | After AI router | After stack rewrite | After redesign |
|---|---|---|---|---|
| AI reliability | 4/10 | **9/10** | 9/10 | 9/10 |
| AI cost efficiency | 6/10 | **9/10** | 9/10 | 9/10 |
| Type safety | 1/10 | 7/10 | **9.5/10** | 9.5/10 |
| Architecture | 4/10 | 6/10 | **9/10** | 9/10 |
| Design distinctiveness | 3/10 | 3/10 | 3/10 | **9/10** |
| Accessibility | 8/10 | 8/10 | **9/10** | **9.5/10** |
| Hireable-signal stack | 3/10 | 5/10 | **9.5/10** | 9.5/10 |
| Feature credibility | 6/10 | 6/10 | 7/10 | **9/10** (Form Lab) |
| **Resume / job-search value** | **6.5 / 10** | **7.5 / 10** | **8.5 / 10** | **9.5 / 10** |

### The three sentences that get you hired

After this work, your README opens with something like:

> **Metria** — a clinical-instrument fitness engine. React 19 + TypeScript strict + Hono
> serverless, Supabase Postgres with RLS, offline-first PWA, and a multi-provider AI layer
> (Gemini for vision + structured outputs, Groq for low-latency extraction) with Zod validation at
> every trust boundary, automatic provider failover, and MediaPipe pose estimation for real-time
> squat form scoring.

Every clause in that is a technical claim you can defend in an interview. That is what moves you
from 6.5 to 9.5.

---

## 7. The honest pushback

Three things in this plan are more work than they look:

1. **The rewrite is 2–3 weeks of full-time work, not a weekend.** `onboarding.js` (568 lines,
   6 steps, 15 validators) and `progress.js` (518 lines, 4 concerns) are UI-coupled and will be
   rebuilt, not moved. Budget for it properly or don't start.
2. **The router is more valuable than the rewrite.** If you only have two weeks, spend it on the
   Zod schemas + provider router + P0 security fixes. That alone is 6.5 → 7.5. The stack rewrite
   is 7.5 → 8.5. The redesign is 8.5 → 9.5. **The ordering matters — do them in that order.**
3. **Don't switch away from Gemini for cost reasons.** You would be trading away schema guarantees,
   vision quality and streaming to save about $3 a month, and you'd likely pay again in Groq's
   paid tier once free limits bite. Route across providers for *reliability*, keep Gemini as the
   quality lane, and let Groq absorb the cheap high-volume work.

Ship Phase 1 and Phase 3 first. They are the highest value-per-hour and the lowest risk.