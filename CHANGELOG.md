# Changelog

All notable changes to MCP Workbench will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Changed

- **npm distribution strategy** — CLI now published as `@raeseoklee/mcp-workbench` (scoped package) because the unscoped `mcp-workbench` name is taken by an unrelated project
- Added `mcp-workbench-cli` convenience wrapper package for users who prefer an unscoped install
- CLI binary name remains `mcp-workbench` — no change to command usage
- Product branding remains **MCP Workbench**

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
