/**
 * MCP Protocol Types - based on spec 2025-11-25
 * https://modelcontextprotocol.io/specification/2025-11-25
 */

// ─── JSON-RPC 2.0 ─────────────────────────────────────────────────────────────

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return "id" in msg && "method" in msg;
}

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return !("id" in msg) && "method" in msg;
}

export function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return "id" in msg && !("method" in msg);
}

export function isSuccess(msg: JsonRpcResponse): msg is JsonRpcSuccess {
  return "result" in msg;
}

export function isError(msg: JsonRpcResponse): msg is JsonRpcError {
  return "error" in msg;
}

// ─── JSON-RPC Error Codes ─────────────────────────────────────────────────────

export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ─── MCP Protocol Versions ────────────────────────────────────────────────────

export const MCP_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-03-26",
  "2024-11-05",
] as const;

export type McpProtocolVersion = (typeof MCP_PROTOCOL_VERSIONS)[number];
export const LATEST_PROTOCOL_VERSION: McpProtocolVersion = "2025-11-25";

// ─── Capabilities ─────────────────────────────────────────────────────────────

export interface ClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, never>;
  elicitation?: Record<string, never>;
  experimental?: Record<string, unknown>;
}

export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, never>;
  completions?: Record<string, never>;
  experimental?: Record<string, unknown>;
}

export interface Implementation {
  name: string;
  version: string;
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
  instructions?: string;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
}

export interface ListToolsResult {
  tools: Tool[];
  nextCursor?: string;
}

export type ContentType = "text" | "image" | "audio" | "resource";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
}

export interface ResourceLink {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export type ToolContent = TextContent | ImageContent | AudioContent | ResourceLink;

export interface CallToolResult {
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

// ─── Resources ────────────────────────────────────────────────────────────────

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ListResourcesResult {
  resources: Resource[];
  nextCursor?: string;
}

export interface ListResourceTemplatesResult {
  resourceTemplates: ResourceTemplate[];
  nextCursor?: string;
}

export interface TextResourceContents {
  uri: string;
  mimeType?: string;
  text: string;
}

export interface BlobResourceContents {
  uri: string;
  mimeType?: string;
  blob: string;
}

export type ResourceContents = TextResourceContents | BlobResourceContents;

export interface ReadResourceResult {
  contents: ResourceContents[];
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface ListPromptsResult {
  prompts: Prompt[];
  nextCursor?: string;
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: TextContent | ImageContent | AudioContent | ResourceLink;
}

export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

// ─── Completion ───────────────────────────────────────────────────────────────

export interface CompletionReference {
  type: "ref/prompt" | "ref/resource";
  name?: string;
  uri?: string;
}

export interface CompletionArgument {
  name: string;
  value: string;
}

export interface CompleteParams {
  ref: CompletionReference;
  argument: CompletionArgument;
  context?: {
    arguments?: Record<string, string>;
  };
}

export interface CompleteResult {
  completion: {
    values: string[];
    total?: number;
    hasMore?: boolean;
  };
}

// ─── Logging ──────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";

export interface LoggingMessageParams {
  level: LogLevel;
  logger?: string;
  data: unknown;
}

// ─── Roots (client capability) ────────────────────────────────────────────────

export interface Root {
  uri: string;
  name?: string;
}

export interface ListRootsResult {
  roots: Root[];
}

// ─── Sampling (client capability) ────────────────────────────────────────────

export interface SamplingMessage {
  role: "user" | "assistant";
  content: TextContent | ImageContent;
}

export interface ModelPreferences {
  hints?: Array<{ name?: string }>;
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

export interface CreateMessageParams {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: "none" | "thisServer" | "allServers";
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMessageResult {
  role: "assistant";
  content: TextContent | ImageContent;
  model: string;
  stopReason?: "endTurn" | "maxTokens" | "stopSequence" | string;
}

// ─── Elicitation (client capability) ─────────────────────────────────────────

export interface ElicitParams {
  message: string;
  requestedSchema: {
    type: "object";
    properties?: Record<string, {
      type: string;
      title?: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface ElicitResult {
  action: "accept" | "decline" | "cancel";
  content?: Record<string, unknown>;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedParams {
  cursor?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const MCP_NOTIFICATIONS = {
  INITIALIZED: "notifications/initialized",
  CANCELLED: "notifications/cancelled",
  PROGRESS: "notifications/progress",
  ROOTS_LIST_CHANGED: "notifications/roots/listChanged",
  TOOLS_LIST_CHANGED: "notifications/tools/listChanged",
  RESOURCES_LIST_CHANGED: "notifications/resources/listChanged",
  RESOURCES_UPDATED: "notifications/resources/updated",
  PROMPTS_LIST_CHANGED: "notifications/prompts/listChanged",
  MESSAGE: "notifications/message",
} as const;

// ─── MCP Methods ──────────────────────────────────────────────────────────────

export const MCP_METHODS = {
  INITIALIZE: "initialize",
  PING: "ping",
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",
  RESOURCES_LIST: "resources/list",
  RESOURCES_READ: "resources/read",
  RESOURCES_SUBSCRIBE: "resources/subscribe",
  RESOURCES_UNSUBSCRIBE: "resources/unsubscribe",
  RESOURCES_TEMPLATES_LIST: "resources/templates/list",
  PROMPTS_LIST: "prompts/list",
  PROMPTS_GET: "prompts/get",
  COMPLETION_COMPLETE: "completion/complete",
  LOGGING_SET_LEVEL: "logging/setLevel",
  ROOTS_LIST: "roots/list",
  SAMPLING_CREATE_MESSAGE: "sampling/createMessage",
  ELICITATION_CREATE: "elicitation/create",
} as const;

export type McpMethod = (typeof MCP_METHODS)[keyof typeof MCP_METHODS];
