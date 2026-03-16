import { Session } from "@mcp-workbench/session-engine";
import { StdioTransport } from "@mcp-workbench/transport-stdio";
import { HttpTransport } from "@mcp-workbench/transport-http";
import type { Transport } from "@mcp-workbench/protocol-kernel";
import { stringify } from "yaml";
import { inferArgs, type JsonSchema } from "./inference.js";
import { classifyTool, hasInferrableArgs } from "./safety.js";
import type {
  GenerateOptions,
  GenerateResult,
  DiscoverySummary,
  DiscoveryResult,
} from "./types.js";

interface Tool {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
}

interface Resource {
  uri: string;
  name?: string;
  description?: string;
}

interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

/**
 * Connect to an MCP server, discover capabilities, and generate a YAML test spec.
 *
 * Supports partial discovery: if initialize fails, individual capability
 * probes are still attempted. Generation succeeds if any category is discovered.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const transport = buildTransport(opts);
  if (transport instanceof StdioTransport || transport instanceof HttpTransport) {
    await transport.connect();
  }

  const session = new Session(transport, {
    clientInfo: { name: "mcp-workbench-generate", version: "0.1.0" },
    requestTimeoutMs: opts.timeoutMs ?? 10_000,
  });

  const shouldInclude = (cap: "tools" | "resources" | "prompts"): boolean => {
    if (opts.exclude?.has(cap)) return false;
    if (opts.include && !opts.include.has(cap)) return false;
    return true;
  };

  const discovery: DiscoverySummary = {
    initialize: { status: "skipped" },
    tools: { status: "skipped" },
    resources: { status: "skipped" },
    prompts: { status: "skipped" },
  };

  let serverInfo: { name: string; version: string; protocol: string } | undefined;
  let initializeSucceeded = false;

  // ─── Phase 1: Initialize ────────────────────────────────────────────────────
  try {
    const negotiated = await session.connect();
    serverInfo = {
      name: negotiated.serverInfo.name,
      version: negotiated.serverInfo.version,
      protocol: negotiated.protocolVersion,
    };
    discovery.initialize = { status: "success", data: serverInfo };
    initializeSucceeded = true;
    opts.onProgress?.(`connected: ${serverInfo.name} v${serverInfo.version}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    discovery.initialize = { status: "failed", error: msg };
    opts.onProgress?.(`initialize failed: ${msg}`);
  }

  // ─── Phase 2: Discovery (independent per category) ──────────────────────────
  let tools: Tool[] = [];
  let resources: Resource[] = [];
  let prompts: Prompt[] = [];

  if (shouldInclude("tools")) {
    try {
      const result = initializeSucceeded
        ? await session.listTools()
        : await probeWithoutInit(transport, "tools/list", opts);
      tools = (result as { tools: Tool[] }).tools ?? [];
      discovery.tools = { status: "success", data: tools };
      opts.onProgress?.(`tools/list: ${tools.length} tools`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      discovery.tools = { status: "failed", error: msg };
      opts.onProgress?.(`tools/list: failed (${msg})`);
    }
  }

  if (shouldInclude("resources")) {
    try {
      const result = initializeSucceeded
        ? await session.listResources()
        : await probeWithoutInit(transport, "resources/list", opts);
      resources = (result as { resources: Resource[] }).resources ?? [];
      discovery.resources = { status: "success", data: resources };
      opts.onProgress?.(`resources/list: ${resources.length} resources`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      discovery.resources = { status: "failed", error: msg };
      opts.onProgress?.(`resources/list: failed (${msg})`);
    }
  }

  if (shouldInclude("prompts")) {
    try {
      const result = initializeSucceeded
        ? await session.listPrompts()
        : await probeWithoutInit(transport, "prompts/list", opts);
      prompts = (result as { prompts: Prompt[] }).prompts ?? [];
      discovery.prompts = { status: "success", data: prompts };
      opts.onProgress?.(`prompts/list: ${prompts.length} prompts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      discovery.prompts = { status: "failed", error: msg };
      opts.onProgress?.(`prompts/list: failed (${msg})`);
    }
  }

  // ─── Check if anything was discovered ────────────────────────────────────────
  const totalDiscovered = tools.length + resources.length + prompts.length;
  if (totalDiscovered === 0) {
    // Close session if it was opened
    try { await session.close(); } catch { /* ignore */ }

    const reasons: string[] = [];
    if (discovery.initialize.status === "failed") {
      reasons.push(`initialize: ${discovery.initialize.error}`);
    }
    if (discovery.tools.status === "failed") {
      reasons.push(`tools: ${discovery.tools.error}`);
    }
    if (discovery.resources.status === "failed") {
      reasons.push(`resources: ${discovery.resources.error}`);
    }
    if (discovery.prompts.status === "failed") {
      reasons.push(`prompts: ${discovery.prompts.error}`);
    }
    throw new Error(
      `No capabilities discovered.\n${reasons.map((r) => `  - ${r}`).join("\n")}`,
    );
  }

  // ─── Phase 3: Deep mode ─────────────────────────────────────────────────────
  const deepResults = new Map<string, unknown>();
  const skipped: Array<{ tool: string; reason: string }> = [];

  if (opts.depth === "deep" && tools.length > 0 && initializeSucceeded) {
    for (const tool of tools) {
      const safety = classifyTool(tool.name);

      if ((safety.level === "unsafe" || safety.level === "unknown") && !opts.allowSideEffects) {
        skipped.push({ tool: tool.name, reason: `skipped: ${safety.reason}` });
        opts.onProgress?.(`skip ${tool.name} (${safety.reason})`);
        continue;
      }

      if (!hasInferrableArgs(tool.inputSchema as Record<string, unknown>)) {
        skipped.push({ tool: tool.name, reason: "skipped: required args not inferrable" });
        opts.onProgress?.(`skip ${tool.name} (args not inferrable)`);
        continue;
      }

      const args = inferArgs(tool.inputSchema as JsonSchema);
      if (args && Object.values(args).includes("TODO")) {
        skipped.push({ tool: tool.name, reason: "skipped: contains TODO placeholder" });
        opts.onProgress?.(`skip ${tool.name} (TODO placeholder)`);
        continue;
      }

      opts.onProgress?.(`call ${tool.name}...`);
      try {
        const result = await session.callTool(tool.name, args ?? {});
        deepResults.set(tool.name, result);
      } catch {
        skipped.push({ tool: tool.name, reason: "skipped: call failed" });
      }
    }
  } else if (opts.depth === "deep" && !initializeSucceeded) {
    opts.onProgress?.("deep mode skipped: initialize failed");
  }

  // ─── Phase 4: Generate YAML ─────────────────────────────────────────────────
  try {
    const tests = buildTests(tools, resources, prompts, deepResults);

    const spec: Record<string, unknown> = {
      apiVersion: "mcp-workbench.dev/v0alpha1",
      server: buildServerBlock(opts),
      tests,
    };

    const headerLines = [
      `# Generated by: mcp-workbench generate`,
    ];
    if (serverInfo) {
      headerLines.push(`# Server: ${serverInfo.name} v${serverInfo.version} (protocol ${serverInfo.protocol})`);
    }
    if (!initializeSucceeded) {
      headerLines.push(`# WARNING: initialize failed — partial discovery only`);
    }
    headerLines.push(`# Review and customize before using in CI.`);
    headerLines.push(``);

    const yaml = headerLines.join("\n") + stringify(spec, { lineWidth: 0 });

    return {
      yaml,
      serverInfo,
      counts: {
        tools: tools.length,
        resources: resources.length,
        prompts: prompts.length,
        tests: tests.length,
      },
      skipped,
      discovery,
    };
  } finally {
    try { await session.close(); } catch { /* ignore */ }
  }
}

