# AgentDX — Technical Specification

> The Agent DX Score for MCP servers.
> `npx agentdx bench` — find out if your MCP server is actually usable by AI agents.

**Version:** 0.2.0
**Last updated:** 2026-02-17

---

## 1. What AgentDX Is

AgentDX is a quality measurement tool for MCP (Model Context Protocol) servers. It answers one question: **"How well can an AI agent actually use your MCP server?"**

It does this through two commands:

- **`agentdx lint`** — Static analysis. Fast, free, no LLM needed. Catches structural problems in tool definitions, schemas, and naming.
- **`agentdx bench`** — LLM-based evaluation. Sends your tool definitions to a real LLM and measures whether it can select the right tools, fill parameters correctly, and handle errors. Produces the **Agent DX Score** (0–100).

That's the product. Everything else is a utility.

### What AgentDX is NOT

- Not a hosting/deployment platform (use Manufact, Railway, Fly, etc.)
- Not a registry or marketplace (npm and the MCP server list already exist)
- Not a scaffolding tool (AI coding agents do this better)
- Not an MCP client/runtime (use mcp-use, Claude, Cursor, etc.)

### Retained utilities (already built, low priority)

- **`agentdx init`** — Scaffolds a new MCP server project. Already implemented. Stays as a convenience, not marketed as core.
- **`agentdx dev`** — Spawns server + REPL for interactive testing. Already implemented. Useful during development, but not the product.

---

## 2. Installation & Usage

### Zero-config usage (the ideal)

```bash
# In any MCP server project directory
npx agentdx lint
npx agentdx bench
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
agentdx bench
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
    description-min-length: 20
    description-max-length: 200
    require-param-descriptions: true
    require-error-schemas: warn
    naming-convention: verb_noun

bench:
  provider: anthropic           # anthropic | openai | ollama
  model: claude-sonnet-4-5-20250929  # any supported model
  scenarios: auto               # auto-generate scenarios, or path to scenarios file
  runs: 3                       # repeat each scenario N times for consistency
  temperature: 0                # deterministic by default
```

---

## 3. `agentdx lint` — Static Analysis

### What it checks

Lint rules are organized into categories. Each rule produces a pass, warn, or fail.

#### 3.1 Tool Descriptions

| Rule | ID | Default | What it catches |
|---|---|---|---|
| Description exists | `desc-exists` | error | Tool has no description at all |
| Minimum length | `desc-min-length` | warn (20 chars) | "Gets data" — too vague for an LLM to understand |
| Maximum length | `desc-max-length` | warn (200 chars) | Overly long descriptions that waste context window |
| Action clarity | `desc-action-verb` | warn | Description should start with a verb ("Retrieves…", "Creates…") |
| No jargon/ambiguity | `desc-clarity` | info | Flags common vague terms: "handles", "processes", "manages" |
| Differentiation | `desc-unique` | warn | Two tools with nearly identical descriptions — LLM won't know which to pick |

#### 3.2 Input Schemas

| Rule | ID | Default | What it catches |
|---|---|---|---|
| Schema exists | `schema-exists` | error | Tool accepts input but has no schema defined |
| Valid JSON Schema | `schema-valid` | error | Schema doesn't conform to JSON Schema spec |
| Param descriptions | `schema-param-desc` | warn | Parameters missing descriptions — LLM guesses what to pass |
| Required fields marked | `schema-required` | warn | Required params not marked, LLM may omit them |
| Enum over boolean | `schema-enum-bool` | info | `isDetailed: boolean` vs `detail_level: "summary" | "full"` — enums are clearer |
| No `any` types | `schema-no-any` | warn | Untyped parameters — LLM has no guidance |
| Default values | `schema-defaults` | info | Optional params without defaults — LLM doesn't know what happens if omitted |

#### 3.3 Naming

