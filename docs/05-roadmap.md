# Consensus — Phase 5: Roadmap (Web)

Twelve milestones. Every one ends with a working, deployed app; every one is
independently testable; each is 1–4 small PRs. Sized in PRs, not weeks —
this is a learning project and pace is yours.

## Ordering rationale (the honest tradeoff)

Risk-first sequencing says "build the backend first — it's the hardest
part." This roadmap deliberately does the opposite: **the entire game loop
runs on `FakeSessionService` before Supabase exists** (M0–M4), because
Phase 1 established that game feel is the product bar. If the swipe-reveal
loop isn't fun with fake friends, the backend is wasted effort. The backend
risk is contained rather than ignored: the `SessionService` interface is
fixed from M2, so fake and real implementations are interchangeable by
construction, and the SQL layer gets its own isolated milestones (M6–M7)
with real integration tests.

**M4 is a hard gate: playtest before proceeding.** If the loop feels like a
survey, iterate on M3–M4 until it doesn't.

A web-specific bonus baked in from M0: **the app deploys to a public URL on
every merge to main.** The portfolio artifact exists from day one and only
gets better.

---

## M0 — Skeleton, CI, and a live URL

pnpm workspace (`app`, `packages/core`, `packages/backend`), Vite + React +
TypeScript strict, ESLint + Prettier, Vitest wired, GitHub Actions (lint +
test + build on PR), deploy-on-merge to GitHub Pages (SPA fallback
configured), README pointing at `docs/`. A repo `CLAUDE.md` capturing the
platform amendment and doc trail for future sessions.

- **Done when:** a placeholder Home is live on a public URL; CI is green and
  required.
- **PRs:** ① workspace + app shell, ② CI + deploy pipeline.
- **Learning:** monorepo boundaries, Vite, Pages deployment.

## M1 — `core`: the rules of the game

Domain types (`DecisionItem`, `SessionSnapshot`, `Vote`, …), scoring engine,
unanimity detection, runoff rule (flat-score threshold, max 2 runoffs), and
the **parity fixture suite** — JSON cases later asserted against SQL (M6).

- **Done when:** Vitest covers every scoring/runoff rule; fixtures committed.
- **PRs:** ① types, ② scoring + fixtures.
- **Learning:** pure-domain design, discriminated unions, table-driven tests.

## M2 — Fake backend and the state-driven session shell

`SessionService` interface (frozen here — changing it later is a design
review, not a refactor), `FakeSessionService` with scripted participants,
and the `/room/:code` shell rendering lobby → voting → waiting → reveal →
winner as placeholder screens driven purely by the snapshot stream.
`/room/DEMO` activates the fake backend in any build, including production.

- **Done when:** demo mode walks the full state machine; a mid-"session"
  page reload re-enters the correct placeholder screen.
- **PRs:** ① interface + fake, ② session shell + demo route.
- **Learning:** AsyncIterable as an architecture seam, state-driven rendering.

## M3 — The voting experience

Design layer gets real: `PosterCard` with pointer-gesture swipe physics
(Motion), flip-for-details, vote buttons, single undo, progress dots,
per-vote exit animations, vibration where supported. Deck is ~15 bundled
fixture movies with local poster assets. Mobile-first layout.

