# @raeseoklee/mcp-workbench-demo-server

A ready-to-use demo [MCP](https://modelcontextprotocol.io) server for **[MCP Workbench](https://github.com/raeseoklee/mcp-workbench)**.

Exposes sample tools, resources, and prompts — perfect for trying out MCP Workbench without writing any server code.

## Install

```bash
npm install -g @raeseoklee/mcp-workbench-demo-server
```

## Usage

```bash
# Start the demo server (stdio transport)
mcp-workbench-demo

# Inspect with MCP Workbench
npm install -g @raeseoklee/mcp-workbench
mcp-workbench inspect --command mcp-workbench-demo

# Run the example test suite
mcp-workbench run examples/fixtures/demo-server.yaml --verbose
```

## What's included

| Capability | Examples |
|------------|----------|
| **Tools** | `get_weather` — returns weather for a city |
| **Resources** | Note resources with text content |
| **Prompts** | Greeting prompt with customizable name |

## Built with

- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- MCP spec version `2025-11-25`

## Links

- [MCP Workbench](https://github.com/raeseoklee/mcp-workbench) — the testing platform
- [Example test specs](https://github.com/raeseoklee/mcp-workbench/tree/develop/examples/fixtures)

## License

[Apache-2.0](https://github.com/raeseoklee/mcp-workbench/blob/develop/LICENSE)
