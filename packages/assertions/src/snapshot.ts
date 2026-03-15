import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ─── Path filtering ──────────────────────────────────────────────────────────

/**
 * Minimal JSONPath-based path filtering.
 * Removes the values at the given paths from a deep-cloned object.
 */
export function applyIgnorePaths(
  value: unknown,
  ignorePaths: string[],
): unknown {
  if (!ignorePaths.length) return value;

  const cloned: unknown = JSON.parse(JSON.stringify(value));
  for (const path of ignorePaths) {
    deletePath(cloned, path);
  }
  return cloned;
}

function deletePath(obj: unknown, path: string): void {
  // Support simple paths like $.foo.bar or $.foo[*].bar
  const parts = path
    .replace(/^\$\.?/, "")
    .split(/\.(?![^\[]*\])/)
    .filter(Boolean);

  deleteAtParts(obj, parts);
}

function deleteAtParts(obj: unknown, parts: string[]): void {
  if (!parts.length || obj === null || typeof obj !== "object") return;

  const [head, ...rest] = parts as [string, ...string[]];

  if (rest.length === 0) {
    // Final segment — delete the key
    if (Array.isArray(obj)) {
      const idx = parseInt(head, 10);
      if (!isNaN(idx)) delete (obj as unknown[])[idx];
    } else {
      delete (obj as Record<string, unknown>)[head];
    }
    return;
  }

  if (head === "[*]" || head === "*") {
    const arr = Array.isArray(obj) ? obj : Object.values(obj as object);
    for (const item of arr) deleteAtParts(item, rest);
    return;
  }

  const wildcardMatch = head.match(/^(\w+)\[\*\]$/);
  if (wildcardMatch) {
    const key = wildcardMatch[1]!;
    const arr = (obj as Record<string, unknown>)[key];
    if (Array.isArray(arr)) {
      for (const item of arr) deleteAtParts(item, rest);
    }
    return;
  }

  const next = (obj as Record<string, unknown>)[head];
  if (next !== undefined) deleteAtParts(next, rest);
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export interface DiffEntry {
  path: string;
  baseline: unknown;
  actual: unknown;
  kind: "added" | "removed" | "changed";
}

export function diffValues(
  baseline: unknown,
  actual: unknown,
  path = "$",
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  collectDiffs(baseline, actual, path, diffs);
  return diffs;
}

function collectDiffs(
  baseline: unknown,
  actual: unknown,
  path: string,
  diffs: DiffEntry[],
): void {
  if (JSON.stringify(baseline) === JSON.stringify(actual)) return;

  if (
    baseline === null ||
    actual === null ||
    typeof baseline !== typeof actual ||
    Array.isArray(baseline) !== Array.isArray(actual)
  ) {
    diffs.push({ path, baseline, actual, kind: "changed" });
    return;
  }

  if (Array.isArray(baseline) && Array.isArray(actual)) {
    const len = Math.max(baseline.length, actual.length);
    for (let i = 0; i < len; i++) {
      if (i >= baseline.length) {
        diffs.push({ path: `${path}[${i}]`, baseline: undefined, actual: actual[i], kind: "added" });
      } else if (i >= actual.length) {
        diffs.push({ path: `${path}[${i}]`, baseline: baseline[i], actual: undefined, kind: "removed" });
      } else {
        collectDiffs(baseline[i], actual[i], `${path}[${i}]`, diffs);
      }
    }
    return;
  }

  if (typeof baseline === "object") {
    const bl = baseline as Record<string, unknown>;
    const ac = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(bl), ...Object.keys(ac)]);
    for (const key of allKeys) {
      if (!(key in bl)) {
        diffs.push({ path: `${path}.${key}`, baseline: undefined, actual: ac[key], kind: "added" });
      } else if (!(key in ac)) {
        diffs.push({ path: `${path}.${key}`, baseline: bl[key], actual: undefined, kind: "removed" });
      } else {
        collectDiffs(bl[key], ac[key], `${path}.${key}`, diffs);
      }
    }
    return;
  }

  // Primitives differ
  diffs.push({ path, baseline, actual, kind: "changed" });
}

export function formatDiff(diffs: DiffEntry[]): string {
  if (!diffs.length) return "";
  return diffs
    .map((d) => {
      if (d.kind === "added") {
        return `  + ${d.path}: ${JSON.stringify(d.actual)}`;
      }
      if (d.kind === "removed") {
        return `  - ${d.path}: ${JSON.stringify(d.baseline)}`;
      }
      return [
        `  ~ ${d.path}`,
        `    baseline: ${JSON.stringify(d.baseline)}`,
        `    actual:   ${JSON.stringify(d.actual)}`,
      ].join("\n");
    })
    .join("\n");
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface SnapshotStore {
  load(name: string): unknown | undefined;
  save(name: string, value: unknown): void;
}

export function createFileSnapshotStore(snapshotsDir: string): SnapshotStore {
  return {
    load(name: string): unknown | undefined {
      const file = join(snapshotsDir, `${name}.json`);
      if (!existsSync(file)) return undefined;
      try {
        return JSON.parse(readFileSync(file, "utf-8")) as unknown;
      } catch {
        return undefined;
      }
    },

    save(name: string, value: unknown): void {
      const file = join(snapshotsDir, `${name}.json`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf-8");
    },
  };
}

/** No-op store used when snapshot mode is not enabled */
export const nullSnapshotStore: SnapshotStore = {
  load: () => undefined,
  save: () => undefined,
};
