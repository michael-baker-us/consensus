import type { ItemScore, RoundOutcome, RoundResults, Vote } from "./types.ts";

/**
 * The scoring rules, v1. Implemented twice by design — here and in SQL
 * (docs/04) — with the fixtures in /fixtures/scoring as the shared spec.
 * Change a number here and the SQL tests must change with it.
 */
export const SCORING = {
  points: { yes: 1, favorite: 2, no: 0 },
  /** A tie of up to this many items goes straight to the wheel. */
  wheelMaxSegments: 5,
  /** More leaders than the wheel holds → runoff on the top-ranked slice. */
  runoffDeckSize: 5,
  /** After this many runoffs the wheel decides regardless (docs/02). */
  maxRunoffs: 2,
} as const;

export type ScoreRoundInput = {
  /** Deck of the current round, in deck order (the ranking tiebreaker). */
  deckItemIds: string[];
  /** Participants still in the room; departed voters don't count. */
  participantIds: string[];
  votes: Vote[];
  /** Runoffs already played (0 on the initial vote). */
  runoffsPlayed: number;
};

/**
 * Pure and deterministic: same input, same output, everywhere.
 *
 * - A missing vote (force-reveal, leaver) scores 0 and breaks unanimity.
 * - Duplicate votes: the last one wins (mirrors the server's upsert).
 * - Votes from unknown participants or for unknown items are ignored.
 * - Outcome: 1 leader → winner; ≤ wheelMaxSegments leaders → tie (wheel);
 *   more → runoff with the top runoffDeckSize items, until maxRunoffs,
 *   then tie (wheel) with the top wheelMaxSegments items.
 */
export function scoreRound(input: ScoreRoundInput): RoundResults {
  const { deckItemIds, participantIds, votes, runoffsPlayed } = input;
  if (deckItemIds.length === 0) throw new Error("scoreRound: empty deck");
  if (participantIds.length === 0) throw new Error("scoreRound: no participants");
  if (new Set(deckItemIds).size !== deckItemIds.length) {
    throw new Error("scoreRound: duplicate item in deck");
  }

  const deckIndex = new Map(deckItemIds.map((id, i) => [id, i]));
  const participants = new Set(participantIds);

  // participantId → itemId → choice, last write wins.
  const effective = new Map<string, Map<string, Vote["choice"]>>();
  for (const vote of votes) {
    if (!participants.has(vote.participantId)) continue;
    if (!deckIndex.has(vote.itemId)) continue;
    let byItem = effective.get(vote.participantId);
    if (!byItem) {
      byItem = new Map();
      effective.set(vote.participantId, byItem);
    }
    byItem.set(vote.itemId, vote.choice);
  }

  const scores: ItemScore[] = deckItemIds.map((itemId) => {
    let yesCount = 0;
    let favoriteCount = 0;
    let noCount = 0;
    for (const byItem of effective.values()) {
      const choice = byItem.get(itemId);
      if (choice === "yes") yesCount++;
      else if (choice === "favorite") favoriteCount++;
      else if (choice === "no") noCount++;
    }
    return {
      itemId,
      score:
        yesCount * SCORING.points.yes +
        favoriteCount * SCORING.points.favorite +
        noCount * SCORING.points.no,
      yesCount,
      favoriteCount,
      noCount,
    };
  });

  // Sort explicitly on (score desc, deck order asc) — determinism is part
  // of the contract, not an implementation detail.
  scores.sort((a, b) => b.score - a.score || deckIndex.get(a.itemId)! - deckIndex.get(b.itemId)!);

  const unanimousItemIds = deckItemIds.filter((itemId) =>
    participantIds.every((participantId) => {
      const choice = effective.get(participantId)?.get(itemId);
      return choice === "yes" || choice === "favorite";
    }),
  );

  return { scores, unanimousItemIds, outcome: decideOutcome(scores, runoffsPlayed) };
}

function decideOutcome(ranked: ItemScore[], runoffsPlayed: number): RoundOutcome {
  const first = ranked[0];
  if (!first) throw new Error("decideOutcome: empty ranking");
  const leaders = ranked.filter((s) => s.score === first.score);

  if (leaders.length === 1) return { kind: "winner", itemId: first.itemId };
  if (leaders.length <= SCORING.wheelMaxSegments) {
    return { kind: "tie", itemIds: leaders.map((s) => s.itemId) };
  }
  if (runoffsPlayed < SCORING.maxRunoffs) {
    return {
      kind: "runoff",
      itemIds: ranked.slice(0, SCORING.runoffDeckSize).map((s) => s.itemId),
    };
  }
  return {
    kind: "tie",
    itemIds: ranked.slice(0, SCORING.wheelMaxSegments).map((s) => s.itemId),
  };
}
