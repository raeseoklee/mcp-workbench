import { Router, type Router as RouterType } from "express";
import { createSession, listSessions, getSession, closeSession } from "../store.js";
import type { SessionConfig, SessionEntry } from "../store.js";

export const sessionsRouter: RouterType = Router();

function serialize(entry: SessionEntry) {
  const neg = entry.session.session;
  return {
    id: entry.id,
    status: entry.session.status,
    config: entry.config,
    serverInfo: neg?.serverInfo ?? null,
    serverCapabilities: neg?.serverCapabilities ?? null,
    serverInstructions: neg?.serverInstructions ?? null,
    createdAt: entry.createdAt,
  };
}

// List all sessions
sessionsRouter.get("/", (_req, res) => {
  res.json(listSessions().map(serialize));
});

// Create session
sessionsRouter.post("/", async (req, res) => {
  const config = req.body as SessionConfig;
  if (!config?.transport) {
    res.status(400).json({ error: "transport is required" });
    return;
  }
  try {
    const entry = await createSession(config);
    res.status(201).json(serialize(entry));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get one session
sessionsRouter.get("/:id", (req, res) => {
  const entry = getSession(req.params["id"]!);
  if (!entry) { res.status(404).json({ error: "session not found" }); return; }
  res.json(serialize(entry));
});

// Close session
sessionsRouter.delete("/:id", async (req, res) => {
  await closeSession(req.params["id"]!);
  res.status(204).end();
});
