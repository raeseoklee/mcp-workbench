# Changelog

All notable changes to MCP Workbench will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [0.5.1] — 2026-03-17

### Added

- `examples/demo-mcp/server-http.mjs` — Streamable HTTP demo server for local testing of the `streamable-http` transport

### Fixed

- `transport-http`: `consumeSseStream` no longer fires `closeHandler` when an inline POST response SSE stream ends; only the persistent GET SSE stream triggers session close

---

## [0.5.0] — 2026-03-16

### Added

- `mcp-workbench generate` command with shallow and deep modes
- Deep mode: call safe tools, add response-based assertions, skip destructive tools
- Safety classification for tools by name patterns (safe/unsafe/unknown)
- Partial discovery: continue generating even when initialize or individual capabilities fail
- Per-category discovery status reporting (success/failed/skipped)
- `--header` option for `inspect` command (authenticated HTTP servers)
- `--depth`, `--allow-side-effects` options for `generate`
- `packages/spec-generator` package (discovery, inference, safety, emitter)
- `docs/generate.md` documentation

### Fixed

- Handle `id: null` JSON-RPC error responses immediately instead of waiting for timeout
- CLI version now read from package.json instead of hardcoded

---

## [0.3.0] — 2026-03-16

### Added

#### `mcp-workbench generate` command
- Auto-generate YAML test spec scaffolds from a live MCP server
- Discover tools, resources, and prompts via server connection
- Arg inference from `inputSchema` with TODO placeholders for unknown values
- `--depth shallow` (default) — list-based skeleton generation
- `--depth deep` — call safe tools, add response-based assertions
- Safety classification: skip destructive tools (`create`, `delete`, `send`, etc.) by default
- `--allow-side-effects` flag to override safety checks
- `--header` for authenticated servers (repeatable)
- `--include` / `--exclude` filters for capabilities
- `-o` / `--stdout` output modes
- `packages/spec-generator` — new package with discovery, inference, safety, and emitter modules

#### Transport
- POST-only Streamable HTTP support (fallback when GET SSE returns non-200)
- MCP protocol versions: added `2025-06-18` and `2024-10-07` (now supports all 5 official versions)

#### Demo server
- Fixed `list_roots` tool: use `server.listRoots()` instead of `extra.sendRequest`
- Read version from `package.json` instead of hardcoding
- Added shebang for proper `bin` execution
- Renamed from `demo-server` to `demo-mcp` across codebase

#### Documentation
- Korean README (`README.ko.md`) with language toggle for both repos
- `docs/generate.md` — full generate command guide
- `docs/npm-distribution.md` — npm packaging strategy

### Changed

- **npm distribution** — all publishable packages under `@mcp-workbench/` org scope
- CLI package: `@mcp-workbench/cli`
- Demo: `@mcp-workbench/demo-mcp`
- Plugins: `@mcp-workbench/plugin-sdk`, `@mcp-workbench/plugin-html-report`, `@mcp-workbench/plugin-junit`
- Convenience wrapper: `mcp-workbench-cli`
- CI updated to actions/checkout@v5 and actions/setup-node@v5
- VS Code extension: LICENSE replaced with standard Apache 2.0 full text

---

## [0.1.0] — 2026-03-15

### Added

#### CLI
- `mcp-workbench inspect` — connect to any MCP server and explore capabilities, tools, resources, and prompts
- `mcp-workbench run <spec-file>` — execute YAML test suites with rich assertions
- `mcp-workbench plugins list` — list loaded plugins and their contributions
- `--json` output for CI-friendly machine-readable results
- `--bail` flag to stop after first failure
- `--tags` / `--ids` filters for selective test execution
- `--update-snapshots` / `--snapshots-dir` for snapshot baseline management
- `--plugin` / `--reporter` / `--reporter-output` for plugin integration
- `--lang` / `MCP_WORKBENCH_LANG` for localised output (en/ko)

#### Assertion engine
- `status`, `executionError`, `protocolError`, `jsonpath`, `contentType`, `count`, `notEmpty`, `equals`, `schema`, `outputSchemaValid`, `snapshot` assertion kinds

#### Transport support
- `stdio` — local server via child process
- `streamable-http` — remote servers via Streamable HTTP
- `sse` — legacy SSE transport

#### Client simulator
- `roots`, `sampling`, `elicitation` capability simulation for server→client flows

#### Plugin system
- `WorkbenchPlugin` interface and `plugin-sdk` package
- `workbench.config.yaml` auto-discovery
- Reporter contributions (`html`, `junit`)
- Command contributions

#### Official plugins
- `@mcp-workbench/plugin-html-report` — self-contained HTML report
- `@mcp-workbench/plugin-junit` — JUnit XML for GitHub Actions / Jenkins / GitLab CI

#### Browser UI
- Protocol Inspector — DevTools-style request/response log
- Dark/light mode toggle

#### Internationalisation
- English and Korean output (`en` / `ko`)
