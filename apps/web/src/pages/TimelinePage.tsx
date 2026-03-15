import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "../context/SessionContext.js";
import NoSession from "../components/NoSession.js";
import { api } from "../api/client.js";
import styles from "./TimelinePage.module.css";
import type { TimelineEvent } from "../api/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "all" | "init" | "tools" | "resources" | "prompts" | "notifications";

interface ProtocolCall {
  id: string;
  method: string;
  subLabel?: string;
  category: Exclude<Category, "all"> | "other";
  timestamp: number;
  durationMs?: number;
  status: "pending" | "success" | "error";
  requestEvent?: TimelineEvent;
  responseEvent?: TimelineEvent;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS: { id: Category; label: string }[] = [
  { id: "all",           label: "All" },
  { id: "init",          label: "Initialize" },
  { id: "tools",         label: "Tools" },
  { id: "resources",     label: "Resources" },
  { id: "prompts",       label: "Prompts" },
  { id: "notifications", label: "Notifications" },
];

const DOT_CLASS: Record<string, string> = {
  init:          styles.dotInit,
  tools:         styles.dotTools,
  resources:     styles.dotResources,
  prompts:       styles.dotPrompts,
  notifications: styles.dotNotifications,
  other:         styles.dotOther,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(method: string | undefined): ProtocolCall["category"] {
  if (!method || method === "initialize") return "init";
  if (method.startsWith("tools/"))        return "tools";
  if (method.startsWith("resources/"))    return "resources";
  if (method.startsWith("prompts/"))      return "prompts";
  return "other";
}

function getSubLabel(method: string | undefined, payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const params = (payload as Record<string, unknown>).params as Record<string, unknown> | undefined;
  if (method === "tools/call"      && params?.name) return `[${params.name}]`;
  if (method === "resources/read"  && params?.uri)  {
    const u = String(params.uri);
    return `[${u.length > 28 ? "…" + u.slice(-28) : u}]`;
  }
  if (method === "prompts/get"     && params?.name) return `[${params.name}]`;
  return undefined;
}

function eventsToCallsMemo(events: TimelineEvent[]): ProtocolCall[] {
  const calls: ProtocolCall[] = [];
  const pendingById = new Map<string | number, ProtocolCall>();

  for (const evt of events) {
    switch (evt.kind) {
      case "connect":
      case "close":
      case "error": {
        calls.push({
          id:           evt.id,
          method:       evt.kind,
          category:     "other",
          timestamp:    evt.timestamp,
          status:       evt.kind === "error" ? "error" : "success",
          requestEvent: evt,
        });
        break;
      }

      case "initialize-request":
      case "request": {
        const call: ProtocolCall = {
          id:           evt.id,
          method:       evt.method ?? "unknown",
          subLabel:     getSubLabel(evt.method, evt.payload),
          category:     getCategory(evt.method),
          timestamp:    evt.timestamp,
          status:       "pending",
          requestEvent: evt,
        };
        if (evt.requestId !== undefined) pendingById.set(evt.requestId, call);
        calls.push(call);
        break;
      }

      case "response": {
        if (evt.requestId !== undefined) {
          const call = pendingById.get(evt.requestId);
          if (call) {
            const p = evt.payload as Record<string, unknown> | null | undefined;
            call.status        = p?.error !== undefined ? "error" : "success";
            call.responseEvent = evt;
            call.durationMs    = evt.durationMs ?? (evt.timestamp - call.timestamp);
            pendingById.delete(evt.requestId);
          }
        }
        break;
      }

      case "notification":
      case "initialize-response": {
        calls.push({
          id:           evt.id,
          method:       evt.method ?? "notification",
          category:     "notifications",
          timestamp:    evt.timestamp,
          status:       "success",
          requestEvent: evt,
        });
        break;
      }
    }
  }
  return calls;
}

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 23);
}

// ─── JSON syntax highlighting ─────────────────────────────────────────────────

type TokType = "key" | "str" | "num" | "bool" | "null" | "ws";
interface Tok { type: TokType; text: string }

const TOK_RE = /("(?:[^"\\]|\\[\s\S])*"\s*:)|("(?:[^"\\]|\\[\s\S])*")|(true|false)|(null)|(-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)|([\s\S])/g;

function tokenize(json: string): Tok[] {
  const out: Tok[] = [];
  let m: RegExpExecArray | null;
  TOK_RE.lastIndex = 0;
  while ((m = TOK_RE.exec(json)) !== null) {
    if      (m[1] != null) out.push({ type: "key",  text: m[1] });
    else if (m[2] != null) out.push({ type: "str",  text: m[2] });
    else if (m[3] != null) out.push({ type: "bool", text: m[3] });
    else if (m[4] != null) out.push({ type: "null", text: m[4] });
    else if (m[5] != null) out.push({ type: "num",  text: m[5] });
    else if (m[6] != null) out.push({ type: "ws",   text: m[6] });
  }
  return out;
}

const TOK_CLASS: Record<TokType, string> = {
  key:  styles.jsonKey,
  str:  styles.jsonStr,
  num:  styles.jsonNum,
  bool: styles.jsonBool,
  null: styles.jsonNull,
  ws:   "",
};

function SyntaxJson({ value }: { value: unknown }) {
  const tokens = useMemo(() => tokenize(JSON.stringify(value, null, 2)), [value]);
  return (
    <pre className={styles.jsonPre}>
      {tokens.map((t, i) =>
        TOK_CLASS[t.type]
          ? <span key={i} className={TOK_CLASS[t.type]}>{t.text}</span>
          : t.text
      )}
    </pre>
  );
}

// ─── StatusIcon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ProtocolCall["status"] }) {
  if (status === "pending") return <span className={styles.statusPending}>●</span>;
  if (status === "success") return <span className={styles.statusSuccess}>✓</span>;
  return <span className={styles.statusError}>✗</span>;
}

