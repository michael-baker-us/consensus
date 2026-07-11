# Consensus — Phase 4: Software Architecture

Satisfies the product decisions in [01](01-product-review.md) and the three
UX-driven requirements at the end of [03](03-ux.md): offline vote queueing,
server-authoritative reveal timing, and broadcast wheel-spin parameters.

## Backend pick: Supabase

Both candidates satisfy "realtime rooms + anonymous auth." Supabase wins on
fit and on learning value:

| Need | Supabase | Firebase |
| --- | --- | --- |
| Lobby presence (who's here, live) | **Native** — Realtime channels have a presence primitive | Hand-rolled (heartbeat docs or a second product, RTDB) |
| Wheel-spin broadcast (host's spin physics → all clients) | **Native** — channel `broadcast` is exactly this | Contortions via Firestore writes; latency and cost per frame-ish event |
| Server-authoritative transitions | Postgres functions: transactional, testable SQL | Cloud Functions: another runtime, slower cold paths |
| Anonymous auth | Supported | Supported |
| iOS SDK weight | Light, pure-Swift SPM package | Heavy (gRPC deps, slow clean builds) |
| Learning transfer | SQL, RLS, transactions — durable skills | Proprietary document model |

Tradeoff accepted: Firestore's built-in offline persistence is better out of
the box. It doesn't matter here — the vote outbox (below) needs custom
semantics either way, and it's ~100 lines we fully control.

**The app never imports Supabase outside one package.** Every backend
interaction goes through `SessionService` (protocol), so the vendor is
swappable and, more importantly, *fakeable* for tests and previews.

## Where the rules live: in Postgres, not on phones

The state machine from Phase 2 is enforced server-side. Clients *request*,
the database *decides*, and every client — including the requester — reacts
to the resulting state change arriving over realtime. One code path for "I
did it" and "someone else did it" eliminates an entire class of sync bugs and
delivers the simultaneous reveal for free.

Postgres functions (called via RPC), each transactional:

- `create_room(config) → room` — generates the 6-char code, seeds the deck.
- `join_room(code, display_name) → participant` — rejects non-lobby states.
- `start_voting(room_id)` — host-only (enforced by RLS, not client code).
- `submit_votes(room_id, votes[])` — records the ballot; **atomically**
  checks whether this voter was the last, and if so computes scores and
  flips state to `reveal` (or `runoff` per the flat-scores rule). The
  completion race — two people finishing simultaneously — dies here, inside
  one transaction, instead of haunting the client.
- `force_reveal(room_id)` — host-only.
- `leave_room(participant_id)` — re-runs the completion check (a leaver can
  *cause* completion).

Row Level Security mirrors the rules: participants read only their room;
votes are insert-only by their owner and **readable by no one** until the
room reaches `reveal` (votes are private by construction, not by UI
politeness); host-only functions check `room.host_id = auth.uid()`.

Scoring (yes = 1, ❤️ = 2, no = 0, unanimity detection, runoff threshold)
is implemented twice by design: once in SQL (authoritative) and once in
`ConsensusCore` (Swift, for previews/tests/optimistic UI) — with a shared
JSON fixture suite asserting both give identical answers. Cross-language
duplication is normally a smell; here it buys an authoritative server *and*
a fully-testable client, and the fixtures keep them honest.

## Realtime topology (per room)

```text
Postgres changes ── room row (status, round, results)  → drives navigation
Postgres changes ── participants table                 → lobby list, waiting count
Channel presence ── who is currently connected         → "Jake left" toast
Channel broadcast ── wheel_spin {velocity, seed, ts}   → shared spin animation
```

Clients fold all four into one `SessionSnapshot` stream (below). The wheel:
host flicks → broadcasts spin parameters → every client (host included) runs
the identical deterministic animation locally. Same input, same physics, same
winner — no per-frame sync, and the result is verifiable from the seed.

## Module structure

Local Swift packages inside one workspace — real compiler-enforced
boundaries without repo sprawl. Feature UI stays in the app target; packages
exist only where a boundary pays for itself:

```text
Consensus.xcworkspace
├── Consensus/  (app target — SwiftUI, feature folders)
│   ├── App/                 ConsensusApp, AppDependencies (composition root)
│   ├── Features/
│   │   ├── Home/            HomeView, HomeModel
│   │   ├── RoomSetup/       CategoryView, FiltersView, ReviewView, RoomSetupModel
│   │   ├── Join/            JoinView, NameEntryView, JoinModel
│   │   └── Session/         LobbyView, VotingView, WaitingView, RevealView,
│   │                        WheelView, WinnerView, SessionModel
│   └── Support/             deep links, haptics glue
└── Packages/
    ├── ConsensusCore/       domain models, state machine, scoring, VoteOutbox
    │                        (pure Swift, zero dependencies — the crown jewels)
    ├── ConsensusBackend/    SessionService protocol + SupabaseSessionService
    │                        + FakeSessionService (shipped for previews/UI tests)
    ├── CandidateProviders/  DeckProviding protocol + TMDbProvider (URLSession)
    └── DesignSystem/        colors, type, PosterCard, chips, wheel, confetti
```

Dependency rule, enforced by package manifests: everything may depend on
`ConsensusCore`; `ConsensusCore` depends on nothing. The app target is the
only place all packages meet.

## Domain model (ConsensusCore)

```swift
struct DecisionItem: Codable, Identifiable, Sendable {
    let id: String            // provider-scoped, e.g. "tmdb:603"
    let title: String
    let subtitle: String?     // "2024 · 2h 46m"
    let imageURL: URL?
    let details: ItemDetails  // enum: .movie(MovieDetails) — one case today
}

enum SessionStatus: String, Codable { case lobby, voting, runoff, reveal, resolved, abandoned }

struct SessionSnapshot: Sendable {   // the one type the UI renders from
    let room: Room                    // status, round, config, hostID
    let participants: [Participant]   // includes per-person finished flag
    let deck: [DecisionItem]
    let results: RoundResults?        // scores, unanimous IDs — nil until reveal
}
```

`ItemDetails` as an enum (not a protocol) is the deliberate "cheap seam" from
Phase 1: adding Restaurants means adding a case and a provider, and the
compiler lists every switch that needs a decision — that's the plug-in
architecture deferred correctly.

## Services and protocols

```swift
protocol SessionService: Sendable {
    func createRoom(config: RoomConfig, deck: [DecisionItem]) async throws -> RoomHandle
    func joinRoom(code: String, displayName: String) async throws -> RoomHandle
    func snapshots(for room: RoomHandle) -> AsyncThrowingStream<SessionSnapshot, Error>
    func startVoting() async throws
    func submitVotes(_ votes: [Vote]) async throws
    func forceReveal() async throws
    func broadcastSpin(_ spin: WheelSpin) async throws
    func spins() -> AsyncStream<WheelSpin>
    func leave() async
}

protocol DeckProviding: Sendable {   // TMDbProvider today; one per category later
    func availableServices(region: String) async throws -> [StreamingService]
    func matchCount(for filters: DeckFilters) async throws -> Int   // live count pill
    func buildDeck(for filters: DeckFilters) async throws -> [DecisionItem]
}
```

TMDb specifics: URLSession + `Endpoint` enum, DTOs decoded then **mapped to
domain types at the package boundary** — no TMDb field names escape
`CandidateProviders`. The API key is injected at build time via an xcconfig
that is gitignored (`Secrets.xcconfig.example` committed); it never enters
source control.

### VoteOutbox (the offline requirement)

An actor in `ConsensusCore`: votes append locally the instant they're cast
(UI never waits on the network), a flush loop pushes batches through
`SessionService`, retries with backoff on failure, and persists pending votes
to disk so a killed app loses nothing. `submit_votes` is idempotent
server-side (upsert on `participant_id + item_id`), which makes retries safe
— idempotency is the contract that lets the outbox be dumb.

## UI architecture

- **MVVM with `@Observable`.** One model per feature (`SessionModel` owns
  the whole session flow), `@MainActor`, constructor-injected services.
- **State-driven session navigation:** `SessionFlowView` switches on
  `snapshot.room.status` — lobby/voting/waiting/reveal/winner are *renderings
  of server state*, not navigation destinations. Relaunch re-entry (Phase 3
  requirement) falls out for free: subscribe, render whatever state arrives.
- Optimistic local touches (card exit animations, undo window) live in the
  view model, reconciled against snapshots.

## Dependency injection

No framework. `AppDependencies` (composition root in the app target) builds
the real graph; initializers take protocols. SwiftUI models receive
dependencies through init, not through `@Environment` — environment is for
view-tier values, not service graphs. A launch argument
(`-UseFakeBackend`) swaps in `FakeSessionService` for UI tests and demos.

## Persistence

Deliberately small (Phase 1: don't over-invest):

- **SwiftData**: `SessionRecord` only — finished sessions for Home's history.
  One model, one store, isolated behind `HistoryStore`.
- **@AppStorage**: display name, avatar seed.
- **Files**: VoteOutbox pending queue (JSON in Application Support).

Server state is never mirrored into SwiftData — the snapshot stream *is* the
truth, and caching it locally would create a second source to reconcile.

## Concurrency (Swift 6, strict)

Domain types are `Sendable` value types. Mutable state lives in actors
(`VoteOutbox`, `SupabaseSessionService`'s subscription bookkeeping) or on the
main actor (view models). `AsyncStream` is the seam between backend callbacks
and the UI — no Combine, no delegates.

## Observability

`OSLog` categories per package (`session`, `deck`, `outbox`, `realtime`);
signposts around deck build and reveal latency (the five-minute budget gets
measured, not assumed). Crash/analytics SDKs: none in MVP.

## Testing strategy

| Layer | How | What it protects |
| --- | --- | --- |
| ConsensusCore | Plain XCTest, no mocks needed (pure functions + actors) | Scoring, runoff rules, outbox retry/idempotency — the correctness core |
| SQL functions | pgTAP-style tests run against local Supabase (Docker) in CI | The authoritative state machine, RLS privacy rules |
| Parity fixtures | One JSON suite asserted by *both* Swift tests and SQL tests | Swift scoring ≡ SQL scoring, forever |
| CandidateProviders | Fixture JSON → DTO → domain mapping tests | TMDb contract drift |
| View models | Unit tests against `FakeSessionService` (scriptable snapshots) | Flow logic: force-reveal gating, undo window, reconnection |
| UI tests | XCUITest, `-UseFakeBackend`, happy path + join-error paths | The five-minute journey end to end |

`FakeSessionService` is a first-class citizen, not a test afterthought: it
powers previews, UI tests, and a demo mode, and it implements the same state
machine via `ConsensusCore` — so the fake stays honest by construction.

## Decisions deliberately deferred

- Web guest voting (Supabase keeps the door open; nothing in the schema
  assumes an iOS client).
- Snapshot-stream reconnection windowing (naive resubscribe is fine at MVP
  scale; revisit if rooms exceed ~20 participants).
- Modularizing feature UI into packages — only if the app target gets slow
  to compile.
