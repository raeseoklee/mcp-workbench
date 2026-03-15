import { describe, it, expect, vi } from "vitest";
import { PluginRuntime } from "./runtime.js";
import { Registry } from "./registry.js";
import type { WorkbenchPlugin, PluginContext } from "@mcp-workbench/plugin-sdk";
import { PLUGIN_API_VERSION } from "./loader.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlugin(overrides?: Partial<WorkbenchPlugin>): WorkbenchPlugin {
  return {
    manifest: {
      name: "@test/plugin",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    register: (_ctx: PluginContext) => {},
    ...overrides,
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("Registry", () => {
  it("registers a command", () => {
    const reg = new Registry();
    const cmd = { name: "greet", run: async () => {} };
    reg.addCommand("plugin-a", cmd);
    expect(reg.getCommand("greet")).toBe(cmd);
  });

  it("first registration wins on duplicate command name", () => {
    const reg = new Registry();
    const first = { name: "greet", run: async () => 0 };
    const second = { name: "greet", run: async () => 1 };
    reg.addCommand("plugin-a", first);
    reg.addCommand("plugin-b", second);
    expect(reg.getCommand("greet")).toBe(first);
  });

  it("registers a reporter", () => {
    const reg = new Registry();
    const rep = { name: "html", generate: async () => {} };
    reg.addReporter("plugin-a", rep);
    expect(reg.getReporter("html")).toBe(rep);
  });

  it("first registration wins on duplicate reporter name", () => {
    const reg = new Registry();
    const first = { name: "html", generate: async () => {} };
    const second = { name: "html", generate: async () => {} };
    reg.addReporter("plugin-a", first);
    reg.addReporter("plugin-b", second);
    expect(reg.getReporter("html")).toBe(first);
  });

  it("lists all commands", () => {
    const reg = new Registry();
    reg.addCommand("p", { name: "a", run: async () => {} });
    reg.addCommand("p", { name: "b", run: async () => {} });
    expect(reg.listCommands()).toHaveLength(2);
  });
});

// ─── PluginRuntime ────────────────────────────────────────────────────────────

describe("PluginRuntime", () => {
  it("registers commands from a plugin", async () => {
    const runtime = new PluginRuntime();
    const plugin = makePlugin({
      register(ctx) {
        ctx.registerCommand({ name: "hello", run: async () => {} });
      },
    });
    await runtime.registerPlugin(plugin);
    expect(runtime.listCommands()).toHaveLength(1);
    expect(runtime.getCommand("hello")).toBeDefined();
  });

  it("registers reporters from a plugin", async () => {
    const runtime = new PluginRuntime();
    const plugin = makePlugin({
      register(ctx) {
        ctx.registerReporter({ name: "html", generate: async () => {} });
      },
    });
    await runtime.registerPlugin(plugin);
    expect(runtime.listReporters()).toHaveLength(1);
    expect(runtime.getReporter("html")).toBeDefined();
  });

  it("isolates register() errors — does not propagate", async () => {
    const runtime = new PluginRuntime();
    const plugin = makePlugin({
      register() {
        throw new Error("boom");
      },
    });
    await expect(runtime.registerPlugin(plugin)).resolves.toBeUndefined();
    expect(runtime.listCommands()).toHaveLength(0);
  });

  it("isolates failed dynamic import — does not throw", async () => {
    const runtime = new PluginRuntime();
    await expect(
      runtime.loadPlugin("non-existent-package-xyz-99999"),
    ).resolves.toBeUndefined();
    expect(runtime.listCommands()).toHaveLength(0);
  });

  it("deduplicates commands across plugins", async () => {
    const runtime = new PluginRuntime();
    const pluginA = makePlugin({
      manifest: { name: "@test/a", version: "1.0.0", apiVersion: PLUGIN_API_VERSION },
      register(ctx) { ctx.registerCommand({ name: "shared", run: async () => 0 }); },
    });
    const pluginB = makePlugin({
      manifest: { name: "@test/b", version: "1.0.0", apiVersion: PLUGIN_API_VERSION },
      register(ctx) { ctx.registerCommand({ name: "shared", run: async () => 1 }); },
    });
    await runtime.registerPlugin(pluginA);
    await runtime.registerPlugin(pluginB);
    expect(runtime.listCommands()).toHaveLength(1);
  });

  it("invokes a registered reporter", async () => {
    const runtime = new PluginRuntime();
    const generated = vi.fn();
    await runtime.registerPlugin(makePlugin({
      register(ctx) {
        ctx.registerReporter({ name: "mock", generate: generated });
      },
    }));
    const reporter = runtime.getReporter("mock");
    expect(reporter).toBeDefined();
    const ctx = {
      report: {
        passed: 1, failed: 0, skipped: 0, errors: 0,
        total: 1, durationMs: 10, snapshotsUpdated: 0, tests: [],
      },
    };
    await reporter!.generate(ctx);
    expect(generated).toHaveBeenCalledWith(ctx);
  });
});
