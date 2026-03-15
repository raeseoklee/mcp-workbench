import type { Assertion } from "@mcp-lab/assertions";

export const SPEC_API_VERSION = "mcp-lab.dev/v0alpha1";

// ─── Server Profile ───────────────────────────────────────────────────────────

export type TransportKind = "stdio" | "streamable-http" | "sse";

export interface StdioServerConfig {
  transport: "stdio";
  command: string;
  args?: string[];
  /** Environment variable names to pass through from the shell (values are read at runtime) */
  envPassthrough?: string[];
  /** Hardcoded env vars (non-secret) */
  env?: Record<string, string>;
  cwd?: string;
}

export interface HttpServerConfig {
  transport: "streamable-http";
  url: string;
  /** Map of header name → env var that holds the value */
  headersFromEnv?: Record<string, string>;
  /** Hardcoded headers (non-secret) */
  headers?: Record<string, string>;
}

export interface SseServerConfig {
  transport: "sse";
  url: string;
  headersFromEnv?: Record<string, string>;
  headers?: Record<string, string>;
}

export type ServerConfig = StdioServerConfig | HttpServerConfig | SseServerConfig;

// ─── Client Config ────────────────────────────────────────────────────────────

export interface ClientConfig {
  protocolVersion?: string;
  clientInfo?: {
    name?: string;
    version?: string;
  };
  capabilities?: {
    roots?: { listChanged?: boolean };
    sampling?: Record<string, never>;
    elicitation?: Record<string, never>;
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export interface SamplingPresetSpec {
  role: "assistant";
  content: { type: "text"; text: string };
  model: string;
  stopReason?: string;
}

export interface Fixtures {
  /**
   * Static workspace roots returned when server calls roots/list.
   * Requires client.capabilities.roots to be set.
   */
  roots?: Array<{ uri: string; name?: string }>;
  /**
   * Preset sampling response returned for every sampling/createMessage request.
   * Requires client.capabilities.sampling to be set.
   */
  sampling?: SamplingPresetSpec;
  /**
   * Preset elicitation response.
   * Requires client.capabilities.elicitation to be set.
   */
  elicitation?: { action: "accept"; content: Record<string, unknown> } | { action: "decline" };
}

// ─── Test Actions ─────────────────────────────────────────────────────────────

export interface ToolsListAction {
  method: "tools/list";
  cursor?: string;
}

export interface ToolsCallAction {
  method: "tools/call";
  tool: string;
  args?: Record<string, unknown>;
}

export interface ResourcesListAction {
  method: "resources/list";
  cursor?: string;
}

export interface ResourcesReadAction {
  method: "resources/read";
  uri: string;
}

export interface PromptsListAction {
  method: "prompts/list";
  cursor?: string;
}

export interface PromptsGetAction {
  method: "prompts/get";
  name: string;
  args?: Record<string, string>;
}

export interface CompletionAction {
  method: "completion/complete";
  ref: { type: "ref/prompt" | "ref/resource"; name?: string; uri?: string };
  argument: { name: string; value: string };
}

export interface PingAction {
  method: "ping";
}

export type TestAction =
  | ToolsListAction
  | ToolsCallAction
  | ResourcesListAction
  | ResourcesReadAction
  | PromptsListAction
  | PromptsGetAction
  | CompletionAction
  | PingAction;

// ─── Test Case ────────────────────────────────────────────────────────────────

export interface TestCase {
  id: string;
  description?: string;
  /** Skip this test */
  skip?: boolean;
  /** Tags for filtering */
  tags?: string[];
  act: TestAction;
  assert?: Assertion[];
  /** Store the result in a named variable for reuse in later tests */
  storeAs?: string;
}

// ─── Top-level Spec ───────────────────────────────────────────────────────────

export interface TestSpec {
  apiVersion: typeof SPEC_API_VERSION;
  server: ServerConfig;
  client?: ClientConfig;
  fixtures?: Fixtures;
  tests: TestCase[];
}
