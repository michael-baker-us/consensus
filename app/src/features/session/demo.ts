import type { RoomConfig } from "@consensus/core";
import { FakeSessionService } from "@consensus/backend";
import type { RoomHandle } from "@consensus/backend";

export const DEMO_CODE = "DEMO";
const HANDLE_KEY = "consensus-demo-handle";

export const demoConfig: RoomConfig = {
  category: "movie",
  filters: { watchProviderIds: [], genreIds: [] },
  deckSize: 8,
};

/** The scripted cast. Fixed seed → the same demo every time, which keeps
 * the e2e suite honest and the demo debuggable. */
export function createDemoService(): FakeSessionService {
  return new FakeSessionService({
    roomCode: DEMO_CODE,
    seed: 20260710,
    deckSize: demoConfig.deckSize,
    scriptedGuests: [
      { displayName: "Maya", joinAfterMs: 1200, finishAfterMs: 2600 },
      { displayName: "Jake", joinAfterMs: 2400, finishAfterMs: 5200 },
      { displayName: "Priya", joinAfterMs: 3600, finishAfterMs: 3800 },
    ],
    storage: sessionStorage,
  });
}

export function loadDemoHandle(): RoomHandle | null {
  const raw = sessionStorage.getItem(HANDLE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomHandle;
  } catch {
    return null;
  }
}

export function saveDemoHandle(handle: RoomHandle): void {
  sessionStorage.setItem(HANDLE_KEY, JSON.stringify(handle));
}

export function resetDemo(): void {
  sessionStorage.removeItem(HANDLE_KEY);
  sessionStorage.removeItem(`consensus-fake-room:${DEMO_CODE}`);
  location.assign(location.href);
}
