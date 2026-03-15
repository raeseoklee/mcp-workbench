import type {
  Assertion,
  AssertionResult,
  JsonPathAssertion,
} from "./types.js";
import type { SnapshotStore } from "./snapshot.js";
import { applyIgnorePaths, diffValues, formatDiff, nullSnapshotStore } from "./snapshot.js";

/** Minimal JSONPath evaluator (supports $.x, $.x.y, $.x[*].y, $.x[0]) */
function jsonPath(obj: unknown, path: string): unknown[] {
  if (path === "$" || path === "") return [obj];

  const parts = path
    .replace(/^\$\.?/, "")
    .split(/\.(?![^\[]*\])/)
    .filter(Boolean);

  let current: unknown[] = [obj];

  for (const part of parts) {
    const next: unknown[] = [];

    const wildcardMatch = part.match(/^(\w+)\[\*\]$/);
    const indexMatch = part.match(/^(\w+)\[(\d+)\]$/);

    for (const node of current) {
      if (node === null || typeof node !== "object") continue;

      if (wildcardMatch) {
        const key = wildcardMatch[1]!;
        const arr = (node as Record<string, unknown>)[key];
        if (Array.isArray(arr)) next.push(...arr);
      } else if (indexMatch) {
        const key = indexMatch[1]!;
        const idx = parseInt(indexMatch[2]!, 10);
        const arr = (node as Record<string, unknown>)[key];
        if (Array.isArray(arr) && idx < arr.length) {
          next.push(arr[idx]);
        }
      } else if (part === "[*]" || part === "*") {
        const val = Array.isArray(node) ? node : Object.values(node as object);
        next.push(...val);
      } else {
        const val = (node as Record<string, unknown>)[part];
        if (val !== undefined) next.push(val);
      }
    }

    current = next;
  }

  return current;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function checkJsonPath(assertion: JsonPathAssertion, data: unknown): AssertionResult {
  const values = jsonPath(data, assertion.path);

  if (assertion.notEmpty === true) {
    const passed = values.length > 0;
    return {
      assertion,
      passed,
      actual: values,
      message: passed ? undefined : `JSONPath "${assertion.path}" returned no values`,
    };
  }

  if (assertion.equals !== undefined) {
    const actual = values.length === 1 ? values[0] : values;
    const passed = deepEqual(actual, assertion.equals);
    return {
      assertion,
      passed,
      actual,
      message: passed ? undefined : `Expected ${JSON.stringify(assertion.equals)}, got ${JSON.stringify(actual)}`,
    };
  }

  if (assertion.contains !== undefined) {
    const passed = values.some((v) => {
      if (typeof v === "string" && typeof assertion.contains === "string") {
        return v.includes(assertion.contains);
      }
      return deepEqual(v, assertion.contains);
    });
    return {
      assertion,
      passed,
      actual: values,
      message: passed ? undefined : `JSONPath "${assertion.path}" values did not contain ${JSON.stringify(assertion.contains)}`,
    };
  }

  if (assertion.matches !== undefined) {
    const regex = new RegExp(assertion.matches);
    const passed = values.some((v) => typeof v === "string" && regex.test(v));
    return {
      assertion,
      passed,
      actual: values,
      message: passed ? undefined : `JSONPath "${assertion.path}" values did not match /${assertion.matches}/`,
    };
  }

  return {
    assertion,
    passed: values.length > 0,
    actual: values,
    message: undefined,
  };
}

export interface RunContext {
  /** The raw result object from the MCP method call */
  result?: unknown;
  /** Whether the call threw a protocol-level error */
  protocolError?: boolean;
  /** Error object if thrown */
  error?: unknown;
  /** Tool output schema, if available */
  outputSchema?: Record<string, unknown>;
  /**
   * Snapshot store for baseline comparison.
   * If omitted, snapshot assertions are skipped.
   */
  snapshotStore?: SnapshotStore;
  /**
   * When true, snapshot assertions overwrite the baseline instead of comparing.
   */
  updateSnapshots?: boolean;
  /**
   * Test ID used as default snapshot name when SnapshotAssertion.name is not set.
   */
  testId?: string;
}

export function runAssertion(assertion: Assertion, ctx: RunContext): AssertionResult {
  const { result, protocolError = false, error } = ctx;

  switch (assertion.kind) {
    case "status": {
      const isSuccess = !protocolError && error === undefined;
      const passed =
        assertion.equals === "success" ? isSuccess : !isSuccess;
      return {
        assertion,
        passed,
        actual: isSuccess ? "success" : "error",
        message: passed ? undefined : `Expected status "${assertion.equals}"`,
      };
    }

    case "executionError": {
      // MCP tool isError flag — distinct from protocol errors
      const isExecError =
        typeof result === "object" &&
        result !== null &&
        (result as { isError?: boolean }).isError === true;
      const passed = assertion.equals === isExecError;
      return {
        assertion,
        passed,
        actual: isExecError,
        message: passed ? undefined : `Expected executionError=${assertion.equals}, got ${isExecError}`,
      };
    }

    case "protocolError": {
      const passed = assertion.equals === protocolError;
      return {
        assertion,
        passed,
        actual: protocolError,
        message: passed ? undefined : `Expected protocolError=${assertion.equals}, got ${protocolError}`,
      };
    }

    case "jsonpath":
      return checkJsonPath(assertion, result);

    case "contains": {
      const target = assertion.path ? jsonPath(result, assertion.path) : [result];
      const passed = target.some((v) => {
        if (typeof v === "string" && typeof assertion.value === "string") {
          return v.includes(assertion.value);
        }
        if (Array.isArray(v)) {
          return v.some((item) => deepEqual(item, assertion.value));
        }
        return deepEqual(v, assertion.value);
      });
      return { assertion, passed, actual: target, message: undefined };
    }

    case "equals": {
      const target = assertion.path
        ? jsonPath(result, assertion.path)[0]
        : result;
      const passed = deepEqual(target, assertion.value);
      return {
        assertion,
        passed,
        actual: target,
        message: passed ? undefined : `Expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(target)}`,
      };
    }

    case "notEmpty": {
      const target = assertion.path ? jsonPath(result, assertion.path)[0] : result;
      const passed =
        target !== null &&
        target !== undefined &&
        (typeof target === "string"
          ? target.length > 0
          : Array.isArray(target)
            ? target.length > 0
            : typeof target === "object"
              ? Object.keys(target).length > 0
              : true);
      return { assertion, passed, actual: target, message: undefined };
    }

    case "count": {
      const target = assertion.path ? jsonPath(result, assertion.path)[0] : result;
      const count = Array.isArray(target) ? target.length : 0;
      const passed =
        (assertion.equals === undefined || count === assertion.equals) &&
        (assertion.min === undefined || count >= assertion.min) &&
        (assertion.max === undefined || count <= assertion.max);
      return {
        assertion,
        passed,
        actual: count,
        message: passed ? undefined : `Count ${count} did not satisfy constraints`,
      };
    }

    case "contentType": {
      // Check content[*].type in tool results
      const content = jsonPath(result, "$.content[*].type");
      if (assertion.equals !== undefined) {
        const passed = content.every((t) => t === assertion.equals);
        return { assertion, passed, actual: content, message: undefined };
      }
      if (assertion.contains !== undefined) {
        const passed = content.includes(assertion.contains);
        return { assertion, passed, actual: content, message: undefined };
      }
      return { assertion, passed: content.length > 0, actual: content, message: undefined };
    }

    case "outputSchemaValid": {
      // If no output schema available, skip (pass)
      if (!ctx.outputSchema) {
        return { assertion, passed: true, actual: undefined, message: "No outputSchema to validate against (skipped)" };
      }
      // Basic presence check: structuredContent must exist when outputSchema present
      const hasStructured =
        typeof result === "object" &&
        result !== null &&
        "structuredContent" in result &&
        (result as { structuredContent?: unknown }).structuredContent !== undefined;
      const passed = assertion.equals === hasStructured;
      return {
        assertion,
        passed,
        actual: hasStructured,
        message: passed ? undefined : `outputSchema validation: expected ${assertion.equals}, got ${hasStructured}`,
      };
    }

    case "schema": {
      // Lightweight schema check: only validates "required" and "type"
      const target = assertion.path ? jsonPath(result, assertion.path)[0] : result;
      const schema = assertion.schema;
      const required = (schema["required"] as string[] | undefined) ?? [];
      const missing = required.filter(
        (k) =>
          typeof target !== "object" ||
          target === null ||
          !(k in (target as object)),
      );
      const passed = missing.length === 0;
      return {
        assertion,
        passed,
        actual: target,
        message: passed ? undefined : `Missing required fields: ${missing.join(", ")}`,
      };
    }

    case "snapshot": {
      const store = ctx.snapshotStore ?? nullSnapshotStore;
      const name = assertion.name ?? ctx.testId ?? "snapshot";
      const ignorePaths = assertion.ignorePaths ?? [];

      const normalised = applyIgnorePaths(result, ignorePaths);

      if (ctx.updateSnapshots) {
        store.save(name, normalised);
        return {
          assertion,
          passed: true,
          actual: normalised,
          message: `Snapshot "${name}" written.`,
        };
      }

      const rawBaseline = store.load(name);
      if (rawBaseline === undefined) {
        // First time: auto-save and pass
        store.save(name, normalised);
        return {
          assertion,
          passed: true,
          actual: normalised,
          message: `Snapshot "${name}" created (first run).`,
        };
      }

      // Apply the same ignorePaths to the baseline so unstable fields are
      // excluded from both sides before comparing.
      const baseline = applyIgnorePaths(rawBaseline, ignorePaths);
      const diffs = diffValues(baseline, normalised);
      if (!diffs.length) {
        return {
          assertion,
          passed: true,
          actual: normalised,
          message: undefined,
        };
      }

      return {
        assertion,
        passed: false,
        actual: normalised,
        message: `Snapshot "${name}" mismatch (${diffs.length} diff${diffs.length === 1 ? "" : "s"})`,
        diff: formatDiff(diffs),
      };
    }
  }
}

export function runAssertions(
  assertions: Assertion[],
  ctx: RunContext,
): AssertionResult[] {
  return assertions.map((a) => runAssertion(a, ctx));
}
