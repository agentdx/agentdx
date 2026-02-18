# CLAUDE.md — AgentDX Project Memory

## What is AgentDX?

The linter for MCP servers. Catches what agents can't tell you.

- `agentdx lint` — static analysis of tool descriptions, schemas, naming, and provider compatibility

**Not** a hosting platform, registry, or scaffolding tool. The `init` and `dev` commands exist as utilities but are not the product.

## Tech Stack

- TypeScript 5.x strict, ESM, Node 22+
- Commander.js (CLI), @clack/prompts (interactive)
- @modelcontextprotocol/sdk (MCP Client class)
- zod (validation), Ajv (JSON Schema), yaml (config)
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
│   └── commands/     # init, dev, lint
├── core/             # Shared: MCP client, config, auto-detect
├── lint/             # Rule engine + rules + formatters
│   ├── rules/        # Pure functions: descriptions, schemas, naming, compatibility
│   └── formatters/   # pretty (text), json, sarif
└── shared/           # Logger, utilities
```

## Architecture Rules

1. `core/` never imports from `cli/` or `lint/`
2. `cli/` only imports command entry functions, not internals
3. Lint rules are pure functions — no side effects, no I/O

## Key Conventions

- ESM only (`import/export`, no `require`)
- No classes unless stateful (rules are plain functions)
- Errors: catch at command level, show human message, exit with code
- Config is always optional — zero-config with auto-detect is the goal
- Types in `src/core/types.ts` for shared interfaces
- No runtime dependencies requiring API keys

## Current State

- [x] Phase 0: CLI skeleton, `init`, `dev` — working and published to npm
- [x] Phase 1: `lint` — 30 rules, 3 formatters, lint score, fix suggestions
- Bench has been removed — agentdx is a pure linter now

## Lint Rules (30 total)

- **Description quality** (10): desc-exists, desc-min-length, desc-max-length, desc-action-verb, desc-clarity, desc-unique, description-states-purpose, description-includes-usage-guidance, description-states-limitations, description-has-examples
- **Schema & parameters** (11): schema-exists, schema-valid, schema-param-desc, schema-required, schema-enum-bool, schema-no-any, schema-defaults, param-enum-documented, param-default-documented, schema-not-too-deep, schema-no-excessive-params
- **Naming** (4): name-convention, name-verb-noun, name-unique, name-prefix
- **Provider compatibility** (4): openai-tool-count, openai-name-length, openai-name-pattern, name-not-ambiguous (new, research-backed)