| Rule | ID | Default | What it catches |
|---|---|---|---|
| Convention | `name-convention` | warn | Inconsistent naming (mix of camelCase, snake_case, kebab-case) |
| Verb-noun pattern | `name-verb-noun` | info | `weather` vs `get_weather` — verb+noun is clearer for LLMs |
| No collisions | `name-unique` | error | Duplicate tool names |
| Prefix grouping | `name-prefix` | info | Related tools should share prefix: `file_read`, `file_write`, `file_delete` |

#### 3.4 Error Handling

| Rule | ID | Default | What it catches |
|---|---|---|---|
| Error content | `error-content` | warn | Tool returns generic errors without actionable info |
| Error differentiation | `error-types` | info | Same error for all failure modes — LLM can't retry intelligently |

### Output format

```
$ agentdx lint

  AgentDX Lint — my-weather-server (5 tools)

  ✗ error  get_forecast: no input schema defined                    [schema-exists]
  ✗ error  get_forecast: duplicate description with get_weather     [desc-unique]
  ⚠ warn   get_weather: parameter "units" has no description        [schema-param-desc]
  ⚠ warn   get_alerts: description is 12 chars — too vague          [desc-min-length]
  ℹ info   set_location: consider verb_noun naming → "location_set" [name-verb-noun]
  ✓ pass   5/5 tools have descriptions
  ✓ pass   naming is consistent (snake_case)
  ✓ pass   no duplicate tool names

  2 errors · 2 warnings · 1 info

  Lint Score: 58/100
```

### Machine-readable output

```bash
agentdx lint --format json > lint-results.json
agentdx lint --format sarif > lint-results.sarif  # for GitHub Actions integration
```

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

### Exit codes

- `0` — No errors (warnings and info are OK)
- `1` — One or more errors
- `2` — Could not connect to server / config error

---

## 4. `agentdx bench` — LLM-Based Evaluation

This is the core product. It measures how well an AI agent can actually use your MCP server.

### How it works

1. **Connect** — AgentDX spawns your MCP server and connects as a client (same as `agentdx dev`)
2. **Discover** — Lists all tools, their descriptions, and schemas
3. **Generate scenarios** (or load from file) — Creates realistic task descriptions that a user might ask an agent
4. **Evaluate** — For each scenario, sends the tools + task to an LLM and measures:
   - Did it select the correct tool(s)?
   - Did it fill parameters correctly?
   - Did it handle ambiguous cases gracefully?
   - Did it recover from errors?
5. **Score** — Produces the Agent DX Score (0–100) with detailed breakdown

### Scenario generation

By default, AgentDX auto-generates scenarios from your tool definitions. It uses an LLM to create realistic tasks:

```
Tool: get_weather(city: string, units?: "celsius" | "fahrenheit")
Description: "Retrieve current weather conditions for a specified city"

Auto-generated scenarios:
  1. "What's the weather in Tokyo?" → should call get_weather({city: "Tokyo"})
  2. "Temperature in Paris in Fahrenheit" → should call get_weather({city: "Paris", units: "fahrenheit"})
  3. "How's the weather?" → should ask for clarification (no city provided)
  4. "Weather in NYC and London" → should call get_weather twice or explain limitation
```

Custom scenarios can be defined in a YAML file:

```yaml
# bench/scenarios.yaml
scenarios:
  - task: "What's the weather in Tokyo?"
    expect:
      tool: get_weather
      params:
        city: "Tokyo"
    
  - task: "Compare weather in Rome and Paris"
    expect:
      tools: [get_weather, get_weather]
      description: "Should call get_weather for both cities"
    
  - task: "Will it rain tomorrow in Berlin?"
    expect:
      tool: get_forecast
      params:
        city: "Berlin"
    tags: [disambiguation]  # tests if LLM picks forecast over current weather
    
  - task: "Set the temperature to 25 degrees"
    expect:
      tool: none
      description: "Should refuse — no tool can set temperature"
    tags: [negative]
```

### Evaluation dimensions

