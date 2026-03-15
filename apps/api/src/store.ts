import { Session } from "@mcp-workbench/session-engine";
import { StdioTransport } from "@mcp-workbench/transport-stdio";
import { HttpTransport } from "@mcp-workbench/transport-http";
import { ClientSimulator } from "@mcp-workbench/client-simulator";

// ─── Config types ─────────────────────────────────────────────────────────────

export interface SimulatorConfig {
  roots?: Array<{ name: string; uri: string }>;
  sampling?: { preset?: { text: string; model?: string } };
  elicitation?: { action: "accept" | "decline" };
}

export interface StdioConfig {
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  simulator?: SimulatorConfig;
}

export interface HttpConfig {
  transport: "streamable-http";
  url: string;
  headers?: Record<string, string>;
  simulator?: SimulatorConfig;
}

export type SessionConfig = StdioConfig | HttpConfig;

function buildSimulator(cfg: SimulatorConfig): ClientSimulator {
  return new ClientSimulator({
    roots: cfg.roots ? { roots: cfg.roots.map((r) => ({ name: r.name, uri: r.uri })) } : undefined,
    sampling: cfg.sampling?.preset
      ? {
          preset: {
            role: "assistant",
            content: { type: "text", text: cfg.sampling.preset.text },
            model: cfg.sampling.preset.model ?? "preset",
          },
        }
      : cfg.sampling
        ? {}
        : undefined,
    elicitation: cfg.elicitation
      ? {
          preset:
            cfg.elicitation.action === "accept"
              ? { action: "accept", content: {} }
              : { action: "decline" },
        }
      : undefined,
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface SessionEntry {
  id: string;
  session: Session;
  config: SessionConfig;
  createdAt: string;
}

const store = new Map<string, SessionEntry>();
let counter = 0;

export async function createSession(config: SessionConfig): Promise<SessionEntry> {
  const id = `s${++counter}`;

  let transport;
  if (config.transport === "stdio") {
    transport = new StdioTransport({
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env,
      inheritEnv: true,
    });
    await transport.connect();
  } else {
    transport = new HttpTransport({ url: config.url, headers: config.headers });
    await transport.connect();
  }

  const simulator = config.simulator ? buildSimulator(config.simulator) : undefined;

  const session = new Session(transport, {
    clientInfo: { name: "mcp-workbench-web", version: "0.1.0" },
    simulator,
  });
  await session.connect();

  const entry: SessionEntry = { id, session, config, createdAt: new Date().toISOString() };
  store.set(id, entry);
  return entry;
}

export function getSession(id: string): SessionEntry | undefined {
  return store.get(id);
}

export function listSessions(): SessionEntry[] {
  return Array.from(store.values());
}

export async function closeSession(id: string): Promise<void> {
  const entry = store.get(id);
  if (entry) {
    await entry.session.close().catch(() => {});
    store.delete(id);
  }
}
