export interface GenerateOptions {
  /** Transport type */
  transport: "stdio" | "streamable-http";
  /** Server URL (HTTP) */
  url?: string;
  /** Server command (stdio) */
  command?: string;
  /** Server args (stdio) */
  args?: string;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Connection timeout ms */
  timeoutMs?: number;
  /** Capabilities to include */
  include?: Set<"tools" | "resources" | "prompts">;
  /** Capabilities to exclude */
  exclude?: Set<"tools" | "resources" | "prompts">;
  /** Generation depth: shallow (default) or deep */
  depth?: "shallow" | "deep";
  /** Allow calling tools with potential side effects in deep mode */
  allowSideEffects?: boolean;
  /** Progress callback for deep mode */
  onProgress?: (msg: string) => void;
}

export type DiscoveryStatus = "success" | "failed" | "skipped";

export interface DiscoveryResult<T> {
  status: DiscoveryStatus;
  data?: T;
  error?: string;
}

export interface DiscoverySummary {
  initialize: DiscoveryResult<{ name: string; version: string; protocol: string }>;
  tools: DiscoveryResult<unknown[]>;
  resources: DiscoveryResult<unknown[]>;
  prompts: DiscoveryResult<unknown[]>;
}

export interface GenerateResult {
  /** Generated YAML string */
  yaml: string;
  /** Server info (if initialize succeeded) */
  serverInfo?: { name: string; version: string; protocol: string };
  /** Counts */
  counts: { tools: number; resources: number; prompts: number; tests: number };
  /** Skipped tools in deep mode */
  skipped: Array<{ tool: string; reason: string }>;
  /** Per-category discovery results */
  discovery: DiscoverySummary;
}
