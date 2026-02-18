# Skill: /test-verify

## When to use

When writing tests for lint rules or verifying existing features.

## Workflow

1. Identify what's being tested (lint rule, command, core module)
2. Create test file in the matching `tests/` directory
3. For lint rules: create fixture ToolDefinition arrays (good and bad examples), assert LintIssue output
4. For commands: integration test — scaffold a fixture server, run the command, assert output
5. Run `npm test` — all must pass
6. Run `npm run typecheck` — must pass
7. Check coverage for the module: `npx vitest --coverage <file>`

## Test patterns

- Lint rules: test with `[]` tools (empty), single tool (one issue), multiple tools (mixed results)
- Real-server fixtures in `tests/fixtures/real-servers/` validate against production MCP servers
- Fixture servers live in `tests/fixtures/`
