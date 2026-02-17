# AgentDX — The MCP Developer Toolkit

**Full Technical Spec, CLI Reference & Roadmap**

*"The Vercel CLI for MCP servers."*

---

## 1. Vision & Positioning

### The Problem

MCP (Model Context Protocol) is the de facto standard for connecting AI agents to external tools and data. The ecosystem has exploded: ~2,000 servers in the official registry, 97M+ monthly SDK downloads, adoption by Anthropic, OpenAI, Google, and thousands of developers. But the developer experience for **building** MCP servers is still fragmented and painful.

Today, building an MCP server looks like this:

1. Copy boilerplate from a GitHub repo or the SDK docs
2. Guess at tool descriptions (will an LLM actually understand them?)
3. Manually test by connecting to Claude Desktop and trying prompts
4. No way to know if your schema is spec-compliant until it breaks
5. No way to measure how well agents actually use your tools
6. Deploy and hope for the best
7. No observability into how agents call your tools in production

This is the "FTP your PHP files to the server" era of MCP development. We're going to end it.

### Existing Tools & Their Gaps

| Tool | What it does | What it doesn't do |
|---|---|---|
| **MCP Inspector** (official) | Web-based UI for debugging servers, manual tool invocation | No scaffolding, no automated testing, no benchmarking, no CI/CD, no registry |
| **mcptools** (community) | Go CLI with basic scaffolding, tool invocation, shell mode | No agent simulation, no quality scoring, no linting, no benchmarking, TS-only scaffolding |
| **FastMCP** (Anthropic) | Python framework for building servers quickly | Framework not toolkit — no testing harness, no linting, no publishing workflow |
| **MCP Python SDK / TS SDK** | Low-level protocol implementation | Raw SDK, not a DX layer — no opinions, no guardrails, no lifecycle tooling |

**Nobody owns the full MCP server lifecycle.** That's the gap.

### What AgentDX Is

AgentDX is a single CLI that owns the entire MCP server developer experience: scaffold → develop → lint → test → benchmark → publish. It's opinionated where it matters (project structure, testing patterns, quality standards) and flexible where it doesn't (language, transport, model provider).

Think of it as what **Vercel CLI** did for frontend deployment, or what **Docker CLI** did for containerization — but for MCP servers.

### Strategic Positioning

**Phase 1 (this document):** Best-in-class MCP developer toolkit. Become the way serious developers build, test, and publish MCP servers.

**Phase 2 (future):** Extend into agent coordination. The metadata AgentDX generates about tool quality, reliability, and agent-friendliness becomes the foundation for orchestrating multi-agent workflows. When one agent needs to delegate to another, AgentDX's registry knows which tools are reliable, what they do, and how to compose them.

---

## 2. Technical Architecture

### 2.1 High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│                     AgentDX CLI                             │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  init    │ │   dev    │ │   lint   │ │   test   │   │
│  │ scaffold │ │  server  │ │ validate │ │  agent   │   │
│  │ generate │ │   REPL   │ │  schema  │ │ simulate │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  bench   │ │ publish  │ │  doctor  │ │  config  │   │
│  │ measure  │ │ registry │ │ diagnose │ │  manage  │   │
│  │  score   │ │ release  │ │  fix     │ │  auth    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Core Engine Layer                      │  │
│  │                                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │  │
│  │  │ MCP Client  │  │   Schema    │  │   Report   │ │  │
│  │  │  (stdlib)   │  │   Engine    │  │  Generator │ │  │
│  │  └─────────────┘  └─────────────┘  └────────────┘ │  │
│  │                                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │  │
│  │  │   LLM       │  │  Transport  │  │   Plugin   │ │  │
│  │  │  Adapter    │  │   Manager   │  │   System   │ │  │
│  │  └─────────────┘  └─────────────┘  └────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   AgentDX Registry                          │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │   Package    │  │   Quality   │  │  Compatibility │  │
│  │   Storage    │  │   Scores    │  │    Matrix      │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### MCP Client (stdlib)
A built-in MCP client implementation that can connect to any server via stdio, SSE, or streamable HTTP. Used by `dev`, `test`, and `bench` commands to interact with the server under development. Unlike the official Inspector (which runs in a browser), this runs entirely in the terminal and is scriptable.

