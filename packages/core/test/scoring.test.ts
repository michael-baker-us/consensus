import { describe, expect, it } from "vitest";

import { SCORING, scoreRound } from "../src/scoring.ts";

describe("scoreRound input validation", () => {
  it("rejects an empty deck", () => {
    expect(() =>
      scoreRound({ deckItemIds: [], participantIds: ["a"], votes: [], runoffsPlayed: 0 }),
    ).toThrow(/empty deck/);
  });

  it("rejects zero participants", () => {
    expect(() =>
      scoreRound({ deckItemIds: ["m1"], participantIds: [], votes: [], runoffsPlayed: 0 }),
    ).toThrow(/no participants/);
  });

  it("rejects duplicate deck items", () => {
    expect(() =>
      scoreRound({ deckItemIds: ["m1", "m1"], participantIds: ["a"], votes: [], runoffsPlayed: 0 }),
    ).toThrow(/duplicate item/);
  });

  it("ignores votes for items not in the deck", () => {
    const results = scoreRound({
      deckItemIds: ["m1"],
      participantIds: ["a"],
      votes: [
        { participantId: "a", itemId: "m1", choice: "yes" },
        { participantId: "a", itemId: "ghost", choice: "favorite" },
      ],
      runoffsPlayed: 0,
    });
    expect(results.scores).toEqual([
      { itemId: "m1", score: 1, yesCount: 1, favoriteCount: 0, noCount: 0 },
    ]);
  });
});

describe("scoring constants", () => {
  // The SQL implementation (M6) hard-codes these same numbers; this test is
  // a tripwire so a casual change here is a conscious cross-language change.
  it("are the v1 rules", () => {
    expect(SCORING).toEqual({
      points: { yes: 1, favorite: 2, no: 0 },
      wheelMaxSegments: 5,
      runoffDeckSize: 5,
      maxRunoffs: 2,
    });
  });
});
