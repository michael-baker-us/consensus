import { Link } from "react-router";

import { resetDemo } from "./demo.ts";
import { Leaderboard } from "./Leaderboard.tsx";
import type { ScreenProps } from "./SessionFlow.tsx";

export function WinnerView({ snapshot }: ScreenProps) {
  const winner = snapshot.deck.find((item) => item.id === snapshot.room.winnerItemId);
  return (
    <main className="screen">
      <p className="trophy" role="img" aria-label="Winner">
        🏆
      </p>
      <h1>{winner?.title ?? "And the winner is…"}</h1>
      {winner?.subtitle && <p className="muted">{winner.subtitle}</p>}
      {snapshot.results && <Leaderboard snapshot={snapshot} results={snapshot.results} />}
      <nav className="home-actions">
        <button className="btn btn-primary" onClick={resetDemo}>
          Run the demo again
        </button>
        <Link className="btn" to="/">
          Home
        </Link>
      </nav>
    </main>
  );
}
