import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { WorkbenchPlugin } from "@mcp-workbench/plugin-sdk";

export const PLUGIN_API_VERSION = "0.4";

/**
 * Dynamically imports a plugin from a package name or local path.
 * Returns null (and logs a warning) on any failure — never throws.
 */
export async function importPlugin(pathOrPackage: string): Promise<WorkbenchPlugin | null> {
  const specifier = resolveSpecifier(pathOrPackage);

  let mod: unknown;
  try {
    mod = await import(specifier);
  } catch (err) {
    console.warn(
      `[mcp-workbench] Failed to load plugin "${pathOrPackage}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  // Support default export or named "plugin" export
  const candidate =
    (mod as { default?: unknown }).default ??
    (mod as { plugin?: unknown }).plugin;

  if (!isWorkbenchPlugin(candidate)) {
    console.warn(
      `[mcp-workbench] Plugin "${pathOrPackage}" does not export a valid WorkbenchPlugin (expected { manifest, register })`,
    );
    return null;
  }

  const { manifest } = candidate;
  if (!manifest.name || !manifest.version || !manifest.apiVersion) {
    console.warn(
      `[mcp-workbench] Plugin "${pathOrPackage}": manifest is missing required fields (name, version, apiVersion)`,
    );
    return null;
  }

  if (manifest.apiVersion !== PLUGIN_API_VERSION) {
    console.warn(
      `[mcp-workbench] Plugin "${manifest.name}": apiVersion "${manifest.apiVersion}" does not match runtime "${PLUGIN_API_VERSION}" — skipping`,
    );
    return null;
  }

  return candidate;
}

function resolveSpecifier(pathOrPackage: string): string {
  if (pathOrPackage.startsWith(".") || isAbsolute(pathOrPackage)) {
    return pathToFileURL(resolve(process.cwd(), pathOrPackage)).href;
  }
  return pathOrPackage;
}

function isWorkbenchPlugin(value: unknown): value is WorkbenchPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    "manifest" in value &&
    typeof (value as { manifest: unknown }).manifest === "object" &&
    "register" in value &&
    typeof (value as { register: unknown }).register === "function"
  );
}