#### Schema Engine
Parses, validates, and analyzes MCP tool/resource/prompt schemas. Powers the `lint` command. Validates against the MCP spec (currently 2025-11-25), checks for common anti-patterns, and scores description quality for LLM comprehension.

#### LLM Adapter
Pluggable interface for calling language models during `test` and `bench`. Supports Anthropic (default), OpenAI, and local models via Ollama/OpenRouter. The adapter handles prompt construction for agent simulation — it frames the LLM as an agent that must accomplish tasks using only the tools your server exposes.

#### Transport Manager
Handles server lifecycle: spawning stdio processes, connecting to SSE/HTTP endpoints, managing health checks, graceful shutdown. Abstracts transport so all commands work identically regardless of how the server communicates.

#### Report Generator
Produces structured output from lint, test, and bench runs. Supports terminal (default), JSON (for CI/CD), and HTML (for sharing). Reports are also stored locally in `.agentdx/reports/` for trend tracking.

#### Plugin System
Extension point for community contributions. Plugins can add custom lint rules, test generators, benchmark suites, and scaffolding templates. Distributed via npm.

### 2.3 Project Structure (Generated by `agentdx init`)

```
my-mcp-server/
├── src/
│   ├── index.ts              # Server entrypoint
│   ├── tools/                # One file per tool
│   │   ├── search.ts
│   │   └── create.ts
│   ├── resources/            # Resource handlers
│   │   └── schema.ts
│   └── prompts/              # Prompt templates
│       └── summarize.ts
├── tests/
│   ├── scenarios/            # Agent simulation scenarios
│   │   ├── happy-path.yaml
│   │   └── edge-cases.yaml
│   └── unit/                 # Standard unit tests
│       └── tools.test.ts
├── agentdx.config.yaml          # AgentDX configuration
├── package.json
├── tsconfig.json
└── README.md                 # Auto-generated from schemas
```

### 2.4 Configuration File: `agentdx.config.yaml`

```yaml
# agentdx.config.yaml
version: 1

server:
  name: "my-mcp-server"
  version: "0.1.0"
  description: "Does something useful for agents"
  transport: stdio              # stdio | sse | streamable-http
  language: typescript          # typescript | python
  entrypoint: src/index.ts

lint:
  rules:
    description-min-length: 20
    description-max-length: 500
    require-examples: true
    require-error-descriptions: true
    max-parameters-per-tool: 8
    naming-convention: kebab-case
  custom-rules: []              # paths to plugin rules

test:
  provider: anthropic           # anthropic | openai | ollama | openrouter
  model: claude-sonnet-4-5-20250929
  scenarios: tests/scenarios/
  timeout: 30s
  max-retries: 3
  parallel: true

bench:
  runs: 10                      # iterations per scenario
  provider: anthropic
  model: claude-sonnet-4-5-20250929
  metrics:
    - tool-selection-accuracy
    - parameter-correctness
    - retry-rate
    - latency-p50
    - latency-p95

publish:
  registry: https://registry.agentdx.dev
  visibility: public            # public | unlisted | private
  license: MIT
```

### 2.5 Data Flow: How a Test Run Works

```
1. agentdx test --scenario happy-path.yaml
   │
2. Transport Manager spawns MCP server (stdio/SSE/HTTP)
   │
3. Schema Engine extracts tool definitions from server
   │
4. Test Runner reads scenario file:
   │   task: "Find all Python files modified today"
   │   expected_tools: [search_files]
   │   expected_behavior: "Returns file list with paths and timestamps"
   │
5. LLM Adapter constructs agent prompt:
   │   "You have access to these tools: [schemas]
   │    Accomplish this task: [task description]
   │    Use tools as needed. Think step by step."
   │
6. LLM generates tool calls → MCP Client sends to server
   │
7. Server responds → LLM receives results → may call more tools
   │
8. Test Runner evaluates:
   │   ✓ Correct tool selected? (search_files, not list_directory)
   │   ✓ Parameters valid? (path: ".", pattern: "*.py", modified_after: "today")
   │   ✓ Task completed? (LLM indicates success with reasonable output)
   │   ✗ Any errors? (schema mismatches, timeouts, unexpected behavior)
   │
9. Report Generator produces results:
   │   Scenario: happy-path
   │   Tool Selection: ✓ (1/1 correct)
   │   Parameter Accuracy: 92% (missed date format on first try)
   │   Retries: 1
   │   Total Time: 3.2s
   │
10. Results stored in .agentdx/reports/2026-02-16T14:30:00.json
```

