/** All assertion kinds that the engine supports */
export type AssertionKind =
  | "status"            // success | error
  | "jsonpath"          // JSONPath expression on result
  | "contains"          // value contains substring
  | "equals"            // deep equality
  | "schema"            // JSON Schema validation
  | "outputSchemaValid" // MCP tool outputSchema validation
  | "contentType"       // content[*].type check
  | "executionError"    // isError === true in tool result
  | "protocolError"     // JSON-RPC error response
  | "notEmpty"          // result is non-empty array/object/string
  | "count"             // array length check
  | "snapshot";         // baseline snapshot comparison

export interface BaseAssertion {
  kind: AssertionKind;
  /** Human-readable label (optional) */
  label?: string;
}

export interface StatusAssertion extends BaseAssertion {
  kind: "status";
  equals: "success" | "error";
}

export interface JsonPathAssertion extends BaseAssertion {
  kind: "jsonpath";
  path: string;
  equals?: unknown;
  contains?: unknown;
  matches?: string; // regex
  notEmpty?: boolean;
}

export interface ContainsAssertion extends BaseAssertion {
  kind: "contains";
  path?: string;
  value: unknown;
}

export interface EqualsAssertion extends BaseAssertion {
  kind: "equals";
  path?: string;
  value: unknown;
}

export interface SchemaAssertion extends BaseAssertion {
  kind: "schema";
  schema: Record<string, unknown>;
  path?: string;
}

export interface OutputSchemaValidAssertion extends BaseAssertion {
  kind: "outputSchemaValid";
  equals: boolean;
}

export interface ContentTypeAssertion extends BaseAssertion {
  kind: "contentType";
  contains?: string;
  equals?: string;
}

export interface ExecutionErrorAssertion extends BaseAssertion {
  kind: "executionError";
  equals: boolean;
}

export interface ProtocolErrorAssertion extends BaseAssertion {
  kind: "protocolError";
  equals: boolean;
}

export interface NotEmptyAssertion extends BaseAssertion {
  kind: "notEmpty";
  path?: string;
}

export interface CountAssertion extends BaseAssertion {
  kind: "count";
  path?: string;
  min?: number;
  max?: number;
  equals?: number;
}

/**
 * SnapshotAssertion compares the result against a stored baseline.
 *
 * - On first run (or with --update-snapshots): saves the result.
 * - On subsequent runs: compares against the saved value, fails on diff.
 * - ignorePaths: JSONPath expressions of fields to exclude before comparing
 *   (use for unstable values like timestamps, request IDs, durations).
 */
export interface SnapshotAssertion extends BaseAssertion {
  kind: "snapshot";
  /**
   * Snapshot file name (without extension).
   * Stored in <snapshotsDir>/<name>.json.
   * Defaults to the test ID if omitted.
   */
  name?: string;
  /**
   * JSONPath expressions for fields to ignore when comparing.
   * Example: ["$.meta.timestamp", "$.requestId"]
   */
  ignorePaths?: string[];
}

export type Assertion =
  | StatusAssertion
  | JsonPathAssertion
  | ContainsAssertion
  | EqualsAssertion
  | SchemaAssertion
  | OutputSchemaValidAssertion
  | ContentTypeAssertion
  | ExecutionErrorAssertion
  | ProtocolErrorAssertion
  | NotEmptyAssertion
  | CountAssertion
  | SnapshotAssertion;

export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  actual: unknown;
  message: string | undefined;
  /** For snapshot assertions: the human-readable diff when failing */
  diff?: string;
}
