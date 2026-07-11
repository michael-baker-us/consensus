# Consensus — Phase 4: Software Architecture (Web)

Satisfies the product decisions in [01](01-product-review.md) (including the
web-platform amendment) and the three UX-driven requirements at the end of
[03](03-ux.md): offline vote queueing, server-authoritative reveal timing,
and broadcast wheel-spin parameters.

## Backend: Supabase (unchanged by the platform pivot)

Chosen over Firebase because its realtime primitives map one-to-one onto our
needs — channel **presence** is the lobby's live participant list, channel
**broadcast** is the wheel-spin sync — and because Postgres + RLS +
transactions are durable, transferable skills. The pivot to web validates
the choice: `supabase-js` is the best-supported client SDK they ship.

**The app never imports `supabase-js` outside one package.** Every backend
interaction goes through the `SessionService` interface, so the vendor is
swappable and, more importantly, _fakeable_ for tests, Storybook-style
component work, and the demo mode.

## Where the rules live: in Postgres, not in browsers

A browser client is _less_ trustworthy than an app-store binary — anyone can
open devtools — which makes server-side authority non-negotiable rather than
merely elegant. Clients _request_, the database _decides_, and every client
(requester included) reacts to the state change arriving over realtime. One
code path for "I did it" and "someone else did it."

Postgres functions (RPC), each transactional:

- `create_room(config) → room` — generates the 6-char code, seeds the deck.
- `join_room(code, display_name) → participant` — rejects non-lobby states.
- `start_voting(room_id)` — host-only, enforced by RLS not client code.
- `submit_votes(room_id, votes[])` — records the ballot; **atomically**
  detects "that was the last voter" and flips state to `reveal` (or `runoff`
  per the flat-scores rule). The completion race dies inside one
  transaction instead of haunting the client.
- `force_reveal(room_id)` — host-only.
- `leave_room(participant_id)` — re-runs the completion check (a leaver can
  _cause_ completion).

Row Level Security mirrors the rules: participants read only their room;
votes are insert-only by their owner and **readable by no one** until the
room reaches `reveal` — vote privacy by construction, provably, even against
a devtools user. Auth is Supabase anonymous sign-in; no accounts anywhere.

Scoring (yes = 1, ❤️ = 2, no = 0, unanimity, runoff threshold) is
implemented twice by design: in SQL (authoritative) and in `core`
(TypeScript — for the fake backend, tests, optimistic UI), with a **shared
JSON fixture suite asserted by both test runners** so they can never drift.
Cross-language duplication is normally a smell; here it buys an
authoritative server _and_ a fully-testable client, and the fixtures keep
them honest.

## Realtime topology (per room)

```text
Postgres changes ── room row (status, round, results)  → drives which screen renders
Postgres changes ── participants table                 → lobby list, waiting count
Channel presence ── who is currently connected         → "Jake left" toast
Channel broadcast ── wheel_spin {velocity, seed, ts}   → shared spin animation
```

Clients fold all four into one `SessionSnapshot` stream. The wheel: host
flicks → broadcasts spin parameters → every client runs the identical
deterministic animation locally. Same seed, same physics, same winner — no
per-frame sync.

### The mobile-browser reality (new risk the pivot introduces)

Phones lock, tabs background, and mobile Safari suspends pages — the
realtime socket **will** drop mid-session as friends flip between the group
chat and the app. This is the web's version of "app killed mid-session" and
it's a first-class design input, not an edge case:

- `visibilitychange` → on return to foreground, resubscribe and **refetch a
  full snapshot** before trusting the stream again (events were missed while
  suspended; the fetch-then-stream pattern makes missed events harmless).
- The same snapshot-refetch path serves page reload, so reload re-entry
  (docs/03 requirement) and wake-from-background are one mechanism.
- Screen Wake Lock API during voting/reveal keeps the phone awake at the
  moments that matter, where supported.

## TMDb: proxied, never called from the browser

A static frontend cannot hold a secret — a TMDb key shipped in the bundle is
public. All TMDb traffic goes through a **Supabase Edge Function**
(`deck-builder`): the key lives server-side, the function exposes exactly
three operations (`availableServices`, `matchCount`, `buildDeck`), caches
TMDb responses briefly, and returns domain-shaped JSON so TMDb field names
never reach the client. Bonus: deck building becomes server-side, which is
where `create_room` wants it anyway.

## Repository structure

pnpm workspace monorepo — same boundaries as the original four Swift
packages, enforced by package manifests instead of Xcode:

```text
consensus/
├── app/                      # Vite + React UI
│   ├── src/
│   │   ├── features/
│   │   │   ├── home/
│   │   │   ├── room-setup/   # category, filters, review
│   │   │   ├── join/         # join, name entry
│   │   │   └── session/      # lobby, voting, waiting, reveal, wheel, winner
│   │   ├── design/           # PosterCard, chips, wheel, confetti, tokens
│   │   ├── routes.tsx        # /, /join/:code, /room/:code
│   │   └── main.tsx          # composition root (DI wiring)
│   └── e2e/                  # Playwright specs (run against fake backend)
├── packages/
│   ├── core/                 # domain types, state machine, scoring,
│   │                         # VoteOutbox — pure TS, zero dependencies
│   └── backend/              # SessionService interface,
│                             # SupabaseSessionService, FakeSessionService
├── supabase/
│   ├── migrations/           # schema, RPCs, RLS
│   ├── functions/deck-builder/   # TMDb proxy (Edge Function, Deno)
│   └── tests/                # SQL tests incl. parity fixtures
└── fixtures/                 # the shared scoring parity suite (JSON)
```

