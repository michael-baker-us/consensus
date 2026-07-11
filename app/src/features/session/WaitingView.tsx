import type { ScreenProps } from "./SessionFlow.tsx";

export function WaitingView({ service, handle, snapshot, isHost }: ScreenProps) {
  const finished = snapshot.participants.filter((p) => p.finished).length;
  const total = snapshot.participants.length;
  return (
    <main className="screen">
      <h1>You're done!</h1>
      <p className="progress-count">
        {finished} of {total} finished
      </p>
      <ul className="participants" aria-label="Progress">
        {snapshot.participants.map((p) => (
          <li key={p.id} className="participant">
            {p.finished ? "✅" : "⏳"} {p.displayName}
          </li>
        ))}
      </ul>
      {isHost && finished < total && (
        <button className="btn" onClick={() => void service.forceReveal(handle)}>
          Reveal now
        </button>
      )}
    </main>
  );
}
