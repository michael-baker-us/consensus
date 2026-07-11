# Consensus — Local Testing, Phone Testing, and Going Live (Web)

The web pivot (docs/01 amendment) turned this from the hardest document into
the easiest one. Everything below is free.

## What you need

| Thing                                             | Cost | Needed from                                 |
| ------------------------------------------------- | ---- | ------------------------------------------- |
| Node 22+ / pnpm                                   | free | M0                                          |
| Docker Desktop + Supabase CLI                     | free | M6 — local database                         |
| Supabase hosted project (free tier)               | free | M5 (Edge Function) / M7 (phone multiplayer) |
| TMDb API key                                      | free | M5                                          |
| GitHub Pages (or Cloudflare Pages/Vercel/Netlify) | free | M0 — live from day one                      |

There is no developer program, no signing, no provisioning, no 7-day expiry,
no review process. The former iOS version of this doc needed $99 and an
appendix about App Review; this one needs a URL.

## 1. Testing on your Mac

- `pnpm dev` → Vite serves the app with hot reload. `/room/DEMO` runs the
  full game loop on `FakeSessionService` — no network, no database (M0–M4
  world).
- Tests: `pnpm test` (Vitest — `core` tests run in milliseconds; this is the
  M1 loop), `pnpm e2e` (Playwright against the fake backend).
- **Multiplayer on one Mac is just two browser windows.** Host in one, join
  in the other — side by side. Playwright automates exactly this (two
  browser contexts in one spec), so the multiplayer happy path runs in CI on
  every PR.
- Mobile layout: browser devtools device emulation covers daily work; real
  gestures still get verified on a real phone (below) before calling a
  feature done.

### Local Supabase (M6+)

```sh
brew install supabase/tap/supabase
supabase start          # Postgres + realtime + auth in Docker
supabase functions serve deck-builder   # TMDb proxy locally
```

Prints a local URL + anon key; a gitignored `.env.local` feeds them to Vite
(`VITE_SUPABASE_URL`, …). The TMDb key lives only in the Edge Function's
server-side secrets — never in the client env. SQL tests (M6) run against
this same container, locally and in CI.

## 2. Testing on your phone

Two options, both trivial:

- **Same Wi-Fi:** `pnpm dev --host` → Vite prints a LAN URL
  (`http://192.168.x.x:5173`) → open it on the phone. Hot reload works on
  the phone too. This is the M3 "does swiping feel right on a thumb" loop.
- **Anywhere:** push to main → the deployed URL updates → open it on any
  phone. From M0 there is always a current build one link away.

For multiplayer with physical phones (M7+), point the app at the **hosted
Supabase free-tier project** (same migrations via `supabase db push`; the
phone can't see your Mac's Docker). Standing setup: local Docker for CI and
SQL tests, hosted free project for anything with a phone. Free-tier limits
(500 MB DB, 200 concurrent realtime connections) dwarf a movie night.

## 3. Sharing with friends (the whole point of the pivot)

Send the URL. That's the section.

(Friends on iPhone _and_ Android join the same room from the same link with
nothing installed. The QR in the lobby encodes the join URL, so the native
camera app scans straight in.)

## 4. Going live and staying live

- **Hosting:** GitHub Pages via an Actions deploy job on merge to main —
  free, in-repo, no accounts beyond GitHub. SPA note: Pages needs the
  `404.html` fallback trick for client-side routes (`/join/CODE` on a hard
  refresh); if that ever grates, Cloudflare Pages handles SPA fallback
  natively and is an hour's migration.
- **Environments:** the deployed app talks to a dedicated hosted Supabase
  project (separate from the dev one once real humans use it — two free
  projects is fine). PR previews (deploy-per-branch) are a nice later
  addition via Cloudflare Pages/Vercel if wanted.
- **Custom domain:** optional vanity (`consensus.yourname.dev`) — DNS +
  a checkbox, whenever.
- **PWA (M10):** manifest + icons makes "Add to Home Screen" give an
  app-like standalone experience. This is as close to "installing" as the
  project needs.
- **Versioning:** tag releases (`v1.0.0`), GitHub Releases with notes; the
  deploy job stamps the commit SHA into the footer so you always know what's
  live.

## 5. The portfolio (the actual deliverable)

The pivot's biggest win: **reviewers can use the product, not watch it.**

- README top: the live URL and a `/room/DEMO` link ("play a round by
  yourself right now, nothing to install") _above_ the demo video.
- 30-second video: two browser windows, host and guest, synchronized reveal
  and wheel — recorded with QuickTime in minutes.
- The `docs/01–06` planning trail, CI badges, small-PR history, and a
  five-step "run it locally" section complete the picture: evidence of _why_
  and _how_, not just _what_.

## Appendix: if it ever needs to be a "real app"

The PWA covers home-screen presence. If demand ever justifies app stores:
the SwiftUI client (original docs 02–03 specs still apply) runs against this
exact backend unchanged — that's what "the backend is client-agnostic" buys.
No decision needed until then.
