# Consensus — Phase 5: Roadmap

Twelve milestones. Every one ends with a working, launchable app; every one
is independently testable; each is 1–4 small PRs. Sized in PRs, not weeks —
this is a learning project and pace is yours.

## Ordering rationale (the honest tradeoff)

Risk-first sequencing says "build the backend first — it's the hardest
part." This roadmap deliberately does the opposite: **the entire game loop
runs on `FakeSessionService` before Supabase exists** (M0–M4), because
Phase 1 established that game feel is the product bar. If the swipe-reveal
loop isn't fun on one device with fake friends, the backend is wasted
effort. The backend risk is contained rather than ignored: the
`SessionService` protocol is fixed from M2, so the fake and the real
implementation are interchangeable by construction, and the SQL layer gets
its own isolated milestones (M6–M7) with real integration tests.

**M4 is a hard gate: playtest before proceeding.** If the loop feels like a
survey, iterate on M3–M4 until it doesn't.

---

## M0 — Skeleton and CI

Workspace, app target, the four empty local packages with their dependency
rules declared, SwiftLint, GitHub Actions running build + tests on PR,
README with a pointer to `docs/`.

- **Done when:** app launches to a placeholder Home; CI is green and required.
- **PRs:** ① workspace + packages, ② CI + lint.
- **Learning:** SPM package boundaries, Xcode workspace layout, Actions for iOS.

## M1 — ConsensusCore: the rules of the game

Domain models (`DecisionItem`, `SessionSnapshot`, `Vote`, …), scoring engine,
unanimity detection, runoff rule (flat-score threshold, max 2 runoffs), and
the **parity fixture suite** — JSON cases that will later also be asserted
against SQL (M6).

- **Done when:** package tests cover every scoring/runoff rule; fixtures
  committed; app unchanged.
- **PRs:** ① models, ② scoring + fixtures.
- **Learning:** pure-domain design, table-driven tests, Swift 6 Sendable modeling.

## M2 — Fake backend and the state-driven session shell

`SessionService` protocol (frozen here — changing it later is a design
review, not a refactor), `FakeSessionService` with scriptable snapshots and
simulated participants, and `SessionFlowView` that renders lobby → voting →
waiting → reveal → winner as placeholder screens driven purely by the
snapshot stream. `-UseFakeBackend` launch argument.

- **Done when:** demo mode walks the full state machine end to end with
  buttons; relaunch mid-"session" re-enters the correct placeholder screen.
- **PRs:** ① protocol + fake, ② session shell + demo mode.
- **Learning:** AsyncStream as an architecture seam, state-driven navigation.

## M3 — The voting experience

DesignSystem gets real: `PosterCard` with swipe physics, flip-for-details,
vote buttons, single undo, progress dots, per-vote exit animations, haptics.
Deck is ~15 bundled fixture movies with local poster assets.

- **Done when:** swiping feels like casting, not submitting (subjective —
  that's the point); VoiceOver custom actions work; buttons fully replace
  gestures.
- **PRs:** ① card + gestures, ② vote feedback/undo/haptics, ③ voting screen
  assembly.
- **Learning:** gesture-driven animation, matchedGeometryEffect groundwork,
  haptic design.

## M4 — Reveal ceremony, wheel, winner  🎯 *playtest gate*

Leaderboard build-up, unanimous banner + confetti, the deterministic wheel
(spin params + seed → identical animation anywhere), winner screen with
matched-geometry poster continuity. Reduce Motion variants for all of it.

- **Done when:** a full solo game — fake friends voting on a scripted delay —
  is genuinely satisfying, and three real humans agree. **Do not pass this
  gate on your own opinion.**
- **PRs:** ① leaderboard, ② wheel, ③ winner + continuity.
- **Learning:** choreographed animation sequences, deterministic simulation.

## M5 — TMDb: real movies, real filters

`CandidateProviders`: endpoint layer, DTOs, domain mapping (fixture-tested),
watch-providers, live match-count. Filters + Review & Create screens wired
to it. Secrets via gitignored xcconfig. Rooms still fake.

- **Done when:** a deck built from real filters (services, genre, era) plays
  through the M4 loop; mapping tests pin the TMDb contract.
- **PRs:** ① client + DTOs + tests, ② filters UI, ③ review/create + deck wiring.
- **Learning:** API client design, DTO/domain separation, secret management.

## M6 — Supabase schema and the authoritative state machine

SQL migrations: tables, the six RPC functions from docs/04, RLS policies
(votes unreadable until reveal). Local Supabase via Docker; SQL tests
including the **parity fixtures from M1 asserted against the SQL scoring**.
CI job for the database. No app changes at all.

- **Done when:** SQL tests prove the transition rules, the completion race,
  host-only enforcement, and vote privacy; Swift ≡ SQL on every fixture.
- **PRs:** ① schema + RPCs, ② RLS + tests + CI.
- **Learning:** transactional state machines, RLS, migrations — the
  distributed-systems core of the project.

## M7 — SupabaseSessionService: real multiplayer

The real `SessionService`: anonymous auth, RPC calls, realtime
subscriptions + presence + broadcast folded into the snapshot stream.
Integration tests against local Supabase.

- **Done when:** two simulators create/join/vote/reveal a real room; the
  wheel spin broadcast replays identically on both.
- **PRs:** ① auth + RPCs, ② realtime fold, ③ integration tests.
- **Learning:** realtime protocols, merging multiple event sources into one
  stream, integration testing against containers.

## M8 — Hardening: the unhappy paths

`VoteOutbox` (persistent, idempotent flush, backoff), reconnection banner,
relaunch re-entry against the real backend, leave/removal handling
(including "leaver causes completion"), force-reveal flow, session timeout.

- **Done when:** airplane mode mid-vote loses nothing; killing the app
  mid-session recovers; a stalled participant can't hang a room.
- **PRs:** ① outbox, ② reconnect/re-entry, ③ host controls + timeouts.
- **Learning:** offline-first reconciliation, idempotency, failure-mode design.

## M9 — Joining: links, QR, codes

Universal links + custom scheme, QR generation (lobby) and scanning (join),
the code-entry field, name entry, every join error state from docs/03.

- **Done when:** a phone with the app installed goes from tapped link to
  lobby in under 10 seconds with no typing except a name.
- **PRs:** ① deep links + code entry, ② QR both directions, ③ error states.

## M10 — History, settings, attribution

SwiftData `SessionRecord` behind `HistoryStore`, Home recent list + winner
recap, Settings (name edit, about, **TMDb/JustWatch attribution** — a terms
requirement, not a nicety).

- **PRs:** ① history, ② settings.

## M11 — Release readiness

Accessibility audit (Dynamic Type, VoiceOver end-to-end, Reduce Motion),
performance pass against the signposts (deck build, reveal latency), app
icon, privacy manifest + nutrition labels, TestFlight, App Store metadata.

- **Done when:** a stranger's group of four picks a movie in under five
  minutes via TestFlight — the Phase 1 promise, measured.
- **PRs:** ① a11y, ② perf + manifest, ③ store assets.

---

## Dependency graph

```text
M0 → M1 → M2 → M3 → M4 ⛔(playtest gate)
                         ├─→ M5 (TMDb)      ──┐
                         └─→ M6 (SQL) → M7 ───┼→ M8 → M9 → M10 → M11
                                              ┘
```

M5 and M6 are independent and can be taken in either order (or interleaved)
after the gate. Everything after M7 requires both.
