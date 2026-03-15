import type {
  PluginContext,
  CommandContribution,
  ReporterContribution,
  PluginLogger,
} from "@mcp-workbench/plugin-sdk";
import type { Registry } from "./registry.js";

export class PluginContextImpl implements PluginContext {
  constructor(
    private readonly pluginName: string,
    private readonly registry: Registry,
    readonly logger: PluginLogger,
  ) {}

  registerCommand(cmd: CommandContribution): void {
    this.registry.addCommand(this.pluginName, cmd);
  }

  registerReporter(reporter: ReporterContribution): void {
    this.registry.addReporter(this.pluginName, reporter);
  }
}
