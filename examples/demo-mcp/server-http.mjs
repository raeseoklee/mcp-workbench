/**
 * HTTP version of the demo-mcp server (Streamable HTTP transport).
 * Usage: node server-http.mjs [port]
 * Default port: 3100
 *
 * Test with:
 *   mcp-workbench generate --transport streamable-http --url http://localhost:3100/mcp --stdout
 */
import express from "express";
import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isInitializeRequest,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.argv[2] ?? 3100);

const CITIES = {
  Seoul:    { temp: 18, condition: "Partly cloudy" },
  Tokyo:    { temp: 22, condition: "Sunny" },
  London:   { temp: 12, condition: "Rainy" },
  New_York: { temp: 20, condition: "Clear" },
};

const NOTES = {
  "note://welcome": "Welcome to MCP Workbench! This is a demo note resource.",
  "note://readme":  "# Demo Server\n\nThis server is part of the MCP Workbench examples.",
};

// Session map: sessionId → transport
const transports = new Map();

function createServer() {
  const server = new Server(
    { name: "demo-mcp-http", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_weather",
        description: "Get current weather for a city",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string", description: "Seoul | Tokyo | London | New_York" } },
          required: ["city"],
        },
      },
      {
        name: "create_note",
        description: "Create a new note",
        inputSchema: {
          type: "object",
          properties: {
            id:      { type: "string" },
            content: { type: "string" },
          },
          required: ["id", "content"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    if (name === "get_weather") {
      const weather = CITIES[args.city];
      if (!weather) return { isError: true, content: [{ type: "text", text: `Unknown city: ${args.city}` }] };
      return { content: [{ type: "text", text: `${args.city}: ${weather.temp}°C, ${weather.condition}` }] };
    }
    if (name === "create_note") {
      NOTES[`note://${args.id}`] = args.content;
      return { content: [{ type: "text", text: `Created note://${args.id}` }] };
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: Object.keys(NOTES).map((uri) => ({ uri, name: uri.replace("note://", ""), mimeType: "text/plain" })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const text = NOTES[req.params.uri];
    if (!text) throw new Error(`Resource not found: ${req.params.uri}`);
    return { contents: [{ uri: req.params.uri, mimeType: "text/plain", text }] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [{ name: "greet", description: "Generate a greeting", arguments: [{ name: "name", required: true }] }],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    if (req.params.name !== "greet") throw new Error(`Unknown prompt: ${req.params.name}`);
    const who = req.params.arguments?.name ?? "World";
    return { messages: [{ role: "user", content: { type: "text", text: `Hey ${who}!` } }] };
  });

  return server;
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  // Existing session
  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId).handleRequest(req, res, req.body);
    return;
  }

  // New session — must be initialize
  if (!isInitializeRequest(req.body)) {
    res.status(400).json({ error: "Expected initialize request for new session" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => transports.set(id, transport),
  });

  // Only clean up on explicit DELETE (client-initiated close), not on HTTP connection close.
  // If we deleted on every onclose, the session would be removed after each POST response
  // and subsequent requests (tools/call etc.) would fail with "session not found".

  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  await transports.get(sessionId).handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId).handleRequest(req, res);
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

app.listen(PORT, () => {
  console.error(`demo-mcp HTTP server running at http://localhost:${PORT}/mcp`);
});
