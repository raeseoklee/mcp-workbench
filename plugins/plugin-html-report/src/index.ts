import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkbenchPlugin, PluginContext } from "@mcp-workbench/plugin-sdk";
import { PLUGIN_API_VERSION } from "./version.js";
import { generateHtml } from "./generator.js";

const plugin: WorkbenchPlugin = {
  manifest: {
    name: "@mcp-workbench/plugin-html-report",
    version: "0.4.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "Generates a self-contained HTML test report",
    contributes: { reporters: ["html"] },
  },

  register(ctx: PluginContext): void {
    ctx.registerReporter({
      name: "html",
      description: "Self-contained HTML report",
      async generate({ report, specFile, outputPath }) {
        const html = generateHtml(report, specFile);
        const out = resolve(outputPath ?? "mcp-workbench-report.html");
        await writeFile(out, html, "utf8");
        ctx.logger.info(`HTML report written to ${out}`);
      },
    });
  },
};

export default plugin;
