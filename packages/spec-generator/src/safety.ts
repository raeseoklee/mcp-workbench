/**
 * Safety classification for tools in deep mode.
 * Determines whether a tool is safe to call without side effects.
 */

/** Patterns that suggest destructive or write operations */
const UNSAFE_PATTERNS = [
  "delete", "remove", "drop", "destroy", "purge", "erase",
  "create", "insert", "add", "register", "new",
  "update", "modify", "edit", "change", "set", "put", "patch",
  "write", "overwrite", "save", "store",
  "send", "post", "publish", "push", "emit", "dispatch", "notify",
  "execute", "run", "invoke", "trigger", "fire",
  "approve", "reject", "confirm", "cancel",
  "purchase", "buy", "pay", "charge",
  "reset", "clear", "flush", "truncate",
  "move", "rename", "transfer", "migrate",
  "enable", "disable", "activate", "deactivate",
  "start", "stop", "restart", "shutdown", "kill",
  "grant", "revoke", "assign", "unassign",
  "subscribe", "unsubscribe",
  "import", "export",
];

/** Patterns that suggest read-only operations */
const SAFE_PATTERNS = [
  "get", "list", "read", "fetch", "show", "view", "describe",
  "search", "find", "query", "lookup", "browse",
  "check", "verify", "validate", "test", "ping",
  "count", "stats", "status", "info", "health",
  "inspect", "analyze", "evaluate", "compare",
  "exists", "has", "is", "can",
];

export type SafetyLevel = "safe" | "unsafe" | "unknown";

export interface SafetyResult {
  level: SafetyLevel;
  reason: string;
}

/**
 * Classify a tool by name to determine if it's safe to call in deep mode.
 */
export function classifyTool(toolName: string): SafetyResult {
  const lower = toolName.toLowerCase();
  const parts = lower.split(/[_\-\s.\/]+/);

  // Check safe patterns first (verb at the start is strongest signal)
  for (const pattern of SAFE_PATTERNS) {
    if (parts[0] === pattern || lower.startsWith(pattern)) {
      return { level: "safe", reason: `name starts with "${pattern}"` };
    }
  }

  // Check unsafe patterns
  for (const pattern of UNSAFE_PATTERNS) {
    if (parts.includes(pattern) || lower.includes(pattern)) {
      return { level: "unsafe", reason: `name contains "${pattern}"` };
    }
  }

  // Check if any safe pattern appears anywhere
  for (const pattern of SAFE_PATTERNS) {
    if (parts.includes(pattern) || lower.includes(pattern)) {
      return { level: "safe", reason: `name contains "${pattern}"` };
    }
  }

  return { level: "unknown", reason: "could not determine safety from name" };
}

/**
 * Check if a tool's inputSchema has all required args satisfiable.
 */
export function hasInferrableArgs(inputSchema: Record<string, unknown> | undefined): boolean {
  if (!inputSchema) return true; // no args needed
  const properties = inputSchema.properties as Record<string, unknown> | undefined;
  const required = inputSchema.required as string[] | undefined;
  if (!required || required.length === 0) return true;
  if (!properties) return false;
  // All required properties must exist in schema
  return required.every((r) => r in properties);
}
