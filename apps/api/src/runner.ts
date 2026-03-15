/**
 * Test runner: takes a parsed TestSpec, connects to the server,
 * and executes all test cases with assertions.
 */
import { Session } from "@mcp-lab/session-engine";
import { StdioTransport } from "@mcp-lab/transport-stdio";
import { HttpTransport } from "@mcp-lab/transport-http";
import { runAssertions, createFileSnapshotStore } from "@mcp-lab/assertions";
import type { AssertionResult, SnapshotStore } from "@mcp-lab/assertions";
import type {
  TestSpec,
  TestCase,
  ServerConfig,
  TestAction,
  Fixtures,
} from "@mcp-lab/test-spec";
import { ClientSimulator } from "@mcp-lab/client-simulator";
import type { Transport } from "@mcp-lab/protocol-kernel";
import { join } from "node:path";

// ─── Results ──────────────────────────────────────────────────────────────────

export type TestStatus = "passed" | "failed" | "skipped" | "error";

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

// ─── Runner ───────────────────────────────────────────────────────────────────

export interface RunnerOptions {
  /** Tags to filter tests (run only tests with at least one matching tag) */
  tags?: string[];
  /** Run only specific test IDs */
  ids?: string[];
  /** Abort on first failure */
  bail?: boolean;
  /** Per-test timeout in ms (overrides server default) */
  timeoutMs?: number;
  /**
   * Directory where snapshot baselines are stored.
   * Defaults to .mcp-lab/snapshots relative to cwd.
   */
  snapshotsDir?: string;
  /**
   * When true, snapshot assertions write/overwrite the baseline instead of comparing.
   */
  updateSnapshots?: boolean;
}

