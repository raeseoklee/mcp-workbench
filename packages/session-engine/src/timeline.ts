/**
 * Timeline records all protocol events in a session for display and export.
 */

export type TimelineEventKind =
  | "connect"
  | "initialize-request"
  | "initialize-response"
  | "request"
  | "response"
  | "notification"
  | "error"
  | "close";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  timestamp: number; // Date.now()
  /** Direction from the perspective of the testbench client */
  direction: "outbound" | "inbound" | "internal";
  method: string | undefined;
  requestId: string | number | undefined;
  payload: unknown;
  durationMs: number | undefined; // set on response events when paired with a request
}

export class Timeline {
  private readonly events: TimelineEvent[] = [];
  private requestTimestamps = new Map<string | number, number>();
  private counter = 0;

  record(
    event: Omit<TimelineEvent, "id" | "method" | "requestId" | "durationMs"> & {
      method?: string;
      requestId?: string | number;
      durationMs?: number;
    },
  ): TimelineEvent {
    const id = `evt-${++this.counter}`;
    const full: TimelineEvent = {
      id,
      method: event.method,
      requestId: event.requestId,
      durationMs: event.durationMs,
      kind: event.kind,
      direction: event.direction,
      timestamp: event.timestamp,
      payload: event.payload,
    };

    // Track request timestamps for latency calculation
    if (event.kind === "request" && event.requestId !== undefined) {
      this.requestTimestamps.set(event.requestId, event.timestamp);
    }

    // Pair response with request for latency
    if (event.kind === "response" && event.requestId !== undefined) {
      const sent = this.requestTimestamps.get(event.requestId);
      if (sent !== undefined) {
        full.durationMs = event.timestamp - sent;
        this.requestTimestamps.delete(event.requestId);
      }
    }

    this.events.push(full);
    return full;
  }

  getAll(): readonly TimelineEvent[] {
    return this.events;
  }

  getByKind(kind: TimelineEventKind): TimelineEvent[] {
    return this.events.filter((e) => e.kind === kind);
  }

  clear(): void {
    this.events.length = 0;
    this.requestTimestamps.clear();
    this.counter = 0;
  }

  toJSON(): TimelineEvent[] {
    return [...this.events];
  }
}
