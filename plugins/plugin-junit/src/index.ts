import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkbenchPlugin, PluginContext } from "@mcp-workbench/plugin-sdk";
import { PLUGIN_API_VERSION } from "./version.js";
import { generateJUnit } from "./generator.js";

const plugin: WorkbenchPlugin = {
  manifest: {
    name: "@mcp-workbench/plugin-junit",
    version: "0.4.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "Generates JUnit XML test report for CI systems",
    contributes: { reporters: ["junit"] },
  },

  register(ctx: PluginContext): void {
    ctx.registerReporter({
      name: "junit",
      description: "JUnit XML report (GitHub Actions, Jenkins, GitLab CI)",
      async generate({ report, specFile, outputPath }) {
        const xml = generateJUnit(report, specFile);
        const out = resolve(outputPath ?? "mcp-workbench-report.xml");
        await writeFile(out, xml, "utf8");
        ctx.logger.info(`JUnit XML report written to ${out}`);
      },
    });
  },
};

export default plugin;
