import type {
  Root,
  CreateMessageParams,
  CreateMessageResult,
  ElicitParams,
  ElicitResult,
  ListRootsResult,
} from "@mcp-workbench/protocol-kernel";

export type { Root, CreateMessageParams, CreateMessageResult, ElicitParams, ElicitResult };

// ─── Roots Config ─────────────────────────────────────────────────────────────

export interface RootsConfig {
  /** Static list of roots to return for all roots/list requests */
  roots: Root[];
}

// ─── Sampling Config ──────────────────────────────────────────────────────────

/**
 * A preset sampling response returned for every createMessage request.
 * Useful in tests to avoid requiring a real LLM.
 */
export interface SamplingPreset {
  role: "assistant";
  content: { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
  model: string;
  stopReason?: "endTurn" | "maxTokens" | "stopSequence" | string;
}

export interface SamplingConfig {
  /**
   * Static preset: always return this response.
   * If not provided, sampling requests are declined (action: "decline").
   */
  preset?: SamplingPreset;
  /**
   * Custom handler — takes full precedence over preset.
   * Can simulate user approval, rejection, or a real LLM call.
   */
  handler?: (params: CreateMessageParams) => Promise<CreateMessageResult>;
}

// ─── Elicitation Config ───────────────────────────────────────────────────────

export interface ElicitationConfig {
  /**
   * Static preset: always return this response.
   * If not provided, elicitation requests are declined.
   */
  preset?: { action: "accept"; content: Record<string, unknown> } | { action: "decline" };
  /**
   * Custom handler for full control.
   */
  handler?: (params: ElicitParams) => Promise<ElicitResult>;
}

// ─── Simulator Config ─────────────────────────────────────────────────────────

export interface ClientSimulatorConfig {
  roots?: RootsConfig;
  sampling?: SamplingConfig;
  elicitation?: ElicitationConfig;
}

// ─── Installed Capabilities ───────────────────────────────────────────────────

export interface InstalledCapabilities {
  roots: boolean;
  sampling: boolean;
  elicitation: boolean;
}

export type { ListRootsResult };
