import { useState, useEffect, useRef } from "react";
import { useSession } from "../context/SessionContext.js";
import NoSession from "../components/NoSession.js";
import { api } from "../api/client.js";
import styles from "./TimelinePage.module.css";
import type { TimelineEvent } from "../api/types.js";

const KIND_COLOR: Record<string, string> = {
  connect: "#4ade80",
  "initialize-request": "#7c6af0",
  "initialize-response": "#7c6af0",
  request: "#60a5fa",
  response: "#94a3b8",
  notification: "#fb923c",
  error: "#f87171",
  close: "#f87171",
};

const DIR_LABEL: Record<string, string> = {
  outbound: "→",
  inbound:  "←",
  internal: "·",
};

export default function TimelinePage() {
  const { session } = useSession();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [polling, setPolling] = useState(true);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!session || !polling) return;
    const fetch = () => {
      api.timeline.get(session.id, lastTs.current).then((newEvents) => {
        if (newEvents.length > 0) {
          lastTs.current = newEvents[newEvents.length - 1]!.timestamp;
          setEvents((prev) => [...prev, ...newEvents]);
        }
      }).catch(() => {});
    };
    fetch();
    const id = setInterval(fetch, 1500);
    return () => clearInterval(id);
  }, [session, polling]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!session) return <NoSession />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Timeline <span className={styles.count}>{events.length}</span></h1>
        <div className={styles.controls}>
          <button
            className={[styles.ctrlBtn, polling ? styles.ctrlActive : ""].join(" ").trim()}
            onClick={() => setPolling((p) => !p)}
          >
            {polling ? "⏸ Pause" : "▶ Resume"}
          </button>
          <button className={styles.ctrlBtn} onClick={() => { setEvents([]); lastTs.current = 0; }}>
            Clear
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className={styles.empty}>No events yet. Perform actions to see them here.</p>
      ) : (
        <div className={styles.feed}>
          {events.map((evt) => (
            <div key={evt.id} className={styles.evt} onClick={() => toggle(evt.id)}>
              <div className={styles.evtHeader}>
                <span className={styles.evtKind} style={{ color: KIND_COLOR[evt.kind] ?? "#94a3b8" }}>
                  {evt.kind}
                </span>
                <span className={styles.evtDir}>{DIR_LABEL[evt.direction] ?? ""}</span>
                {evt.method && <span className={styles.evtMethod}>{evt.method}</span>}
                {evt.durationMs !== undefined && (
                  <span className={styles.evtDuration}>{evt.durationMs}ms</span>
                )}
                <span className={styles.evtTime}>{new Date(evt.timestamp).toISOString().slice(11, 23)}</span>
              </div>
              {expanded.has(evt.id) && (
                <pre className={styles.evtPayload}>{JSON.stringify(evt.payload, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