---

## 3. CLI Command Reference

### 3.1 `agentdx init`

Scaffolds a new MCP server project with production-ready structure.

```
agentdx init [project-name]

Options:
  --language, -l     Language: typescript (default) | python
  --transport, -t    Transport: stdio (default) | sse | streamable-http
  --tools            Comma-separated tool names to scaffold
                     e.g. --tools search,create,delete
  --resources        Comma-separated resource names
  --prompts          Comma-separated prompt names
  --template         Use a community template from registry
                     e.g. --template api-wrapper
  --api              URL of an OpenAPI spec to auto-generate tools from
  --no-git           Skip git initialization
  --package-manager  npm (default) | pnpm | yarn | bun
  --interactive, -i  Run interactive wizard (default when no flags)

Examples:
  agentdx init my-server
  agentdx init my-server --tools search,create -l python
  agentdx init my-server --api https://api.example.com/openapi.json
  agentdx init my-server --template database-wrapper
```

**What it does:**
- Creates project directory with the structure from §2.3
- Generates typed tool/resource/prompt skeletons with descriptive comments
- Sets up build pipeline (TypeScript compilation or Python packaging)
- Generates `agentdx.config.yaml` with sensible defaults
- Creates example test scenarios
- Initializes git repo with `.gitignore`
- If `--api` is provided, introspects the OpenAPI spec and generates one MCP tool per endpoint with parameter mappings, descriptions derived from the API docs, and error handling stubs

**The `--api` flag is key differentiation.** Most MCP servers wrap existing APIs. Today that's a manual process of reading API docs, writing tool definitions, mapping parameters. AgentDX automates this: point it at an OpenAPI spec and get a working MCP server in seconds. The developer then refines descriptions and adds business logic.

---

### 3.2 `agentdx dev`

Starts a local development server with an interactive console.

```
agentdx dev [entrypoint]

Options:
  --port, -p         Port for SSE/HTTP transport (default: 3456)
  --watch, -w        Hot-reload on file changes (default: true)
  --no-watch         Disable hot-reload
  --ui               Open web UI (similar to Inspector but integrated)
  --verbose, -v      Show raw JSON-RPC messages
  --record           Record all interactions to .agentdx/sessions/

Sub-commands within the REPL:
  .tools             List all registered tools with schemas
  .resources         List all resources
  .prompts           List all prompts
  .call <tool> <json>  Invoke a tool with JSON parameters
  .read <resource>     Read a resource
  .prompt <name>       Execute a prompt
  .ask <natural lang>  Describe what you want in plain English;
                       AgentDX translates to tool calls via LLM
  .schema <tool>       Pretty-print a tool's full schema
  .history             Show interaction history
  .export              Export session as test scenario YAML
  .clear               Clear the screen
  .quit                Exit dev server

Examples:
  agentdx dev
  agentdx dev src/index.ts --verbose
  agentdx dev --record
```

**What it does:**
- Spawns the MCP server and connects as a client
- Provides a REPL where you can invoke tools directly
- The `.ask` command is the killer feature: you describe what you want in natural language, AgentDX uses an LLM to generate the appropriate tool calls, executes them, and shows both the LLM's reasoning and the server's response. This lets you test "can an agent actually figure out how to use my tools?" without leaving your terminal
- Hot-reloads when source files change (rebuilds TypeScript, reconnects)
- `.export` converts your REPL session into a reusable test scenario
- `--record` captures all interactions for later replay/analysis

---

### 3.3 `agentdx lint`

Validates tool definitions against the MCP spec and best practices.

```
agentdx lint [entrypoint]

Options:
  --fix              Auto-fix issues where possible
  --format, -f       Output format: terminal (default) | json | sarif
  --rules            Comma-separated rule overrides
  --severity         Minimum severity: error | warn (default) | info
  --config           Path to custom config (default: agentdx.config.yaml)

Examples:
  agentdx lint
  agentdx lint --fix
  agentdx lint --format json | jq '.errors'
  agentdx lint --severity error
```

