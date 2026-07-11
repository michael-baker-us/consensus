import type { RoundResults, SessionSnapshot } from "@consensus/core";

export function Leaderboard({
  snapshot,
  results,
}: {
  snapshot: SessionSnapshot;
  results: RoundResults;
}) {
  const titleOf = (itemId: string) =>
    snapshot.deck.find((item) => item.id === itemId)?.title ?? itemId;
  return (
    <ol className="leaderboard">
      {results.scores.map((score) => (
        <li key={score.itemId} className="leaderboard-row">
          <span className="item-title">{titleOf(score.itemId)}</span>
          {results.unanimousItemIds.includes(score.itemId) && (
            <span className="badge badge-gold">unanimous!</span>
          )}
          <span className="muted">
            {score.score} pts · 👍{score.yesCount} ❤️{score.favoriteCount} 👎{score.noCount}
          </span>
        </li>
      ))}
    </ol>
  );
}
