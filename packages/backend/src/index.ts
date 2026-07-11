// @consensus/backend — the SessionService seam and its implementations.
// Only this package may import supabase-js (docs/04); the Supabase
// implementation arrives in M7.

export {
  SessionError,
  type RoomHandle,
  type SessionErrorCode,
  type SessionService,
} from "./session-service.ts";
export {
  FakeSessionService,
  type FakeSessionOptions,
  type ScriptedGuest,
} from "./fake/fake-session-service.ts";
