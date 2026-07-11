import {
  SCORING,
  scoreRound,
  type DecisionItem,
  type Participant,
  type RoomConfig,
  type RoundResults,
  type SessionSnapshot,
  type Vote,
  type WheelSpin,
} from "@consensus/core";

import { Emitter } from "../emitter.ts";
import { SessionError, type RoomHandle, type SessionService } from "../session-service.ts";
import { demoDeck } from "./demo-deck.ts";
import { createRng } from "./rng.ts";

export type ScriptedGuest = {
  displayName: string;
  /** Delay after room creation before this guest appears in the lobby. */
  joinAfterMs: number;
  /** Delay after each voting round starts before this guest finishes it. */
  finishAfterMs: number;
};

export type FakeSessionOptions = {
  roomCode?: string;
  /** Drives scripted guests' votes; fixed seed → fully deterministic demo. */
  seed?: number;
  scriptedGuests?: ScriptedGuest[];
  deckSize?: number;
  /** Persists room state across page reloads (sessionStorage in the app,
   * nothing in tests). */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
};

type InternalParticipant = Participant & {
  scripted: boolean;
  joined: boolean;
};

type RoomState = {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: SessionSnapshot["room"]["status"];
  round: number;
  runoffsPlayed: number;
  config: RoomConfig;
  participants: InternalParticipant[];
  fullDeck: DecisionItem[];
  currentDeckIds: string[];
  /** Votes per round; scoring only ever sees the current round's slice. */
  votesByRound: Vote[][];
  results: RoundResults | null;
  winnerItemId?: string;
  seed: number;
};

const STORAGE_PREFIX = "consensus-fake-room:";

/**
 * In-memory implementation of the frozen SessionService contract. It runs
 * the same transition rules the SQL functions will implement in M6 — via
 * the same @consensus/core scoring — so the demo can't drift from the real
 * game. Scripted guests join and vote on timers to simulate a group.
 */
export class FakeSessionService implements SessionService {
  private state: RoomState | null = null;
  private readonly snapshotEmitter = new Emitter<SessionSnapshot>();
  private readonly spinEmitter = new Emitter<WheelSpin>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly options: Required<
    Pick<FakeSessionOptions, "roomCode" | "seed" | "scriptedGuests" | "deckSize">
  > & { storage: FakeSessionOptions["storage"] };

  constructor(options: FakeSessionOptions = {}) {
    this.options = {
      roomCode: options.roomCode ?? "DEMO",
      seed: options.seed ?? 1234,
      scriptedGuests: options.scriptedGuests ?? [],
      deckSize: options.deckSize ?? 8,
      storage: options.storage ?? null,
    };
    this.restore();
  }

