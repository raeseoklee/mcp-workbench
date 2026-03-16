/**
 * `mcp-workbench inspect` — connect to a server and display its capabilities
 * without running any tests.
 */
import { Session } from "@mcp-workbench/session-engine";
import { StdioTransport } from "@mcp-workbench/transport-stdio";
import { HttpTransport } from "@mcp-workbench/transport-http";
import { t } from "@mcp-workbench/i18n";
import chalk from "chalk";

export interface InspectCommandOptions {
  transport?: "stdio" | "streamable-http" | "sse";
  command?: string;
  args?: string;
  url?: string;
  header?: string[];
  json?: boolean;
  timeout?: string;
}

export async function inspectCommand(opts: InspectCommandOptions): Promise<void> {
  const transport = opts.transport ?? (opts.url ? "streamable-http" : "stdio");

  let rawTransport;
  if (transport === "stdio") {
    if (!opts.command) {
      console.error(chalk.red(t("cli.inspect.error.noCommand")));
      process.exit(1);
    }
    const tr = new StdioTransport({
      command: opts.command,
      args: opts.args?.split(" ").filter(Boolean),
    });
    await tr.connect();
    rawTransport = tr;
  } else {
    if (!opts.url) {
      console.error(chalk.red(t("cli.inspect.error.noUrl")));
      process.exit(1);
    }
    const headers: Record<string, string> = {};
    for (const h of opts.header ?? []) {
      const idx = h.indexOf(":");
      if (idx !== -1) headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    }
    const tr = new HttpTransport({
      url: opts.url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    await tr.connect();
    rawTransport = tr;
  }

  const session = new Session(rawTransport, {
    requestTimeoutMs: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
  });

  try {
    const negotiated = await session.connect();

    if (opts.json) {
      console.log(JSON.stringify(negotiated, null, 2));
      return;
    }

    console.log(chalk.bold(`\n  ${t("cli.inspect.header.serverInfo")}\n`));
    console.log(`  ${t("cli.inspect.label.name")} ${chalk.cyan(negotiated.serverInfo.name)}`);
    console.log(`  ${t("cli.inspect.label.version")} ${chalk.cyan(negotiated.serverInfo.version)}`);
    console.log(`  ${t("cli.inspect.label.protocol")} ${chalk.cyan(negotiated.protocolVersion)}`);

    if (negotiated.serverInstructions) {
      console.log(`\n  ${t("cli.inspect.label.instructions")}\n  ${chalk.dim(negotiated.serverInstructions)}`);
    }

    console.log(chalk.bold(`\n  ${t("cli.inspect.header.capabilities")}\n`));
    const caps = negotiated.serverCapabilities;

    printCap("tools", caps.tools, [
      caps.tools?.listChanged ? "listChanged" : null,
    ]);
    printCap("resources", caps.resources, [
      caps.resources?.subscribe ? "subscribe" : null,
      caps.resources?.listChanged ? "listChanged" : null,
    ]);
    printCap("prompts", caps.prompts, [
      caps.prompts?.listChanged ? "listChanged" : null,
    ]);
    printCap("completions", caps.completions);
    printCap("logging", caps.logging);

    // Fetch capability details
    if (caps.tools) {
      const { tools } = await session.listTools();
      console.log(chalk.bold(`\n  ${t("cli.inspect.header.tools", { count: tools.length })}\n`));
      for (const tool of tools) {
        const risk = tool.annotations?.destructiveHint ? chalk.red(` ${t("cli.inspect.annotation.destructive")}`) : "";
        const readonly = tool.annotations?.readOnlyHint ? chalk.dim(` ${t("cli.inspect.annotation.readonly")}`) : "";
        console.log(`  ${chalk.cyan(tool.name)}${risk}${readonly}`);
        if (tool.description) console.log(`    ${chalk.dim(tool.description)}`);
      }
    }

    if (caps.resources) {
      const { resources } = await session.listResources();
      console.log(chalk.bold(`\n  ${t("cli.inspect.header.resources", { count: resources.length })}\n`));
      for (const r of resources) {
        console.log(`  ${chalk.cyan(r.uri)}`);
        if (r.name !== r.uri) console.log(`    ${chalk.dim(r.name)}`);
      }
    }

    if (caps.prompts) {
      const { prompts } = await session.listPrompts();
      console.log(chalk.bold(`\n  ${t("cli.inspect.header.prompts", { count: prompts.length })}\n`));
      for (const p of prompts) {
        console.log(`  ${chalk.cyan(p.name)}`);
        if (p.description) console.log(`    ${chalk.dim(p.description)}`);
      }
    }

    console.log();
  } finally {
    await session.close();
  }
}

function printCap(
  name: string,
  cap: object | undefined,
  flags: (string | null)[] = [],
): void {
  if (cap) {
    const activeFlags = flags.filter(Boolean);
    const suffix = activeFlags.length ? chalk.dim(` (${activeFlags.join(", ")})`) : "";
    console.log(`  ${chalk.green("✓")} ${name}${suffix}`);
  } else {
    console.log(`  ${chalk.dim("○")} ${chalk.dim(name)}`);
  }
}
