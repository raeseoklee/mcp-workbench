import { Router, type Router as RouterType } from "express";
import { parseSpec, loadSpec, SpecParseError } from "@mcp-lab/test-spec";
import { runSpec } from "../runner.js";
import type { RunnerOptions } from "../runner.js";

export const runsRouter: RouterType = Router();

runsRouter.post("/", async (req, res) => {
  const { specContent, specFile, options } = req.body as {
    specContent?: string;
    specFile?: string;
    options?: RunnerOptions;
  };

  if (!specContent && !specFile) {
    res.status(400).json({ error: "specContent or specFile is required" });
    return;
  }

  try {
    const spec = specContent ? parseSpec(specContent) : loadSpec(specFile!);
    const report = await runSpec(spec, options ?? {});
    res.json(report);
  } catch (err) {
    if (err instanceof SpecParseError) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
});