#### 4.1 Tool Selection Accuracy

Can the LLM pick the right tool for a given task?

- **Correct selection**: LLM chooses the expected tool
- **Partial selection**: LLM chooses a related but suboptimal tool
- **Wrong selection**: LLM chooses an unrelated tool
- **Hallucination**: LLM invents a tool that doesn't exist
- **Correct refusal**: Task has no matching tool, LLM correctly says so

#### 4.2 Parameter Accuracy

Does the LLM fill in parameters correctly?

- **All required params present**: No missing required fields
- **Correct types**: String for string, number for number, etc.
- **Correct values**: Enum values match, formats are right
- **Optional params**: Used when beneficial, omitted when irrelevant

#### 4.3 Ambiguity Handling

How does the LLM behave when the task is unclear?

- **Asks for clarification** when task is vague (good)
- **Makes reasonable assumption** with explanation (acceptable)
- **Silently guesses wrong** (bad)

#### 4.4 Multi-tool Orchestration

For servers with multiple tools, can the LLM compose them?

- **Correct sequencing**: Calls tools in logical order
- **Data passing**: Uses output of one tool as input to another
- **Avoids redundancy**: Doesn't call the same tool unnecessarily

#### 4.5 Error Recovery

When a tool returns an error, does the LLM:

- **Retry with corrected params** (good)
- **Try alternative tool** (good)
- **Explain the error to the user** (acceptable)
- **Silently fail or hallucinate** (bad)

### The Agent DX Score

The overall score (0–100) is a weighted composite:

| Dimension | Weight | Description |
|---|---|---|
| Tool Selection | 35% | Right tool for the job |
| Parameter Accuracy | 30% | Correct inputs |
| Ambiguity Handling | 15% | Graceful with unclear tasks |
| Multi-tool | 10% | Orchestration and composition |
| Error Recovery | 10% | Resilience to failures |

Score bands:

| Score | Rating | Meaning |
|---|---|---|
| 90–100 | Excellent | LLMs reliably use this server |
| 75–89 | Good | Works well with minor confusion |
| 50–74 | Needs work | LLMs frequently misuse tools |
| 0–49 | Poor | LLMs struggle to use this server |

### Output format

```
$ agentdx bench

  AgentDX Bench — my-weather-server (5 tools, 18 scenarios)

  Running with claude-sonnet-4-5-20250929 (3 runs per scenario)...

  Tool Selection     ████████████████████░░  92%  (17/18 correct)
  Parameter Accuracy ██████████████░░░░░░░░  68%  (units param confused in 4 cases)
  Ambiguity Handling ████████████████░░░░░░  78%  (asked for clarification 7/9 times)
  Multi-tool         ████████████████████░░  90%  (correct sequencing)
  Error Recovery     ██████████░░░░░░░░░░░░  50%  (LLM didn't understand error format)

  ┌─────────────────────────────────┐
  │  Agent DX Score:  78 / 100      │
  │  Rating: Good                   │
  └─────────────────────────────────┘

  Top issues:
  1. get_weather "units" param: no default specified, LLM omits it 60% of the time
     → Fix: add default "celsius" to schema
  2. Error responses are plain strings, LLM can't parse failure reason
     → Fix: return structured errors { code, message, suggestion }
  3. get_forecast vs get_weather: descriptions too similar
     → Fix: add time range to get_forecast description

  Full report: .agentdx/bench-report-2026-02-17.json
```

### Machine-readable output

```bash
agentdx bench --format json > bench-results.json
```

The JSON report includes every scenario, every LLM response, and per-tool breakdowns.

### LLM Provider Configuration

```bash
# Anthropic (default)
export ANTHROPIC_API_KEY=sk-ant-...
agentdx bench

# OpenAI
agentdx bench --provider openai --model gpt-4o
# requires OPENAI_API_KEY

# Ollama (local, free)
agentdx bench --provider ollama --model llama3.2
# requires Ollama running locally

# Multiple models comparison
agentdx bench --provider anthropic --model claude-sonnet-4-5-20250929
agentdx bench --provider openai --model gpt-4o
# compare results to see which LLM works best with your server
```

