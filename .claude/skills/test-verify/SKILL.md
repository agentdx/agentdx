---
name: test-verify
description: Write tests for a module or verify existing tests pass. Use after implementing a feature.
---

# Test & Verify: $ARGUMENTS

## Find What Needs Testing

1. Identify the module or feature to test
2. Check if a test file already exists at the mirrored path under `tests/` or colocated as `*.test.ts`
3. Read the implementation to understand inputs, outputs, edge cases

## Write Tests Using Vitest

- Import from `vitest`: `import { describe, it, expect, vi, beforeEach } from 'vitest'`
- Mock external dependencies (LLM calls, file system, MCP connections) with `vi.mock()`
- IMPORTANT: never make real LLM API calls in tests. Mock the adapter.
- IMPORTANT: never spawn real MCP server processes in unit tests. Mock the client.
- Test the happy path first, then edge cases, then error handling
- Use descriptive test names: `it('returns error when tool name contains spaces')`

## Run & Verify

1. Run the specific test: `npx vitest run <test-file>`
2. If tests fail, read the error, fix the issue, run again
3. Run typecheck: `npm run typecheck`
4. Only report done when tests pass and types check
