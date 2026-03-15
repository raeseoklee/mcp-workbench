// ─── Session ─────────────────────────────────────────────────────────────────

export interface SimulatorConfig {
  roots?: Array<{ name: string; uri: string }>;
  sampling?: { preset?: { text: string; model?: string } };
  elicitation?: { action: "accept" | "decline" };
}

export interface SessionConfig {
  transport: "stdio" | "streamable-http";
  // stdio
  command?: string;
  args?: string[];
  cwd?: string;
  // http
  url?: string;
  headers?: Record<string, string>;
  // client simulator
  simulator?: SimulatorConfig;
}

export interface SessionInfo {
  id: string;
  status: "idle" | "connecting" | "ready" | "error" | "closed";
  config: SessionConfig;
  serverInfo: { name: string; version: string } | null;
  serverCapabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    logging?: Record<string, unknown>;
    experimental?: Record<string, unknown>;
  } | null;
  serverInstructions: string | null;
  createdAt: string;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

export interface ContentBlock {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;
}

// ─── Resources ───────────────────────────────────────────────────────────────

export interface ResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

export interface PromptArg {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptInfo {
  name: string;
  description?: string;
  arguments?: PromptArg[];
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

export interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

// ─── Test Runs ───────────────────────────────────────────────────────────────

export type TestStatus = "passed" | "failed" | "skipped" | "error";

export interface AssertionResult {
  assertion: { kind: string; label?: string; [key: string]: unknown };
  passed: boolean;
  actual: unknown;
  message?: string;
  diff?: string;
}

export interface TestResult {
  testId: string;
  description?: string;
  status: TestStatus;
  durationMs: number;
  assertionResults: AssertionResult[];
  error?: string;
  rawResult?: unknown;
}

export interface RunReport {
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  total: number;
  durationMs: number;
  snapshotsUpdated: number;
  tests: TestResult[];
}

export interface RunOptions {
  tags?: string[];
  ids?: string[];
  bail?: boolean;
  timeoutMs?: number;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  kind: "connect" | "initialize-request" | "initialize-response" | "request" | "response" | "notification" | "error" | "close";
  timestamp: number;
  direction: "outbound" | "inbound" | "internal";
  method?: string;
  requestId?: string | number;
  payload?: unknown;
  durationMs?: number;
}