### Cost awareness

AgentDX shows estimated cost before running:

```
This benchmark will run 18 scenarios × 3 runs = 54 LLM calls
Estimated cost: ~$0.12 (claude-sonnet-4-5-20250929)
Proceed? [Y/n]
```

---

## 5. `agentdx init` (utility — already built)

Interactive wizard that scaffolds a new MCP server project. Produces:

- `package.json` with MCP SDK dependency
- `tsconfig.json` (strict, ESM)
- `src/index.ts` — working server with example tool
- `agentdx.config.yaml`
- `README.md`

Not the core product. Kept as a convenience.

---

## 6. `agentdx dev` (utility — already built)

Spawns MCP server locally with interactive REPL:

- `.tools` — list tools
- `.call <tool> <json>` — call a tool
- `.schema <tool>` — show input schema
- `.reconnect` — restart server
- Hot-reload on file changes via chokidar

Not the core product. Useful during development.

---

## 7. CLI Reference

```
agentdx <command> [options]

Commands:
  agentdx lint              Static analysis of MCP server tool quality
  agentdx bench             LLM-based evaluation (produces Agent DX Score)
  agentdx init [name]       Scaffold a new MCP server project
  agentdx dev [entry]       Start dev server with interactive REPL

Global options:
  --verbose                 Show detailed output
  --config <path>           Path to agentdx.config.yaml (default: auto-detect)
  --help                    Show help
  --version                 Show version

Lint options:
  --format <fmt>            Output format: text (default), json, sarif
  --fix                     Auto-fix what's possible (add missing descriptions, etc.)
  --rule <id>               Run only specific rule(s)
  --severity <level>        Minimum severity to report: error, warn, info

Bench options:
  --provider <name>         LLM provider: anthropic (default), openai, ollama
  --model <name>            Model to use (default: claude-sonnet-4-5-20250929)
  --scenarios <path>        Path to custom scenarios YAML file
  --runs <n>                Runs per scenario (default: 3)
  --format <fmt>            Output format: text (default), json
  --no-confirm              Skip cost confirmation prompt
  --temperature <n>         LLM temperature (default: 0)
```

---

## 8. Auto-detection (Zero Config)

AgentDX should work in any MCP server project without configuration. The auto-detection logic:

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

## 9. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.x (strict, ESM) | MCP ecosystem is TS-native |
| Runtime | Node.js 22+ | Required for MCP SDK |
| CLI framework | Commander.js | Already implemented, lightweight |
| Interactive prompts | @clack/prompts | Already implemented |
| MCP connectivity | @modelcontextprotocol/sdk | Official SDK, Client class |
| Schema validation | zod v4, Ajv | Validate tool schemas |
| LLM (primary) | @anthropic-ai/sdk | Best MCP understanding |
| LLM (secondary) | openai SDK | OpenAI + Ollama compatible |
| Config | yaml | Parse agentdx.config.yaml |
| Process management | execa | Spawn MCP servers |
| File watching | chokidar | Dev command hot-reload |
| Build | tsup | Fast ESM bundling |
| Dev runner | tsx | Fast TS execution |
| Test | Vitest | Unit + integration tests |

---

## 10. Project Structure

