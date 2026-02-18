# AgentDX — Technical Specification

> The linter for MCP servers. Catches what agents can't tell you.
> `npx agentdx lint` — find out if your MCP server's tool definitions are LLM-friendly.

**Version:** 0.3.0
**Last updated:** 2026-02-18

---

## 1. What AgentDX Is

AgentDX is a static analysis linter for MCP (Model Context Protocol) servers. It answers one question: **"Are your tool definitions good enough for LLMs to use correctly?"**

- **`agentdx lint`** — Static analysis. Fast, free, no LLM needed. Catches structural problems in tool descriptions, schemas, naming, and provider compatibility. Produces a **Lint Score** (0–100).

That's the product. Everything else is a utility.

### What AgentDX is NOT

- Not a hosting/deployment platform
- Not a registry or marketplace
- Not a scaffolding tool (AI coding agents do this better)
- Not an MCP client/runtime
- Not an LLM-based evaluator — all analysis is deterministic

### Retained utilities (already built, low priority)

- **`agentdx init`** — Scaffolds a new MCP server project. Convenience, not core.
- **`agentdx dev`** — Spawns server + REPL for interactive testing. Useful during development, not core.

---

## 2. Installation & Usage

### Zero-config usage (the ideal)

```bash
# In any MCP server project directory
npx agentdx lint
```

No config file required. AgentDX auto-detects the server entry point by scanning for common patterns:

1. `agentdx.config.yaml` (if present, use it)
2. `package.json` → `main` or `bin` field
3. `src/index.ts` or `src/index.js`
4. `index.ts` or `index.js`

### Global install

```bash
npm install -g agentdx
agentdx lint
```

### With config (optional)

```yaml
# agentdx.config.yaml
server:
  name: my-weather-server
  entry: src/index.ts
  transport: stdio

lint:
  rules:
    desc-min-length: 30 # override threshold
    schema-enum-bool: off # disable rule
    description-states-limitations: warn # escalate to warning
```

```json
// .agentdxrc.json
{
  "lint": {
    "rules": {
      "desc-min-length": 30,
      "schema-enum-bool": "off"
    }
  }
}
```

---

## 3. `agentdx lint` — Static Analysis

### What it checks

30 rules across 4 categories, informed by academic research on LLM-tool interaction.

#### 3.1 Description Quality (10 rules)

| Rule                | ID                                    | Severity | What it catches                                      |
| ------------------- | ------------------------------------- | -------- | ---------------------------------------------------- |
| Description exists  | `desc-exists`                         | error    | Tool has no description                              |
| Minimum length      | `desc-min-length`                     | warn     | Too vague for an LLM to understand (< 20 chars)      |
| Maximum length      | `desc-max-length`                     | warn     | Overly long, wastes context window (> 200 chars)     |
| Action verb         | `desc-action-verb`                    | warn     | Description should start with a verb                 |
| No jargon/ambiguity | `desc-clarity`                        | info     | Flags vague terms: "handles", "processes", "manages" |
| Unique descriptions | `desc-unique`                         | warn     | Two tools with nearly identical descriptions         |
| States purpose      | `description-states-purpose`          | warn     | Description clearly states what the tool does        |
| Usage guidance      | `description-includes-usage-guidance` | info     | Explains when or how to use the tool                 |
| States limitations  | `description-states-limitations`      | info     | Mentions constraints, rate limits, or caveats        |
| Has examples        | `description-has-examples`            | info     | Complex tools (3+ params) include example inputs     |

#### 3.2 Schema & Parameters (11 rules)

| Rule               | ID                           | Severity | What it catches                             |
| ------------------ | ---------------------------- | -------- | ------------------------------------------- |
| Schema exists      | `schema-exists`              | error    | Tool accepts input but has no schema        |
| Valid schema       | `schema-valid`               | error    | Schema type is not "object"                 |
| Param descriptions | `schema-param-desc`          | warn     | Parameters missing descriptions             |
| Required fields    | `schema-required`            | warn     | Required params not marked                  |
| Enum over boolean  | `schema-enum-bool`           | info     | Booleans where enums would be clearer       |
| No untyped params  | `schema-no-any`              | warn     | Parameters without a type                   |
| Default values     | `schema-defaults`            | info     | Optional params without defaults            |
| Enum documented    | `param-enum-documented`      | warn     | Enum values not explained in description    |
| Default documented | `param-default-documented`   | info     | Default values not mentioned in description |
| Nesting depth      | `schema-not-too-deep`        | warn     | Nesting exceeds depth 3                     |
| Param count        | `schema-no-excessive-params` | warn     | More than 10 parameters                     |

#### 3.3 Naming Conventions (4 rules)