// ─── CallRow ──────────────────────────────────────────────────────────────────

function CallRow({ call, isSelected, onClick }: {
  call: ProtocolCall;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={[styles.callRow, isSelected ? styles.callRowSelected : ""].join(" ").trim()}
      onClick={onClick}
    >
      <span className={[styles.dot, DOT_CLASS[call.category] ?? styles.dotOther].join(" ")} />
      <span className={styles.callMethod}>{call.method}</span>
      {call.subLabel && <span className={styles.callSub}>{call.subLabel}</span>}
      <span className={styles.callMeta}>
        <StatusIcon status={call.status} />
        {call.durationMs !== undefined && (
          <span className={styles.callDur}>{call.durationMs}ms</span>
        )}
        <span className={styles.callTime}>{fmtTime(call.timestamp)}</span>
      </span>
    </button>
  );
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

function DetailPanel({ call, tab, onTabChange }: {
  call: ProtocolCall;
  tab: "request" | "response";
  onTabChange: (t: "request" | "response") => void;
}) {
  const hasReq  = call.requestEvent?.payload  !== undefined;
  const hasResp = call.responseEvent?.payload !== undefined;
  const payload = tab === "request" ? call.requestEvent?.payload : call.responseEvent?.payload;

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <span className={[styles.dot, DOT_CLASS[call.category] ?? styles.dotOther].join(" ")} />
        <span className={styles.detailMethod}>{call.method}</span>
        {call.subLabel && <span className={styles.detailSub}>{call.subLabel}</span>}
        <StatusIcon status={call.status} />
        {call.durationMs !== undefined && (
          <span className={styles.detailDur}>{call.durationMs}ms</span>
        )}
        <span className={styles.detailTs}>{fmtTime(call.timestamp)}</span>
      </div>

      <div className={styles.detailTabs}>
        <button
          className={[styles.detailTab, tab === "request" ? styles.detailTabActive : ""].join(" ").trim()}
          onClick={() => onTabChange("request")}
          disabled={!hasReq}
        >
          Request
        </button>
        <button
          className={[styles.detailTab, tab === "response" ? styles.detailTabActive : ""].join(" ").trim()}
          onClick={() => onTabChange("response")}
          disabled={!hasResp}
        >
          Response
          {call.status === "pending" && <span className={styles.pendingPulse} />}
        </button>
      </div>

      <div className={styles.detailBody}>
        {payload !== undefined ? (
          <SyntaxJson value={payload} />
        ) : (
          <span className={styles.noPayload}>
            {tab === "response" && call.status === "pending"
              ? "Waiting for response…"
              : "No payload"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { session } = useSession();
  const [events,     setEvents]     = useState<TimelineEvent[]>([]);
  const [filter,     setFilter]     = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab,  setDetailTab]  = useState<"request" | "response">("request");
  const [polling,    setPolling]    = useState(true);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!session || !polling) return;
    const tick = () => {
      api.timeline.get(session.id, lastTs.current).then((newEvts) => {
        if (newEvts.length > 0) {
          lastTs.current = newEvts[newEvts.length - 1]!.timestamp;
          setEvents((prev) => [...prev, ...newEvts]);
        }
      }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [session, polling]);

  const calls = useMemo(() => eventsToCallsMemo(events), [events]);
  const filtered = useMemo(
    () => filter === "all" ? calls : calls.filter((c) => c.category === filter),
    [calls, filter],
  );
  const selected = selectedId ? (calls.find((c) => c.id === selectedId) ?? null) : null;

  if (!session) return <NoSession />;

  return (
    <div className={styles.inspector}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {FILTER_TABS.map(({ id, label }) => (
            <button
              key={id}
              className={[styles.filterBtn, filter === id ? styles.filterActive : ""].join(" ").trim()}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          <button
            className={[styles.ctrlBtn, polling ? styles.ctrlActive : ""].join(" ").trim()}
            onClick={() => setPolling((p) => !p)}
          >
            {polling ? "⏸ Pause" : "▶ Resume"}
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={() => { setEvents([]); setSelectedId(null); lastTs.current = 0; }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className={styles.callList}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>
              {events.length === 0
                ? "No events yet. Connect to a server and perform actions."
                : "No events match this filter."}
            </p>
          ) : (
            filtered.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                isSelected={selectedId === call.id}
                onClick={() => {
                  setSelectedId((prev) => prev === call.id ? null : call.id);
                  setDetailTab("request");
                }}
              />
            ))
          )}
        </div>

        {selected ? (
          <DetailPanel call={selected} tab={detailTab} onTabChange={setDetailTab} />
        ) : (
          <div className={styles.detailEmpty}>
            <span>Select a call to inspect its payload</span>
          </div>
        )}
      </div>
    </div>
  );
}
