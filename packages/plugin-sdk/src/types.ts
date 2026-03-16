// ─── Manifest ─────────────────────────────────────────────────────────────────

export interface PluginManifest {
  /** npm package name or local identifier */
  name: string;
  version: string;
  /** Must match PLUGIN_API_VERSION in plugin-runtime (currently "0.4") */
  apiVersion: string;
  description?: string;
  contributes?: {
    commands?: string[];
    reporters?: string[];
  };
}

// ─── RunReport (mirrors CLI runner shape; plugins use this for reporting) ──────

export interface AssertionSummary {
  assertion: { kind: string; label?: string };
  passed: boolean;
  actual: unknown;
  message?: string;
  diff?: string;
}

export interface TestResultSummary {
  testId: string;
  description?: string;
  status: "passed" | "failed" | "skipped" | "error";
  durationMs: number;
  assertionResults: AssertionSummary[];
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
  tests: TestResultSummary[];
}

// ─── Contributions ────────────────────────────────────────────────────────────

export interface CommandRunContext {
  args: string[];
  options: Record<string, unknown>;
}

export interface ReportContext {
  report: RunReport;
  specFile?: string;
  outputPath?: string;
}

export interface CommandContribution {
  name: string;
  description?: string;
  run(ctx: CommandRunContext): Promise<number | void>;
}

export interface ReporterContribution {
  name: string;
  description?: string;
  generate(ctx: ReportContext): Promise<void>;
}

// ─── Plugin infrastructure ────────────────────────────────────────────────────

export interface PluginLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface PluginContext {
  registerCommand(command: CommandContribution): void;
  registerReporter(reporter: ReporterContribution): void;
  logger: PluginLogger;
}

export interface WorkbenchPlugin {
  manifest: PluginManifest;
  register(context: PluginContext): Promise<void> | void;
}
