# mcp-workbench-cli

Convenience wrapper for **[@mcp-workbench/cli](https://www.npmjs.com/package/@mcp-workbench/cli)**.

The unscoped npm name `mcp-workbench` is taken by an unrelated project. This package provides the same `mcp-workbench` command under an alternative package name.

## Installation

```bash
npm install -g mcp-workbench-cli
```

This is equivalent to:

```bash
npm install -g @mcp-workbench/cli
```

Both install the `mcp-workbench` command.

## Usage

```bash
mcp-workbench inspect --command node --args "path/to/server.js"
mcp-workbench run tests.yaml --verbose
```

See the [MCP Workbench documentation](https://github.com/raeseoklee/mcp-workbench) for the full reference.
