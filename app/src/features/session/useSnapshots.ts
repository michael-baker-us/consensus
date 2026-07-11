import { useEffect, useState } from "react";

import type { SessionSnapshot } from "@consensus/core";
import type { RoomHandle, SessionService } from "@consensus/backend";

/** Subscribes to the session's snapshot stream. The contract guarantees an
 * immediate first emission, so `null` only lasts one microtask. */
export function useSnapshots(service: SessionService, handle: RoomHandle): SessionSnapshot | null {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);

  useEffect(() => {
    const iterator = service.snapshots(handle)[Symbol.asyncIterator]();
    let active = true;
    void (async () => {
      while (active) {
        const result = await iterator.next();
        if (result.done || !active) break;
        setSnapshot(result.value);
      }
    })();
    return () => {
      active = false;
      void iterator.return?.();
    };
  }, [service, handle]);

  return snapshot;
}
