# Consensus — Phase 1: Product Review

Decisions and scope agreed on 2026-07-10. This document is the record of *why*;
later phases build on it without re-litigating.

> **Platform amendment (2026-07-10, same day, before any code):** Consensus
> is a **web app**, not the iOS app of the original brief. Rationale: the #1
> product risk identified below — the second user's install friction — is
> *eliminated* by the web (link → voting in seconds, any phone), and the
> project's stated goals are portfolio and shareability, both of which a live
> URL serves better than a sideloaded build. The Supabase backend design is
> client-agnostic and survives unchanged; a native SwiftUI client remains a
> possible second act on the same backend. Decision #2 below (zero-signup
> join) is strengthened by this change, not weakened.

## Locked decisions

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | **Sync layer: BaaS (Firebase or Supabase)** behind a protocol | Realtime rooms, anonymous auth, and presence out of the box. The specific vendor is chosen in Phase 4; the app never talks to it directly, so it stays swappable. |
| 2 | **Zero-signup join** | Joining is: tap link / scan QR / enter code → type a display name → vote. No accounts anywhere in the MVP. The second user's friction is the #1 product risk. |
| 3 | **Streaming-availability filter is in MVP** | A winner nobody can stream is a failed session. TMDb watch-providers endpoint + a service picker at room setup. This is the killer filter. |
| 4 | **Deck capped at ~15–20 cards** | "Hundreds of choices" and "under five minutes" can't both be true. Filters do the heavy lifting before voting; the deck is small by design. |
| 5 | **Score-based ranking, not unanimity classes** | Yes = 1, Favorite = 2, No = 0 (tunable). The reveal is a ranked leaderboard; unanimous matches are a celebrated bonus, not the required outcome. |
| 6 | **One resolution mechanic: the spin wheel** | Ties among the top go to the wheel. Menus of mechanics (random / highest rating / re-vote) are survey energy; one delightful mechanic is game energy. |
| 7 | **Session lifecycle is designed, not patched** | lobby → voting → (runoff)* → reveal → resolved / abandoned. Host can force-reveal and remove stalled participants. Sessions time out. |
| 8 | **No plug-in framework yet** | Movies is built concretely with two cheap seams: a category-agnostic `DecisionItem` card model and a candidate-provider protocol. The real abstraction is extracted when category #2 arrives. |

## Cut from MVP

- Accounts, profiles, user history tied to identity
- Multiple reveal-resolution mechanics (wheel only)
- Anonymous / majority / unanimous voting modes (scoring *is* the mode)
- All listed nice-to-haves (Golden Vote, tournaments, Watch, widgets, …)

## Postponed but strategic

- **Web guest voting / App Clips** — the real fix for install friction; the BaaS choice keeps the door open.
- **SharePlay** — natively solves the "same room, synchronized reveal" moment.
- **❤️ Favorite** is *in* the MVP (cheap, feeds tiebreaks) but is the first thing cut if the voting UX gets muddy.

## Known risks

1. **The backend is the product.** The realtime session — presence, completion detection, simultaneous reveal — is most of the engineering. The swiping UI is ~30%.
2. **Market graveyard.** Movieswipe, Rave, and a dozen Tinder-for-movies apps exist. Differentiation is the reveal moment and the multi-category future, i.e., execution and delight.
3. **Sync edge cases.** One distracted participant must never hang a session: progress visibility, host force-reveal, and timeouts are core flows, not error handling.
4. **TMDb terms** require attribution and prohibit implying endorsement; watch-provider data is JustWatch-sourced and must be attributed too.
