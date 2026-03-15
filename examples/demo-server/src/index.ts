/**
 * Demo MCP server using the official @modelcontextprotocol/sdk.
 * Provides a simple weather tool, a note resource, and a greeting prompt —
 * just enough to exercise all of MCP Lab's features.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CreateMessageRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CITIES: Record<string, { temp: number; condition: string }> = {
  Seoul:    { temp: 18, condition: "Partly cloudy" },
  Tokyo:    { temp: 22, condition: "Sunny" },
  London:   { temp: 12, condition: "Rainy" },
  New_York: { temp: 20, condition: "Clear" },
};

const NOTES: Record<string, string> = {
  "note://welcome": "Welcome to MCP Lab! This is a demo note resource.",
  "note://readme":  "# Demo Server\n\nThis server is part of the MCP Lab examples.",
};

const server = new Server(
  { name: "demo-mcp-server", version: "0.1.0" },
  {
    capabilities: {
      tools:     { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts:   { listChanged: false },
    },
  },
);

// ─── Tool: list-roots (exercises client roots capability) ────────────────────
// This tool asks the client for its roots list, then returns them as text.
// It demonstrates the server→client roots/list call pattern.

// ─── Tools ───────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_roots",
      description: "Ask the client for its workspace roots (exercises roots capability)",
      inputSchema: { type: "object" as const, properties: {} },
      annotations: { readOnlyHint: true, title: "List Roots" },
    },
    {
      name: "get_weather",
      description: "Get current weather for a city",
      inputSchema: {
        type: "object" as const,
        properties: {
          city: {
            type: "string",
            description: "City name (Seoul, Tokyo, London, New_York)",
          },
        },
        required: ["city"],
      },
      annotations: {
        readOnlyHint: true,
        title: "Get Weather",
      },
    },
    {
      name: "create_note",
      description: "Create a new note (destructive example)",
      inputSchema: {
        type: "object" as const,
        properties: {
          id:      { type: "string" },
          content: { type: "string" },
        },
        required: ["id", "content"],
      },
      annotations: {
        destructiveHint: true,
        title: "Create Note",
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "list_roots") {
    try {
      // Ask the client for its roots via the session
      const result = await extra.sendRequest(
        { method: "roots/list", params: {} },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
      ) as { roots: Array<{ uri: string; name?: string }> };
      const lines = result.roots.map((r) => `${r.uri}${r.name ? ` (${r.name})` : ""}`);
      return {
        content: [{
          type: "text" as const,
          text: lines.length ? `Roots:\n${lines.join("\n")}` : "No roots provided by client",
        }],
      };
    } catch {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "Client does not support roots/list" }],
      };
    }
  }

  if (name === "get_weather") {
    const city = args["city"] as string | undefined;
    if (!city || typeof city !== "string") {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "Error: city must be a string" }],
      };
    }
    const weather = CITIES[city];
    if (!weather) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Error: unknown city "${city}". Known cities: ${Object.keys(CITIES).join(", ")}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Weather in ${city}: ${weather.temp}°C, ${weather.condition}`,
        },
      ],
    };
  }

  if (name === "create_note") {
    const id = args["id"] as string;
    const content = args["content"] as string;
    NOTES[`note://${id}`] = content;
    return {
      content: [{ type: "text" as const, text: `Note created: note://${id}` }],
    };
  }

  return {
    isError: true,
    content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
  };
});

// ─── Resources ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: Object.keys(NOTES).map((uri) => ({
    uri,
    name: uri.replace("note://", ""),
    mimeType: "text/plain",
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const content = NOTES[uri];
  if (!content) {
    throw new Error(`Resource not found: ${uri}`);
  }
  return {
    contents: [{ uri, mimeType: "text/plain", text: content }],
  };
});

// ─── Prompts ─────────────────────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "greet",
      description: "Generate a greeting message",
      arguments: [
        { name: "name", description: "Person to greet", required: true },
        { name: "style", description: "formal | casual", required: false },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  if (name !== "greet") throw new Error(`Unknown prompt: ${name}`);

  const personName = args["name"] ?? "World";
  const style = args["style"] ?? "casual";

  const greeting =
    style === "formal"
      ? `Good day, ${personName}. How may I assist you?`
      : `Hey ${personName}! What's up?`;

  return {
    description: "A greeting message",
    messages: [
      { role: "user" as const, content: { type: "text" as const, text: greeting } },
    ],
  };
});

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