**Built-in Rules:**

| Rule | Severity | Description |
|---|---|---|
| `spec-compliance` | error | Tool/resource/prompt schemas match MCP spec |
| `description-quality` | warn | Descriptions are clear enough for LLMs to understand |
| `description-length` | warn | Not too short (<20 chars) or too long (>500 chars) |
| `parameter-descriptions` | warn | Every parameter has a description |
| `required-fields` | error | Required parameters are marked as such |
| `naming-consistency` | warn | Tool names follow a consistent convention |
| `input-validation` | warn | Parameters use JSON Schema constraints (min/max, patterns, enums) |
| `error-handling` | warn | Error responses include meaningful descriptions |
| `duplicate-tools` | error | No duplicate tool names |
| `example-values` | info | Parameters include example values in descriptions |
| `conflicting-names` | warn | Tool names don't collide with common MCP conventions |
| `auth-scope` | info | Tools that modify data are annotated with required auth scopes |
| `idempotency-hints` | info | Destructive tools are marked appropriately |
| `description-llm-score` | warn | An LLM evaluates whether the description is unambiguous (uses the LLM adapter to score) |

**What `--fix` auto-corrects:**
- Adds missing `required` fields based on analysis
- Expands terse descriptions using LLM to generate better ones (with developer approval)
- Normalizes naming conventions
- Adds missing JSON Schema type constraints
- Generates example values from type information

---

### 3.4 `agentdx test`

Runs agent simulation tests against your server.

```
agentdx test [scenario-path]

Options:
  --scenario, -s     Path to specific scenario file or directory
  --all              Run all scenarios in tests/scenarios/
  --provider         LLM provider: anthropic (default) | openai | ollama
  --model            Specific model to use
  --parallel         Run scenarios in parallel (default: true)
  --retries          Max retries per scenario (default: 3)
  --timeout          Per-scenario timeout (default: 30s)
  --format, -f       Output: terminal (default) | json | junit
  --verbose, -v      Show full LLM reasoning and tool call traces
  --record           Save full interaction traces
  --update-snapshots Update expected output snapshots

Examples:
  agentdx test
  agentdx test tests/scenarios/happy-path.yaml
  agentdx test --all --verbose
  agentdx test --provider ollama --model llama3.1
  agentdx test --format junit > results.xml
```

**Scenario File Format:**

```yaml
# tests/scenarios/happy-path.yaml
name: "Basic file search"
description: "Agent should find Python files modified today"

# The task the simulated agent must accomplish
task: |
  Find all Python files in the project directory that were
  modified in the last 24 hours. Return their paths and sizes.

# Expected behavior (flexible, not exact matching)
expect:
  tools_used:
    - search_files           # must use this tool
  tools_not_used:
    - delete_file            # must NOT use this tool
  parameters:
    search_files:
      path: "."              # expected value (flexible matching)
      pattern: "*.py"        # can be regex or glob
  result:
    contains: ".py"          # output should contain this
    min_items: 1             # should return at least 1 result
  max_tool_calls: 3          # shouldn't need more than 3 calls
  completes: true            # agent should report task complete

# Optional: provide context the agent should have
context:
  - "The project directory is at /workspace"
  - "There are 50 Python files in the project"

# Optional: setup commands to run before the test
setup:
  - "mkdir -p /tmp/test-workspace"
  - "touch /tmp/test-workspace/app.py"

# Optional: cleanup
teardown:
  - "rm -rf /tmp/test-workspace"
```

**What it evaluates:**

1. **Tool Selection Accuracy** — Did the agent pick the right tools for the task?
2. **Parameter Correctness** — Were parameters valid and sensible?
3. **Task Completion** — Did the agent accomplish what was asked?
4. **Efficiency** — How many tool calls did it take? Were there unnecessary retries?
5. **Error Recovery** — When a tool returned an error, did the agent handle it gracefully?
6. **Safety** — Did the agent avoid using destructive tools when not needed?