| Rule              | ID                | Severity | What it catches                              |
| ----------------- | ----------------- | -------- | -------------------------------------------- |
| Convention        | `name-convention` | warn     | Inconsistent naming (mix of styles)          |
| Verb-noun pattern | `name-verb-noun`  | info     | Name should contain a verb (e.g. `get_user`) |
| No collisions     | `name-unique`     | error    | Duplicate tool names                         |
| Prefix grouping   | `name-prefix`     | info     | Related tools should share prefix            |

#### 3.4 Provider Compatibility (4 rules)

| Rule            | ID                    | Severity   | What it catches                           |
| --------------- | --------------------- | ---------- | ----------------------------------------- |
| Tool count      | `openai-tool-count`   | warn/error | Warns >20 tools, errors >128              |
| Name length     | `openai-name-length`  | error      | Names longer than 64 characters           |
| Name pattern    | `openai-name-pattern` | error      | Names with invalid characters             |
| Ambiguous names | `name-not-ambiguous`  | warn       | Generic names like "search", "get", "run" |

### Output format

```
$ agentdx lint

  AgentDX Lint — my-weather-server (5 tools)

  ✗ error  get_forecast: no input schema defined                    [schema-exists]
  ⚠ warn   get_weather: parameter "units" has no description        [schema-param-desc]
  ⚠ warn   get_alerts: description is 12 chars — too vague          [desc-min-length]
  ✓ pass   naming is consistent (snake_case)

  ✓ 22 rules passed | ⚠ 2 warnings | ✗ 1 error

  Lint Score: 84/100
```

### Machine-readable output

```bash
agentdx lint --format json > lint-results.json
agentdx lint --format sarif > lint-results.sarif  # for GitHub Actions integration
```

### CLI options

```
agentdx lint [options]

Options:
  -f, --format <format>   Output format: pretty (default), json, sarif
  --fix-suggestions       Show concrete fix suggestions for each failing rule
  --quiet                 Only show errors, suppress warnings and info (CI mode)
  -c, --config <path>     Path to .agentdxrc.json config file
  -v, --verbose           Enable verbose output
  --help                  Show help
  --version               Show version
```

### Exit codes

| Code | Meaning                    |
| ---- | -------------------------- |
| `0`  | All rules passed           |
| `1`  | Errors found               |
| `2`  | Warnings found (no errors) |

### CI integration

```yaml
# .github/workflows/agentdx.yml
- name: AgentDX Lint
  run: npx agentdx lint --format sarif > results.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

### Lint Score

The score is deterministic — same input always produces the same score.

**Formula:** Rule-based pass rate weighted by severity.

- Each failing rule contributes a deduction: error=3, warn=2, info=1
- Multiple issues from the same rule count once (worst severity wins)
- Score = `100 * (1 - deduction / (totalRules * 3))`, clamped to 0-100

This normalizes fairly — a server with 20 tools and a server with 1 tool are scored on the same scale (rules passed vs. rules failed, not issues counted).

---

## 4. `agentdx init` (utility — already built)

Interactive wizard that scaffolds a new MCP server project. Produces:

- `package.json` with MCP SDK dependency
- `tsconfig.json` (strict, ESM)
- `src/index.ts` — working server with example tool
- `agentdx.config.yaml`
- `README.md`

Not the core product. Kept as a convenience.

---

## 5. `agentdx dev` (utility — already built)

Spawns MCP server locally with interactive REPL:

- `.tools` — list tools
- `.call <tool> <json>` — call a tool
- `.schema <tool>` — show input schema
- `.reconnect` — restart server
- Hot-reload on file changes via chokidar

Not the core product. Useful during development.

---

## 6. CLI Reference

```
agentdx <command> [options]

Commands:
  agentdx lint              Static analysis of MCP server tool quality
  agentdx init [name]       Scaffold a new MCP server project
  agentdx dev [entry]       Start dev server with interactive REPL

Global options:
  --verbose                 Show detailed output
  --config <path>           Path to config file (default: auto-detect)
  --help                    Show help
  --version                 Show version

Lint options:
  -f, --format <fmt>        Output format: pretty (default), json, sarif
  --fix-suggestions         Show concrete fix suggestions
  --quiet                   Only show errors (CI mode)
