import { describe, it, expect, beforeEach } from "vitest";
import { applyIgnorePaths, diffValues, formatDiff } from "../snapshot.js";
import type { SnapshotStore } from "../snapshot.js";
import { runAssertion } from "../runner.js";
import type { RunContext } from "../runner.js";

// ─── applyIgnorePaths ─────────────────────────────────────────────────────────

describe("applyIgnorePaths", () => {
  it("returns original when no paths given", () => {
    const obj = { a: 1, b: 2 };
    expect(applyIgnorePaths(obj, [])).toEqual({ a: 1, b: 2 });
  });

  it("removes a top-level field", () => {
    const obj = { a: 1, ts: "2026-01-01" };
    expect(applyIgnorePaths(obj, ["$.ts"])).toEqual({ a: 1 });
  });

  it("removes a nested field", () => {
    const obj = { meta: { timestamp: 123, version: "1" }, data: "x" };
    const result = applyIgnorePaths(obj, ["$.meta.timestamp"]) as typeof obj;
    expect((result.meta as Record<string,unknown>)["timestamp"]).toBeUndefined();
    expect((result.meta as Record<string,unknown>)["version"]).toBe("1");
  });

  it("removes fields from array items via [*]", () => {
    const obj = {
      tools: [
        { name: "a", id: 1 },
        { name: "b", id: 2 },
      ],
    };
    const result = applyIgnorePaths(obj, ["$.tools[*].id"]) as typeof obj;
    for (const tool of result.tools) {
      expect((tool as Record<string,unknown>)["id"]).toBeUndefined();
      expect(tool.name).toBeDefined();
    }
  });

  it("does not mutate the original object", () => {
    const obj = { a: 1 };
    applyIgnorePaths(obj, ["$.a"]);
    expect(obj.a).toBe(1);
  });
});

// ─── diffValues ───────────────────────────────────────────────────────────────

describe("diffValues", () => {
  it("returns empty for identical objects", () => {
    expect(diffValues({ a: 1 }, { a: 1 })).toHaveLength(0);
  });

  it("detects changed primitive", () => {
    const diffs = diffValues({ a: 1 }, { a: 2 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.kind).toBe("changed");
    expect(diffs[0]?.path).toBe("$.a");
    expect(diffs[0]?.baseline).toBe(1);
    expect(diffs[0]?.actual).toBe(2);
  });

  it("detects added key", () => {
    const diffs = diffValues({ a: 1 }, { a: 1, b: 2 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.kind).toBe("added");
    expect(diffs[0]?.path).toBe("$.b");
  });

  it("detects removed key", () => {
    const diffs = diffValues({ a: 1, b: 2 }, { a: 1 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.kind).toBe("removed");
    expect(diffs[0]?.path).toBe("$.b");
  });

  it("detects array element change", () => {
    const diffs = diffValues([1, 2, 3], [1, 2, 4]);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe("$[2]");
  });

  it("detects nested change", () => {
    const diffs = diffValues(
      { tools: [{ name: "a" }] },
      { tools: [{ name: "b" }] },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe("$.tools[0].name");
  });
});

// ─── formatDiff ───────────────────────────────────────────────────────────────

describe("formatDiff", () => {
  it("returns empty string for no diffs", () => {
    expect(formatDiff([])).toBe("");
  });

  it("formats changed line", () => {
    const diffs = diffValues({ a: 1 }, { a: 2 });
    const formatted = formatDiff(diffs);
    expect(formatted).toContain("$.a");
    expect(formatted).toContain("1");
    expect(formatted).toContain("2");
  });
});

// ─── snapshot assertion ───────────────────────────────────────────────────────

describe("snapshot assertion", () => {
  function makeStore(): SnapshotStore & { db: Map<string, unknown> } {
    const db = new Map<string, unknown>();
    return {
      db,
      load: (name: string) => db.get(name),
      save: (name: string, value: unknown) => { db.set(name, value); },
    };
  }

  const result = { tools: [{ name: "get_weather" }] };

  it("creates snapshot on first run (no baseline)", () => {
    const store = makeStore();
    const ctx: RunContext = { result, snapshotStore: store, testId: "t1" };
    const r = runAssertion({ kind: "snapshot" }, ctx);
    expect(r.passed).toBe(true);
    expect(store.db.has("t1")).toBe(true);
    expect(r.message).toContain("created");
  });

  it("passes when result matches baseline", () => {
    const store = makeStore();
    store.save("t1", result);
    const ctx: RunContext = { result, snapshotStore: store, testId: "t1" };
    const r = runAssertion({ kind: "snapshot" }, ctx);
    expect(r.passed).toBe(true);
  });

  it("fails when result differs from baseline", () => {
    const store = makeStore();
    store.save("t1", { tools: [{ name: "old_tool" }] });
    const ctx: RunContext = { result, snapshotStore: store, testId: "t1" };
    const r = runAssertion({ kind: "snapshot" }, ctx);
    expect(r.passed).toBe(false);
    expect(r.diff).toBeDefined();
    expect(r.diff).toContain("$.tools[0].name");
  });

  it("updates snapshot when updateSnapshots=true", () => {
    const store = makeStore();
    store.save("t1", { tools: [{ name: "old_tool" }] });
    const ctx: RunContext = {
      result,
      snapshotStore: store,
      testId: "t1",
      updateSnapshots: true,
    };
    const r = runAssertion({ kind: "snapshot" }, ctx);
    expect(r.passed).toBe(true);
    expect(store.db.get("t1")).toEqual(result);
    expect(r.message).toContain("written");
  });

  it("uses assertion.name over testId", () => {
    const store = makeStore();
    const ctx: RunContext = {
      result,
      snapshotStore: store,
      testId: "test-1",
    };
    runAssertion({ kind: "snapshot", name: "custom-name" }, ctx);
    expect(store.db.has("custom-name")).toBe(true);
    expect(store.db.has("test-1")).toBe(false);
  });

  it("ignores specified paths when comparing", () => {
    const store = makeStore();
    const baseline = { data: "hello", ts: "2026-01-01" };
    const actual = { data: "hello", ts: "2026-01-02" }; // timestamp changed
    store.save("t1", baseline);
    const ctx: RunContext = {
      result: actual,
      snapshotStore: store,
      testId: "t1",
    };
    const r = runAssertion({ kind: "snapshot", ignorePaths: ["$.ts"] }, ctx);
    expect(r.passed).toBe(true); // ts ignored
  });

  it("fails when non-ignored path changes", () => {
    const store = makeStore();
    const baseline = { data: "hello", ts: "2026-01-01" };
    const actual = { data: "world", ts: "2026-01-01" };
    store.save("t1", baseline);
    const ctx: RunContext = { result: actual, snapshotStore: store, testId: "t1" };
    const r = runAssertion({ kind: "snapshot" }, ctx);
    expect(r.passed).toBe(false);
  });
});