/**
 * Attempt a raw JSON-RPC call without initialize.
 * Used when initialize fails but we want to probe capabilities anyway.
 */
async function probeWithoutInit(
  transport: Transport,
  method: string,
  opts: GenerateOptions,
): Promise<unknown> {
  const id = Date.now();
  const request = {
    jsonrpc: "2.0" as const,
    id,
    method,
    params: {},
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`probe ${method} timed out`));
    }, opts.timeoutMs ?? 10_000);

    transport.onMessage((msg) => {
      const response = msg as { id?: number; result?: unknown; error?: { message: string } };
      if (response.id === id) {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      }
    });

    transport.send(request).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function buildServerBlock(opts: GenerateOptions): Record<string, unknown> {
  if (opts.transport === "stdio") {
    const block: Record<string, unknown> = {
      transport: "stdio",
      command: opts.command,
    };
    if (opts.args) block.args = opts.args.split(/\s+/);
    return block;
  }

  const block: Record<string, unknown> = {
    transport: "streamable-http",
    url: opts.url,
  };
  if (opts.headers && Object.keys(opts.headers).length > 0) {
    block.headers = { ...opts.headers };
  }
  return block;
}

function buildTests(
  tools: Tool[],
  resources: Resource[],
  prompts: Prompt[],
  deepResults: Map<string, unknown> = new Map(),
): unknown[] {
  const tests: unknown[] = [];

  // Tools
  if (tools.length > 0) {
    tests.push({
      id: "tools-list",
      description: "Server exposes tools",
      act: { method: "tools/list" },
      assert: [
        { kind: "status", equals: "success" },
        { kind: "notEmpty", path: "$.tools" },
      ],
    });

    for (const tool of tools) {
      const asserts: unknown[] = [
        { kind: "status", equals: "success" },
        { kind: "executionError", equals: false },
      ];

      const deepResult = deepResults.get(tool.name) as
        | { content?: Array<{ type: string; text?: string }>; isError?: boolean }
        | undefined;

      if (deepResult && !deepResult.isError && deepResult.content?.[0]) {
        const firstContent = deepResult.content[0];
        if (firstContent.type === "text" && firstContent.text) {
          asserts.push({ kind: "contentType", contains: "text" });
        }
      }

      const test: Record<string, unknown> = {
        id: `tool-${sanitizeId(tool.name)}`,
        description: `Tool: ${tool.name}`,
        act: {
          method: "tools/call",
          tool: tool.name,
        },
        assert: asserts,
      };

      const args = inferArgs(tool.inputSchema as JsonSchema);
      if (args) {
        (test.act as Record<string, unknown>).args = args;
      }

      tests.push(test);
    }
  }

  // Resources
  if (resources.length > 0) {
    tests.push({
      id: "resources-list",
      description: "Server exposes resources",
      act: { method: "resources/list" },
      assert: [
        { kind: "status", equals: "success" },
        { kind: "notEmpty", path: "$.resources" },
      ],
    });

    for (const resource of resources) {
      tests.push({
        id: `resource-${sanitizeId(resource.name ?? resource.uri)}`,
        description: `Resource: ${resource.name ?? resource.uri}`,
        act: {
          method: "resources/read",
          uri: resource.uri,
        },
        assert: [{ kind: "status", equals: "success" }],
      });
    }
  }

  // Prompts
  if (prompts.length > 0) {
    tests.push({
      id: "prompts-list",
      description: "Server exposes prompts",
      act: { method: "prompts/list" },
      assert: [{ kind: "status", equals: "success" }],
    });

    for (const prompt of prompts) {
      const test: Record<string, unknown> = {
        id: `prompt-${sanitizeId(prompt.name)}`,
        description: `Prompt: ${prompt.name}`,
        act: {
          method: "prompts/get",
          name: prompt.name,
        },
        assert: [{ kind: "status", equals: "success" }],
      };

      const promptArgs = prompt.arguments;
      if (promptArgs && promptArgs.length > 0) {
        const args: Record<string, string> = {};
        for (const arg of promptArgs) {
          args[arg.name] = "TODO";
        }
        (test.act as Record<string, unknown>).args = args;
      }

      tests.push(test);
    }
  }

  return tests;
}

function sanitizeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function buildTransport(opts: GenerateOptions): Transport {
  if (opts.transport === "stdio") {
    if (!opts.command) throw new Error("--command is required for stdio transport");
    return new StdioTransport({
      command: opts.command,
      args: opts.args?.split(/\s+/) ?? [],
      inheritEnv: true,
    });
  }

  if (!opts.url) throw new Error("--url is required for streamable-http transport");
  return new HttpTransport({
    url: opts.url,
    headers: opts.headers,
    timeoutMs: opts.timeoutMs ?? 10_000,
  });
}
