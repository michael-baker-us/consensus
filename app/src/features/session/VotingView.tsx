import { useState } from "react";

import type { VoteChoice } from "@consensus/core";

import type { ScreenProps } from "./SessionFlow.tsx";

const CHOICES: { choice: VoteChoice; label: string; symbol: string }[] = [
  { choice: "no", label: "No", symbol: "👎" },
  { choice: "favorite", label: "Favorite", symbol: "❤️" },
  { choice: "yes", label: "Yes", symbol: "👍" },
];

// Mounted with key={round} (SessionFlow), so each runoff gets fresh state.
export function VotingView({ service, handle, snapshot }: ScreenProps) {
  const [voted, setVoted] = useState<Record<string, VoteChoice>>({});

  const votedCount = Object.keys(voted).length;

  const cast = (itemId: string, choice: VoteChoice) => {
    setVoted((current) => ({ ...current, [itemId]: choice }));
    void service.submitVotes(handle, [{ participantId: handle.participantId, itemId, choice }]);
  };

  return (
    <main className="screen">
      {snapshot.room.status === "runoff" && (
        <p className="banner">Final round! Vote again on the group's top picks.</p>
      )}
      <h1>Vote</h1>
      <p className="muted">
        {votedCount} of {snapshot.deck.length} voted
      </p>
      <ul className="card-list">
        {snapshot.deck.map((item) => (
          <li key={item.id} className="item-row">
            <div className="item-info">
              <span className="item-title">{item.title}</span>
              {item.subtitle && <span className="muted"> {item.subtitle}</span>}
            </div>
            <div className="item-actions">
              {voted[item.id] ? (
                <span className="badge">
                  {CHOICES.find((c) => c.choice === voted[item.id])?.symbol} voted
                </span>
              ) : (
                CHOICES.map(({ choice, label, symbol }) => (
                  <button
                    key={choice}
                    className="btn btn-vote"
                    aria-label={`${label}: ${item.title}`}
                    onClick={() => cast(item.id, choice)}
                  >
                    {symbol}
                  </button>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
