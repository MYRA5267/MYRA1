# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MYRA is a React music-streaming app with an entirely optional Supabase backend: it must always work as a fully local/offline demo with zero configuration, and gain real accounts, uploads, social features, donations, and payments only when Supabase (and a few other services) are configured. The same web build is repackaged for Android/iOS (Capacitor), desktop (Electron; Tauri CLI is also present), and deployed to GitHub Pages.

## Commands

- `pnpm install` — install dependencies (pnpm, not npm/yarn — `pnpm-lock.yaml` is the source of truth)
- `pnpm dev` — Vite dev server
- `pnpm build` — production build to `dist/`
- `pnpm typecheck` — `tsc --noEmit` (strict mode; `noUnusedLocals`/`noUnusedParameters` are off)
- `pnpm preview` — serve the built `dist/` locally
- `pnpm electron:dev` / `pnpm electron:build` — Electron shell around the same `dist/`

There is no automated test suite in this repo (no `test` script, no test files). Verification is `pnpm typecheck` + `pnpm build` plus manual or Playwright-driven smoke testing against `pnpm dev`.

## Architecture

### Everything lives in flat files under `src/app/`, not folders

There's no `components/`/`features/` subdivision. Each file is a large, self-contained concern:

- `App.tsx` — root state machine: all top-level state (session, current track/queue, tab, every sheet's open/closed state) and the screen router live here.
- `screens.tsx` — the main screens: Home, Browse, Library, Creator, Profile sit on the bottom nav (`NAV` in `player.tsx`; `Creator`/`Студия` only shows for artists, see `navItems()`), plus `Rating` which is reached from a Home-screen shortcut rather than the nav bar itself.
- `overlays.tsx` — every bottom sheet/modal (donate, subscriptions, artist profiles, people search, support chat, etc.) — the largest file in the app.
- `player.tsx` — the full-screen player (`FullPlayer`), `FrequencyOrb` visualizer, `ParticleWave` scrubber.
- `lib.tsx` — shared UI primitives and constants: `THEMES`, `ThemeCtx`, `GLASS`, `F` (font stacks), `SPRING`, `Sheet`, `Waveform`, `EQ`, `isWeakEnvironment()`.
- `data.ts` — the static demo catalog (`TRACKS`, `ARTISTS`, `CHARTS`, `PLAYLISTS`) and the `ls` localStorage helper.
- `i18n.tsx` — hand-rolled ru/en dictionary and `LangProvider`/`useLang()` — no external i18n library.
- `auth.tsx` — onboarding + login/signup flow.
- `dev.tsx` — developer panel (eruda console toggle), admin support inbox, content-moderation queue.
- `supabase.ts` / `sentry.ts` — see below.
- `rooms.ts` / `roomSheet.tsx` — Realtime listening rooms.
- `stats.ts`, `smart.ts`, `achievements.ts`, `structure.ts`, `syncQueue.ts`, `idb.ts` — listening stats/XP/revenue-split math, the recommendation engine, achievements, track-structure annotations, the offline-operation retry queue, and an IndexedDB wrapper for locally-stored tracks, respectively.

### The optional-backend pattern

`src/app/supabase.ts` is the **only** file that imports `@supabase/supabase-js`. It computes `supabase`/`supabaseEnabled` once at module load from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, wrapped in try/catch (a malformed or missing env var must never throw at module-load time — that previously caused a white screen before React even mounted). Every exported helper in that file begins with `if (!supabaseEnabled || !supabase) return <safe no-op>`. Callers elsewhere must go through these helpers — never import `@supabase/supabase-js` directly — and must degrade gracefully to the local/offline experience when `supabaseEnabled` is false, which is the default in dev and CI since no real credentials are ever committed.

`src/app/sentry.ts` follows the identical shape for `@sentry/react`, gated on `VITE_SENTRY_DSN`. It's the only file importing that package, and does so lazily (dynamic `import()` on idle-callback or on first caught error) using a custom lightweight `SentryErrorBoundary` (plain React, not Sentry's own `ErrorBoundary`) so crash-catching never depends on the SDK chunk having loaded. When touching this file, always destructure named exports from the dynamic import (`const { init, captureException } = await import(...)`) — a namespace import (`import * as Sentry`) defeats Rollup's tree-shaking and silently pulls in Sentry's Replay/Tracing integrations (~400KB) even though neither is ever enabled here.

### Theming

