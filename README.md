# MCP Lab

**A quality platform for MCP server developers.**

Test, inspect, and validate [Model Context Protocol](https://modelcontextprotocol.io) servers — from the command line or in CI.

[![CI](https://github.com/your-org/mcp-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/mcp-lab/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

```
MCP Lab = Inspector + Contract Test + Regression Diff + CI Runner
```

---

## Why MCP Lab?

The MCP ecosystem has debugging tools (Inspector) and SDKs, but no dedicated quality validation platform.
MCP Lab fills that gap: **saved tests, regression diffs, and CI-ready assertion runs**.

| Tool | Interactive Debug | Saved Tests | Regression Diff | CI Runner |
|------|:-----------------:|:-----------:|:---------------:|:---------:|
| MCP Inspector | ✓ | — | — | — |
| **MCP Lab** | ✓ | **✓** | **✓** | **✓** |

---

## Features

- **`mcp-lab inspect`** — connect to any MCP server and explore its capabilities, tools, resources, and prompts
- **`mcp-lab run`** — execute YAML-defined test suites with rich assertions
- **Assertion engine** — `status`, `jsonpath`, `executionError`, `protocolError`, `contentType`, `count`, `notEmpty`, `equals`, `schema`, and more
- **Transport support** — `stdio` (local servers), `streamable-http` (remote servers), legacy SSE
- **CI-friendly** — `--json` output, non-zero exit on failure, `--bail` flag
- **Protocol-accurate** — implements MCP spec `2025-11-25` including capability negotiation, session lifecycle, and notification handling

---

## Installation

```bash
npm install -g mcp-lab
# or
pnpm add -g mcp-lab
```

---

## Quick Start

### Inspect a server

```bash
# stdio (local server)
mcp-lab inspect --command node --args "path/to/server.js"

# HTTP (remote server)
mcp-lab inspect --transport streamable-http --url https://your-server.com/mcp
```

Example output:

```
  Server Info

  Name:     my-mcp-server
  Version:  1.0.0
  Protocol: 2025-11-25

  Capabilities

  ✓ tools (listChanged)
  ✓ resources (subscribe)
  ✓ prompts
  ○ completions
  ○ logging

  Tools (3)

  get_weather [read-only]
    Get current weather for a city
  create_file [destructive]
    Create or overwrite a file
```

### Run a test suite

```bash
mcp-lab run tests.yaml
mcp-lab run tests.yaml --verbose
mcp-lab run tests.yaml --json > results.json
mcp-lab run tests.yaml --bail --timeout 5000
```

---

## Test Specification Format

Test suites are YAML files with the `mcp-lab.dev/v0alpha1` schema.

```yaml
apiVersion: mcp-lab.dev/v0alpha1

server:
  transport: stdio
  command: node
  args:
    - dist/server.js

# or for remote:
# server:
#   transport: streamable-http
#   url: https://your-server.com/mcp
#   headersFromEnv:
#     Authorization: MCP_API_TOKEN

client:
  protocolVersion: "2025-11-25"

tests:
  - id: tools-list
    description: Server exposes at least one tool
    act:
      method: tools/list
    assert:
      - kind: status
        equals: success
      - kind: notEmpty
        path: $.tools

  - id: get-weather
    description: Weather tool returns text for a valid city
    act:
      method: tools/call
      tool: get_weather
      args:
        city: Seoul
    assert:
      - kind: executionError
        equals: false
      - kind: contentType
        contains: text
      - kind: jsonpath
        path: $.content[0].text
        matches: "Seoul"

  - id: invalid-input
    description: Tool returns execution error (not protocol error) for bad input
    act:
      method: tools/call
      tool: get_weather
      args:
        city: 12345
    assert:
      - kind: executionError
        equals: true
      - kind: protocolError
        equals: false
```

### Assertion Reference

| Kind | Description |
|------|-------------|
| `status` | `equals: success \| error` — overall call status |
| `executionError` | `equals: true \| false` — tool `isError` flag |
| `protocolError` | `equals: true \| false` — JSON-RPC error response |
| `jsonpath` | JSONPath query with `equals`, `contains`, `matches`, or `notEmpty` |
| `notEmpty` | target is non-empty string / array / object |
| `contentType` | checks `content[*].type` — `equals` or `contains` |
| `count` | array length — `equals`, `min`, `max` |
| `equals` | deep equality at optional `path` |
| `schema` | JSON Schema validation at optional `path` |
| `outputSchemaValid` | validates tool `structuredContent` against `outputSchema` |

---

## CLI Reference

### `mcp-lab inspect`

```
mcp-lab inspect [options]

Options:
  --transport <kind>   stdio | streamable-http | sse  (default: stdio)
  --command <cmd>      Command to run (stdio)
  --args <args>        Space-separated arguments (stdio)
  --url <url>          Server URL (HTTP)
  --timeout <ms>       Request timeout
  --json               JSON output
```

### `mcp-lab run`

```
mcp-lab run <spec-file> [options]

Options:
  --tags <tags>        Run only tests matching these comma-separated tags
  --ids <ids>          Run only tests with these comma-separated IDs
  --bail               Stop after first failure
  --timeout <ms>       Per-request timeout
  --json               JSON output (CI-friendly)
  -v, --verbose        Show all assertion details
```

---

## Architecture

MCP Lab is a pnpm monorepo. The public package is `mcp-lab`. Internal libraries are published under `@mcp-lab/*`.

```
apps/
  cli                  — CLI entry point (mcp-lab command)

packages/
  protocol-kernel      — JSON-RPC 2.0 + MCP types, ProtocolKernel class
  session-engine       — Session lifecycle, Timeline recording
  transport-stdio      — stdio child-process transport
  transport-http       — Streamable HTTP + SSE transport
  assertions           — Assertion engine
  test-spec            — YAML spec types and parser

examples/
  demo-server          — Demo MCP server (tools, resources, prompts)
  fixtures/            — Example test specs
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[Apache-2.0](LICENSE)
