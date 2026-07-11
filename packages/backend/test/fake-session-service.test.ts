import type { RoomConfig, SessionSnapshot } from "@consensus/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSessionService, SessionError, type RoomHandle } from "../src/index.ts";

const config: RoomConfig = {
  category: "movie",
  filters: { watchProviderIds: [], genreIds: [] },
  deckSize: 8,
};

async function current(service: FakeSessionService, handle: RoomHandle): Promise<SessionSnapshot> {
  for await (const snapshot of service.snapshots(handle)) return snapshot;
  throw new Error("stream ended without a snapshot");
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

async function voteAll(
  service: FakeSessionService,
  handle: RoomHandle,
  choice: "yes" | "no" | "favorite" = "yes",
  itemIds?: string[],
): Promise<void> {
  const deck = itemIds ?? (await current(service, handle)).deck.map((item) => item.id);
  await service.submitVotes(
    handle,
    deck.map((itemId) => ({ participantId: handle.participantId, itemId, choice })),
  );
}

describe("FakeSessionService", () => {
  let service: FakeSessionService;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    service?.dispose();
    vi.useRealTimers();
  });

  it("creates a lobby with the host and emits the current snapshot immediately", async () => {
    service = new FakeSessionService();
    const handle = await service.createRoom(config, "You");
    const snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("lobby");
    expect(snapshot.participants).toEqual([
      { id: handle.participantId, displayName: "You", finished: false },
    ]);
    expect(snapshot.deck.length).toBeGreaterThan(0);
  });

  it("scripted guests join the lobby on their timers", async () => {
    service = new FakeSessionService({
      scriptedGuests: [
        { displayName: "Maya", joinAfterMs: 100, finishAfterMs: 1000 },
        { displayName: "Jake", joinAfterMs: 300, finishAfterMs: 1000 },
      ],
    });
    const handle = await service.createRoom(config, "You");
    expect((await current(service, handle)).participants).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(150);
    expect((await current(service, handle)).participants).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(200);
    expect((await current(service, handle)).participants.map((p) => p.displayName)).toEqual([
      "You",
      "Maya",
      "Jake",
    ]);
  });

  it("only the host can start voting", async () => {
    service = new FakeSessionService();
    const handle = await service.createRoom(config, "You");
    const guest = await service.joinRoom(handle.roomCode, "Jake");
    await expect(service.startVoting(guest)).rejects.toMatchObject({ code: "not-host" });
    await service.startVoting(handle);
    expect((await current(service, handle)).room.status).toBe("voting");
  });

  it("reveals when the last voter finishes, via core scoring", async () => {
    service = new FakeSessionService({
      seed: 42,
      scriptedGuests: [{ displayName: "Maya", joinAfterMs: 10, finishAfterMs: 500 }],
    });
    const handle = await service.createRoom(config, "You");
    await vi.advanceTimersByTimeAsync(20);
    await service.startVoting(handle);
    await voteAll(service, handle, "yes");
    // Host is done, Maya isn't: still voting, host marked finished.
    let snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("voting");
    expect(snapshot.participants.find((p) => p.id === handle.participantId)?.finished).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("reveal");
    expect(snapshot.results).not.toBeNull();
    expect(snapshot.results!.scores).toHaveLength(snapshot.deck.length);
  });

  it("re-submitting a vote replaces the earlier choice (upsert)", async () => {
    service = new FakeSessionService({ deckSize: 2 });
    const handle = await service.createRoom({ ...config, deckSize: 2 }, "You");
    await service.startVoting(handle);
    const [first, second] = (await current(service, handle)).deck;
    await service.submitVotes(handle, [
      { participantId: handle.participantId, itemId: first!.id, choice: "no" },
    ]);
    await service.submitVotes(handle, [
      { participantId: handle.participantId, itemId: first!.id, choice: "favorite" },
      { participantId: handle.participantId, itemId: second!.id, choice: "no" },
    ]);
    const snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("reveal");
    expect(snapshot.results!.scores[0]).toMatchObject({
      itemId: first!.id,
      favoriteCount: 1,
      noCount: 0,
    });
  });

  it("host can force-reveal with missing votes", async () => {
    service = new FakeSessionService({
      scriptedGuests: [{ displayName: "Maya", joinAfterMs: 10, finishAfterMs: 60_000 }],
    });
    const handle = await service.createRoom(config, "You");
    await vi.advanceTimersByTimeAsync(20);
    await service.startVoting(handle);
    await voteAll(service, handle, "yes");
    await service.forceReveal(handle);
    const snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("reveal");
    expect(snapshot.results!.unanimousItemIds).toEqual([]); // Maya's silence breaks unanimity
  });

  it("flat scores trigger a runoff with the top five and a fresh ballot", async () => {
    service = new FakeSessionService({ deckSize: 7 });
    const handle = await service.createRoom({ ...config, deckSize: 7 }, "You");
    await service.startVoting(handle);
    const deck = (await current(service, handle)).deck.map((item) => item.id);
    await service.submitVotes(
      handle,
      deck.map((itemId, i) => ({
        participantId: handle.participantId,
        itemId,
        choice: i < 6 ? ("yes" as const) : ("no" as const),
      })),
    );
    const snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("runoff");
    expect(snapshot.room.round).toBe(1);
    expect(snapshot.deck).toHaveLength(5);
    expect(snapshot.results).toBeNull(); // no mid-narrowing reveal
    expect(snapshot.participants[0]?.finished).toBe(false);
  });

  it("resolveTie validates the winner against the tied leaders", async () => {
    service = new FakeSessionService({ deckSize: 2 });
    const handle = await service.createRoom({ ...config, deckSize: 2 }, "You");
    await service.startVoting(handle);
    await voteAll(service, handle, "yes");
    const snapshot = await current(service, handle);
    expect(snapshot.results!.outcome.kind).toBe("tie");
    await expect(service.resolveTie(handle, "demo:999")).rejects.toMatchObject({
      code: "invalid-winner",
    });
    await service.resolveTie(handle, "demo:2");
    expect((await current(service, handle)).room.winnerItemId).toBe("demo:2");
  });

  it("a leaver can cause completion", async () => {
    service = new FakeSessionService({ deckSize: 3 });
    const handle = await service.createRoom({ ...config, deckSize: 3 }, "You");
    const guest = await service.joinRoom(handle.roomCode, "Jake");
    await service.startVoting(handle);
    const deck = (await current(service, handle)).deck.map((item) => item.id);
    await service.submitVotes(
      handle,
      deck.map((itemId, i) => ({
        participantId: handle.participantId,
        itemId,
        choice: i === 0 ? ("yes" as const) : ("no" as const),
      })),
    );
    expect((await current(service, handle)).room.status).toBe("voting");
    await service.leave(guest);
    const snapshot = await current(service, handle);
    expect(snapshot.room.status).toBe("reveal");
    expect(snapshot.results!.outcome).toEqual({ kind: "winner", itemId: deck[0] });
  });

  it("restores persisted state in a new instance (page reload)", async () => {
    const storage = memoryStorage();
    service = new FakeSessionService({ storage });
    const handle = await service.createRoom(config, "You");
    await service.startVoting(handle);
    service.dispose();

    const reloaded = new FakeSessionService({ storage });
    try {
      const snapshot = await current(reloaded, handle);
      expect(snapshot.room.status).toBe("voting");
      expect(snapshot.participants[0]?.displayName).toBe("You");
    } finally {
      reloaded.dispose();
    }
  });

  it("rejects joining a room that already started", async () => {
    service = new FakeSessionService();
    const handle = await service.createRoom(config, "You");
    await service.startVoting(handle);
    await expect(service.joinRoom(handle.roomCode, "Late")).rejects.toBeInstanceOf(SessionError);
    await expect(service.joinRoom(handle.roomCode, "Late")).rejects.toMatchObject({
      code: "room-not-joinable",
    });
  });
});
