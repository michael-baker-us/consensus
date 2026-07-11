import type { ScreenProps } from "./SessionFlow.tsx";

export function LobbyView({ service, handle, snapshot, isHost }: ScreenProps) {
  const canStart = snapshot.participants.length >= 2;
  return (
    <main className="screen">
      <p className="muted">Room code</p>
      <h1 className="room-code">{snapshot.room.code}</h1>
      <ul className="participants" aria-label="Participants">
        {snapshot.participants.map((p) => (
          <li key={p.id} className="participant">
            {p.displayName}
            {p.id === snapshot.room.hostId && <span className="badge">host</span>}
          </li>
        ))}
      </ul>
      {isHost ? (
        <button
          className="btn btn-primary"
          disabled={!canStart}
          onClick={() => void service.startVoting(handle)}
        >
          {canStart ? "Start voting" : "Waiting for at least one more…"}
        </button>
      ) : (
        <p className="muted">Waiting for the host to start…</p>
      )}
    </main>
  );
}
