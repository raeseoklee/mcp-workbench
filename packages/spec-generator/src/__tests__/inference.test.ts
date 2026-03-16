import { describe, it, expect } from "vitest";
import { inferArgs, inferValue } from "../inference.js";

describe("inferValue", () => {
  it("returns Seoul for city field", () => {
    expect(inferValue("city", { type: "string" })).toBe("Seoul");
  });

  it("returns test for query field", () => {
    expect(inferValue("query", { type: "string" })).toBe("test");
  });

  it("returns example for name field", () => {
    expect(inferValue("name", { type: "string" })).toBe("example");
  });

  it("returns http://example.com for url field", () => {
    expect(inferValue("url", { type: "string" })).toBe("http://example.com");
  });

  it("returns TODO for unknown string field", () => {
    expect(inferValue("unknown_field_xyz", { type: "string" })).toBe("TODO");
  });

  it("returns 1 for generic number", () => {
    expect(inferValue("amount", { type: "number" })).toBe(1);
  });

  it("returns 10 for limit field", () => {
    expect(inferValue("limit", { type: "integer" })).toBe(10);
  });

  it("returns 1 for page field", () => {
    expect(inferValue("page", { type: "number" })).toBe(1);
  });

  it("returns true for boolean", () => {
    expect(inferValue("enabled", { type: "boolean" })).toBe(true);
  });

  it("returns first enum value", () => {
    expect(inferValue("mode", { enum: ["fast", "slow"] })).toBe("fast");
  });

  it("returns default if available", () => {
    expect(inferValue("size", { type: "number", default: 42 })).toBe(42);
  });

  it("returns empty array for array type", () => {
    expect(inferValue("items", { type: "array" })).toEqual([]);
  });

  it("returns empty object for object type", () => {
    expect(inferValue("config", { type: "object" })).toEqual({});
  });

  it("returns TODO for unknown type", () => {
    expect(inferValue("x", {})).toBe("TODO");
  });
});

describe("inferArgs", () => {
  it("returns undefined for schema without properties", () => {
    expect(inferArgs(undefined)).toBeUndefined();
    expect(inferArgs({})).toBeUndefined();
  });

  it("generates args from required properties", () => {
    const schema = {
      type: "object" as const,
      properties: {
        city: { type: "string" },
        limit: { type: "integer" },
        optional_field: { type: "string" },
        another_optional: { type: "string" },
      },
      required: ["city", "limit"],
    };
    const result = inferArgs(schema);
    expect(result).toEqual({ city: "Seoul", limit: 10 });
  });

  it("generates all args when 3 or fewer properties", () => {
    const schema = {
      type: "object" as const,
      properties: {
        city: { type: "string" },
        units: { type: "string" },
      },
    };
    const result = inferArgs(schema);
    expect(result).toEqual({ city: "Seoul", units: "TODO" });
  });
});
