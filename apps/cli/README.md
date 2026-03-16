# MCP Workbench

**A quality platform for MCP server developers.**

Test, inspect, and validate [Model Context Protocol](https://modelcontextprotocol.io) servers — from the command line or in CI.

## Install

```bash
# Preferred
npm install -g @mcp-workbench/cli

# Alternative convenience package
npm install -g mcp-workbench-cli
```

Both provide the same `mcp-workbench` command.

> **Why not `npm install -g mcp-workbench`?**
> The unscoped name is taken by an unrelated project. See [npm distribution docs](https://github.com/raeseoklee/mcp-workbench/blob/develop/docs/npm-distribution.md) for details.

## Usage

```bash
# Inspect a server
mcp-workbench inspect --command node --args "path/to/server.js"

# Run a test suite
mcp-workbench run tests.yaml --verbose

# JSON output for CI
mcp-workbench run tests.yaml --json
```

## Features

- **`mcp-workbench inspect`** — connect to any MCP server and explore capabilities, tools, resources, and prompts
- **`mcp-workbench run`** — execute YAML-defined test suites with rich assertions
- **Assertion engine** — `status`, `jsonpath`, `executionError`, `protocolError`, `contentType`, `count`, `equals`, `schema`, `snapshot`, and more
- **Transport support** — `stdio`, `streamable-http`, legacy SSE
- **Client simulator** — inject roots, sampling presets, and elicitation handlers
- **CI-friendly** — `--json` output, non-zero exit on failure, `--bail` flag
- **Plugin system** — extend with reporters (`html`, `junit`) and custom commands

## VS Code Extension

Install the [MCP Workbench VS Code extension](https://marketplace.visualstudio.com/items?itemName=raeseoklee.mcp-workbench-vscode) for integrated testing and inspection.

## Links

- [GitHub](https://github.com/raeseoklee/mcp-workbench)
- [Full documentation](https://github.com/raeseoklee/mcp-workbench#readme)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=raeseoklee.mcp-workbench-vscode)

## License

[Apache-2.0](https://github.com/raeseoklee/mcp-workbench/blob/develop/LICENSE)