Dependency rule: everything may depend on `core`; `core` depends on
nothing. Only `main.tsx` sees concrete implementations.

## Stack choices, with reasons

| Choice                                    | Why                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **React 19 + TypeScript (strict) + Vite** | Most legible stack to portfolio reviewers; Vite for instant dev loop and static builds that deploy anywhere free                             |
| **Motion (Framer Motion)**                | `layoutId` shared-element transitions are the matched-geometry poster continuity from docs/03; best-in-class spring/gesture APIs             |
| **Zustand**                               | One small store holding the latest `SessionSnapshot` + optimistic local state; no server-cache library needed — realtime push _is_ the cache |
| **react-router v7**                       | Three routes; anything heavier is overhead                                                                                                   |
| **Tailwind CSS v4**                       | Fast iteration; design tokens as CSS custom properties (poster-derived backdrop colors are runtime values)                                   |
| **PWA (vite-plugin-pwa)**                 | Add-to-home-screen + icon + standalone display — the "feels like an app" layer, added late (M10), not a structural concern                   |

## Domain model (`core`)

```ts
type DecisionItem = {
  id: string; // provider-scoped, e.g. "tmdb:603"
  title: string;
  subtitle?: string; // "2024 · 2h 46m"
  imageUrl?: string;
  details: { kind: "movie" } & MovieDetails; // discriminated union —
}; // category #2 adds a variant, and the
// compiler flags every switch to update

type SessionStatus = "lobby" | "voting" | "runoff" | "reveal" | "resolved" | "abandoned";

type SessionSnapshot = {
  // the one type the UI renders from
  room: Room; // status, round, config, hostId
  participants: Participant[]; // includes per-person finished flag
  deck: DecisionItem[];
  results: RoundResults | null; // scores, unanimous ids — null until reveal
};
```

## Services and interfaces (`backend`)

```ts
interface SessionService {
  createRoom(config: RoomConfig): Promise<RoomHandle>; // deck built server-side
  joinRoom(code: string, displayName: string): Promise<RoomHandle>;
  snapshots(room: RoomHandle): AsyncIterable<SessionSnapshot>;
  startVoting(): Promise<void>;
  submitVotes(votes: Vote[]): Promise<void>;
  forceReveal(): Promise<void>;
  broadcastSpin(spin: WheelSpin): Promise<void>;
  spins(): AsyncIterable<WheelSpin>;
  leave(): Promise<void>;
}
```

`FakeSessionService` is a first-class citizen, not a test afterthought: it
implements the same state machine via `core`, simulates scripted
participants with configurable delays, and powers component development,
Playwright e2e, and the public **demo mode** (`/room/DEMO`) — which on a
portfolio project doubles as the "try it alone right now" front door.

### VoteOutbox (the offline requirement)

In `core`: votes append locally the instant they're cast (the UI never waits
on the network), a flush loop pushes batches through `SessionService` with
backoff, and pending votes persist to `localStorage` so a killed tab loses
nothing. `submit_votes` is idempotent server-side (upsert on
`participant_id + item_id`) — idempotency is the contract that lets the
outbox be dumb.

## UI architecture

- **Feature-level view models as hooks** (`useSession`, `useVoting`): thin
  layers that read the Zustand store and expose intents; components stay
  declarative. Services arrive via the composition root in `main.tsx` and a
  single context — components never import concrete backends.
- **Server state decides the screen:** `/room/:code` renders whichever
  session screen matches `snapshot.room.status`. Reload, wake-from-
  background, and "someone else advanced the room" are all the same code path.
- Optimistic local touches (card exit animations, the undo window) live in
  store-local state, reconciled against snapshots.

## Observability

Structured dev logging behind a tiny logger (silent in prod builds except
errors); `performance.mark`/`measure` around deck build and reveal latency —
the five-minute budget gets measured, not assumed. Analytics SDKs: none.

## Testing strategy

| Layer            | How                                                        | What it protects                                                       |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `core`           | Vitest, no mocks (pure functions)                          | Scoring, runoff rules, outbox retry/idempotency — the correctness core |
| SQL              | pgTAP-style tests against local Supabase (Docker) in CI    | The authoritative state machine, RLS privacy rules                     |
| Parity fixtures  | One JSON suite asserted by _both_ Vitest and the SQL tests | TS scoring ≡ SQL scoring, forever                                      |
| Edge Function    | Deno tests with TMDb fixture JSON                          | Contract drift, domain mapping                                         |
| Components/hooks | Vitest + Testing Library against `FakeSessionService`      | Flow logic: force-reveal gating, undo window, reconnection             |
| e2e              | Playwright, fake backend, mobile viewport                  | The five-minute journey; multi-tab test = two participants in one spec |

That last cell is a quiet superpower of the web pivot: **Playwright drives
two browser contexts in one test** — host and guest, create/join/vote/reveal
asserted end-to-end in CI. The equivalent two-simulator iOS test was never
going to run on every PR.

## Decisions deliberately deferred

- Native SwiftUI client (second act on this same backend, if ever).
- Realtime reconnection windowing beyond fetch-then-stream (fine at ≤20
  participants).
- SSR/frameworks (Next/Remix): nothing here needs a server render; static
  SPA keeps hosting free and deployment trivial.
