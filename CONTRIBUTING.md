# Contributing to MCP Lab

Thank you for your interest in contributing!

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/raeseoklee/mcp-lab.git
cd mcp-lab

# 2. Install dependencies (requires pnpm ≥ 9 and Node ≥ 20)
pnpm install

# 3. Build all packages
pnpm build

# 4. Run unit tests
pnpm test

# 5. Run integration tests against the demo server
node apps/cli/dist/index.js run examples/fixtures/demo-server.yaml --verbose
```

## Project Structure

- `packages/` — library packages (`@mcp-lab/*`)
- `apps/cli` — the `mcp-lab` CLI
- `examples/` — demo server and fixture files

## Workflow

1. Fork the repo and create a feature branch
2. Make changes, add tests
3. Ensure `pnpm build && pnpm test` passes
4. Open a pull request

## Adding a New Assertion

1. Add the type to `packages/assertions/src/types.ts`
2. Implement the logic in `packages/assertions/src/runner.ts`
3. Add tests in `packages/assertions/src/__tests__/runner.test.ts`
4. Document it in `README.md`

## Adding a New Transport

1. Create `packages/transport-<name>/`
2. Implement the `Transport` interface from `@mcp-lab/protocol-kernel`
3. Export from `index.ts`
4. Add to the CLI runner in `apps/cli/src/runner.ts`

## Code Style

- TypeScript strict mode
- ESM modules (`"type": "module"`)
- No default exports
- Named exports only

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
