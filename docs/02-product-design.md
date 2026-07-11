# Consensus — Phase 2: Product Design

Builds on the decisions in [01-product-review.md](01-product-review.md).

## Personas

### 1. Maya — the Organizer (host)

29, plans movie night for a friend group of five. Motivated enough to spend
60 seconds on setup (services, genres) because she's the one who suffers most
from the group chat's "idk, whatever you want." Owns the room: invites,
start, force-reveal, remove-stalled-participant.

**Designs for her:** the setup wizard, host controls, session progress visibility.

### 2. Jake — the Reluctant Guest

31, in the group chat, will not create an account for anything, has never
heard of this app. He taps a link mid-conversation. If he isn't voting within
60 seconds of tapping (install time excluded), we've lost him — and losing one
guest kills the session for everyone.

**Designs for him:** zero-signup join, name entry as the *only* gate, voting
UI that needs no explanation.

### 3. Sam & Priya — the Couple

Deciding date-night movie. Group of two — likely the *most common* real-world
session size. Keeps the design honest: consensus math, reveal drama, and the
wheel must all work when n = 2, not just for parties.

**Designs for them:** scoring and reveal that scale down gracefully; no copy
that assumes a crowd.

## Primary user journey (target: under 5 minutes)

| Time | Who | What happens |
| --- | --- | --- |
| 0:00 | Maya | New Room → Movies → picks streaming services, genres, deck size → room created with code, QR, share link |
| 0:30 | Maya | Shares link to the group chat |
| 0:45 | Jake | Taps link → (first time: App Store) → app opens on join screen, room pre-filled → types "Jake" → lands in lobby |
| 1:30 | Maya | Lobby shows 5 participants → Start |
| 1:30–3:30 | All | Each swipes the ~15-card deck privately; waiting screen shows "3 of 5 finished" |
| 3:30 | All | Everyone done (or Maya force-reveals) → reveal ceremony: leaderboard animates bottom-up, unanimous banner if earned, tie at the top → wheel spin |
| 4:15 | All | Winner card: poster, where to watch, done. Group presses play on the TV. |

## Session state machine

```text
          host creates            host starts           all done /
             room                   voting             force-reveal
  (none) ──────────► LOBBY ──────────► VOTING ──────────► REVEAL
                       ▲                  │ tie needs        │
                       │                  │ narrowing        │ winner
                       │              ┌───▼─────┐            ▼
                       │              │ RUNOFF  │──────► RESOLVED
                       │              │ VOTING  │  all done
                       │              └─────────┘
        any state ── timeout / host ends ──► ABANDONED
```

- Participants may join only in `LOBBY` (late joiners see "voting in progress — wait for the next round" — MVP keeps this simple: no mid-round joins).
- A participant leaving mid-vote is removed from the completion count after a grace period, or immediately by the host.
- Runoff rounds use the top 3–5 scored items; maximum 2 runoffs, then the wheel decides regardless.

## Information architecture

```text
Consensus
├── Home
│   ├── New Room  ──► Room Setup (wizard)
│   ├── Join Room ──► Join (code entry / QR scan; deep links land here pre-filled)
│   └── Recent sessions (local history, device-only)
├── Room Setup (host only)
│   ├── Step 1: Category (Movies — sole option, but a real chooser screen)
│   ├── Step 2: Filters (streaming services, genres, era, runtime, deck size)
│   └── Step 3: Review & Create
├── Session (one NavigationStack context, state-driven)
│   ├── Lobby (participants, share sheet / QR / code, host: Start)
│   ├── Voting (card stack: 👎 / 👍 / ❤️, progress dots)
│   ├── Waiting ("3 of 5 finished", host: force-reveal)
│   ├── Reveal (leaderboard ceremony → wheel if tied)
│   └── Winner (poster, providers, done / rematch)
└── Settings (about, TMDb + JustWatch attribution, display name default)
```

## Navigation map

- **Root:** `NavigationStack` from Home; the Session is a single flow whose
  screens are driven by shared session state (server is the source of truth),
  not by manual push/pop — a participant whose app relaunches mid-session
  re-enters at the correct screen.
- **Deep links:** `consensus://join/{roomCode}` and universal link
  `https://…/join/{roomCode}` open Join with the code pre-filled; QR codes
  encode the universal link.
- **No tab bar in MVP.** One job, one stack.

## Screen inventory (12)

| # | Screen | Key states |
| --- | --- | --- |
| 1 | Home | default · has recent sessions |
| 2 | Category chooser | Movies only (visual placeholder for future categories) |
| 3 | Filters | default · services empty-warning · loading provider list |
| 4 | Review & Create | creating (network) · create failed |
| 5 | Join | manual code · QR scanner · pre-filled from link · room not found · room already started |
| 6 | Name entry | first run only; remembered afterward |
| 7 | Lobby | 1 participant · n participants · host vs guest view · room expired |
| 8 | Voting | card stack · deck loading · image loading · last card |
| 9 | Waiting | progress · someone left · host force-reveal control |
| 10 | Reveal | leaderboard animation · unanimous banner · tie → wheel handoff |
| 11 | Winner | poster + watch providers · rematch CTA |
| 12 | Settings | static |

Per-screen layout, component, animation, and full empty/loading/error state
specs are Phase 3.
