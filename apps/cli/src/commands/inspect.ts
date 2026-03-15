/**
 * `mcp-lab inspect` — connect to a server and display its capabilities
 * without running any tests.
 */
import { Session } from "@mcp-lab/session-engine";
import { StdioTransport } from "@mcp-lab/transport-stdio";
import { HttpTransport } from "@mcp-lab/transport-http";
import chalk from "chalk";

export interface InspectCommandOptions {
  transport?: "stdio" | "streamable-http" | "sse";
  command?: string;
  args?: string;
  url?: string;
  json?: boolean;
  timeout?: string;
}

export async function inspectCommand(opts: InspectCommandOptions): Promise<void> {
  const transport = opts.transport ?? (opts.url ? "streamable-http" : "stdio");

  let rawTransport;
  if (transport === "stdio") {
    if (!opts.command) {
      console.error(chalk.red("--command is required for stdio transport"));
      process.exit(1);
    }
    const t = new StdioTransport({
      command: opts.command,
      args: opts.args?.split(" ").filter(Boolean),
    });
    await t.connect();
    rawTransport = t;
  } else {
    if (!opts.url) {
      console.error(chalk.red("--url is required for HTTP transport"));
      process.exit(1);
    }
    const t = new HttpTransport({ url: opts.url });
    await t.connect();
    rawTransport = t;
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

    console.log(chalk.bold("\n  Server Info\n"));
    console.log(`  Name:     ${chalk.cyan(negotiated.serverInfo.name)}`);
    console.log(`  Version:  ${chalk.cyan(negotiated.serverInfo.version)}`);
    console.log(`  Protocol: ${chalk.cyan(negotiated.protocolVersion)}`);

    if (negotiated.serverInstructions) {
      console.log(`\n  Instructions:\n  ${chalk.dim(negotiated.serverInstructions)}`);
    }

    console.log(chalk.bold("\n  Capabilities\n"));
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
      console.log(chalk.bold(`\n  Tools (${tools.length})\n`));
      for (const tool of tools) {
        const risk = tool.annotations?.destructiveHint ? chalk.red(" [destructive]") : "";
        const readonly = tool.annotations?.readOnlyHint ? chalk.dim(" [read-only]") : "";
        console.log(`  ${chalk.cyan(tool.name)}${risk}${readonly}`);
        if (tool.description) console.log(`    ${chalk.dim(tool.description)}`);
      }
    }

    if (caps.resources) {
      const { resources } = await session.listResources();
      console.log(chalk.bold(`\n  Resources (${resources.length})\n`));
      for (const r of resources) {
        console.log(`  ${chalk.cyan(r.uri)}`);
        if (r.name !== r.uri) console.log(`    ${chalk.dim(r.name)}`);
      }
    }

    if (caps.prompts) {
      const { prompts } = await session.listPrompts();
      console.log(chalk.bold(`\n  Prompts (${prompts.length})\n`));
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
