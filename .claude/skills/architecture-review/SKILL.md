---
name: architecture-review
description: Review the project architecture for violations, circular deps, and alignment with the spec. Runs as an isolated exploration.
context: fork
agent: Explore
---

# Architecture Review of AgentDX

Analyze the current codebase architecture and report on health.

## Check These Boundaries

1. **cli/ → core/ dependency direction**: `src/cli/` may import from `src/core/`, never the reverse. Search for any `from '../cli` or `from '../../cli` imports inside `src/core/`.

2. **LLM adapter isolation**: Only `src/core/llm-adapter/` should import `@anthropic-ai/sdk` or `openai`. Grep the entire `src/` tree for direct SDK imports outside the adapter.

3. **MCP SDK isolation**: Only `src/core/mcp-client/` should import `@modelcontextprotocol/sdk`. Grep for leaks.

4. **No circular dependencies**: Check if any module in `src/core/` imports from another core module that imports back from it.

5. **Plugin interface stability**: Check that `src/plugins/types.ts` exports only interfaces, not implementations. Plugin consumers should depend on the interface, not internals.

## Check Module Responsibilities

- `schema-engine/` should only parse and validate schemas — no LLM calls, no network
- `test-runner/` orchestrates but delegates LLM to the adapter and MCP to the client
- `scaffolder/` should be pure template rendering — no runtime server connections
- `registry-client/` is HTTP only — no business logic about scoring or validation

## Report

Summarize findings as:
- **Clean:** Boundaries that are correctly maintained
- **Violations:** Specific imports or patterns that break boundaries (with file:line)
- **Risks:** Patterns that aren't violations yet but could become problems