**Auto-generated scenarios:** When you run `agentdx test --generate`, AgentDX reads your tool schemas and uses an LLM to generate a suite of test scenarios covering happy paths, edge cases, type mismatches, missing parameters, and adversarial inputs. This gives you instant test coverage for a new server.

---

### 3.5 `agentdx bench`

Measures how well agents actually interact with your tools. Produces a quantitative "Agent DX Score."

```
agentdx bench [entrypoint]

Options:
  --runs, -n         Number of iterations per scenario (default: 10)
  --provider         LLM provider (default: anthropic)
  --model            Specific model
  --scenarios        Scenario directory (default: tests/scenarios/)
  --compare          Path to previous benchmark for comparison
  --output, -o       Output file (default: .agentdx/benchmarks/latest.json)
  --format, -f       terminal (default) | json | html
  --budget           Max API spend for this run (e.g. --budget $5.00)

Examples:
  agentdx bench
  agentdx bench --runs 20 --model claude-opus-4-5-20250929
  agentdx bench --compare .agentdx/benchmarks/v0.1.0.json
  agentdx bench --format html -o report.html
```

**Metrics Produced:**

| Metric | Description |
|---|---|
| **Tool Selection Accuracy** | % of times the agent picked the correct tool(s) |
| **Parameter Accuracy** | % of tool calls with fully correct parameters |
| **First-Try Success Rate** | % of scenarios completed without retries |
| **Avg Tool Calls per Task** | Efficiency measure — lower is better |
| **Retry Rate** | How often the agent needed to retry after errors |
| **Latency P50/P95** | Time from task start to completion |
| **Error Recovery Rate** | % of errors the agent recovered from gracefully |
| **Description Clarity Score** | LLM-evaluated quality of tool descriptions |
| **Overall Agent DX Score** | Composite 0-100 score |

**The Agent DX Score** is the headline metric. It combines all individual metrics into a single number that tells you: "How easy is it for an AI agent to use your tools?" A score above 85 means your server is production-ready. Below 60 means agents will struggle.

**Comparison mode** (`--compare`) shows deltas between benchmark runs, so you can see if a schema change improved or degraded agent usability:

```
Agent DX Score: 78 → 84 (+6) ▲
  Tool Selection:    92% → 95% (+3%)
  Parameter Accuracy: 71% → 82% (+11%) ← biggest improvement
  First-Try Success:  65% → 70% (+5%)
  Retry Rate:         22% → 15% (-7%)
```

---

### 3.6 `agentdx publish`

Publishes your MCP server to the AgentDX registry.

```
agentdx publish

Options:
  --registry         Registry URL (default: from config)
  --tag              Version tag (default: from package.json)
  --visibility       public | unlisted | private
  --dry-run          Validate without publishing
  --force            Skip confirmation prompts
  --include-bench    Include latest benchmark results in listing

Examples:
  agentdx publish
  agentdx publish --dry-run
  agentdx publish --tag beta --visibility unlisted
  agentdx publish --include-bench
```

**What it does:**

1. Runs `agentdx lint` — publishing fails if there are errors
2. Runs `agentdx test --all` — publishing fails if tests fail
3. Packages server code + schemas + metadata
4. Generates auto-documentation from tool schemas
5. Creates compatibility matrix (which clients this server has been tested with)
6. Uploads to registry with quality scores from latest benchmark
7. Updates README with registry badge and quality score

**Registry Listing includes:**
- Server name, description, version, author
- Full tool/resource/prompt documentation (auto-generated from schemas)
- Agent DX Score and individual metrics
- Compatibility matrix (Claude Code, OpenClaw, Cursor, etc.)
- Install command (`agentdx install <name>` or `npx`)
- Download stats, GitHub stars (if linked)
- Version history with benchmark comparisons

---

### 3.7 `agentdx doctor`

Diagnoses problems with your MCP server setup.

```
agentdx doctor [entrypoint]

Options:
  --fix              Attempt to auto-fix found issues
  --verbose, -v      Show detailed diagnostic output

Examples:
  agentdx doctor
  agentdx doctor --fix
```

**Checks:**
- Node/Python version compatibility
- Dependencies installed and up to date
- MCP SDK version matches spec version
- Server starts without errors
- All tools register correctly
- Transport is configured properly
- Auth is set up (if applicable)
- Config file is valid
- Test scenarios parse correctly
- Registry credentials (if publishing)