  /** Stops scripted timers (tests, unmount). State stays persisted. */
  dispose(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  async createRoom(config: RoomConfig, hostDisplayName: string): Promise<RoomHandle> {
    const hostId = "p-host";
    this.state = {
      roomId: `fake-${this.options.roomCode}`,
      roomCode: this.options.roomCode,
      hostId,
      status: "lobby",
      round: 0,
      runoffsPlayed: 0,
      config,
      participants: [
        {
          id: hostId,
          displayName: hostDisplayName,
          finished: false,
          scripted: false,
          joined: true,
        },
        ...this.options.scriptedGuests.map((guest, i) => ({
          id: `p-guest-${i + 1}`,
          displayName: guest.displayName,
          finished: false,
          scripted: true,
          joined: false,
        })),
      ],
      fullDeck: demoDeck(Math.min(config.deckSize, this.options.deckSize)),
      currentDeckIds: [],
      votesByRound: [[]],
      results: null,
      seed: this.options.seed,
    };
    this.state.currentDeckIds = this.state.fullDeck.map((item) => item.id);
    this.scheduleScriptedJoins();
    this.commit();
    return { roomId: this.state.roomId, roomCode: this.state.roomCode, participantId: hostId };
  }

  async joinRoom(roomCode: string, displayName: string): Promise<RoomHandle> {
    const state = this.state;
    if (!state || state.roomCode !== roomCode) throw new SessionError("room-not-found");
    if (state.status !== "lobby") throw new SessionError("room-not-joinable");
    const participant: InternalParticipant = {
      id: `p-${crypto.randomUUID().slice(0, 8)}`,
      displayName,
      finished: false,
      scripted: false,
      joined: true,
    };
    state.participants.push(participant);
    this.commit();
    return { roomId: state.roomId, roomCode: state.roomCode, participantId: participant.id };
  }

  snapshots(handle: RoomHandle): AsyncIterable<SessionSnapshot> {
    this.requireState(handle);
    return this.snapshotEmitter.stream(() => this.snapshot());
  }

  spins(handle: RoomHandle): AsyncIterable<WheelSpin> {
    this.requireState(handle);
    return this.spinEmitter.stream();
  }

  async startVoting(handle: RoomHandle): Promise<void> {
    const state = this.requireHost(handle);
    if (state.status !== "lobby") throw new SessionError("invalid-transition");
    state.status = "voting";
    this.scheduleScriptedFinishes();
    this.commit();
  }

  async submitVotes(handle: RoomHandle, votes: Vote[]): Promise<void> {
    const state = this.requireState(handle);
    if (state.status !== "voting" && state.status !== "runoff") {
      throw new SessionError("invalid-transition");
    }
    this.recordVotes(
      state,
      votes.map((vote) => ({ ...vote, participantId: handle.participantId })),
    );
  }

  async forceReveal(handle: RoomHandle): Promise<void> {
    const state = this.requireHost(handle);
    if (state.status !== "voting" && state.status !== "runoff") {
      throw new SessionError("invalid-transition");
    }
    // The host asked for an end, not another round: score as if runoffs
    // are exhausted, so the outcome is a winner or a tie — never a runoff.
    // (M6's SQL force_reveal must do the same.)
    this.reveal(state, { final: true });
    this.commit();
  }

  async broadcastSpin(handle: RoomHandle, spin: WheelSpin): Promise<void> {
    this.requireHost(handle);
    this.spinEmitter.emit(spin);
  }

  async resolveTie(handle: RoomHandle, winningItemId: string): Promise<void> {
    const state = this.requireHost(handle);
    const outcome = state.results?.outcome;
    if (state.status !== "reveal" || outcome?.kind !== "tie") {
      throw new SessionError("invalid-transition");
    }
    if (!outcome.itemIds.includes(winningItemId)) throw new SessionError("invalid-winner");
    state.winnerItemId = winningItemId;
    this.commit();
  }

  async leave(handle: RoomHandle): Promise<void> {
    const state = this.requireState(handle);
    const participant = state.participants.find((p) => p.id === handle.participantId);
    if (!participant) return;
    participant.joined = false;
    // A leaver can cause completion (docs/04).
    if (state.status === "voting" || state.status === "runoff") this.checkCompletion(state);
    this.commit();
  }

  // --- internals -----------------------------------------------------------

  private recordVotes(state: RoomState, votes: Vote[]): void {
    const round = state.votesByRound[state.round] ?? [];
    for (const vote of votes) {
      if (!state.currentDeckIds.includes(vote.itemId)) continue;
      const existing = round.findIndex(
        (v) => v.participantId === vote.participantId && v.itemId === vote.itemId,
      );
      if (existing >= 0) round[existing] = vote;
      else round.push(vote);
    }
    state.votesByRound[state.round] = round;
    this.checkCompletion(state);
    this.commit();
  }

  /** The transition the SQL submit_votes performs atomically in M6. */
  private checkCompletion(state: RoomState): void {
    const active = state.participants.filter((p) => p.joined);
    if (active.length === 0) return;
    const round = state.votesByRound[state.round] ?? [];
    for (const participant of active) {
      participant.finished = state.currentDeckIds.every((itemId) =>
        round.some((v) => v.participantId === participant.id && v.itemId === itemId),
      );
    }
    if (active.every((p) => p.finished)) this.reveal(state);
  }

  private reveal(state: RoomState, { final = false } = {}): void {
    const active = state.participants.filter((p) => p.joined);
    const results = scoreRound({
      deckItemIds: state.currentDeckIds,
      participantIds: active.map((p) => p.id),
      votes: state.votesByRound[state.round] ?? [],
      runoffsPlayed: final ? SCORING.maxRunoffs : state.runoffsPlayed,
    });
    if (results.outcome.kind === "runoff") {
      state.round += 1;
      state.runoffsPlayed += 1;
      state.currentDeckIds = results.outcome.itemIds;
      state.votesByRound[state.round] = [];
      state.results = null; // no mid-narrowing reveal (docs/03)
      state.status = "runoff";
      for (const participant of state.participants) participant.finished = false;
      this.scheduleScriptedFinishes();
      return;
    }
    state.results = results;
    state.status = "reveal";
    if (results.outcome.kind === "winner") state.winnerItemId = results.outcome.itemId;
    // "resolved" is reserved for an explicit end-of-session action; the
    // reveal → winner progression is client-side choreography (M4).
  }

  private scheduleScriptedJoins(): void {
    const state = this.state;
    if (!state) return;
    for (const [i, guest] of this.options.scriptedGuests.entries()) {
      const participant = state.participants.find((p) => p.id === `p-guest-${i + 1}`);
      if (!participant || participant.joined) continue;
      this.after(guest.joinAfterMs, () => {
        if (!this.state || this.state.status !== "lobby") return;
        participant.joined = true;
        this.commit();
      });
    }
  }

  private scheduleScriptedFinishes(): void {
    const state = this.state;
    if (!state) return;
    for (const [i, guest] of this.options.scriptedGuests.entries()) {
      const participant = state.participants.find((p) => p.id === `p-guest-${i + 1}`);
      if (!participant?.joined || participant.finished) continue;
      this.after(guest.finishAfterMs, () => {
        const current = this.state;
        if (!current || (current.status !== "voting" && current.status !== "runoff")) return;
        if (!participant.joined || participant.finished) return;
        this.recordVotes(current, this.scriptedBallot(current, participant.id, i));
      });
    }
  }

  /** Deterministic: seed + guest index + round → identical votes on replay. */
  private scriptedBallot(state: RoomState, participantId: string, guestIndex: number): Vote[] {
    const rng = createRng(state.seed + guestIndex * 101 + state.round * 7919);
    return state.currentDeckIds.map((itemId) => {
      const roll = rng();
      const choice = roll < 0.55 ? "yes" : roll < 0.85 ? "no" : "favorite";
      return { participantId, itemId, choice };
    });
  }

  private after(ms: number, fn: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  private snapshot(): SessionSnapshot {
    const state = this.state;
    if (!state) throw new SessionError("room-not-found");
    const deckById = new Map(state.fullDeck.map((item) => [item.id, item]));
    return {
      room: {
        id: state.roomId,
        code: state.roomCode,
        hostId: state.hostId,
        status: state.status,
        round: state.round,
        config: state.config,
        ...(state.winnerItemId !== undefined && { winnerItemId: state.winnerItemId }),
      },
      participants: state.participants
        .filter((p) => p.joined)
        .map(({ id, displayName, finished }) => ({ id, displayName, finished })),
      deck: state.currentDeckIds.map((id) => deckById.get(id)!),
      results: state.results,
    };
  }

  private commit(): void {
    const storage = this.options.storage;
    if (storage && this.state) {
      storage.setItem(STORAGE_PREFIX + this.state.roomCode, JSON.stringify(this.state));
    }
    this.snapshotEmitter.emit(this.snapshot());
  }

  private restore(): void {
    const storage = this.options.storage;
    if (!storage) return;
    const raw = storage.getItem(STORAGE_PREFIX + this.options.roomCode);
    if (!raw) return;
    try {
      this.state = JSON.parse(raw) as RoomState;
    } catch {
      storage.removeItem(STORAGE_PREFIX + this.options.roomCode);
      return;
    }
    // Re-arm whatever the scripted cast hadn't done yet when the page died.
    if (this.state.status === "lobby") this.scheduleScriptedJoins();
    if (this.state.status === "voting" || this.state.status === "runoff") {
      this.scheduleScriptedFinishes();
    }
  }

  private requireState(handle: RoomHandle): RoomState {
    const state = this.state;
    if (!state || state.roomId !== handle.roomId) throw new SessionError("room-not-found");
    if (!state.participants.some((p) => p.id === handle.participantId && p.joined)) {
      throw new SessionError("not-in-room");
    }
    return state;
  }

  private requireHost(handle: RoomHandle): RoomState {
    const state = this.requireState(handle);
    if (state.hostId !== handle.participantId) throw new SessionError("not-host");
    return state;
  }
}
