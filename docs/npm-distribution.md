# npm Distribution Strategy

## Package Names

| Name | Type | Description |
|------|------|-------------|
| **MCP Workbench** | Product name | The project brand |
| `@raeseoklee/mcp-workbench` | Primary npm package | Full CLI implementation |
| `mcp-workbench-cli` | Convenience wrapper | Thin forwarder to the scoped package |
| `mcp-workbench` | CLI command | Binary name (same for both packages) |

## Why a scoped package?

The unscoped `mcp-workbench` name on npm is already taken by an [unrelated project](https://www.npmjs.com/package/mcp-workbench) — an MCP server aggregator that bundles multiple servers into toolboxes.

Our project is a **testing and validation platform** for MCP server developers. Despite sharing the name, the two projects have completely different purposes and zero feature overlap.

To avoid confusion, we publish under a scoped name and provide a convenience wrapper.

## Installation

### Option 1 — Scoped package (recommended)

```bash
npm install -g @raeseoklee/mcp-workbench
```

### Option 2 — Convenience wrapper

```bash
npm install -g mcp-workbench-cli
```

Both options install the same `mcp-workbench` command:

```bash
mcp-workbench --version
mcp-workbench inspect --command node --args "path/to/server.js"
mcp-workbench run tests.yaml --verbose
```

## How the wrapper works

`mcp-workbench-cli` is a thin package that:

1. Declares `@raeseoklee/mcp-workbench` as a dependency
2. Provides a `bin/mcp-workbench.js` script that forwards to the real CLI entry point
3. Contains no implementation logic of its own

## Upgrade

```bash
# Scoped package
npm update -g @raeseoklee/mcp-workbench

# Wrapper
npm update -g mcp-workbench-cli
```

## Publishing (for maintainers)

Both packages must be published in order — the wrapper depends on the scoped package.

```bash
# 1. Build
pnpm build

# 2. Publish the real package first
pnpm --filter @raeseoklee/mcp-workbench publish

# 3. Then publish the wrapper
cd packages/npm-wrapper-cli
npm publish
```

### Version coordination

Both packages should share the same version number. When bumping versions:

1. Update `apps/cli/package.json` version
2. Update `packages/npm-wrapper-cli/package.json` version AND its dependency on `@raeseoklee/mcp-workbench`
3. Publish scoped package first, then wrapper
