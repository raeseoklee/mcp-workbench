import type { Transport } from "@mcp-workbench/protocol-kernel";
import { type JsonRpcMessage, McpTransportError } from "@mcp-workbench/protocol-kernel";

export interface HttpTransportOptions {
  /** MCP server endpoint URL */
  url: string;
  /** Additional headers (e.g. Authorization) */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 60 000) */
  timeoutMs?: number;
}

/**
 * Streamable HTTP Transport (MCP spec 2025-11-25).
 *
 * - Client sends JSON-RPC requests/notifications as HTTP POST (application/json).
 * - Server streams responses back via Server-Sent Events (text/event-stream).
 * - A session ID (Mcp-Session-Id header) is used to correlate streams.
 */
export class HttpTransport implements Transport {
  private sessionId: string | null = null;
  private messageHandler: ((msg: JsonRpcMessage) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private errorHandler: ((err: Error) => void) | null = null;
  private sseController: AbortController | null = null;

  constructor(private readonly opts: HttpTransportOptions) {}

  readonly onMessage = (handler: (msg: JsonRpcMessage) => void): void => {
    this.messageHandler = handler;
  };

  readonly onClose = (handler: () => void): void => {
    this.closeHandler = handler;
  };

  readonly onError = (handler: (err: Error) => void): void => {
    this.errorHandler = handler;
  };

  /**
   * Open the SSE stream for receiving server messages and notifications.
   * If the server does not support GET SSE (e.g. POST-only Streamable HTTP),
   * falls back to POST-only mode where responses arrive inline with each POST.
   */
  async connect(): Promise<void> {
    this.sseController = new AbortController();
    const { signal } = this.sseController;

    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      ...this.opts.headers,
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    try {
      const response = await fetch(this.opts.url, {
        method: "GET",
        headers,
        signal,
      });

      if (!response.ok) {
        // Server does not support GET SSE — fall back to POST-only mode
        return;
      }

      const newSessionId = response.headers.get("Mcp-Session-Id");
      if (newSessionId) this.sessionId = newSessionId;

      // Read SSE stream
      this.consumeSseStream(response.body!, signal).catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") {
          this.errorHandler?.(new McpTransportError("SSE stream error", err));
          this.closeHandler?.();
        }
      });
    } catch {
      // Network error on GET — fall back to POST-only mode
    }
  }

  async send(message: JsonRpcMessage): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...this.opts.headers,
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? 60_000,
    );

    let response: Response;
    try {
      response = await fetch(this.opts.url, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new McpTransportError("HTTP POST failed", err);
    } finally {
      clearTimeout(timer);
    }

    // Capture session ID from response
    const newSessionId = response.headers.get("Mcp-Session-Id");
    if (newSessionId) this.sessionId = newSessionId;

    const contentType = response.headers.get("Content-Type") ?? "";

    if (contentType.includes("application/json")) {
      // Single response inline
      const body = await response.json() as JsonRpcMessage | JsonRpcMessage[];
      const messages = Array.isArray(body) ? body : [body];
      for (const msg of messages) {
        this.messageHandler?.(msg);
      }
    } else if (contentType.includes("text/event-stream")) {
      // Streaming response - consume inline
      await this.consumeSseStream(response.body!, new AbortController().signal);
    } else if (response.status === 202) {
      // Accepted - response will arrive via SSE channel
    } else if (!response.ok) {
      const text = await response.text();
      throw new McpTransportError(
        `Server returned ${response.status}: ${text}`,
      );
    }
  }

  async close(): Promise<void> {
    this.sseController?.abort();
    this.sseController = null;

    // Attempt to send DELETE to terminate the session server-side
    if (this.sessionId) {
      try {
        await fetch(this.opts.url, {
          method: "DELETE",
          headers: {
            "Mcp-Session-Id": this.sessionId,
            ...this.opts.headers,
          },
        });
      } catch {
        // Best-effort; ignore errors during teardown
      }
      this.sessionId = null;
    }

    this.closeHandler?.();
  }

  /** The negotiated session ID, or null if not yet connected */
  get mcpSessionId(): string | null {
    return this.sessionId;
  }

  private async consumeSseStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          this.closeHandler?.();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const msg = JSON.parse(data) as JsonRpcMessage;
              this.messageHandler?.(msg);
            } catch {
              this.errorHandler?.(
                new McpTransportError(`Failed to parse SSE data: ${data}`),
              );
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
