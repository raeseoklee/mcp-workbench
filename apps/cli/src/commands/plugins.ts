import { PluginRuntime, loadWorkbenchConfig } from "@mcp-workbench/plugin-runtime";
import chalk from "chalk";

export interface PluginsListOptions {
  plugin?: string[];
}

export async function pluginsListCommand(opts: PluginsListOptions): Promise<void> {
  const runtime = new PluginRuntime();

  const config = await loadWorkbenchConfig();
  const configPlugins = config?.plugins ?? [];
  const flagPlugins = opts.plugin ?? [];
  const allPlugins = [...configPlugins, ...flagPlugins];

  if (allPlugins.length === 0) {
    console.log(chalk.dim("  No plugins configured."));
    console.log(chalk.dim("  Add plugins via --plugin <path> or workbench.config.yaml"));
    return;
  }

  await runtime.loadPlugins(allPlugins);

  const commands = runtime.listCommands();
  const reporters = runtime.listReporters();

  if (commands.length === 0 && reporters.length === 0) {
    console.log(chalk.yellow("  Plugins loaded but no contributions registered."));
    return;
  }

  console.log(chalk.bold(`\n  Plugins\n`));
  console.log(chalk.dim(`  Sources: ${allPlugins.join(", ")}\n`));

  if (reporters.length > 0) {
    console.log(chalk.cyan("  Reporters"));
    for (const r of reporters) {
      const desc = r.description ? chalk.dim(` — ${r.description}`) : "";
      console.log(`    ${chalk.green(r.name)}${desc}`);
    }
    console.log();
  }

  if (commands.length > 0) {
    console.log(chalk.cyan("  Commands"));
    for (const c of commands) {
      const desc = c.description ? chalk.dim(` — ${c.description}`) : "";
      console.log(`    ${chalk.green(c.name)}${desc}`);
    }
    console.log();
  }
}