---

### 3.8 `agentdx install`

Installs an MCP server from the registry or configures it for a client.

```
agentdx install <server-name>

Options:
  --client           Target client: claude-code | claude-desktop | cursor | openclaw
  --global           Install globally
  --config-only      Just add to mcp.json, don't install package

Examples:
  agentdx install @agentdx/github
  agentdx install @agentdx/postgres --client claude-code
  agentdx install my-private-server --client openclaw
```

**What it does:**
- Downloads the server package from the registry
- Generates the correct configuration for the target client
- Adds the entry to the client's `mcp.json` or equivalent config
- Verifies the server works with `agentdx doctor`

This is the "consumer" side of the tool — making it trivially easy to install well-tested MCP servers into any client.

---

### 3.9 `agentdx config`

Manages AgentDX configuration and credentials.

```
agentdx config

Sub-commands:
  agentdx config init          Create/reset agentdx.config.yaml
  agentdx config set <key> <val>  Set a config value
  agentdx config get <key>        Get a config value
  agentdx config auth login       Authenticate with registry
  agentdx config auth logout      Remove stored credentials
  agentdx config auth whoami      Show current authenticated user

Examples:
  agentdx config set test.provider openai
  agentdx config set test.model gpt-4o
  agentdx config auth login
```

---

### 3.10 `agentdx upgrade`

Self-update command.

```
agentdx upgrade

Options:
  --check            Just check for updates, don't install
  --canary           Install latest canary build
```

---

## 4. The AgentDX Registry

### 4.1 What It Is

A searchable, quality-scored registry of MCP servers. Think npmjs.com but purpose-built for MCP, with agent-friendliness as a first-class concern.

### 4.2 Key Differentiators from Existing Registries

The official MCP Registry (launched September 2025) is a catalog — it lists servers. AgentDX Registry is a **quality layer**:

- **Agent DX Scores** — every listed server has a quantitative "how well can agents use this?" score
- **Verified testing** — servers published through AgentDX have passed automated agent simulation tests
- **Benchmark history** — you can see how a server's quality has changed across versions
- **Compatibility matrix** — which clients (Claude Code, OpenClaw, Cursor) each server has been verified with
- **One-click install** — `agentdx install` configures the server for your specific client
- **Private registries** — organizations can run their own instance for internal MCP servers

### 4.3 Registry API (for Phase 2 agent coordination)

```
GET    /v1/servers                    # List/search servers
GET    /v1/servers/:name              # Server details + scores
GET    /v1/servers/:name/tools        # Tool schemas
GET    /v1/servers/:name/bench        # Benchmark history
POST   /v1/servers                    # Publish (authenticated)
GET    /v1/servers/:name/compatibility # Client compatibility matrix
GET    /v1/recommend?task=<desc>      # "Which server can do X?" (Phase 2)
```

The `/recommend` endpoint is the bridge to Phase 2. An orchestrating agent asks "I need to search a GitHub repository" and the registry responds with the best-scored server for that capability, along with connection instructions. This is how AgentDX evolves from developer tool to agent coordination infrastructure.

---

## 5. Technology Stack

### CLI

| Component | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 22+ | MCP ecosystem is JS/TS-native. Same runtime as most MCP servers. |
| CLI Framework | Commander.js + Ink (React for CLI) | Commander for arg parsing, Ink for rich terminal UI in dev/bench |
| MCP Client | `@modelcontextprotocol/sdk` | Official SDK, always spec-current |
| LLM Calls | Anthropic SDK (primary), OpenAI SDK, Ollama REST | Pluggable via LLM Adapter |
| Schema Validation | Ajv (JSON Schema) | Industry standard, fast |
| File Watching | chokidar | For `agentdx dev --watch` |
| Testing | Vitest | For AgentDX's own tests |
| Build | tsup | Fast TypeScript bundler |
| Package | npm (published as `agentdx`) | Largest reach |

### Registry

