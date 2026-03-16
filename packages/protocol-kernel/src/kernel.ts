import { EventEmitter } from "node:events";
import type {
  JsonRpcId,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcResponse,
  ClientCapabilities,
  ServerCapabilities,
  Implementation,
  InitializeParams,
  InitializeResult,
  ListToolsResult,
  CallToolResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptResult,
  CompleteParams,
  CompleteResult,
  LogLevel,
  LoggingMessageParams,
  PaginatedParams,
  McpProtocolVersion,
} from "./types.js";
import {
  MCP_METHODS,
  MCP_NOTIFICATIONS,
  LATEST_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSIONS,
  isResponse,
  isRequest,
  isSuccess,
  isError,
  isNotification,
  JSON_RPC_ERROR_CODES,
} from "./types.js";
import {
  McpCapabilityError,
  McpTimeoutError,
  McpTransportError,
  McpVersionError,
  McpProtocolError,
} from "./errors.js";

// ─── Transport Interface ──────────────────────────────────────────────────────

export interface Transport {
  send(message: JsonRpcMessage): Promise<void>;
  close(): Promise<void>;
  readonly onMessage: (handler: (msg: JsonRpcMessage) => void) => void;
  readonly onClose: (handler: () => void) => void;
  readonly onError: (handler: (err: Error) => void) => void;
}

// ─── Pending Request ──────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
  method: string;
  timer?: NodeJS.Timeout;
}

// ─── Kernel Events ────────────────────────────────────────────────────────────

export interface KernelEvents {
  notification: [method: string, params: unknown];
  "log-message": [params: LoggingMessageParams];
  "tools-changed": [];
  "resources-changed": [];
  "resources-updated": [uri: string];
  "prompts-changed": [];
  close: [];
  error: [err: Error];
}

// ─── Protocol Kernel ──────────────────────────────────────────────────────────

export interface KernelOptions {
  /** Client identity */
  clientInfo?: Implementation;
  /** Client capabilities to advertise */
  clientCapabilities?: ClientCapabilities;
  /** Preferred protocol versions, in order of preference */
  protocolVersions?: McpProtocolVersion[];
  /** Request timeout in milliseconds (default: 30 000) */
  requestTimeoutMs?: number;
}

export interface NegotiatedSession {
  protocolVersion: McpProtocolVersion;
  serverCapabilities: ServerCapabilities;
  serverInfo: Implementation;
  serverInstructions: string | undefined;
  clientCapabilities: ClientCapabilities;
}

/**
 * Protocol Kernel: manages the JSON-RPC transport, MCP initialization,
 * capability negotiation, and typed method dispatch.
 *
 * Usage:
 *   const kernel = new ProtocolKernel(transport, { ... });
 *   const session = await kernel.initialize();
 *   const tools = await kernel.listTools();
 */
export class ProtocolKernel extends EventEmitter {
  private readonly transport: Transport;
  private readonly options: Required<KernelOptions>;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly serverRequestHandlers = new Map<
    string,
    (params: unknown) => Promise<unknown>
  >();
  private nextId = 1;
  private session: NegotiatedSession | null = null;

