import type { RoomConfig, SessionSnapshot, Vote, WheelSpin } from "@consensus/core";

/**
 * One participant's membership of one room. Serializable by design: the app
 * persists it (sessionStorage) and re-enters the session after a reload.
 */
export type RoomHandle = {
  roomId: string;
  roomCode: string;
  participantId: string;
};

export type SessionErrorCode =
  | "room-not-found"
  | "room-not-joinable" // exists, but voting already started / expired
  | "not-in-room"
  | "not-host"
  | "invalid-transition"
  | "invalid-winner";

export class SessionError extends Error {
  constructor(
    readonly code: SessionErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SessionError";
  }
}

/**
 * The seam between the UI and any backend (docs/04). FROZEN as of M2:
 * FakeSessionService and SupabaseSessionService both live behind it, so
 * changing this interface is a design review, not a refactor.
 *
 * Contract notes:
 * - `snapshots` emits the current snapshot immediately, then on every
 *   change (fetch-then-stream — consumers never ask "what did I miss?").
 * - The server owns all state transitions. Clients request; the resulting
 *   snapshot is the answer. No method returns the new state directly.
 * - `submitVotes` is idempotent per (participant, item): re-submitting
 *   replaces the earlier choice (upsert semantics; enables undo + retries).
 * - `resolveTie` records the wheel's verdict. The winner is validated
 *   against the tied leaders server-side; the spin itself is cosmetic and
 *   deterministic from the broadcast seed.
 */
export interface SessionService {
  createRoom(config: RoomConfig, hostDisplayName: string): Promise<RoomHandle>;
  joinRoom(roomCode: string, displayName: string): Promise<RoomHandle>;
  snapshots(handle: RoomHandle): AsyncIterable<SessionSnapshot>;
  startVoting(handle: RoomHandle): Promise<void>;
  submitVotes(handle: RoomHandle, votes: Vote[]): Promise<void>;
  forceReveal(handle: RoomHandle): Promise<void>;
  broadcastSpin(handle: RoomHandle, spin: WheelSpin): Promise<void>;
  spins(handle: RoomHandle): AsyncIterable<WheelSpin>;
  resolveTie(handle: RoomHandle, winningItemId: string): Promise<void>;
  leave(handle: RoomHandle): Promise<void>;
}
