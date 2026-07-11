import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import type { FakeSessionService, RoomHandle } from "@consensus/backend";

import {
  createDemoService,
  DEMO_CODE,
  demoConfig,
  loadDemoHandle,
  saveDemoHandle,
} from "./demo.ts";
import { SessionFlow } from "./SessionFlow.tsx";

export function RoomRoute() {
  const { code } = useParams();
  if (code?.toUpperCase() === DEMO_CODE) return <DemoRoom />;
  return (
    <main className="screen">
      <h1>Room {code}</h1>
      <p className="muted">
        Real multiplayer rooms arrive in milestone M7. Until then, the demo room plays a full round
        with scripted friends.
      </p>
      <nav className="home-actions">
        <Link className="btn btn-primary" to={`/room/${DEMO_CODE}`}>
          ▶ Try the demo
        </Link>
        <Link className="btn" to="/">
          Home
        </Link>
      </nav>
    </main>
  );
}

type DemoSession = { service: FakeSessionService; handle: RoomHandle };

function DemoRoom() {
  const [session, setSession] = useState<DemoSession | null>(null);

  useEffect(() => {
    // The service constructor restores persisted room state (reload
    // re-entry) and re-arms the scripted cast's timers.
    const service = createDemoService();
    let cancelled = false;
    void (async () => {
      let handle = loadDemoHandle();
      if (handle) {
        const alive = await service
          .snapshots(handle)
          [Symbol.asyncIterator]()
          .next()
          .then(() => true)
          .catch(() => false);
        if (!alive) handle = null;
      }
      if (!handle) {
        handle = await service.createRoom(demoConfig, "You");
        saveDemoHandle(handle);
      }
      if (!cancelled) setSession({ service, handle });
    })();
    return () => {
      cancelled = true;
      service.dispose();
    };
  }, []);

  if (!session) return <main className="screen muted">Setting up the room…</main>;
  return <SessionFlow service={session.service} handle={session.handle} />;
}
