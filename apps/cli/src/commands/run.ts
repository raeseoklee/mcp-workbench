import { loadSpec } from "@mcp-lab/test-spec";
import { runSpec } from "../runner.js";
import type { RunReport, TestResult } from "../runner.js";
import { t } from "@mcp-lab/i18n";
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
    console.error(chalk.red(`✗ ${t("cli.run.error.loadSpec", { file: specFile })}`));
    console.error(chalk.dim((err as Error).message));
    process.exit(1);
  }

  if (!opts.json) {
    console.log(chalk.bold(`\n  ${t("cli.run.header")}\n`));
    console.log(chalk.dim(`  ${t("cli.run.label.spec", { file: specFile })}`));
    console.log(chalk.dim(`  ${t("cli.run.label.transport", { transport: spec.server.transport })}`));
    console.log(chalk.dim(`  ${t("cli.run.label.tests", { count: spec.tests.length })}`));
    if (opts.updateSnapshots) {
      console.log(chalk.yellow(`  ${t("cli.run.label.mode.updateSnapshots")}`));
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
    console.error(chalk.red(`\n  ✗ ${t("cli.run.error.runner", { error: (err as Error).message })}`));
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
    console.log(chalk.yellow(`  ${t("cli.run.label.snapshots", { n: report.snapshotsUpdated })}`));
  }
  console.log(chalk.dim(`  ${t("cli.run.label.duration", { ms: report.durationMs })}\n`));
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
        const msg = ar.message ?? t("cli.run.assertion.defaultFail", { kind: ar.assertion.kind });
        console.log(chalk.red(`    ✗ ${ar.assertion.label ?? ar.assertion.kind}: ${msg}`));
        if (ar.diff) {
          console.log(chalk.red(ar.diff));
        } else if (ar.actual !== undefined) {
          console.log(chalk.dim(`      ${t("cli.run.assertion.actual", { value: JSON.stringify(ar.actual) })}`));
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
  if (report.passed)  parts.push(chalk.green(`${report.passed} ${t("cli.run.summary.passed")}`));
  if (report.failed)  parts.push(chalk.red(`${report.failed} ${t("cli.run.summary.failed")}`));
  if (report.errors)  parts.push(chalk.red(`${report.errors} ${t("cli.run.summary.errors")}`));
  if (report.skipped) parts.push(chalk.yellow(`${report.skipped} ${t("cli.run.summary.skipped")}`));
  parts.push(chalk.dim(`${report.total} ${t("cli.run.summary.total")}`));

  const allGood = report.failed === 0 && report.errors === 0;
  const label = `  ${t("cli.run.summary.tests")}`;
  const header = allGood ? chalk.green(label) : chalk.red(label);
  return `${header} ${parts.join(chalk.dim(", "))}`;
}
