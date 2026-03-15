import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export interface WorkbenchConfig {
  plugins?: string[];
}

const CONFIG_FILENAMES = ["workbench.config.yaml", "workbench.config.yml"];

/**
 * Looks for workbench.config.yaml (or .yml) in the given directory
 * and returns the parsed config, or null if no file is found.
 * Never throws — parse errors are logged as warnings.
 */
export async function loadWorkbenchConfig(cwd: string = process.cwd()): Promise<WorkbenchConfig | null> {
  for (const name of CONFIG_FILENAMES) {
    const filePath = resolve(cwd, name);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    try {
      const parsed = parseYamlSubset(raw);
      return parsed;
    } catch (err) {
      console.warn(
        `[mcp-workbench] Failed to parse ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
  return null;
}

async function parseYamlSubset(raw: string): Promise<WorkbenchConfig> {
  const doc = parseYaml(raw) as unknown;

  if (typeof doc !== "object" || doc === null) {
    return {};
  }

  const obj = doc as Record<string, unknown>;
  const config: WorkbenchConfig = {};

  if (Array.isArray(obj["plugins"])) {
    config.plugins = (obj["plugins"] as unknown[])
      .filter((p): p is string => typeof p === "string");
  }

  return config;
}