| Component | Technology | Rationale |
|---|---|---|
| API | Hono on Cloudflare Workers | Fast, cheap, scales globally |
| Database | Cloudflare D1 (SQLite) | Metadata, scores, users |
| Package Storage | Cloudflare R2 | Server packages, benchmarks |
| Search | Meilisearch (hosted) | Fast full-text search over tool descriptions |
| Auth | GitHub OAuth | Standard for developer tools |
| Frontend | Astro + React | Static site with interactive search |

---

## 6. Phased Roadmap

### Phase 0: Foundation (Weeks 1–2)

**Goal:** Working CLI skeleton with `init` and `dev` commands.

**Deliverables:**
- [ ] Project repo setup (TypeScript, tsup, Vitest, CI)
- [ ] CLI skeleton with Commander.js, global help, version
- [ ] `agentdx init` — interactive wizard + flag-based scaffolding
  - TypeScript template with working stdio server
  - Python template with working stdio server
  - Generates `agentdx.config.yaml`
  - Creates example tool with full schema
- [ ] `agentdx dev` — spawns server, connects client, REPL
  - `.tools`, `.call`, `.schema` commands work
  - Hot-reload on file save
  - `--verbose` shows raw JSON-RPC
- [ ] `agentdx doctor` — basic diagnostics
- [ ] README, LICENSE, contributing guide
- [ ] Publish `agentdx@0.1.0-alpha` on npm

**Milestone:** Developer can `npx agentdx init my-server && cd my-server && agentdx dev` and have a working MCP server in under 60 seconds.

---

### Phase 1: Quality Layer (Weeks 3–5)

**Goal:** Lint, test, and benchmark. This is where AgentDX becomes more than a scaffolding tool.

**Deliverables:**
- [ ] `agentdx lint` — full rule engine
  - Spec compliance checks
  - Description quality scoring (LLM-powered)
  - `--fix` auto-correction
  - JSON + SARIF output for CI/CD
- [ ] `agentdx test` — agent simulation testing
  - Scenario YAML format
  - LLM adapter (Anthropic first, OpenAI second)
  - Tool selection, parameter, and completion evaluation
  - `--generate` auto-creates scenarios from schemas
  - JUnit output for CI/CD
- [ ] `agentdx bench` — quantitative benchmarking
  - All metrics from §3.5
  - Agent DX Score composite
  - `--compare` delta reporting
  - HTML report output
- [ ] `.ask` command in `agentdx dev` — natural language → tool calls
- [ ] `.export` command — convert REPL sessions to test scenarios
- [ ] Publish `agentdx@0.2.0-alpha`

**Milestone:** Developer can measure and improve how well agents use their tools with a single command.

---

### Phase 2: Publishing & Registry (Weeks 6–9)

**Goal:** The registry goes live. AgentDX becomes the quality standard for MCP servers.

**Deliverables:**
- [ ] Registry API on Cloudflare Workers
  - Package upload/download
  - Quality score storage
  - Search (Meilisearch)
  - GitHub OAuth
- [ ] Registry frontend
  - Server listings with scores
  - Tool schema browser
  - Benchmark history graphs
  - One-click install instructions
- [ ] `agentdx publish` — full publishing workflow
  - Lint + test gates
  - Auto-documentation generation
  - Compatibility matrix
  - Version management
- [ ] `agentdx install` — consumer install flow
  - Claude Code, Claude Desktop, Cursor, OpenClaw support
  - Auto-config generation
- [ ] `agentdx config auth` — credential management
- [ ] `--api` flag for `agentdx init` — OpenAPI → MCP server generation
- [ ] Private registry support for organizations
- [ ] Publish `agentdx@0.3.0-beta`

**Milestone:** A developer publishes a server with `agentdx publish` and another developer installs it with `agentdx install` and it just works — quality-verified.

---

### Phase 3: Community & Polish (Weeks 10–13)

**Goal:** Ecosystem growth. Make AgentDX the default tool mentioned in MCP tutorials.

**Deliverables:**
- [ ] Plugin system — custom lint rules, test generators, templates
- [ ] Community templates in registry (api-wrapper, database, file-system, etc.)
- [ ] `agentdx init --template` browsing and installation
- [ ] CI/CD integrations
  - GitHub Action: `agentdx-action` (lint + test + bench on PR)
  - Pre-commit hook support
