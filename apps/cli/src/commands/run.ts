import { loadSpec } from "@mcp-lab/test-spec";
import { runSpec } from "../runner.js";
import type { RunReport, TestResult } from "../runner.js";
import chalk from "chalk";

export interface RunCommandOptions {
  tags?: string;
  ids?: string;
  bail?: boolean;
  timeout?: string;
  json?: boolean;
  verbose?: boolean;
  updateSnapshots?: boolean;
  snapshotsDir?: string;
}

export async function runCommand(
  specFile: string,
  opts: RunCommandOptions,
): Promise<void> {
  let spec;
  try {
    spec = loadSpec(specFile);
  } catch (err) {
    console.error(chalk.red(`✗ Failed to load spec: ${specFile}`));
    console.error(chalk.dim((err as Error).message));
    process.exit(1);
  }

  if (!opts.json) {
    console.log(chalk.bold("\n  MCP Lab\n"));
    console.log(chalk.dim(`  Spec:      ${specFile}`));
    console.log(chalk.dim(`  Transport: ${spec.server.transport}`));
    console.log(chalk.dim(`  Tests:     ${spec.tests.length}`));
    if (opts.updateSnapshots) {
      console.log(chalk.yellow(`  Mode:      update snapshots`));
    }
    console.log();
  }

  let report: RunReport;
  try {
    report = await runSpec(spec, {
      tags: opts.tags?.split(",").map((t) => t.trim()),
      ids: opts.ids?.split(",").map((i) => i.trim()),
      bail: opts.bail,
      timeoutMs: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
      updateSnapshots: opts.updateSnapshots,
      snapshotsDir: opts.snapshotsDir,
    });
  } catch (err) {
    console.error(chalk.red(`\n  ✗ Runner error: ${(err as Error).message}`));
    if (opts.verbose) console.error(err);
    process.exit(1);
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, opts.verbose ?? false);
  }

  const exitCode = report.failed + report.errors > 0 ? 1 : 0;
  process.exit(exitCode);
}

function printReport(report: RunReport, verbose: boolean): void {
  for (const test of report.tests) {
    printTestResult(test, verbose);
  }

  console.log();
  const summary = formatSummary(report);
  console.log(summary);
  if (report.snapshotsUpdated > 0) {
    console.log(chalk.yellow(`  Snapshots: ${report.snapshotsUpdated} written`));
  }
  console.log(chalk.dim(`  Duration:  ${report.durationMs}ms\n`));
}

function printTestResult(result: TestResult, verbose: boolean): void {
  const icon = statusIcon(result.status);
  const label = result.description
    ? `${result.testId} — ${result.description}`
    : result.testId;

  const duration = chalk.dim(` (${result.durationMs}ms)`);
  console.log(`  ${icon} ${label}${duration}`);

  if (result.status === "error" && result.error) {
    console.log(chalk.red(`    ↳ ${result.error}`));
  }

  if (verbose || result.status === "failed") {
    for (const ar of result.assertionResults) {
      if (!ar.passed) {
        const msg = ar.message ?? `assertion "${ar.assertion.kind}" failed`;
        console.log(chalk.red(`    ✗ ${ar.assertion.label ?? ar.assertion.kind}: ${msg}`));
        if (ar.diff) {
          console.log(chalk.red(ar.diff));
        } else if (ar.actual !== undefined) {
          console.log(chalk.dim(`      actual: ${JSON.stringify(ar.actual)}`));
        }
      } else if (verbose) {
        const note = ar.message ? chalk.dim(` (${ar.message})`) : "";
        console.log(
          chalk.green(`    ✓ ${ar.assertion.label ?? ar.assertion.kind}${note}`),
        );
      }
    }
  }
}

function statusIcon(status: TestResult["status"]): string {
  switch (status) {
    case "passed":  return chalk.green("✓");
    case "failed":  return chalk.red("✗");
    case "skipped": return chalk.yellow("○");
    case "error":   return chalk.red("!");
  }
}

function formatSummary(report: RunReport): string {
  const parts: string[] = [];
  if (report.passed)  parts.push(chalk.green(`${report.passed} passed`));
  if (report.failed)  parts.push(chalk.red(`${report.failed} failed`));
  if (report.errors)  parts.push(chalk.red(`${report.errors} errors`));
  if (report.skipped) parts.push(chalk.yellow(`${report.skipped} skipped`));
  parts.push(chalk.dim(`${report.total} total`));

  const allGood = report.failed === 0 && report.errors === 0;
  const header = allGood ? chalk.green("  Tests:") : chalk.red("  Tests:");
  return `${header} ${parts.join(chalk.dim(", "))}`;
}
