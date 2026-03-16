/**
 * Infer placeholder values for tool/prompt arguments from JSON Schema.
 */

// Common field name patterns → sensible defaults
const STRING_HINTS: Record<string, string> = {
  city: "Seoul",
  query: "test",
  search: "test",
  text: "test",
  name: "example",
  title: "example",
  url: "http://example.com",
  email: "test@example.com",
  path: "/tmp/example",
  file: "/tmp/example",
  description: "example description",
  message: "hello",
  content: "example content",
};

const NUMBER_HINTS: Record<string, number> = {
  limit: 10,
  count: 10,
  page: 1,
  offset: 0,
  per_minute: 100,
  timeout: 5000,
};

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  items?: JsonSchema;
  default?: unknown;
}

/**
 * Generate args object from a tool's inputSchema.
 * Returns undefined if no properties defined.
 */
export function inferArgs(
  schema: JsonSchema | undefined,
): Record<string, unknown> | undefined {
  if (!schema?.properties) return undefined;

  const args: Record<string, unknown> = {};
  const required = new Set(schema.required ?? []);

  for (const [field, fieldSchema] of Object.entries(schema.properties)) {
    // Only generate required fields (optional fields are skipped)
    if (!required.has(field) && Object.keys(schema.properties).length > 3) continue;

    args[field] = inferValue(field, fieldSchema);
  }

  return Object.keys(args).length > 0 ? args : undefined;
}

/**
 * Infer a single field value.
 */
export function inferValue(fieldName: string, schema: JsonSchema): unknown {
  // Use default if available
  if (schema.default !== undefined) return schema.default;

  // Enum → first value
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  const type = schema.type ?? "string";
  const lowerName = fieldName.toLowerCase();

  switch (type) {
    case "string": {
      // Check hints
      for (const [hint, value] of Object.entries(STRING_HINTS)) {
        if (lowerName.includes(hint)) return value;
      }
      return "TODO";
    }
    case "number":
    case "integer": {
      for (const [hint, value] of Object.entries(NUMBER_HINTS)) {
        if (lowerName.includes(hint)) return value;
      }
      return 1;
    }
    case "boolean":
      return true;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "TODO";
  }
}
