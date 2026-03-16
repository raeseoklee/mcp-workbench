import { Command } from "commander";
import { setLang } from "@mcp-workbench/i18n";
import { runCommand } from "./commands/run.js";
import { inspectCommand } from "./commands/inspect.js";
import { pluginsListCommand } from "./commands/plugins.js";
import { generateCommand } from "./commands/generate.js";

const program = new Command();

program
  .name("mcp-workbench")
  .description("MCP server testing, validation, and regression platform")
  .version("0.1.0")
  .option(
    "--lang <locale>",
    "Output language: en | ko  (env: MCP_WORKBENCH_LANG)",
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
  .option("--snapshots-dir <dir>", "Directory for snapshot files (default: .mcp-workbench/snapshots)")
  .option("--plugin <path>", "Load a plugin (repeatable)", (v: string, prev: string[]) => [...prev, v], [] as string[])
  .option("--reporter <name>", "Reporter plugin to invoke after tests (e.g. html)")
  .option("--reporter-output <path>", "Output path passed to the reporter")
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

// ─── generate ─────────────────────────────────────────────────────────────────

program
  .command("generate")
  .description("Connect to an MCP server and generate a YAML test spec scaffold")
  .option(
    "--transport <kind>",
    "Transport: stdio | streamable-http",
    "stdio",
  )
  .option("--command <cmd>", "Command to run (stdio transport)")
  .option("--args <args>", "Space-separated arguments (stdio transport)")
  .option("--url <url>", "Server URL (HTTP transport)")
  .option("--header <header>", "HTTP header 'Key: Value' (repeatable)", (v: string, prev: string[]) => [...prev, v], [] as string[])
  .option("--timeout <ms>", "Connection timeout in milliseconds")
  .option("--include <list>", "Comma-separated capabilities: tools,resources,prompts")
  .option("--exclude <list>", "Comma-separated capabilities to skip")
  .option("--depth <mode>", "Generation depth: shallow (default) or deep", "shallow")
  .option("--allow-side-effects", "Allow calling potentially destructive tools in deep mode", false)
  .option("-o, --output <file>", "Write spec to file")
  .option("--stdout", "Print spec to stdout", false)
  .option("--overwrite", "Overwrite existing output file", false)
  .action(generateCommand);

// ─── plugins ──────────────────────────────────────────────────────────────────

const pluginsCmd = program.command("plugins").description("Plugin management commands");

pluginsCmd
  .command("list")
  .description("List loaded plugins and their contributions")
  .option("--plugin <path>", "Load a plugin (repeatable)", (v: string, prev: string[]) => [...prev, v], [] as string[])
  .action(pluginsListCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
