import { importPlugin } from "./loader.js";
import { Registry } from "./registry.js";
import { PluginContextImpl } from "./context.js";
import { loadWorkbenchConfig } from "./config.js";
import type {
  WorkbenchPlugin,
  CommandContribution,
  ReporterContribution,
  PluginLogger,
} from "@mcp-workbench/plugin-sdk";

export class PluginRuntime {
  private readonly registry = new Registry();

  /**
   * Load plugins from workbench.config.yaml merged with explicit flag paths.
   * Deduplicates paths (config first, then flags).
   */
  async loadFromConfigAndFlags(flagPlugins: string[] = []): Promise<void> {
    const config = await loadWorkbenchConfig();
    const configPlugins = config?.plugins ?? [];
    const allPlugins = [...configPlugins, ...flagPlugins];
    if (allPlugins.length > 0) await this.loadPlugins(allPlugins);
  }

  /** Load plugins from a list of package names or local paths (parallel). */
  async loadPlugins(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => this.loadPlugin(p)));
  }

  /** Load a single plugin from a package name or local path. */
  async loadPlugin(pathOrPackage: string): Promise<void> {
    const plugin = await importPlugin(pathOrPackage);
    if (plugin) await this.registerPlugin(plugin);
  }

  /**
   * Register a pre-loaded plugin object.
   * Useful for testing or programmatic usage without filesystem loading.
   */
  async registerPlugin(plugin: WorkbenchPlugin): Promise<void> {
    const logger: PluginLogger = makeLogger(plugin.manifest.name);
    const context = new PluginContextImpl(plugin.manifest.name, this.registry, logger);
    try {
      await plugin.register(context);
    } catch (err) {
      console.warn(
        `[mcp-workbench] Plugin "${plugin.manifest.name}": register() threw an error — disabling plugin: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  getCommand(name: string): CommandContribution | undefined {
    return this.registry.getCommand(name);
  }

  getReporter(name: string): ReporterContribution | undefined {
    return this.registry.getReporter(name);
  }

  listCommands(): CommandContribution[] {
    return this.registry.listCommands();
  }

  listReporters(): ReporterContribution[] {
    return this.registry.listReporters();
  }
}

function makeLogger(pluginName: string): PluginLogger {
  return {
    info: (msg) => console.log(`[${pluginName}] ${msg}`),
    warn: (msg) => console.warn(`[${pluginName}] ${msg}`),
    error: (msg) => console.error(`[${pluginName}] ${msg}`),
  };
}
