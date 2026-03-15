import express from "express";
import cors from "cors";
import { sessionsRouter } from "./routes/sessions.js";
import { inspectRouter } from "./routes/inspect.js";

const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
app.use(express.json());

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", inspectRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = Number(process.env["PORT"] ?? 3001);
app.listen(PORT, () => {
  process.stderr.write(`MCP Lab API running on http://localhost:${PORT}\n`);
});
