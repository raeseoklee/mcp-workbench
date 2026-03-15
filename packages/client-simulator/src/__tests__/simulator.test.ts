import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientSimulator } from "../simulator.js";
import type { ClientSimulatorConfig } from "../types.js";
import { MCP_METHODS } from "@mcp-lab/protocol-kernel";

// ─── Mock Kernel ──────────────────────────────────────────────────────────────

function makeMockKernel() {
  const handlers = new Map<string, (params: unknown) => Promise<unknown>>();
  return {
    setRequestHandler: vi.fn((method: string, handler: (p: unknown) => Promise<unknown>) => {
      handlers.set(method, handler);
    }),
    removeRequestHandler: vi.fn((method: string) => {
      handlers.delete(method);
    }),
    /** Call a registered handler directly (for testing) */
    callHandler: async (method: string, params?: unknown): Promise<unknown> => {
      const h = handlers.get(method);
      if (!h) throw new Error(`No handler for ${method}`);
      return h(params ?? {});
    },
    handlers,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ClientSimulator", () => {
  describe("install / uninstall", () => {
    it("installs roots handler when roots config is provided", () => {
      const kernel = makeMockKernel();
      const sim = new ClientSimulator({ roots: { roots: [{ uri: "file:///workspace" }] } });
      sim.install(kernel as never);
      expect(kernel.setRequestHandler).toHaveBeenCalledWith(
        MCP_METHODS.ROOTS_LIST,
        expect.any(Function),
      );
    });

    it("returns installed capability flags", () => {
      const kernel = makeMockKernel();
      const sim = new ClientSimulator({
        roots: { roots: [] },
        sampling: { preset: { role: "assistant", content: { type: "text", text: "hi" }, model: "mock" } },
      });
      const caps = sim.install(kernel as never);
      expect(caps.roots).toBe(true);
      expect(caps.sampling).toBe(true);
      expect(caps.elicitation).toBe(false);
    });

    it("does not install handlers not in config", () => {
      const kernel = makeMockKernel();
      new ClientSimulator({}).install(kernel as never);
      expect(kernel.setRequestHandler).not.toHaveBeenCalled();
    });

    it("uninstall removes handlers", () => {
      const kernel = makeMockKernel();
      const sim = new ClientSimulator({ roots: { roots: [] } });
      sim.install(kernel as never);
      sim.uninstall(kernel as never);
      expect(kernel.removeRequestHandler).toHaveBeenCalledWith(MCP_METHODS.ROOTS_LIST);
    });
  });

  describe("buildCapabilities", () => {
    it("returns roots cap when roots configured", () => {
      const sim = new ClientSimulator({ roots: { roots: [] } });
      const caps = sim.buildCapabilities();
      expect(caps.roots).toEqual({ listChanged: false });
      expect(caps.sampling).toBeUndefined();
    });

    it("returns sampling cap when sampling configured", () => {
      const sim = new ClientSimulator({ sampling: {} });
      const caps = sim.buildCapabilities();
      expect(caps.sampling).toEqual({});
    });

    it("returns elicitation cap when elicitation configured", () => {
      const sim = new ClientSimulator({ elicitation: {} });
      const caps = sim.buildCapabilities();
      expect(caps.elicitation).toEqual({});
    });
  });

  describe("roots/list handler", () => {
    it("returns the configured roots", async () => {
      const kernel = makeMockKernel();
      const roots = [
        { uri: "file:///workspace/a", name: "project-a" },
        { uri: "file:///workspace/b" },
      ];
      new ClientSimulator({ roots: { roots } }).install(kernel as never);

      const result = await kernel.callHandler(MCP_METHODS.ROOTS_LIST) as { roots: typeof roots };
      expect(result.roots).toHaveLength(2);
      expect(result.roots[0]?.uri).toBe("file:///workspace/a");
      expect(result.roots[0]?.name).toBe("project-a");
      expect(result.roots[1]?.uri).toBe("file:///workspace/b");
    });

    it("returns empty roots array", async () => {
      const kernel = makeMockKernel();
      new ClientSimulator({ roots: { roots: [] } }).install(kernel as never);
      const result = await kernel.callHandler(MCP_METHODS.ROOTS_LIST) as { roots: unknown[] };
      expect(result.roots).toHaveLength(0);
    });
  });

  describe("sampling/createMessage handler", () => {
    it("returns preset when configured", async () => {
      const kernel = makeMockKernel();
      const preset = {
        role: "assistant" as const,
        content: { type: "text" as const, text: "Hello from mock LLM" },
        model: "mock-model",
        stopReason: "endTurn" as const,
      };
      new ClientSimulator({ sampling: { preset } }).install(kernel as never);

      const result = await kernel.callHandler(MCP_METHODS.SAMPLING_CREATE_MESSAGE, {
        messages: [],
        maxTokens: 100,
      }) as typeof preset;
      expect(result.content.text).toBe("Hello from mock LLM");
      expect(result.model).toBe("mock-model");
    });

    it("uses custom handler over preset", async () => {
      const kernel = makeMockKernel();
      const handler = vi.fn().mockResolvedValue({
        role: "assistant",
        content: { type: "text", text: "custom" },
        model: "custom-model",
      });
      new ClientSimulator({
        sampling: {
          preset: { role: "assistant", content: { type: "text", text: "preset" }, model: "x" },
          handler,
        },
      }).install(kernel as never);

      await kernel.callHandler(MCP_METHODS.SAMPLING_CREATE_MESSAGE, { messages: [], maxTokens: 10 });
      expect(handler).toHaveBeenCalledOnce();
    });

    it("throws (→ error response) when no preset or handler", async () => {
      const kernel = makeMockKernel();
      new ClientSimulator({ sampling: {} }).install(kernel as never);
      await expect(
        kernel.callHandler(MCP_METHODS.SAMPLING_CREATE_MESSAGE, { messages: [], maxTokens: 10 }),
      ).rejects.toThrow("declined");
    });
  });

  describe("elicitation/create handler", () => {
    it("returns accept preset", async () => {
      const kernel = makeMockKernel();
      new ClientSimulator({
        elicitation: { preset: { action: "accept", content: { name: "Alice" } } },
      }).install(kernel as never);

      const result = await kernel.callHandler(MCP_METHODS.ELICITATION_CREATE, {
        message: "What is your name?",
        requestedSchema: { type: "object" },
      }) as { action: string; content?: Record<string, unknown> };
      expect(result.action).toBe("accept");
      expect(result.content?.["name"]).toBe("Alice");
    });

    it("returns decline by default (no config)", async () => {
      const kernel = makeMockKernel();
      new ClientSimulator({ elicitation: {} }).install(kernel as never);
      const result = await kernel.callHandler(MCP_METHODS.ELICITATION_CREATE, {}) as { action: string };
      expect(result.action).toBe("decline");
    });
  });
});