- **Done when:** swiping feels like casting, not submitting (subjective —
  that's the point) *on a real phone via the deployed URL*; keyboard + screen
  reader operable; buttons fully replace gestures.
- **PRs:** ① card + gestures, ② vote feedback/undo, ③ voting screen assembly.
- **Learning:** gesture-driven animation, layoutId groundwork, touch vs
  pointer events.

## M4 — Reveal ceremony, wheel, winner  🎯 *playtest gate*

Leaderboard build-up, unanimous banner + confetti, the deterministic wheel
(spin params + seed → identical animation anywhere), winner screen with
layoutId poster continuity. `prefers-reduced-motion` variants for all of it.

- **Done when:** a full solo game at `/room/DEMO` — fake friends voting on
  scripted delays — is genuinely satisfying, and three real humans (sent the
  link, zero setup) agree. **Do not pass this gate on your own opinion.**
- **PRs:** ① leaderboard, ② wheel, ③ winner + continuity.
- **Learning:** choreographed animation sequences, deterministic simulation.

## M5 — TMDb via Edge Function: real movies, real filters

`deck-builder` Edge Function (TMDb key server-side, domain-shaped responses,
Deno tests with fixture JSON), then Filters + Review & Create screens wired
to it: service chips, live match count, deck build. Rooms still fake.

- **Done when:** a deck built from real filters plays through the M4 loop;
  no TMDb field name or key exists in client code.
- **PRs:** ① Edge Function + tests, ② filters UI, ③ review/create wiring.
- **Learning:** API proxy design, secret hygiene, edge runtimes.

## M6 — Supabase schema and the authoritative state machine

SQL migrations: tables, the six RPCs from docs/04, RLS policies (votes
unreadable until reveal). Local Supabase via Docker; SQL tests including the
**parity fixtures from M1 asserted against SQL scoring**. CI job for the
database. No app changes at all.

- **Done when:** SQL tests prove the transition rules, the completion race,
  host-only enforcement, and vote privacy; TS ≡ SQL on every fixture.
- **PRs:** ① schema + RPCs, ② RLS + tests + CI.
- **Learning:** transactional state machines, RLS, migrations — the
  distributed-systems core of the project.

## M7 — `SupabaseSessionService`: real multiplayer

The real implementation: anonymous auth, RPCs, realtime + presence +
broadcast folded into the snapshot stream. Playwright integration spec with
**two browser contexts** — host and guest in one test — against local
Supabase.

- **Done when:** two browser tabs create/join/vote/reveal a real room; the
  wheel-spin broadcast replays identically in both; the two-context spec
  runs in CI.
- **PRs:** ① auth + RPCs, ② realtime fold, ③ two-context integration spec.
- **Learning:** realtime protocols, merging event sources, multi-client
  testing.

## M8 — Hardening: the unhappy paths

`VoteOutbox` (localStorage-persisted, idempotent flush, backoff),
`visibilitychange` fetch-then-stream recovery (the phone-locked-mid-vote
case — *the* mobile-web failure mode), reload re-entry against the real
backend, leave/removal handling (including "leaver causes completion"),
force-reveal flow, session timeout, Wake Lock during voting/reveal.

- **Done when:** airplane mode mid-vote loses nothing; locking the phone for
  a minute and returning recovers seamlessly; a stalled participant can't
  hang a room.
- **PRs:** ① outbox, ② visibility/reload recovery, ③ host controls + timeouts.
- **Learning:** offline-first reconciliation, idempotency, mobile-browser
  lifecycle.

## M9 — Joining polish

`/join/:code` with the code-entry field (pre-fill + auto-submit from URL),
QR generation in the lobby (encoding the join URL — any phone camera scans
straight in; there is no in-app scanner), Web Share API with copy-link
fallback, name entry, every join error state from docs/03.

- **Done when:** a phone goes from scanned QR to lobby in under 10 seconds
  with no typing except a name.
- **PRs:** ① join route + code entry, ② QR + share, ③ error states.

## M10 — History, settings, PWA

`localStorage`-backed session history behind a `HistoryStore` interface,
Home recent list + winner recap, Settings (name edit, about, **TMDb/JustWatch
attribution** — a terms requirement, not a nicety), PWA manifest + icons
(add-to-home-screen, standalone display).

- **PRs:** ① history, ② settings + attribution, ③ PWA.

## M11 — Portfolio readiness

Accessibility audit (keyboard end-to-end, screen reader pass, reduced
motion, Lighthouse a11y), performance pass against the marks (deck build,
reveal latency, bundle size), README overhaul: 30-second demo video above
the fold, **the live URL and `/room/DEMO` link at the very top**, architecture
sketch, "run it locally in five steps." Tagged v1.0.

- **Done when:** a friends' group of four picks a movie in under five
  minutes — the Phase 1 promise, measured — and a stranger with the README
  gets from clone to local multiplayer in five minutes.
- **PRs:** ① a11y, ② perf, ③ README + demo video + release tag.

---

## Dependency graph

```text
M0 → M1 → M2 → M3 → M4 ⛔(playtest gate)
                         ├─→ M5 (TMDb fn)   ──┐
                         └─→ M6 (SQL) → M7 ───┼→ M8 → M9 → M10 → M11
                                              ┘
```

M5 and M6 are independent and can be taken in either order (or interleaved)
after the gate. Everything after M7 requires both.
