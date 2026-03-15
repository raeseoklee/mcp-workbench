# MCP Workbench — VS Code Extension

The official VS Code extension for MCP Workbench is maintained in a separate repository:

**[mcp-workbench-vscode](https://github.com/raeseoklee/mcp-workbench-vscode)**

---

## Installation

1. Install the MCP Workbench CLI:

```bash
npm install -g mcp-workbench
```

2. Install the VS Code extension from the Marketplace (search "MCP Workbench")
   or clone `mcp-workbench-vscode` and run it in the Extension Development Host.

---

## Features

| Feature | Description |
|---------|-------------|
| **Run Current Spec** | Run the open YAML spec file — results appear in the tree view |
| **Run Workspace Specs** | Discover and run all spec files in the workspace |
| **Update Snapshots** | Regenerate snapshot baselines for the current spec |
| **Test Results tree** | Explorer panel tree: suite → test → assertions |
| **Problems panel** | Failed assertions appear as diagnostics |
| **Output channel** | Full run log in the MCP Workbench output panel |

---

## How it works

The extension invokes the `mcp-workbench` CLI as a subprocess with `--json` output,
then parses the `RunReport` to populate the tree view, diagnostics, and output channel.

No MCP protocol logic runs inside VS Code — all test execution happens in the CLI.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `mcpWorkbench.cliPath` | `"mcp-workbench"` | Path to the CLI executable |
| `mcpWorkbench.timeout` | `30000` | Per-request timeout (ms) |
| `mcpWorkbench.specGlob` | `"**/*.{yaml,yml}"` | Glob for workspace spec discovery |

---

## Spec recognition

The extension recognises files containing `apiVersion: mcp-workbench.dev/v0alpha1`.
Only files with this marker are treated as MCP Workbench specs.