- [ ] VS Code extension — inline lint warnings, test runner
- [ ] Python scaffolding parity with TypeScript (FastMCP integration)
- [ ] Landing page + documentation site
- [ ] "Built with AgentDX" badge for READMEs
- [ ] Content: blog posts, tutorials, "how to build your first MCP server in 5 minutes"
- [ ] Publish `agentdx@1.0.0`

**Milestone:** AgentDX appears in the official MCP docs as a recommended tool. 100+ servers published through the registry.

---

### Phase 4: Bridge to Agent Coordination (Weeks 14–20)

**Goal:** The metadata AgentDX has accumulated becomes the foundation for multi-agent workflows. This is where Option B begins.

**Deliverables:**
- [ ] `/recommend` API endpoint — "which server can accomplish X?"
- [ ] `agentdx compose` command — define multi-server workflows
  - YAML format for chaining tools across servers
  - Dependency resolution (server A's output feeds server B's input)
  - Parallel execution where possible
- [ ] Agent-to-agent protocol primitives
  - Delegation: "I can't do X, but server Y can"
  - Verification: "Server Y completed X, here's the proof"
  - Fallback chains: "If Y fails, try Z"
- [ ] Quality-based routing — automatically pick the highest-scored server for each capability
- [ ] Dashboard for monitoring multi-server workflows
- [ ] `agentdx orchestrate` command — run a composed workflow

**Milestone:** An agent can say "I need to search GitHub, run tests, and post results to Slack" and AgentDX automatically discovers, connects, and orchestrates the three best-scored servers for those tasks.

---

## 7. Growth Strategy & Metrics

### How to Get to 500 Servers in the Registry

1. **Seed with auto-generated wrappers.** Use `agentdx init --api` to generate MCP servers for the top 50 public APIs (GitHub, Slack, Notion, Linear, Stripe, etc.). Publish them as `@agentdx/github`, `@agentdx/slack`, etc. This gives the registry immediate value.

2. **Make every MCP tutorial use AgentDX.** Contribute PRs to the official MCP docs. Write tutorials. Answer StackOverflow questions. When someone asks "how do I build an MCP server?" the answer should involve `agentdx init`.

3. **GitHub Action as Trojan horse.** The `agentdx-action` CI integration means every team that uses AgentDX for testing continues to use it. Their servers become publishable with one config change.

4. **Agent DX Score as social proof.** Make the score badge a status symbol. Developers will want to improve their score, which means running `agentdx bench` more, which means deeper adoption.

### Key Metrics to Track

| Metric | Target (3 months) | Target (6 months) |
|---|---|---|
| npm weekly downloads | 2,000 | 15,000 |
| GitHub stars | 1,000 | 5,000 |
| Registered servers | 100 | 500 |
| Monthly `agentdx test` runs | 5,000 | 50,000 |
| Contributors | 20 | 50 |
| Mentioned in MCP docs | yes | featured |

### The Acquisition Signal

The signal that makes Anthropic/OpenAI pay attention isn't downloads — it's **dependency**. When their ecosystem's quality depends on your tool, the conversation starts. The path:

1. AgentDX becomes how quality MCP servers are built
2. The registry becomes where agents discover capabilities
3. The orchestration layer becomes how multi-agent workflows compose
4. At that point, you're infrastructure — not optional

---

## 8. Open Questions

These are decisions to make during Phase 0–1, not blockers:

1. **CLI name.** `agentdx` is clean but could conflict. Alternatives: `forge`, `mcp-forge`, `mcp-dx`, `toolsmith`. Need to check npm availability.

2. **Free vs paid registry tiers.** Public servers free, private registries paid? Or fully free to maximize adoption?

3. **Which LLM provider as default.** Anthropic is natural (they created MCP) but requiring an Anthropic API key limits adoption. Consider: free tier with a shared key for `lint --llm-score` and `test`, or Ollama as default for zero-cost local testing.

4. **Relationship with official MCP Registry.** Complement it (AgentDX registry as quality layer on top) or compete (replace it)? Likely complement — publish to both.

5. **Monorepo or separate repos.** CLI and registry could live together (simpler) or apart (cleaner separation). Start together, split if needed.

---

*Last updated: February 16, 2026*
*Status: Draft v1 — ready for implementation*
