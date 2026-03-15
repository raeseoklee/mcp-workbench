import {
  MCP_METHODS,
  type ProtocolKernel,
  type CreateMessageParams,
  type CreateMessageResult,
  type ElicitParams,
  type ElicitResult,
  type ListRootsResult,
} from "@mcp-lab/protocol-kernel";
import type {
  ClientSimulatorConfig,
  InstalledCapabilities,
} from "./types.js";

/**
 * ClientSimulator installs server→client request handlers on a ProtocolKernel.
 *
 * It simulates the client-side MCP capabilities that servers can invoke:
 *   - roots/list       (servers ask for the client's workspace roots)
 *   - sampling/createMessage  (servers ask the client to call an LLM)
 *   - elicitation/create      (servers ask the client to prompt the user)
 *
 * Usage:
 *   const sim = new ClientSimulator({ roots: { roots: [...] } });
 *   sim.install(kernel);
 */
export class ClientSimulator {
  constructor(private readonly config: ClientSimulatorConfig) {}

  /**
   * Install handlers on the given ProtocolKernel.
   * Call this before kernel.initialize().
   */
  install(kernel: ProtocolKernel): InstalledCapabilities {
    const installed: InstalledCapabilities = {
      roots: false,
      sampling: false,
      elicitation: false,
    };

    // ─── roots/list ──────────────────────────────────────────────────────────
    if (this.config.roots) {
      const rootsConfig = this.config.roots;
      kernel.setRequestHandler(MCP_METHODS.ROOTS_LIST, async (): Promise<ListRootsResult> => ({
        roots: rootsConfig.roots,
      }));
      installed.roots = true;
    }

    // ─── sampling/createMessage ───────────────────────────────────────────────
    if (this.config.sampling) {
      const samplingConfig = this.config.sampling;
      kernel.setRequestHandler(
        MCP_METHODS.SAMPLING_CREATE_MESSAGE,
        async (params): Promise<CreateMessageResult> => {
          if (samplingConfig.handler) {
            return samplingConfig.handler(params as CreateMessageParams);
          }
          if (samplingConfig.preset) {
            return {
              role: samplingConfig.preset.role,
              content: samplingConfig.preset.content,
              model: samplingConfig.preset.model,
              stopReason: samplingConfig.preset.stopReason ?? "endTurn",
            };
          }
          // Default: decline
          throw new Error("Sampling not configured — request declined");
        },
      );
      installed.sampling = true;
    }

    // ─── elicitation/create ───────────────────────────────────────────────────
    if (this.config.elicitation) {
      const elicitConfig = this.config.elicitation;
      kernel.setRequestHandler(
        MCP_METHODS.ELICITATION_CREATE,
        async (params): Promise<ElicitResult> => {
          if (elicitConfig.handler) {
            return elicitConfig.handler(params as ElicitParams);
          }
          if (elicitConfig.preset) {
            return elicitConfig.preset as ElicitResult;
          }
          // Default: decline
          return { action: "decline" };
        },
      );
      installed.elicitation = true;
    }

    return installed;
  }

  /**
   * Remove all installed handlers from the kernel.
   */
  uninstall(kernel: ProtocolKernel): void {
    if (this.config.roots) {
      kernel.removeRequestHandler(MCP_METHODS.ROOTS_LIST);
    }
    if (this.config.sampling) {
      kernel.removeRequestHandler(MCP_METHODS.SAMPLING_CREATE_MESSAGE);
    }
    if (this.config.elicitation) {
      kernel.removeRequestHandler(MCP_METHODS.ELICITATION_CREATE);
    }
  }

  /** Build the clientCapabilities object that should be advertised in initialize */
  buildCapabilities(): {
    roots?: { listChanged: boolean };
    sampling?: Record<string, never>;
    elicitation?: Record<string, never>;
  } {
    const caps: ReturnType<ClientSimulator["buildCapabilities"]> = {};
    if (this.config.roots) {
      caps.roots = { listChanged: false };
    }
    if (this.config.sampling) {
      caps.sampling = {};
    }
    if (this.config.elicitation) {
      caps.elicitation = {};
    }
    return caps;
  }
}
