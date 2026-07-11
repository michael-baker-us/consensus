# Consensus

Decide together. Groups vote privately on a deck of options — movies, for
now — then a game-like reveal (ranked leaderboard, spin wheel for ties)
picks the winner. Goal: a group decision in under five minutes.

> 🚧 In progress — milestone **M0** of the [roadmap](docs/05-roadmap.md).
> A live demo link and video will land here as milestones ship.

## How it works

1. A host creates a room, picks streaming services and genres, and shares a
   link or QR code.
2. Friends join in the browser — nothing to install, no accounts, just a name.
3. Everyone swipes through the same small deck privately: 👎 / 👍 / ❤️.
4. When the last person finishes, every phone reveals the results at the
   same moment. Ties spin a wheel.

## The docs are the spec

The full planning trail — product review, design, UX, architecture,
roadmap — lives in [`docs/`](docs/). Start with
[01-product-review.md](docs/01-product-review.md).

## Stack

React 19 · TypeScript (strict) · Vite · Motion · Zustand · Supabase
(Postgres RPCs + RLS + realtime) · Vitest · Playwright · GitHub Pages.

pnpm workspace: `app/` (UI), `packages/core` (pure domain logic, zero
dependencies), `packages/backend` (the `SessionService` seam; the only
package allowed to import supabase-js).

## Run it locally

```sh
corepack enable        # once, if pnpm isn't installed
pnpm install
pnpm dev               # app on http://localhost:5173
pnpm test              # workspace tests
```
