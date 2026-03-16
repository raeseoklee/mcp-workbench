import { writeFileSync, existsSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { generate } from "@mcp-workbench/spec-generator";
import type { GenerateOptions, DiscoveryResult } from "@mcp-workbench/spec-generator";

interface GenerateCommandOpts {
  transport: string;
  url?: string;
  command?: string;
  args?: string;
  header?: string[];
  timeout?: string;
  include?: string;
  exclude?: string;
  output?: string;
  stdout?: boolean;
  overwrite?: boolean;
  depth?: string;
  allowSideEffects?: boolean;
}

export async function generateCommand(opts: GenerateCommandOpts): Promise<void> {
  // Validate output
  if (!opts.output && !opts.stdout) {
    console.error(chalk.red("Error: specify --output <file> or --stdout"));
    process.exit(1);
  }

  if (opts.output && !opts.overwrite && existsSync(opts.output)) {
    console.error(chalk.red(`Error: ${opts.output} already exists. Use --overwrite to replace.`));
    process.exit(1);
  }

  // Parse headers
  const headers: Record<string, string> = {};
  for (const h of opts.header ?? []) {
    const idx = h.indexOf(":");
    if (idx === -1) {
      console.error(chalk.red(`Invalid header format: ${h} (expected "Key: Value")`));
      process.exit(1);
    }
    headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
  }

  // Parse include/exclude
  const parseSet = (val?: string): Set<"tools" | "resources" | "prompts"> | undefined => {
    if (!val) return undefined;
    return new Set(val.split(",").map((s) => s.trim()) as Array<"tools" | "resources" | "prompts">);
  };

  const useSpinner = !opts.stdout;
  const spinner = useSpinner ? ora("Connecting to server...").start() : null;

  const genOpts: GenerateOptions = {
    transport: opts.transport as "stdio" | "streamable-http",
    url: opts.url,
    command: opts.command,
    args: opts.args,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    timeoutMs: opts.timeout ? Number(opts.timeout) : undefined,
    include: parseSet(opts.include),
    exclude: parseSet(opts.exclude),
    depth: (opts.depth as "shallow" | "deep") ?? "shallow",
    allowSideEffects: opts.allowSideEffects ?? false,
    onProgress: useSpinner
      ? (msg) => { if (spinner) spinner.text = msg; }
      : undefined,
  };

  try {
    const result = await generate(genOpts);
    spinner?.stop();

    if (opts.stdout) {
      process.stdout.write(result.yaml);
    }

    if (opts.output) {
      writeFileSync(opts.output, result.yaml, "utf-8");
    }

    // Summary
    if (!opts.stdout || opts.output) {
      const d = result.discovery;
      console.log();
      console.log(chalk.bold("  mcp-workbench generate"));
      console.log();

      // Initialize status
      if (d.initialize.status === "success" && result.serverInfo) {
        console.log(`  Server:    ${result.serverInfo.name} v${result.serverInfo.version} (${result.serverInfo.protocol})`);
      } else if (d.initialize.status === "failed") {
        console.log(`  ${chalk.yellow("⚠")} initialize failed: ${d.initialize.error}`);
        console.log(`  ${chalk.dim("  Continuing with partial discovery...")}`);
      }

      // Per-category status
      console.log();
      printDiscovery("tools", d.tools, result.counts.tools);
      printDiscovery("resources", d.resources, result.counts.resources);
      printDiscovery("prompts", d.prompts, result.counts.prompts);

      console.log();
      console.log(`  Tests:     ${chalk.green(result.counts.tests)} generated`);

      if (result.skipped.length > 0) {
        console.log(`  Skipped:   ${chalk.yellow(result.skipped.length)} tools`);
        for (const s of result.skipped) {
          console.log(`    ${chalk.dim("→")} ${s.tool}: ${s.reason}`);
        }
      }

      if (opts.output) {
        console.log();
        console.log(`  ${chalk.green("Written to")} ${opts.output}`);
      }
      console.log();
    }
  } catch (err) {
    spinner?.fail("Generation failed");
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

function printDiscovery(name: string, result: DiscoveryResult<unknown>, count: number): void {
  const padded = (name + ":").padEnd(12);
  if (result.status === "success") {
    console.log(`  ${padded} ${chalk.green("✓")} ${count} discovered`);
  } else if (result.status === "failed") {
    console.log(`  ${padded} ${chalk.red("✗")} failed (${result.error})`);
  } else {
    console.log(`  ${padded} ${chalk.dim("○")} skipped`);
  }
}