```
agentdx/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI entry point (Commander)
│   │   └── commands/
│   │       ├── init.ts           # init command (utility)
│   │       ├── dev.ts            # dev command (utility)
│   │       ├── lint.ts           # lint command (core)
│   │       └── bench.ts          # bench command (core)
│   ├── core/
│   │   ├── mcp-client.ts         # Shared: spawn server, connect, list tools
│   │   ├── config.ts             # Load and validate agentdx.config.yaml
│   │   ├── detect.ts             # Auto-detect entry point, transport
│   │   └── types.ts              # Shared type definitions
│   ├── lint/
│   │   ├── engine.ts             # Lint rule engine
│   │   ├── rules/
│   │   │   ├── descriptions.ts   # Description quality rules
│   │   │   ├── schemas.ts        # Schema validation rules
│   │   │   ├── naming.ts         # Naming convention rules
│   │   │   └── errors.ts         # Error handling rules
│   │   ├── score.ts              # Calculate lint score
│   │   └── formatters/
│   │       ├── text.ts           # Terminal output
│   │       ├── json.ts           # JSON output
│   │       └── sarif.ts          # SARIF for GitHub Actions
│   ├── bench/
│   │   ├── engine.ts             # Bench orchestrator
│   │   ├── scenarios/
│   │   │   ├── generator.ts      # Auto-generate scenarios from tools
│   │   │   └── loader.ts         # Load custom scenarios from YAML
│   │   ├── evaluators/
│   │   │   ├── tool-selection.ts  # Did LLM pick the right tool?
│   │   │   ├── parameters.ts      # Did LLM fill params correctly?
│   │   │   ├── ambiguity.ts       # How does LLM handle unclear tasks?
│   │   │   ├── multi-tool.ts      # Can LLM compose multiple tools?
│   │   │   └── error-recovery.ts  # Does LLM handle errors?
│   │   ├── llm/
│   │   │   ├── adapter.ts        # LLM provider abstraction
│   │   │   ├── anthropic.ts      # Anthropic implementation
│   │   │   ├── openai.ts         # OpenAI implementation
│   │   │   └── ollama.ts         # Ollama implementation
│   │   ├── score.ts              # Calculate Agent DX Score
│   │   └── reporter.ts           # Format and display results
│   └── shared/
│       └── logger.ts             # Logging with --verbose support
├── tests/
│   ├── lint/
│   │   └── rules/                # Unit tests for each lint rule
│   ├── bench/
│   │   ├── evaluators/           # Unit tests for evaluators
│   │   └── scenarios/            # Test scenario generation
│   └── cli/
│       └── commands/             # Integration tests
├── docs/
│   ├── SPEC.md                   # This file
│   └── ARCHITECTURE.md           # Technical architecture
├── CLAUDE.md                     # Claude Code project memory
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── agentdx.config.yaml           # (only for AgentDX's own config)
```

---

## 11. Roadmap

### Phase 0 — Foundation (done)
- [x] CLI skeleton with Commander
- [x] `agentdx init` — scaffold MCP server projects
- [x] `agentdx dev` — REPL + hot-reload
- [x] Published to npm as `agentdx`

### Phase 1 — Lint (next)
- [ ] Core shared module: spawn server, connect, list tools (`src/core/mcp-client.ts`)
- [ ] Auto-detection: entry point, transport, tools
- [ ] Lint rule engine with all rules from section 3
- [ ] Text, JSON, SARIF output formatters
- [ ] Lint score calculation
- [ ] `agentdx lint` works zero-config in any MCP server project

### Phase 2 — Bench
- [ ] LLM adapter: Anthropic, OpenAI, Ollama
- [ ] Scenario auto-generation from tool definitions
- [ ] Custom scenario YAML loader
- [ ] All 5 evaluators (tool selection, params, ambiguity, multi-tool, error recovery)
- [ ] Agent DX Score calculation
- [ ] Cost estimation + confirmation prompt
- [ ] `agentdx bench` produces the score

### Phase 3 — Polish & Share
- [ ] GitHub Actions example in README
- [ ] `--fix` for auto-fixable lint rules
- [ ] Comparison mode: bench against multiple models
- [ ] Beautiful terminal output (progress bars, color)
- [ ] Landing page at agentdx.dev
- [ ] Blog post / tweet thread announcing the DX Score concept
- [ ] Submit to MCP community lists