  constructor(transport: Transport, options: KernelOptions = {}) {
    super();
    this.transport = transport;
    this.options = {
      clientInfo: options.clientInfo ?? {
        name: "mcp-workbench",
        version: "0.1.0",
      },
      clientCapabilities: options.clientCapabilities ?? {},
      protocolVersions: options.protocolVersions ?? [...MCP_PROTOCOL_VERSIONS],
      requestTimeoutMs: options.requestTimeoutMs ?? 30_000,
    };

    this.transport.onMessage((msg) => this.handleIncoming(msg));
    this.transport.onClose(() => {
      this.rejectAllPending(new McpTransportError("Transport closed unexpectedly"));
      this.emit("close");
    });
    this.transport.onError((err) => {
      this.emit("error", err);
    });
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  async initialize(): Promise<NegotiatedSession> {
    if (this.session) return this.session;

    const params: InitializeParams = {
      protocolVersion: this.options.protocolVersions[0] ?? LATEST_PROTOCOL_VERSION,
      capabilities: this.options.clientCapabilities,
      clientInfo: this.options.clientInfo,
    };

    const result = await this.request<InitializeResult>(MCP_METHODS.INITIALIZE, params);

    // Validate negotiated version
    const negotiated = result.protocolVersion as McpProtocolVersion;
    if (!MCP_PROTOCOL_VERSIONS.includes(negotiated)) {
      throw new McpVersionError(params.protocolVersion, negotiated);
    }

    this.session = {
      protocolVersion: negotiated,
      serverCapabilities: result.capabilities,
      serverInfo: result.serverInfo,
      serverInstructions: result.instructions,
      clientCapabilities: this.options.clientCapabilities,
    };

    // Send initialized notification
    await this.notify(MCP_NOTIFICATIONS.INITIALIZED, {});

    return this.session as NegotiatedSession;
  }

  getSession(): NegotiatedSession | null {
    return this.session;
  }

  requireSession(): NegotiatedSession {
    if (!this.session) throw new McpProtocolError("Not initialized. Call initialize() first.");
    return this.session;
  }

  // ─── Ping ───────────────────────────────────────────────────────────────────

  async ping(): Promise<void> {
    await this.request(MCP_METHODS.PING, {});
  }

  // ─── Tools ──────────────────────────────────────────────────────────────────

  async listTools(params?: PaginatedParams): Promise<ListToolsResult> {
    this.requireCapability("tools");
    return this.request<ListToolsResult>(MCP_METHODS.TOOLS_LIST, params ?? {});
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    this.requireCapability("tools");
    return this.request<CallToolResult>(MCP_METHODS.TOOLS_CALL, {
      name,
      arguments: args ?? {},
    });
  }

  // ─── Resources ──────────────────────────────────────────────────────────────

  async listResources(params?: PaginatedParams): Promise<ListResourcesResult> {
    this.requireCapability("resources");
    return this.request<ListResourcesResult>(MCP_METHODS.RESOURCES_LIST, params ?? {});
  }

  async listResourceTemplates(params?: PaginatedParams): Promise<ListResourceTemplatesResult> {
    this.requireCapability("resources");
    return this.request<ListResourceTemplatesResult>(
      MCP_METHODS.RESOURCES_TEMPLATES_LIST,
      params ?? {},
    );
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    this.requireCapability("resources");
    return this.request<ReadResourceResult>(MCP_METHODS.RESOURCES_READ, { uri });
  }

  async subscribeResource(uri: string): Promise<void> {
    const session = this.requireSession();
    if (!session.serverCapabilities.resources?.subscribe) {
      throw new McpCapabilityError("resources.subscribe");
    }
    await this.request(MCP_METHODS.RESOURCES_SUBSCRIBE, { uri });
  }

  async unsubscribeResource(uri: string): Promise<void> {
    this.requireCapability("resources");
    await this.request(MCP_METHODS.RESOURCES_UNSUBSCRIBE, { uri });
  }

  // ─── Prompts ────────────────────────────────────────────────────────────────

  async listPrompts(params?: PaginatedParams): Promise<ListPromptsResult> {
    this.requireCapability("prompts");
    return this.request<ListPromptsResult>(MCP_METHODS.PROMPTS_LIST, params ?? {});
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    this.requireCapability("prompts");
    return this.request<GetPromptResult>(MCP_METHODS.PROMPTS_GET, {
      name,
      arguments: args ?? {},
    });
  }

  // ─── Completion ─────────────────────────────────────────────────────────────

  async complete(params: CompleteParams): Promise<CompleteResult> {
    this.requireCapability("completions");
    return this.request<CompleteResult>(MCP_METHODS.COMPLETION_COMPLETE, params);
  }

  // ─── Logging ────────────────────────────────────────────────────────────────

  async setLogLevel(level: LogLevel): Promise<void> {
    this.requireCapability("logging");
    await this.request(MCP_METHODS.LOGGING_SET_LEVEL, { level });
  }

  // ─── Server → Client Request Handlers ────────────────────────────────────────

  /**
   * Register a handler for incoming requests from the server (server → client).
   * The handler receives the raw params and must return the result object.
   * Throwing will send a JSON-RPC error response back to the server.
   *
   * Used by ClientSimulator to respond to roots/list, sampling/createMessage, etc.
   */
  setRequestHandler(
    method: string,
    handler: (params: unknown) => Promise<unknown>,
  ): void {
    this.serverRequestHandlers.set(method, handler);
  }

  removeRequestHandler(method: string): void {
    this.serverRequestHandlers.delete(method);
  }

  // ─── Transport ──────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    this.rejectAllPending(new McpTransportError("Kernel closed"));
    await this.transport.close();
    this.session = null;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const message: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new McpTimeoutError(id, method, this.options.requestTimeoutMs));
      }, this.options.requestTimeoutMs);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        method,
        timer,
      });

      this.transport.send(message).catch((err: unknown) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new McpTransportError(`Failed to send ${method}`, err));
      });
    });
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    await this.transport.send({ jsonrpc: "2.0", method, params });
  }

  private handleIncoming(msg: JsonRpcMessage): void {
    if (isResponse(msg)) {
      this.handleResponse(msg);
    } else if (isRequest(msg)) {
      // Server → client request (e.g. roots/list, sampling/createMessage)
      void this.handleServerRequest(msg);
    } else if (isNotification(msg)) {
      this.handleNotification(msg.method, msg.params);
    }
  }

  private async handleServerRequest(msg: JsonRpcRequest): Promise<void> {
    const handler = this.serverRequestHandlers.get(msg.method);
    if (!handler) {
      await this.transport.send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
          message: `Client does not support method: ${msg.method}`,
        },
      });
      return;
    }
    try {
      const result = await handler(msg.params);
      await this.transport.send({ jsonrpc: "2.0", id: msg.id, result });
    } catch (err) {
      await this.transport.send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  private handleResponse(msg: JsonRpcResponse): void {
    // id: null error responses — reject the only pending request if there is exactly one
    if (msg.id === null || msg.id === undefined) {
      if (isError(msg) && this.pending.size === 1) {
        const [, entry] = [...this.pending.entries()][0]!;
        clearTimeout(entry.timer);
        this.pending.clear();
        entry.reject(
          new McpProtocolError(msg.error.message, {
            code: msg.error.code,
            data: msg.error.data,
          }),
        );
      }
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(msg.id);

    if (isSuccess(msg)) {
      pending.resolve(msg.result);
    } else if (isError(msg)) {
      pending.reject(
        new McpProtocolError(msg.error.message, {
          code: msg.error.code,
          data: msg.error.data,
        }),
      );
    }
  }

  private handleNotification(method: string, params: unknown): void {
    this.emit("notification", method, params);

    switch (method) {
      case MCP_NOTIFICATIONS.MESSAGE:
        this.emit("log-message", params as LoggingMessageParams);
        break;
      case MCP_NOTIFICATIONS.TOOLS_LIST_CHANGED:
        this.emit("tools-changed");
        break;
      case MCP_NOTIFICATIONS.RESOURCES_LIST_CHANGED:
        this.emit("resources-changed");
        break;
      case MCP_NOTIFICATIONS.RESOURCES_UPDATED:
        this.emit("resources-updated", (params as { uri: string }).uri);
        break;
      case MCP_NOTIFICATIONS.PROMPTS_LIST_CHANGED:
        this.emit("prompts-changed");
        break;
    }
  }

  private requireCapability(cap: keyof ServerCapabilities): void {
    const session = this.requireSession();
    if (!session.serverCapabilities[cap]) {
      throw new McpCapabilityError(cap);
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pending.delete(id);
    }
  }
}
