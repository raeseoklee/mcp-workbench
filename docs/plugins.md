# MCP Workbench Plugin System

MCP Workbench has a plugin system that lets you extend the tool without modifying the core.

---

## What plugins can do

| Extension point | Status | Example |
|-----------------|--------|---------|
| **Reporters** | ✅ v0.4 | Generate HTML or JUnit XML after a test run |
| **Commands** | ✅ v0.4 | Add custom top-level CLI commands |
| Assertions | 🗓 v0.5 | Add custom assertion kinds to YAML specs |
| Transports | 🗓 v0.5 | Add custom server connection methods |

---

## Loading plugins

### Option A — CLI flag (one-off)

```bash
mcp-workbench run tests.yaml \
  --plugin @mcp-workbench/plugin-html-report \
  --reporter html
```

`--plugin` can be repeated:

```bash
mcp-workbench run tests.yaml \
  --plugin ./my-plugin.js \
  --plugin @mcp-workbench/plugin-junit \
  --reporter junit
```

### Option B — Config file (persistent)

Create `workbench.config.yaml` in your project root:

```yaml
plugins:
  - "@mcp-workbench/plugin-html-report"
  - "@mcp-workbench/plugin-junit"
  - "./plugins/my-custom-reporter.js"
```

Plugins in the config file are loaded automatically on every `mcp-workbench run`.
`--plugin` flags are merged on top.

### Inspect loaded plugins

```bash
mcp-workbench plugins list
mcp-workbench plugins list --plugin ./my-plugin.js
```

---

## Official plugins

### `@mcp-workbench/plugin-html-report`

Generates a self-contained HTML report.

```bash
pnpm add -D @mcp-workbench/plugin-html-report

mcp-workbench run tests.yaml \
  --plugin @mcp-workbench/plugin-html-report \
  --reporter html \
  --reporter-output report.html
```

### `@mcp-workbench/plugin-junit`

Generates JUnit XML for CI systems (GitHub Actions, Jenkins, GitLab CI).

```bash
pnpm add -D @mcp-workbench/plugin-junit

mcp-workbench run tests.yaml \
  --plugin @mcp-workbench/plugin-junit \
  --reporter junit \
  --reporter-output junit-results.xml
```

In GitHub Actions:

```yaml
- name: Run MCP tests
  run: |
    mcp-workbench run tests.yaml \
      --plugin @mcp-workbench/plugin-junit \
      --reporter junit \
      --reporter-output test-results.xml

- name: Publish test results
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: test-results.xml
```

---

## Building a plugin

### 1. Create a package

```
my-plugin/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

`package.json`:

```json
{
  "name": "my-mcp-plugin",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@mcp-workbench/plugin-sdk": "^0.4.0"
  }
}
```

### 2. Implement `WorkbenchPlugin`

```typescript
// src/index.ts
import type { WorkbenchPlugin, PluginContext } from "@mcp-workbench/plugin-sdk";

const plugin: WorkbenchPlugin = {
  manifest: {
    name: "my-mcp-plugin",
    version: "1.0.0",
    apiVersion: "0.4",          // must match runtime version
    description: "My custom reporter",
    contributes: {
      reporters: ["my-format"],
    },
  },

  register(ctx: PluginContext): void {
    ctx.registerReporter({
      name: "my-format",
      description: "My custom report format",
      async generate({ report, specFile, outputPath }) {
        // report: RunReport — full test results
        // specFile: string | undefined — spec file path
        // outputPath: string | undefined — from --reporter-output
        ctx.logger.info(`Generating report for ${report.total} tests`);
        // ... write your output
      },
    });
  },
};

export default plugin;
```

### 3. Use it

```bash
node_modules/.bin/mcp-workbench run tests.yaml \
  --plugin ./my-plugin/dist/index.js \
  --reporter my-format
```

---

## Adding a command plugin

```typescript
const plugin: WorkbenchPlugin = {
  manifest: {
    name: "my-commands-plugin",
    version: "1.0.0",
    apiVersion: "0.4",
    contributes: { commands: ["my-cmd"] },
  },

  register(ctx: PluginContext): void {
    ctx.registerCommand({
      name: "my-cmd",
      description: "Does something custom",
      async run({ args, options }) {
        ctx.logger.info(`Running with args: ${args.join(", ")}`);
        // return a non-zero number to signal failure
      },
    });
  },
};
```

---

## Plugin API version

The current `apiVersion` is **`"0.4"`**.

Your plugin's `manifest.apiVersion` must exactly match the runtime version.
A mismatch produces a clear warning and the plugin is skipped — the host process is never crashed.

---

## Error handling guarantee

The plugin runtime provides the following safety guarantees:

| Failure mode | Behavior |
|---|---|
| Package not found / import error | Warning printed, plugin skipped |
| Invalid or missing manifest fields | Warning printed, plugin skipped |
| `apiVersion` mismatch | Warning printed, plugin skipped |
| `register()` throws | Warning printed, plugin's contributions ignored |
| Reporter `generate()` throws | Error printed, continues to next step |
| Duplicate command/reporter name | Warning printed, first registered wins |

In all cases, the core process keeps running.

---

## RunReport shape

Your reporter receives a `RunReport`:

```typescript
interface RunReport {
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  total: number;
  durationMs: number;
  snapshotsUpdated: number;
  tests: TestResultSummary[];
}

interface TestResultSummary {
  testId: string;
  description?: string;
  status: "passed" | "failed" | "skipped" | "error";
  durationMs: number;
  assertionResults: AssertionSummary[];
  error?: string;
}

interface AssertionSummary {
  assertion: { kind: string; label?: string };
  passed: boolean;
  actual: unknown;
  message?: string;
  diff?: string;
}
```
