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
}

export interface GenerateResult {
  /** Generated YAML string */
  yaml: string;
  /** Server info */
  serverInfo?: { name: string; version: string; protocol: string };
  /** Counts */
  counts: { tools: number; resources: number; prompts: number; tests: number };
}
