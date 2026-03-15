import { EventEmitter } from "node:events";
import {
  ProtocolKernel,
  type Transport,
  type KernelOptions,
  type NegotiatedSession,
  type ListToolsResult,
  type CallToolResult,
  type ListResourcesResult,
  type ReadResourceResult,
  type ListPromptsResult,
  type GetPromptResult,
  type CompleteParams,
  type CompleteResult,
  type ClientCapabilities,
  isRequest,
  isNotification,
  isResponse,
} from "@mcp-workbench/protocol-kernel";
import type { JsonRpcMessage } from "@mcp-workbench/protocol-kernel";
import { Timeline, type TimelineEvent } from "./timeline.js";

/** Minimal interface so session-engine does not need to depend on client-simulator */
export interface ClientSimulatorLike {
  install(kernel: ProtocolKernel): { roots: boolean; sampling: boolean; elicitation: boolean };
  buildCapabilities(): Partial<ClientCapabilities>;
}

export type SessionStatus = "idle" | "connecting" | "ready" | "error" | "closed";

export interface SessionOptions extends KernelOptions {
  /** Max timeline events to keep in memory (default: 10 000) */
  maxTimelineEvents?: number;
  /**
   * Optional client simulator — if provided, its handlers are installed on the
   * kernel before initialize() and its capabilities are merged into
   * clientCapabilities automatically.
   */
  simulator?: ClientSimulatorLike;
}

export interface SessionEvents {
  "status-change": [status: SessionStatus];
  "timeline-event": [event: TimelineEvent];
  "tools-changed": [];
  "resources-changed": [];
  "prompts-changed": [];
  error: [err: Error];
  close: [];
}

/**
 * Session wraps the ProtocolKernel with lifecycle management, timeline
 * recording, and a typed event bus for the UI and CLI layers.
 */
export class Session extends EventEmitter {
  private kernel: ProtocolKernel | null = null;
  private _status: SessionStatus = "idle";
  readonly timeline = new Timeline();
  private negotiatedSession: NegotiatedSession | null = null;

  constructor(
    private readonly transport: Transport,
    private readonly options: SessionOptions = {},
  ) {
    super();
  }

  get status(): SessionStatus {
    return this._status;
  }

  get session(): NegotiatedSession | null {
    return this.negotiatedSession;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async connect(): Promise<NegotiatedSession> {
    this.setStatus("connecting");

    this.timeline.record({
      kind: "connect",
      direction: "internal",
      timestamp: Date.now(),
      payload: { message: "Connecting to server..." },
    });

    // Wrap the transport to intercept messages for timeline
    const intercepted = this.wrapTransport(this.transport);

    // Merge simulator capabilities into clientCapabilities
    const simulatorCaps = this.options.simulator?.buildCapabilities() ?? {};
    const mergedOptions: SessionOptions = {
      ...this.options,
      clientCapabilities: {
        ...simulatorCaps,
        ...this.options.clientCapabilities,
      },
    };

    this.kernel = new ProtocolKernel(intercepted, mergedOptions);

    // Install simulator handlers before initialize
    if (this.options.simulator) {
      this.options.simulator.install(this.kernel);
    }

    // Wire kernel events → session events
    this.kernel.on("tools-changed", () => this.emit("tools-changed"));
    this.kernel.on("resources-changed", () => this.emit("resources-changed"));
    this.kernel.on("prompts-changed", () => this.emit("prompts-changed"));
    this.kernel.on("error", (err: Error) => this.emit("error", err));
    this.kernel.on("close", () => {
      this.setStatus("closed");
      this.emit("close");
    });

    try {
      this.negotiatedSession = await this.kernel.initialize();
      this.setStatus("ready");
      return this.negotiatedSession;
    } catch (err) {
      this.setStatus("error");
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.kernel?.close();
    this.setStatus("closed");
  }

  // ─── Delegation to kernel ───────────────────────────────────────────────────

  async ping(): Promise<void> {
    return this.requireKernel().ping();
  }

  async listTools(): Promise<ListToolsResult> {
    return this.requireKernel().listTools();
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    return this.requireKernel().callTool(name, args);
  }

  async listResources(): Promise<ListResourcesResult> {
    return this.requireKernel().listResources();
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    return this.requireKernel().readResource(uri);
  }

  async listPrompts(): Promise<ListPromptsResult> {
    return this.requireKernel().listPrompts();
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    return this.requireKernel().getPrompt(name, args);
  }

  async complete(params: CompleteParams): Promise<CompleteResult> {
    return this.requireKernel().complete(params);
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private requireKernel(): ProtocolKernel {
    if (!this.kernel || this._status !== "ready") {
      throw new Error("Session not ready. Call connect() first.");
    }
    return this.kernel;
  }

  private setStatus(status: SessionStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.emit("status-change", status);
    }
  }

  /**
   * Wraps the raw transport to record every message in the timeline before
   * forwarding it to the kernel.
   */
  private wrapTransport(raw: Transport): Transport {
    const self = this;
    let messageHandler: ((msg: JsonRpcMessage) => void) | null = null;
    let closeHandler: (() => void) | null = null;
    let errorHandler: ((err: Error) => void) | null = null;

    // Intercept outbound send
    const wrappedSend = async (msg: JsonRpcMessage): Promise<void> => {
      const event = self.timeline.record({
        kind: self.classifyOutbound(msg),
        direction: "outbound",
        timestamp: Date.now(),
        method: "method" in msg ? msg.method : undefined,
        requestId: "id" in msg && msg.id !== null ? msg.id : undefined,
        payload: msg,
      });
      self.emit("timeline-event", event);
      return raw.send(msg);
    };

    raw.onMessage((msg) => {
      const event = self.timeline.record({
        kind: self.classifyInbound(msg),
        direction: "inbound",
        timestamp: Date.now(),
        method: "method" in msg ? msg.method : undefined,
        requestId: "id" in msg && msg.id !== null ? msg.id : undefined,
        payload: msg,
      });
      self.emit("timeline-event", event);
      messageHandler?.(msg);
    });

    raw.onClose(() => closeHandler?.());
    raw.onError((err) => errorHandler?.(err));

    return {
      send: wrappedSend,
      close: () => raw.close(),
      onMessage: (h) => { messageHandler = h; },
      onClose: (h) => { closeHandler = h; },
      onError: (h) => { errorHandler = h; },
    };
  }

  private classifyOutbound(msg: JsonRpcMessage): TimelineEvent["kind"] {
    if (isRequest(msg)) {
      return msg.method === "initialize" ? "initialize-request" : "request";
    }
    return "notification";
  }

  private classifyInbound(msg: JsonRpcMessage): TimelineEvent["kind"] {
    if (isResponse(msg)) {
      return isRequest({ ...msg, method: "" } as never)
        ? "response"
        : "response";
    }
    if (isNotification(msg)) return "notification";
    return "response";
  }
}
