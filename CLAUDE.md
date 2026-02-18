# CLAUDE.md — AgentDX Project Memory

## What is AgentDX?

A quality measurement tool for MCP servers. Two core commands:
- `agentdx lint` — static analysis of tool descriptions, schemas, naming
- `agentdx bench` — LLM-based evaluation producing the Agent DX Score (0-100)

**Not** a hosting platform, registry, or scaffolding tool. The `init` and `dev` commands exist as utilities but are not the product.

## Tech Stack

- TypeScript 5.x strict, ESM, Node 22+
- Commander.js (CLI), @clack/prompts (interactive)
- @modelcontextprotocol/sdk (MCP Client class)
- @anthropic-ai/sdk (primary LLM), openai SDK (secondary + Ollama)
- zod v4 (validation), Ajv (JSON Schema), yaml (config)
- tsup (build), tsx (dev), Vitest (test)
- execa (process spawn), chokidar (file watch)

## Commands

```bash
npm run build      # tsup → dist/
npm run dev        # tsx watch mode
npm test           # vitest
npm run typecheck  # tsc --noEmit
```

## Project Structure

```
src/
├── cli/              # CLI entry + commands
│   ├── index.ts      # Commander program
│   └── commands/     # init, dev, lint, bench
├── core/             # Shared: MCP client, config, auto-detect
├── lint/             # Rule engine + rules + formatters
│   ├── rules/        # Pure functions: descriptions, schemas, naming, errors
│   └── formatters/   # text, json, sarif
├── bench/            # Bench engine
│   ├── scenarios/    # Generator + YAML loader
│   ├── evaluators/   # tool-selection, params, ambiguity, multi-tool, error-recovery
│   └── llm/          # Adapter pattern: anthropic, openai, ollama
└── shared/           # Logger, utilities
```

## Architecture Rules

1. `core/` never imports from `cli/`, `lint/`, or `bench/`
2. `lint/` and `bench/` never import from each other
3. `cli/` only imports command entry functions, not internals
4. All LLM calls go through `bench/llm/adapter.ts` — never call SDKs directly from evaluators
5. Lint rules are pure functions — no side effects, no I/O
6. Evaluators are pure functions — take inputs, return scores

## Key Conventions

- ESM only (`import/export`, no `require`)
- No classes unless stateful (rules and evaluators are plain functions)
- Errors: catch at command level, show human message, exit with code
- Config is always optional — zero-config with auto-detect is the goal
- Types in `src/core/types.ts` for shared interfaces

## Current State

- [x] Phase 0: CLI skeleton, `init`, `dev` — working and published to npm
- [ ] Phase 1: `lint` — next to implement
- [ ] Phase 2: `bench` — after lint

## Implementation Notes

- Extract MCP client logic from `dev.ts` into `src/core/mcp-client.ts` before starting lint
- Lint connects to server only to discover tools, then disconnects
- Bench sends tool definitions to LLM — it does NOT execute the actual tools
- Multiple runs per scenario (default 3) with majority vote for consistency
