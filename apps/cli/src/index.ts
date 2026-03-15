#!/usr/bin/env node
import { Command } from "commander";
import { setLang } from "@mcp-lab/i18n";
import { runCommand } from "./commands/run.js";
import { inspectCommand } from "./commands/inspect.js";

const program = new Command();

program
  .name("mcp-lab")
  .description("MCP server testing, validation, and regression platform")
  .version("0.1.0")
  .option(
    "--lang <locale>",
    "Output language: en | ko  (env: MCP_LAB_LANG)",
  )
  .hook("preAction", () => {
    const lang = (program.opts() as { lang?: string }).lang;
    if (lang) setLang(lang);
  });

// ─── run ─────────────────────────────────────────────────────────────────────

program
  .command("run <spec-file>")
  .description("Run a YAML test spec against an MCP server")
  .option("--tags <tags>", "Run only tests with these comma-separated tags")
  .option("--ids <ids>", "Run only tests with these comma-separated IDs")
  .option("--bail", "Stop after first failure", false)
  .option("--timeout <ms>", "Per-request timeout in milliseconds")
  .option("--json", "Output results as JSON", false)
  .option("-v, --verbose", "Show all assertion details", false)
  .option("-u, --update-snapshots", "Write/overwrite snapshot baselines", false)
  .option("--snapshots-dir <dir>", "Directory for snapshot files (default: .mcp-lab/snapshots)")
  .action(runCommand);

// ─── inspect ─────────────────────────────────────────────────────────────────

program
  .command("inspect")
  .description("Connect to an MCP server and display its capabilities")
  .option(
    "--transport <kind>",
    "Transport: stdio | streamable-http | sse",
    "stdio",
  )
  .option("--command <cmd>", "Command to run (stdio transport)")
  .option("--args <args>", "Space-separated arguments (stdio transport)")
  .option("--url <url>", "Server URL (HTTP transport)")
  .option("--timeout <ms>", "Request timeout in milliseconds")
  .option("--json", "Output as JSON", false)
  .action(inspectCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
