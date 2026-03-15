import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { TestSpec } from "./types.js";
import { SPEC_API_VERSION } from "./types.js";

export class SpecParseError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SpecParseError";
  }
}

/**
 * Parse a YAML test spec from a string.
 */
export function parseSpec(yaml: string, filePath?: string): TestSpec {
  let raw: unknown;
  try {
    raw = parseYaml(yaml);
  } catch (err) {
    throw new SpecParseError("Failed to parse YAML", filePath, err);
  }

  if (typeof raw !== "object" || raw === null) {
    throw new SpecParseError("Spec must be a YAML object", filePath);
  }

  const spec = raw as Record<string, unknown>;

  // Version check
  if (spec["apiVersion"] !== SPEC_API_VERSION) {
    throw new SpecParseError(
      `Unsupported apiVersion "${spec["apiVersion"] ?? "(missing)"}". Expected "${SPEC_API_VERSION}".`,
      filePath,
    );
  }

  if (!spec["server"]) {
    throw new SpecParseError("Missing required field: server", filePath);
  }

  if (!Array.isArray(spec["tests"]) || spec["tests"].length === 0) {
    throw new SpecParseError("Missing or empty required field: tests", filePath);
  }

  validateTests(spec["tests"] as unknown[], filePath);

  return raw as TestSpec;
}

/**
 * Load and parse a test spec from a file path.
 */
export function loadSpec(filePath: string): TestSpec {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new SpecParseError(`Cannot read file: ${filePath}`, filePath, err);
  }
  return parseSpec(content, filePath);
}

function validateTests(tests: unknown[], filePath?: string): void {
  const ids = new Set<string>();
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i] as Record<string, unknown>;
    if (!test["id"] || typeof test["id"] !== "string") {
      throw new SpecParseError(`Test at index ${i} is missing required field: id`, filePath);
    }
    if (ids.has(test["id"])) {
      throw new SpecParseError(`Duplicate test id: "${test["id"]}"`, filePath);
    }
    ids.add(test["id"]);

    if (!test["act"] || typeof test["act"] !== "object") {
      throw new SpecParseError(
        `Test "${test["id"]}" is missing required field: act`,
        filePath,
      );
    }

    const act = test["act"] as Record<string, unknown>;
    if (!act["method"] || typeof act["method"] !== "string") {
      throw new SpecParseError(
        `Test "${test["id"]}" act is missing required field: method`,
        filePath,
      );
    }
  }
}