Themes (`dark`/`light`/`neon`) are plain objects in `THEMES` (in `lib.tsx`), spread as **inline style** (CSS custom properties like `--bg`, `--fg`, `--wash`, `--glass-edge`) onto the app's root via `ThemeCtx`. There is no `.dark` class toggle and no competing `:root` token block — `src/styles/theme.css` holds only real, hand-written classes for the redesigned screens (`.myra-*`) plus the Tailwind imports; don't add a second design-token system there. Shared visual constants (`GLASS`, `F`, `SPRING`, `ON_DARK`) live in `lib.tsx` and should be reused rather than redefined per component.

### i18n

All user-facing strings go through the `STR` dictionary in `i18n.tsx` as `{ "key.name": { ru: "...", en: "..." } }`, consumed via `t("key.name", ...args)` from `useLang()`. New UI needs both `ru` and `en` entries added there.

### Data model boundary

The static demo catalog in `data.ts` (small numeric ids) is frontend-only and never touches the database. Real user-generated content (accounts, uploaded tracks, comments, donations, follows, reports) lives in Supabase with RLS. Several tables key on a `text` column rather than a strict `uuid` FK specifically to reference *either* a real Supabase row *or* a `"catalog:N"`-prefixed demo-catalog id (e.g. `comments.track_id`, `reports.target_id`) — this mixed-key convention is intentional, not a modeling gap to "fix" into a hard foreign key.

### Supabase schema (`supabase/schema.sql`)

One hand-maintained SQL file, no migrations directory — it's meant to be pasted whole into the Supabase SQL Editor and re-run any number of times. It is fully idempotent: every `create table`/`create index` uses `if not exists`, every `alter table ... add column` uses `add column if not exists`, and — since Postgres has no `create policy if not exists` — every single `create policy` is preceded by a matching `drop policy if exists "name" on table;`. Any new section appended to this file must follow the same pattern, or a future re-run will hard-fail on the first collision and abort everything after it in the same paste. Sections are numbered sequentially in comments.

### Edge functions (`supabase/functions/*/index.ts`, Deno)

Each is a single `Deno.serve` handler. Anything privileged uses a two-client pattern: an anon-key client authenticates the caller via their own JWT (`auth.getUser()`), then a *separate* service-role client (bypasses RLS) performs the actual write — this is what stops a user from e.g. granting themselves an active paid subscription directly. `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the platform; anything else (`OPENROUTER_API_KEY` for `support-chat`, `YOOKASSA_SHOP_ID`/`YOOKASSA_SECRET_KEY` for `create-payment`/`yookassa-webhook`) must be set via `supabase secrets set` and is absent by default, which each function must treat as a normal, expected state (return a clear "not configured" error), not a crash.

`yookassa-webhook` is a public, unauthenticated endpoint — it must never trust the `status` field in the incoming POST body (anyone can POST a forged payload). It extracts only the payment id and independently re-fetches the authoritative status via `GET /v3/payments/{id}` with its own secret key before acting, and is idempotent against duplicate webhook delivery.

### Realtime listening rooms (`rooms.ts`)

Uses Supabase Realtime Broadcast + Presence directly with no dedicated DB table — the room code *is* the channel name (`room:{code}`), so a room either really connects two people or doesn't (no "dead invite link" state is possible). `supabase.channel(topic)` reuses an existing channel object for the same topic from the client's internal registry, so `disconnectRoom` must call `supabase.removeChannel()` (not just `.unsubscribe()`) or the channel leaks and listeners stack up on re-entry.

### Performance: `fx-simple` / `isWeakEnvironment()`

`isWeakEnvironment()` (`lib.tsx`) detects weak hardware or Android WebView (`/; wv\)/` UA match, or `"Capacitor" in window`) and auto-adds a root `fx-simple` class that disables heavy `backdrop-filter`/animations via CSS — Android WebView's `backdrop-filter` compositing causes flicker regardless of raw hardware power. CSS alone can't stop a JS `requestAnimationFrame` loop, so any decorative canvas/rAF-driven component must also check `document.querySelector(".fx-simple")` itself and stop animating, not rely on the CSS class alone.

### Honesty principle

Nothing simulated may be presented as real without a clear label — this is an enforced product rule, not generic advice. Example: donation/subscription flows call `createPayment()` first and only fall back to the clearly-labeled simulated card/QR flow (`don.simNote` / `plus.simNote` i18n strings) if payments aren't configured; decorative UI that doesn't actually function gets removed rather than left in place as a fake control.

### Multi-platform packaging

The same Vite output in `dist/` is reused unmodified by Electron (`main.js` just loads `dist/index.html` in a `BrowserWindow`) and Capacitor (`android/`, `ios/`, `capacitor.config.json` → `webDir: dist`). The web target deploys to GitHub Pages via `.github/workflows/deploy-web.yml` on every push to `main`, building with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_SENTRY_DSN` from repo secrets — all optional; the build and app must work with none of them set.