export async function runSpec(
  spec: TestSpec,
  opts: RunnerOptions = {},
): Promise<RunReport> {
  const transport = buildTransport(spec.server);

  if (transport instanceof StdioTransport) {
    await transport.connect();
  } else if (transport instanceof HttpTransport) {
    await transport.connect();
  }

  const simulator = buildSimulator(spec.fixtures, spec.client?.capabilities ?? {});

  const session = new Session(transport, {
    clientInfo: {
      name: spec.client?.clientInfo?.name ?? "mcp-lab",
      version: spec.client?.clientInfo?.version ?? "0.1.0",
    },
    clientCapabilities: spec.client?.capabilities ?? {},
    requestTimeoutMs: opts.timeoutMs,
    simulator,
  });

  await session.connect();

  // Build snapshot store
  const snapshotsDir = opts.snapshotsDir ?? join(process.cwd(), ".mcp-lab", "snapshots");
  const snapshotStore: SnapshotStore = createFileSnapshotStore(snapshotsDir);

  const results: TestResult[] = [];
  const resultStore: Record<string, unknown> = {};
  const start = Date.now();
  let snapshotsUpdated = 0;

  const testsToRun = filterTests(spec.tests, opts);

  for (const test of spec.tests) {
    if (test.skip || !testsToRun.includes(test)) {
      results.push({
        testId: test.id,
        description: test.description,
        status: "skipped",
        durationMs: 0,
        assertionResults: [],
      });
      continue;
    }

    const result = await runTest(session, test, resultStore, snapshotStore, opts);
    results.push(result);

    // Count snapshot writes
    for (const ar of result.assertionResults) {
      if (ar.assertion.kind === "snapshot" && ar.passed && ar.message?.includes("written")) {
        snapshotsUpdated++;
      }
    }

    if (opts.bail && result.status === "failed") break;
  }

  await session.close();

  const totalDuration = Date.now() - start;

  return {
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    total: results.length,
    durationMs: totalDuration,
    snapshotsUpdated,
    tests: results,
  };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function filterTests(tests: TestCase[], opts: RunnerOptions): TestCase[] {
  return tests.filter((t) => {
    if (t.skip) return false;
    if (opts.ids && opts.ids.length > 0 && !opts.ids.includes(t.id)) return false;
    if (opts.tags && opts.tags.length > 0) {
      const testTags = t.tags ?? [];
      if (!opts.tags.some((tag) => testTags.includes(tag))) return false;
    }
    return true;
  });
}

async function runTest(
  session: Session,
  test: TestCase,
  resultStore: Record<string, unknown>,
  snapshotStore: SnapshotStore,
  opts: RunnerOptions,
): Promise<TestResult> {
  const testStart = Date.now();

  let rawResult: unknown;
  let protocolError = false;
  let errorMessage: string | undefined;

  try {
    rawResult = await executeAction(session, test.act, resultStore);
    if (test.storeAs) {
      resultStore[test.storeAs] = rawResult;
    }
  } catch (err) {
    protocolError = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const assertionResults = runAssertions(test.assert ?? [], {
    result: rawResult,
    protocolError,
    error: errorMessage,
    snapshotStore,
    updateSnapshots: opts.updateSnapshots,
    testId: test.id,
  });

  const allPassed = assertionResults.every((r) => r.passed);
  const status: TestStatus = protocolError && !test.assert?.length
    ? "error"
    : allPassed
      ? "passed"
      : "failed";

  return {
    testId: test.id,
    description: test.description,
    status,
    durationMs: Date.now() - testStart,
    assertionResults,
    error: errorMessage,
    rawResult,
  };
}

async function executeAction(
  session: Session,
  action: TestAction,
  _store: Record<string, unknown>,
): Promise<unknown> {
  switch (action.method) {
    case "tools/list":
      return session.listTools();
    case "tools/call":
      return session.callTool(action.tool, action.args);
    case "resources/list":
      return session.listResources();
    case "resources/read":
      return session.readResource(action.uri);
    case "prompts/list":
      return session.listPrompts();
    case "prompts/get":
      return session.getPrompt(action.name, action.args);
    case "completion/complete":
      return session.complete({
        ref: action.ref,
        argument: action.argument,
      });
    case "ping":
      await session.ping();
      return {};
  }
}

function buildSimulator(
  fixtures: Fixtures | undefined,
  clientCaps: Record<string, unknown>,
): ClientSimulator | undefined {
  const hasCaps =
    (clientCaps["roots"] !== undefined) ||
    (clientCaps["sampling"] !== undefined) ||
    (clientCaps["elicitation"] !== undefined);

  if (!fixtures && !hasCaps) return undefined;

  return new ClientSimulator({
    roots: fixtures?.roots
      ? { roots: fixtures.roots.map((r) => ({ uri: r.uri, name: r.name })) }
      : undefined,
    sampling: fixtures?.sampling
      ? { preset: fixtures.sampling }
      : clientCaps["sampling"] !== undefined
        ? {} // advertise capability but use default decline behaviour
        : undefined,
    elicitation: fixtures?.elicitation
      ? { preset: fixtures.elicitation }
      : clientCaps["elicitation"] !== undefined
        ? {}
        : undefined,
  });
}

function buildTransport(config: ServerConfig): Transport {
  switch (config.transport) {
    case "stdio": {
      const env: Record<string, string> = { ...config.env };
      return new StdioTransport({
        command: config.command,
        args: config.args,
        env,
        cwd: config.cwd,
        inheritEnv: true,
      });
    }
    case "streamable-http": {
      const headers: Record<string, string> = { ...config.headers };
      for (const [header, envVar] of Object.entries(config.headersFromEnv ?? {})) {
        const val = process.env[envVar];
        if (val !== undefined) headers[header] = val;
      }
      return new HttpTransport({ url: config.url, headers });
    }
    case "sse": {
      const headers: Record<string, string> = { ...config.headers };
      for (const [header, envVar] of Object.entries(config.headersFromEnv ?? {})) {
        const val = process.env[envVar];
        if (val !== undefined) headers[header] = val;
      }
      return new HttpTransport({ url: config.url, headers });
    }
  }
}
