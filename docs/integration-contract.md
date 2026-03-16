# MCP Workbench — Integration Contract

This document defines the stable interface between `mcp-workbench` and external tools
(editor extensions, CI scripts, custom reporters).

**Contract version:** 0.1 (aligned with CLI v0.x)

External tools MUST rely only on this documented contract, not on undocumented
fields or output formats.

---

## `mcp-workbench run --json` output

Invoking `mcp-workbench run <spec-file> --json` writes a single JSON object to
**stdout** when the run completes.  All other output (progress, warnings) goes to
**stderr**.

### RunReport

```json
{
  "passed": 3,
  "failed": 1,
  "skipped": 0,
  "errors": 0,
  "total": 4,
  "durationMs": 1234,
  "snapshotsUpdated": 0,
  "tests": [ ...TestResultSummary[] ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `passed` | `number` | Tests with status `"passed"` |
| `failed` | `number` | Tests with status `"failed"` (assertion failures) |
| `skipped` | `number` | Tests with status `"skipped"` (filtered out by `--tags`/`--ids`) |
| `errors` | `number` | Tests with status `"error"` (transport/runtime error) |
| `total` | `number` | Total number of tests in the spec |
| `durationMs` | `number` | Wall-clock time for the entire run in milliseconds |
| `snapshotsUpdated` | `number` | Number of snapshot baselines written (`--update-snapshots`) |
| `tests` | `TestResultSummary[]` | Per-test results (see below) |

### TestResultSummary

```json
{
  "testId": "get-weather",
  "description": "Weather tool returns text for a valid city",
  "status": "failed",
  "durationMs": 42,
  "assertionResults": [ ...AssertionSummary[] ],
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `testId` | `string` | The `id` field from the YAML spec |
| `description` | `string \| undefined` | The `description` field from the YAML spec |
| `status` | `"passed" \| "failed" \| "skipped" \| "error"` | Test outcome |
| `durationMs` | `number` | Time for this test in milliseconds |
| `assertionResults` | `AssertionSummary[]` | One entry per assertion in the spec |
| `error` | `string \| undefined` | Present only when `status === "error"`: human-readable error message |

### AssertionSummary

```json
{
  "assertion": { "kind": "jsonpath", "label": "city name present" },
  "passed": false,
  "actual": null,
  "message": "$.content[0].text did not match /Seoul/",
  "diff": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `assertion.kind` | `string` | Assertion kind from the spec (e.g. `"jsonpath"`, `"status"`) |
| `assertion.label` | `string \| undefined` | Optional human-readable label from the spec |
| `passed` | `boolean` | Whether this assertion passed |
| `actual` | `unknown` | The actual value that was tested (may be `null`) |
| `message` | `string \| undefined` | Human-readable failure reason |
| `diff` | `string \| undefined` | Unified diff string, present for `snapshot` assertions on mismatch |

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed (or were skipped) |
| `1` | One or more tests failed or errored; or a fatal error prevented the run |

There is no distinction between "test failures" and "fatal errors" in the exit
code — both produce exit code `1`.  Use the `failed` and `errors` fields in the
JSON report to distinguish them.

---

## Error categories

Three distinct error categories can appear in output:

### 1. Spec parse / load error

Occurs before any test runs.  The CLI prints a human-readable message to **stderr**
and exits with code `1`.  **No JSON is written to stdout.**

```
✗ Failed to load spec file: examples/fixtures/typo.yaml
  Unexpected token at line 12
```

External tools should detect this by catching a JSON parse failure on stdout
combined with exit code `1`.

### 2. Test execution error (`status: "error"`)

A test failed to execute at all (transport error, server crash, timeout).
Appears in the `tests` array with `status: "error"` and a non-empty `error` field.
Counted in `errors`, not `failed`.

### 3. Test assertion failure (`status: "failed"`)

The server responded but one or more assertions did not pass.
Appears with `status: "failed"` and failed entries in `assertionResults`.
Counted in `failed`, not `errors`.

---

## Snapshot diff payload

When a `snapshot` assertion fails, `AssertionSummary.diff` contains a unified diff
string (produced by the `diff` package):

```
--- baseline
+++ actual
@@ -1,4 +1,4 @@
 {
-  "temperature": 20,
+  "temperature": 21,
   "city": "Seoul"
 }
```

The baseline file lives in `.mcp-workbench/snapshots/<name>.json` relative to the
working directory (overridable with `--snapshots-dir`).

---

## Locale / `--lang` impact

The `--lang` flag and `MCP_WORKBENCH_LANG` env var affect **only** human-readable
CLI output printed to the terminal.

The following are **never** localised and are always in English:
- JSON output (`--json`)
- Assertion `kind` values
- `status` values (`"passed"`, `"failed"`, `"skipped"`, `"error"`)
- `testId` values
- All fields in `RunReport`, `TestResultSummary`, `AssertionSummary`

External tools that parse JSON output are **not affected** by `--lang`.

---

## Backward compatibility policy

- **Fields will not be removed** from `RunReport`, `TestResultSummary`, or
  `AssertionSummary` within a major version.
- **New optional fields may be added** at any minor version.  External tools
  should ignore unknown fields.
- **`status` values** (`"passed"`, `"failed"`, `"skipped"`, `"error"`) are stable.
- **Exit codes** `0` and `1` are stable.

Breaking changes (field removal, type changes, new mandatory exit codes) will only
occur in a new major version and will be announced in `CHANGELOG.md`.

---

## Invoking the CLI from an external tool

Recommended invocation pattern:

```typescript
import { spawn } from "child_process";

const proc = spawn("mcp-workbench", ["run", specFile, "--json"], {
  cwd: workspaceRoot,
  env: { ...process.env },
});

let stdout = "";
proc.stdout.on("data", (chunk) => { stdout += chunk; });

proc.on("close", (code) => {
  if (code !== 0 && stdout.trim() === "") {
    // Spec parse/load error — no JSON written
    // Read stderr for the human-readable error
    return;
  }
  const report = JSON.parse(stdout);
  // use report.passed, report.failed, report.tests ...
});
```

Key points:
- Always pass `--json` for machine-readable output
- Set `cwd` to the workspace root so relative paths in the spec resolve correctly
- Inherit the parent process env so PATH and other env vars are available
- A non-zero exit code with empty stdout means a fatal pre-run error

---

## Version compatibility

| mcp-workbench | mcp-workbench-vscode | Notes |
|---------------|----------------------|-------|
| `0.x` | `0.x` | Initial release, contract as documented here |

As both tools reach `1.0`, a formal compatibility matrix will be maintained.
