import type { CommandContribution, ReporterContribution } from "@mcp-workbench/plugin-sdk";

export class Registry {
  private readonly commands = new Map<string, CommandContribution>();
  private readonly reporters = new Map<string, ReporterContribution>();

  addCommand(pluginName: string, cmd: CommandContribution): void {
    if (this.commands.has(cmd.name)) {
      console.warn(
        `[mcp-workbench] Plugin "${pluginName}": command "${cmd.name}" already registered — skipping duplicate`,
      );
      return;
    }
    this.commands.set(cmd.name, cmd);
  }

  addReporter(pluginName: string, reporter: ReporterContribution): void {
    if (this.reporters.has(reporter.name)) {
      console.warn(
        `[mcp-workbench] Plugin "${pluginName}": reporter "${reporter.name}" already registered — skipping duplicate`,
      );
      return;
    }
    this.reporters.set(reporter.name, reporter);
  }

  getCommand(name: string): CommandContribution | undefined {
    return this.commands.get(name);
  }

  getReporter(name: string): ReporterContribution | undefined {
    return this.reporters.get(name);
  }

  listCommands(): CommandContribution[] {
    return [...this.commands.values()];
  }

  listReporters(): ReporterContribution[] {
    return [...this.reporters.values()];
  }
}
