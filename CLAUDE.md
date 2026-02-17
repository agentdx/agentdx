# AgentDX — MCP Developer Toolkit CLI

A CLI that owns the full MCP server developer lifecycle: scaffold → develop → lint → test → benchmark → publish. Think "Vercel CLI for MCP servers."

## Project Structure

```
src/
├── cli/                  # Command definitions (Commander.js)
│   ├── index.ts          # Entry point
│   └── commands/         # One file per command (init, dev, lint, test, bench, publish, doctor, install, config)
├── core/                 # Business logic, no CLI concerns
│   ├── mcp-client/       # Wraps @modelcontextprotocol/sdk — connects to servers, calls tools, records interactions
│   ├── schema-engine/    # Parses, validates, scores MCP tool schemas. Powers lint.
│   ├── llm-adapter/      # Pluggable LLM interface. Anthropic primary, OpenAI secondary, Ollama for local.
│   ├── test-runner/      # Agent simulation tests — spins up LLM, has it use tools, evaluates results
│   ├── bench-runner/     # Quantitative benchmarking — runs test scenarios N times, computes Agent DX Score
│   ├── scaffolder/       # Project generation from templates and OpenAPI specs
│   └── registry-client/  # API client for the AgentDX registry
├── plugins/              # Plugin loader and interfaces
└── utils/                # Config, logging, fs helpers, process management
```

## Tech Stack

- **Language:** TypeScript 5.x, strict mode, ESM (`"type": "module"`)
- **Runtime:** Node.js 22+
- **CLI:** Commander.js for commands, @clack/prompts for wizards, Ink (React) only for REPL and live progress
- **MCP:** @modelcontextprotocol/sdk (official SDK, wraps it — never reimplement protocol logic)
- **LLM:** @anthropic-ai/sdk (primary), openai package (secondary + Ollama compat)
- **Validation:** zod v4 (MCP SDK peer dep), Ajv for JSON Schema
- **Build:** tsup (production bundle), tsx (dev execution)
- **Test:** Vitest
- **Process:** execa for spawning MCP servers, chokidar for file watch
- **Config:** yaml package for agentdx.config.yaml parsing

## Commands

```bash
npm run build          # tsup — bundles to dist/
npm run dev            # tsx src/cli/index.ts
npm run test           # vitest run
npm run test:watch     # vitest
npm run lint:code      # eslint + prettier
npm run typecheck      # tsc --noEmit
```

## Key Conventions

- ESM imports everywhere. `import { x } from 'y'`, never `require()`.
- One file per CLI command in `src/cli/commands/`. Each exports a function that receives the Commander program and adds its command.
- Core modules have zero CLI dependencies. `src/core/` never imports from `src/cli/`.
- All async operations use async/await, never raw callbacks.
- Error handling: throw typed errors from core, catch and format in CLI layer. See `src/utils/errors.ts` for error classes.
- No classes unless genuinely stateful. Prefer functions + interfaces.
- Naming: kebab-case for files, camelCase for variables/functions, PascalCase for types/interfaces.

## Architecture Rules

- IMPORTANT: The MCP client wraps `@modelcontextprotocol/sdk`. Never reimplement JSON-RPC, transport negotiation, or protocol handshakes.
- IMPORTANT: LLM calls go through `src/core/llm-adapter/adapter.ts` interface. Never call Anthropic/OpenAI SDKs directly from commands or test runner.
- The schema engine extracts tool definitions by connecting to a running MCP server and calling `listTools()`. It does NOT parse source code.
- Test scenarios are YAML files in `tests/scenarios/`. See `docs/scenarios.md` for the schema.
- The Agent DX Score formula lives in `src/core/bench-runner/scorer.ts`. It's a weighted composite — see the spec in `docs/SPEC.md` section 3.5.

## Spec Documents

Full project specification, architecture, and launch plan are in `docs/`:
- `docs/SPEC.md` — What to build: CLI commands, config format, registry API, roadmap
- `docs/ARCHITECTURE.md` — How to build: infrastructure, internal architecture, security, launch playbook

When implementing a feature, always check the relevant spec section first.

## Working Style

- Run `npm run typecheck` after making changes to catch type errors early.
- Run relevant tests, not the whole suite: `npx vitest run src/core/schema-engine`
- When adding a new CLI command: create `src/cli/commands/<name>.ts`, register it in `src/cli/index.ts`, add corresponding core logic in `src/core/`.
- When modifying LLM prompts: prompts live in `src/core/llm-adapter/prompts/`. They are plain template strings, not magic.
- Commit messages: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
