import { describe, it, expect } from "vitest";
import { runAssertion, runAssertions } from "../runner.js";
import type { RunContext } from "../runner.js";

const toolsListResult = {
  tools: [
    { name: "get_weather", description: "Weather tool" },
    { name: "create_note", description: "Note tool" },
  ],
};

const callToolResult = {
  content: [{ type: "text", text: "Weather in Seoul: 18°C, Partly cloudy" }],
  isError: false,
};

const callToolErrorResult = {
  content: [{ type: "text", text: "Error: unknown city" }],
  isError: true,
};

describe("runAssertion", () => {
  describe("status", () => {
    it("passes for success when no error", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion({ kind: "status", equals: "success" }, ctx);
      expect(r.passed).toBe(true);
    });

    it("fails for success when protocolError", () => {
      const ctx: RunContext = { result: undefined, protocolError: true };
      const r = runAssertion({ kind: "status", equals: "success" }, ctx);
      expect(r.passed).toBe(false);
    });

    it("passes for error when protocolError", () => {
      const ctx: RunContext = { protocolError: true };
      const r = runAssertion({ kind: "status", equals: "error" }, ctx);
      expect(r.passed).toBe(true);
    });
  });

  describe("executionError", () => {
    it("detects isError=true", () => {
      const ctx: RunContext = { result: callToolErrorResult };
      const r = runAssertion({ kind: "executionError", equals: true }, ctx);
      expect(r.passed).toBe(true);
    });

    it("detects isError=false", () => {
      const ctx: RunContext = { result: callToolResult };
      const r = runAssertion({ kind: "executionError", equals: false }, ctx);
      expect(r.passed).toBe(true);
    });
  });

  describe("protocolError", () => {
    it("passes when protocolError matches", () => {
      const ctx: RunContext = { protocolError: false };
      const r = runAssertion({ kind: "protocolError", equals: false }, ctx);
      expect(r.passed).toBe(true);
    });
  });

  describe("jsonpath", () => {
    it("contains string value", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion(
        { kind: "jsonpath", path: "$.tools[*].name", contains: "get_weather" },
        ctx,
      );
      expect(r.passed).toBe(true);
    });

    it("matches regex", () => {
      const ctx: RunContext = { result: callToolResult };
      const r = runAssertion(
        { kind: "jsonpath", path: "$.content[0].text", matches: "Seoul" },
        ctx,
      );
      expect(r.passed).toBe(true);
    });

    it("equals deep value", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion(
        {
          kind: "jsonpath",
          path: "$.tools[0].name",
          equals: "get_weather",
        },
        ctx,
      );
      expect(r.passed).toBe(true);
    });

    it("notEmpty on array", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion(
        { kind: "jsonpath", path: "$.tools", notEmpty: true },
        ctx,
      );
      expect(r.passed).toBe(true);
    });

    it("fails when path returns nothing", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion(
        { kind: "jsonpath", path: "$.nonexistent", notEmpty: true },
        ctx,
      );
      expect(r.passed).toBe(false);
    });
  });

  describe("contentType", () => {
    it("detects text content type", () => {
      const ctx: RunContext = { result: callToolResult };
      const r = runAssertion({ kind: "contentType", contains: "text" }, ctx);
      expect(r.passed).toBe(true);
    });
  });

  describe("notEmpty", () => {
    it("passes on non-empty array", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion({ kind: "notEmpty", path: "$.tools" }, ctx);
      expect(r.passed).toBe(true);
    });

    it("fails on empty array", () => {
      const ctx: RunContext = { result: { tools: [] } };
      const r = runAssertion({ kind: "notEmpty", path: "$.tools" }, ctx);
      expect(r.passed).toBe(false);
    });
  });

  describe("count", () => {
    it("checks min", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion({ kind: "count", path: "$.tools", min: 2 }, ctx);
      expect(r.passed).toBe(true);
    });

    it("fails when below min", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion({ kind: "count", path: "$.tools", min: 5 }, ctx);
      expect(r.passed).toBe(false);
    });

    it("checks equals", () => {
      const ctx: RunContext = { result: toolsListResult };
      const r = runAssertion({ kind: "count", path: "$.tools", equals: 2 }, ctx);
      expect(r.passed).toBe(true);
    });
  });
});

describe("runAssertions", () => {
  it("returns all results", () => {
    const ctx: RunContext = { result: callToolResult };
    const results = runAssertions(
      [
        { kind: "status", equals: "success" },
        { kind: "executionError", equals: false },
        { kind: "contentType", contains: "text" },
      ],
      ctx,
    );
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