```

---

## 7. Auto-detection (Zero Config)

AgentDX should work in any MCP server project without configuration.

### Server entry point detection

```
Priority order:
1. agentdx.config.yaml → server.entry
2. CLI argument: agentdx lint src/my-server.ts
3. package.json → "bin" field (first entry)
4. package.json → "main" field
5. src/index.ts → src/index.js → index.ts → index.js
6. Fail with helpful error: "Could not find MCP server entry point"
```

### Server type detection

```
Priority order:
1. agentdx.config.yaml → server.transport
2. Scan entry file for StdioServerTransport → stdio
3. Scan entry file for SSEServerTransport → sse
4. Default: stdio
```

### Tool discovery

AgentDX spawns the server and connects as an MCP client. It calls `tools/list` to discover all available tools, descriptions, and schemas. This is the source of truth — not static analysis of source code.

---

## 8. Tech Stack

| Layer               | Choice                       | Rationale                  |
| ------------------- | ---------------------------- | -------------------------- |
| Language            | TypeScript 5.x (strict, ESM) | MCP ecosystem is TS-native |
| Runtime             | Node.js 22+                  | Required for MCP SDK       |
| CLI framework       | Commander.js                 | Lightweight                |
| Interactive prompts | @clack/prompts               | Beautiful terminal UI      |
| MCP connectivity    | @modelcontextprotocol/sdk    | Official SDK, Client class |
| Schema validation   | zod, Ajv                     | Validate tool schemas      |
| Config              | yaml                         | Parse agentdx.config.yaml  |
| Process management  | execa                        | Spawn MCP servers          |
| File watching       | chokidar                     | Dev command hot-reload     |
| Build               | tsup                         | Fast ESM bundling          |
| Dev runner          | tsx                          | Fast TS execution          |
| Test                | Vitest                       | Unit + integration tests   |
| Code linting        | ESLint + typescript-eslint   | Static analysis            |
| Formatting          | Prettier                     | Consistent code style      |

---

## 9. Project Structure

```
agentdx/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI entry point (Commander)
│   │   └── commands/
│   │       ├── init.ts           # init command (utility)
│   │       ├── dev.ts            # dev command (utility)
│   │       └── lint.ts           # lint command (core)
│   ├── core/
│   │   ├── mcp-client.ts         # Spawn server, connect, list tools
│   │   ├── config.ts             # Load and validate config
│   │   ├── detect.ts             # Auto-detect entry point, transport
│   │   └── types.ts              # Shared type definitions
│   ├── lint/
│   │   ├── engine.ts             # Lint rule engine
│   │   ├── score.ts              # Calculate lint score
│   │   ├── rules/
│   │   │   ├── index.ts          # Rule registry (30 rules)
│   │   │   ├── descriptions.ts   # Description quality rules (10)
│   │   │   ├── schemas.ts        # Schema validation rules (11)
│   │   │   ├── naming.ts         # Naming convention rules (4)
│   │   │   └── compatibility.ts  # Provider compatibility rules (4)
│   │   └── formatters/
│   │       ├── text.ts           # Pretty terminal output
│   │       ├── json.ts           # JSON output
│   │       └── sarif.ts          # SARIF for GitHub Actions
│   └── shared/
│       └── logger.ts             # Logging with --verbose support
├── tests/
│   ├── lint/
│   │   ├── engine.test.ts
│   │   ├── score.test.ts
│   │   ├── formatters.test.ts
│   │   └── rules/               # Per-category rule tests
│   ├── core/                    # Config and detect tests
│   ├── cli/commands/            # Command integration tests
│   └── fixtures/
│       └── real-servers/        # JSON fixtures from real MCP servers
├── examples/                    # Lint output from real servers
├── scripts/
│   └── test-real-servers.ts     # Validate rules against real servers
├── docs/
│   ├── SPEC.md                  # This file
│   └── ARCHITECTURE.md          # Technical architecture
├── eslint.config.js             # ESLint flat config
├── .prettierrc.json             # Prettier config
├── CLAUDE.md                    # Claude Code project memory
├── CONTRIBUTING.md              # Contribution guidelines
├── CHANGELOG.md                 # Release changelog
├── CODE_OF_CONDUCT.md           # Contributor Covenant
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## 10. Research

AgentDX rules are informed by academic research on LLM-tool interaction:

- **"MCP Tool Descriptions Are Smelly"** ([arxiv 2602.14878](https://arxiv.org/abs/2602.14878)) — analyzed 1,899 MCP tools and found 97.1% have description quality issues. Identified 5 smell categories: missing purpose, missing guidance, vague language, missing constraints, and duplicates.

- **Microsoft MCP Interviewer research** — found 775 naming collisions across the MCP ecosystem, tool selection accuracy drops past 20 tools, and deeply nested schemas (up to 20 levels) cause 47% performance degradation.

---

## 11. Roadmap

- [x] CLI skeleton, `init`, `dev`
- [x] `agentdx lint` — 30 rules, 3 formatters, lint score
- [x] Validated against real MCP servers (filesystem, everything, fetch, playwright)
- [ ] `--fix` for auto-fixable lint rules
- [ ] CI GitHub Action (`agentdx/lint-action`)
- [ ] MCP server registry integration
- [ ] Landing page at agentdx.dev
