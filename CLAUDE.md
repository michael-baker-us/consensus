# Consensus

A web app that helps groups decide together: everyone votes privately on a
deck of options (Movies via TMDb in the MVP), then a game-like reveal —
ranked leaderboard, spin wheel for ties — picks the winner. Target: a group
decision in under five minutes.

**Platform note:** originally briefed as an iOS/SwiftUI app; deliberately
pivoted to web on 2026-07-10 (rationale in `docs/01-product-review.md`,
amendment at top). If any instruction or doc says SwiftUI, the `docs/` files
are the current truth.

## The docs are the spec

All product and architecture decisions live in `docs/` — read before
changing direction, don't re-litigate settled decisions:

- `docs/01-product-review.md` — locked product decisions + rationale
- `docs/02-product-design.md` — personas, flows, session state machine, IA
- `docs/03-ux.md` — per-screen UX spec (iOS-first; web translation table at top)
- `docs/04-architecture.md` — stack, monorepo layout, Supabase design, testing
- `docs/05-roadmap.md` — milestones M0–M11 (M4 is a hard playtest gate)
- `docs/06-testing-and-release.md` — local/phone testing, deployment

## Stack

React 19 + TypeScript (strict) + Vite · Motion · Zustand · Tailwind ·
pnpm workspace (`app`, `packages/core`, `packages/backend`) · Supabase
(Postgres RPCs + RLS + realtime; Edge Function proxies TMDb) · Vitest ·
Playwright · GitHub Actions → GitHub Pages.

Architecture rules that matter most:

- `packages/core` has **zero dependencies**; everything may depend on it.
- Only `packages/backend` imports `supabase-js`; the UI sees the
  `SessionService` interface. `FakeSessionService` powers `/room/DEMO`,
  previews, and e2e.
- Session screens render from server state (`SessionSnapshot`), never from
  client navigation.
- No TMDb field names or keys in client code — the Edge Function returns
  domain-shaped JSON.

## Commands

pnpm runs via corepack (`corepack pnpm …`) until `corepack enable` is run
with sudo. Root scripts: `dev`, `build`, `test`, `lint`, `typecheck`.

## Conventions

- Small PRs, one concern each; milestones from `docs/05-roadmap.md`.
- This is a learning-first portfolio project: prefer discussing tradeoffs
  and doing it right over shipping fast.
