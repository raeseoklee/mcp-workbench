# Changelog

All notable changes to MCP Workbench are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Snapshot / baseline diff assertions (`kind: snapshot`) — run with `--update-snapshots` to record, subsequent runs compare and diff

---

## [0.1.0] — 2026-03-15

Initial release of MCP Workbench.

### Added
- `mcp-workbench inspect` — connect to any MCP server and display capabilities, tools, resources, and prompts
- `mcp-workbench run <spec>` — execute YAML test suites with typed assertions
- Transport support: `stdio` (child process) and `streamable-http` (Streamable HTTP / SSE)
- Assertion engine: `status`, `jsonpath`, `executionError`, `protocolError`, `contentType`, `count`, `notEmpty`, `equals`, `schema`, `outputSchemaValid`
- YAML test spec format `mcp-workbench.dev/v0alpha1` with `server`, `client`, `fixtures`, and `tests` sections
- `--json` output mode for CI integration
- `--bail`, `--tags`, `--ids`, `--timeout`, `--verbose` CLI flags
- Demo server (`@mcp-workbench/demo-server`) with tools, resources, and prompts
- Example fixture (`examples/fixtures/demo-server.yaml`)
- GitHub Actions CI workflow
- Protocol spec `2025-11-25` with backward compatibility for `2024-11-05`

### Architecture
- `@mcp-workbench/protocol-kernel` — JSON-RPC 2.0 + MCP types + ProtocolKernel
- `@mcp-workbench/session-engine` — session lifecycle + timeline recording
- `@mcp-workbench/transport-stdio` — stdio transport
- `@mcp-workbench/transport-http` — Streamable HTTP transport
- `@mcp-workbench/assertions` — assertion engine
- `@mcp-workbench/test-spec` — YAML spec parser and types
