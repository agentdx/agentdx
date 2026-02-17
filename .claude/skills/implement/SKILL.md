---
name: implement
description: Implement a feature following AgentDX conventions. Checks spec, writes code, runs typecheck and tests.
---

# Implement Feature: $ARGUMENTS

## Before Writing Code

1. Check if this feature is described in `docs/SPEC.md` — find the relevant section
2. Check if there's architecture guidance in `docs/ARCHITECTURE.md`
3. Identify which `src/core/` module this belongs to
4. Identify if a new CLI command is needed in `src/cli/commands/`

## Implementation Rules

- Core logic goes in `src/core/`. CLI formatting goes in `src/cli/`.
- If this touches LLM calls, go through `src/core/llm-adapter/adapter.ts` interface
- If this touches the MCP protocol, use the SDK client in `src/core/mcp-client/`
- Export types/interfaces from the module, import them where needed
- Write the implementation, then add or update tests in the corresponding test file

## After Writing Code

1. Run `npm run typecheck` — fix any type errors before proceeding
2. Run the relevant test: `npx vitest run <path-to-test>`
3. If a CLI command was added/changed, manually verify: `npx tsx src/cli/index.ts <command> --help`

## Checklist Before Done

- [ ] Core logic is in `src/core/`, not in CLI layer
- [ ] No `any` types unless absolutely necessary (with a comment explaining why)
- [ ] Errors are typed and have user-facing messages
- [ ] Typecheck passes
- [ ] Tests pass
