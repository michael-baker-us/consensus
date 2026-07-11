import { useState } from "react";

import type { ScreenProps } from "./SessionFlow.tsx";
import { Leaderboard } from "./Leaderboard.tsx";

export function RevealView({ service, handle, snapshot, isHost }: ScreenProps) {
  const [spinning, setSpinning] = useState(false);
  const results = snapshot.results;
  if (!results) return <main className="screen muted">Counting votes…</main>;

  const tie = results.outcome.kind === "tie" ? results.outcome.itemIds : null;

  // Placeholder wheel (M4 brings the real one): the seed deterministically
  // picks the winner, exactly as the shared spin will.
  const spin = async (itemIds: string[]) => {
    setSpinning(true);
    const seed = Date.now() >>> 0;
    await service.broadcastSpin(handle, { seed, velocity: 1, startedAtMs: Date.now() });
    setTimeout(() => {
      void service.resolveTie(handle, itemIds[seed % itemIds.length]!);
    }, 1200);
  };

  return (
    <main className="screen">
      <h1>Results</h1>
      <Leaderboard snapshot={snapshot} results={results} />
      {tie && (
        <section className="tie-block">
          <p className="banner">It's a tie!</p>
          {spinning ? (
            <p className="muted">🎡 Spinning…</p>
          ) : isHost ? (
            <button className="btn btn-primary" onClick={() => void spin(tie)}>
              Spin the wheel
            </button>
          ) : (
            <p className="muted">Waiting for the host to spin the wheel…</p>
          )}
        </section>
      )}
    </main>
  );
}
