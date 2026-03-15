import { Router, type Router as RouterType } from "express";
import type { Response } from "express";
import { getSession } from "../store.js";
import type { SessionEntry } from "../store.js";

export const inspectRouter: RouterType = Router();

function requireSession(id: string, res: Response): SessionEntry | null {
  const entry = getSession(id);
  if (!entry) { res.status(404).json({ error: "session not found" }); return null; }
  return entry;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

inspectRouter.get("/:id/tools", async (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  try {
    res.json(await entry.session.listTools());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

inspectRouter.post("/:id/tools/call", async (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  const { name, args } = req.body as { name: string; args?: Record<string, unknown> };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    res.json(await entry.session.callTool(name, args ?? {}));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Resources ───────────────────────────────────────────────────────────────

inspectRouter.get("/:id/resources", async (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  try {
    res.json(await entry.session.listResources());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

inspectRouter.get("/:id/resources/read", async (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  const uri = req.query["uri"] as string | undefined;
  if (!uri) { res.status(400).json({ error: "uri query param is required" }); return; }
  try {
    res.json(await entry.session.readResource(uri));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Prompts ─────────────────────────────────────────────────────────────────

inspectRouter.get("/:id/prompts", async (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  try {
    res.json(await entry.session.listPrompts());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

inspectRouter.post("/:id/prompts/get", async (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  const { name, args } = req.body as { name: string; args?: Record<string, string> };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    res.json(await entry.session.getPrompt(name, args));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Timeline ────────────────────────────────────────────────────────────────

inspectRouter.get("/:id/timeline", (req, res) => {
  const entry = requireSession(req.params["id"]!, res);
  if (!entry) return;
  const since = Number(req.query["since"] ?? 0);
  const events = entry.session.timeline.getAll().filter((e) => e.timestamp > since);
  res.json(events);
});
