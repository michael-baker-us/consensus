import { assertNever } from "@consensus/core";
import type { RoomHandle, SessionService } from "@consensus/backend";
import { Link } from "react-router";

import { useSnapshots } from "./useSnapshots.ts";
import { LobbyView } from "./LobbyView.tsx";
import { RevealView } from "./RevealView.tsx";
import { VotingView } from "./VotingView.tsx";
import { WaitingView } from "./WaitingView.tsx";
import { WinnerView } from "./WinnerView.tsx";

export type ScreenProps = {
  service: SessionService;
  handle: RoomHandle;
  snapshot: NonNullable<ReturnType<typeof useSnapshots>>;
  isHost: boolean;
};

/**
 * The session is a rendering of server state (docs/04): which screen shows
 * is decided by the snapshot, never by navigation. Reload, waking from
 * background, and "someone else advanced the room" are all this one switch.
 */
export function SessionFlow({ service, handle }: { service: SessionService; handle: RoomHandle }) {
  const snapshot = useSnapshots(service, handle);
  if (!snapshot) return <main className="screen muted">Connecting…</main>;

  const isHost = snapshot.room.hostId === handle.participantId;
  const me = snapshot.participants.find((p) => p.id === handle.participantId);
  const props: ScreenProps = { service, handle, snapshot, isHost };

  switch (snapshot.room.status) {
    case "lobby":
      return <LobbyView {...props} />;
    case "voting":
    case "runoff":
      return me?.finished ? (
        <WaitingView {...props} />
      ) : (
        <VotingView key={snapshot.room.round} {...props} />
      );
    case "reveal":
      return snapshot.room.winnerItemId ? <WinnerView {...props} /> : <RevealView {...props} />;
    case "resolved":
      return <WinnerView {...props} />;
    case "abandoned":
      return (
        <main className="screen">
          <h1>Session ended</h1>
          <Link className="btn" to="/">
            Home
          </Link>
        </main>
      );
    default:
      return assertNever(snapshot.room.status);
  }
}
