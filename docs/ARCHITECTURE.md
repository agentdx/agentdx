# AgentDX — Deep Technical Architecture & Public Launch Playbook

**Companion to the AgentDX Full Spec**

---

## PART 1: DEEP TECHNICAL ARCHITECTURE

### 1.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEVELOPER MACHINE                         │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   agentdx CLI   │───▶│ MCP Server   │    │ Local LLM        │   │
│  │  (Node.js)   │◀───│ (user's)     │    │ (Ollama, opt.)   │   │
│  └──────┬───────┘    └──────────────┘    └──────────────────┘   │
│         │                                                         │
│         │  .agentdx/                                                 │
│         │  ├── config.yaml                                        │
│         │  ├── cache/          (schema cache, LLM response cache) │
│         │  ├── reports/        (lint, test, bench results)        │
│         │  ├── sessions/       (recorded dev sessions)            │
│         │  └── benchmarks/     (historical benchmark data)        │
│         │                                                         │
└─────────┼─────────────────────────────────────────────────────────┘
          │
          │ HTTPS (only when needed)
          │
┌─────────▼─────────────────────────────────────────────────────────┐
│                        CLOUD SERVICES                              │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Anthropic API  │  │ AgentDX Registry  │  │ npm Registry        │  │
│  │ (test/bench)   │  │ (publish/      │  │ (CLI distribution)  │  │
│  │                │  │  install)      │  │                     │  │
│  └────────────────┘  └───────┬────────┘  └─────────────────────┘  │
│                              │                                      │
│                    ┌─────────▼─────────┐                           │
│                    │  Cloudflare Edge  │                           │
│                    │  ├── Workers (API)│                           │
│                    │  ├── D1 (metadata)│                           │
│                    │  ├── R2 (packages)│                           │
│                    │  └── Pages (site) │                           │
│                    └───────────────────┘                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Design principle: Local-first.** The CLI must work fully offline for `init`, `dev`, `lint` (basic rules), and `doctor`. Cloud is only needed for LLM-powered features (`test`, `bench`, `lint --llm-score`) and registry operations (`publish`, `install`). This matters because developers want tools that work on airplanes, behind corporate firewalls, and without API keys for basic functionality.

---

### 1.2 CLI Internal Architecture

```
agentdx/
├── src/
│   ├── cli/                      # Command layer
│   │   ├── index.ts              # Entry point, Commander setup
│   │   ├── commands/
│   │   │   ├── init.ts           # Scaffolding
│   │   │   ├── dev.ts            # Dev server + REPL
│   │   │   ├── lint.ts           # Schema validation
│   │   │   ├── test.ts           # Agent simulation
│   │   │   ├── bench.ts          # Benchmarking
│   │   │   ├── publish.ts        # Registry publishing
│   │   │   ├── install.ts        # Server installation
│   │   │   ├── doctor.ts         # Diagnostics
│   │   │   └── config.ts         # Configuration
│   │   └── ui/                   # Terminal UI (Ink components)
│   │       ├── DevRepl.tsx        # Interactive REPL
│   │       ├── TestRunner.tsx     # Test progress display
│   │       ├── BenchReport.tsx    # Benchmark visualization
│   │       └── Spinner.tsx        # Shared components
│   │
│   ├── core/                     # Business logic layer
│   │   ├── mcp-client/           # MCP protocol client
│   │   │   ├── client.ts         # Main client class
│   │   │   ├── transports/
│   │   │   │   ├── stdio.ts      # stdio transport
│   │   │   │   ├── sse.ts        # SSE transport
│   │   │   │   └── http.ts       # Streamable HTTP transport
│   │   │   └── types.ts          # MCP protocol types
│   │   │
│   │   ├── schema-engine/        # Schema analysis
│   │   │   ├── parser.ts         # Extract schemas from server
│   │   │   ├── validator.ts      # Spec compliance checking
│   │   │   ├── scorer.ts         # Description quality scoring
│   │   │   └── rules/            # Lint rules
│   │   │       ├── spec-compliance.ts
│   │   │       ├── description-quality.ts
│   │   │       ├── naming-convention.ts
│   │   │       └── index.ts      # Rule registry
│   │   │
│   │   ├── llm-adapter/          # LLM integration
│   │   │   ├── adapter.ts        # Abstract adapter interface
│   │   │   ├── anthropic.ts      # Anthropic implementation
│   │   │   ├── openai.ts         # OpenAI implementation
│   │   │   ├── ollama.ts         # Ollama implementation
│   │   │   ├── cache.ts          # Response caching
│   │   │   └── prompts/          # Prompt templates
│   │   │       ├── agent-sim.ts  # Agent simulation prompt
│   │   │       ├── desc-eval.ts  # Description evaluation
│   │   │       └── scenario-gen.ts # Auto scenario generation
│   │   │
│   │   ├── test-runner/          # Test execution
│   │   │   ├── runner.ts         # Orchestrates test runs
│   │   │   ├── scenario.ts       # Scenario parser
│   │   │   ├── evaluator.ts      # Result evaluation
│   │   │   └── reporter.ts       # Output formatting
│   │   │
│   │   ├── bench-runner/         # Benchmark execution
│   │   │   ├── runner.ts         # Orchestrates bench runs
│   │   │   ├── metrics.ts        # Metric calculations
│   │   │   ├── scorer.ts         # Agent DX Score
│   │   │   └── comparator.ts     # Version comparison
│   │   │
│   │   ├── scaffolder/           # Project generation
│   │   │   ├── generator.ts      # Template rendering
│   │   │   ├── templates/        # Built-in templates
│   │   │   │   ├── typescript-stdio/
│   │   │   │   ├── typescript-sse/
│   │   │   │   ├── python-stdio/
│   │   │   │   └── openapi-wrapper/
│   │   │   └── openapi.ts        # OpenAPI introspection
│   │   │
│   │   └── registry-client/      # Registry API client
│   │       ├── client.ts         # API calls
│   │       ├── auth.ts           # GitHub OAuth flow
│   │       └── package.ts        # Package upload/download
│   │
│   ├── plugins/                  # Plugin system
│   │   ├── loader.ts             # Plugin discovery + loading
│   │   ├── types.ts              # Plugin interface definitions
│   │   └── hooks.ts              # Lifecycle hooks
│   │
│   └── utils/
│       ├── config.ts             # Config file handling
│       ├── logger.ts             # Structured logging
│       ├── fs.ts                 # File system helpers
│       └── process.ts            # Process management
│
├── templates/                    # Scaffold templates (copied during init)
├── tests/                        # AgentDX's own tests
├── package.json
├── tsconfig.json
└── tsup.config.ts               # Build config
```

---

### 1.3 MCP Client Implementation

The built-in MCP client is the foundation of everything. It must handle all three transports and support the latest spec (2025-11-25).

```typescript
// Simplified interface — the actual implementation wraps the official SDK
interface AgentDXClient {
  // Connection lifecycle
  connect(config: ServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Discovery
  listTools(): Promise<ToolDefinition[]>;
  listResources(): Promise<ResourceDefinition[]>;
  listPrompts(): Promise<PromptDefinition[]>;

  // Execution
  callTool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
  readResource(uri: string): Promise<ResourceContent>;
  getPrompt(name: string, params?: Record<string, string>): Promise<PromptResult>;

  // Observability (unique to AgentDX)
  onToolCall(handler: (call: ToolCallEvent) => void): void;
  onError(handler: (error: MCPError) => void): void;
  getCallHistory(): ToolCallEvent[];
  getMetrics(): ConnectionMetrics;
}

interface ServerConfig {
  transport: 'stdio' | 'sse' | 'streamable-http';

  // stdio
  command?: string;          // e.g. "node"
  args?: string[];           // e.g. ["build/index.js"]
  env?: Record<string, string>;

  // SSE / HTTP
  url?: string;
  headers?: Record<string, string>;

  // Shared
  timeout?: number;          // connection timeout ms
  retries?: number;          // max reconnect attempts
}
```

**Key implementation decisions:**

1. **Wrap the official SDK, don't rewrite.** Use `@modelcontextprotocol/sdk` as the protocol layer. AgentDX adds observability, caching, and the REPL layer on top. This ensures spec compliance without maintaining a second protocol implementation.

2. **Process management for stdio.** When spawning servers via stdio, use `execa` with proper signal handling. The server process must be killed cleanly on REPL exit, test completion, etc. Handle orphaned processes (if AgentDX crashes, the server shouldn't hang around).

3. **Connection pooling for SSE/HTTP.** In `test` and `bench` (which may run multiple scenarios in parallel), reuse connections rather than spawning a new server per scenario.

4. **Call recording.** Every tool call, response, and error is logged to an in-memory buffer (and optionally to disk via `--record`). This powers the `.export` feature (convert session to test scenario) and bench metrics.

---

### 1.4 LLM Adapter Architecture

The LLM adapter handles all AI model interactions: agent simulation in tests, description quality scoring in lint, and the `.ask` REPL command.

```typescript
interface LLMAdapter {
  // Core
  complete(messages: Message[], options?: CompletionOptions): Promise<Completion>;

  // Tool-use specific (for agent simulation)
  agentLoop(config: AgentLoopConfig): AsyncGenerator<AgentStep>;
}

interface AgentLoopConfig {
  task: string;                    // Natural language task description
  tools: ToolDefinition[];         // Available MCP tools
  mcpClient: AgentDXClient;          // To execute tool calls
  maxSteps: number;                // Safety limit
  context?: string[];              // Additional context
  onStep?: (step: AgentStep) => void; // Progress callback
}

interface AgentStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'completion' | 'error';
  content: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  toolResult?: unknown;
  timestamp: number;
}
```

**The Agent Loop is the core algorithm for `test` and `bench`:**

```
1. System prompt: "You are an AI agent. You have these tools: [schemas].
   Accomplish this task. Think step by step. Call tools as needed."

2. User message: task description + optional context

3. Loop:
   a. Send messages to LLM
   b. If LLM returns tool_use → execute via MCP client → add result to messages → goto 3a
   c. If LLM returns text (no tool use) → task is complete or failed
   d. If max_steps reached → mark as timeout
   e. Yield each step to the caller (for progress display and recording)
```

**Cost management is critical.** Running `agentdx bench --runs 20` on a server with 10 scenarios means 200 LLM API calls. At roughly $0.003-0.015 per call (depending on model and tokens), that's $0.60-$3.00 per bench run. The CLI must:
- Show estimated cost before running (`Estimated cost: ~$1.50. Continue? [y/n]`)
- Support `--budget $5.00` to cap spend
- Cache LLM responses for identical inputs (schema + task haven't changed)
- Use cheaper models for non-critical evaluations (description scoring can use Haiku)
- Support Ollama for zero-cost local testing (at reduced quality)

**Prompt engineering matters enormously here.** The agent simulation prompt must be carefully crafted so the LLM uses tools naturally, not just to please the test. This is the single most important piece of IP in the project — it determines whether test results are meaningful.

---

### 1.5 Schema Engine & Lint Rules

The schema engine extracts, parses, and evaluates MCP tool/resource/prompt definitions.

```typescript
interface SchemaAnalysis {
  tools: ToolAnalysis[];
  resources: ResourceAnalysis[];
  prompts: PromptAnalysis[];
  overallScore: number;         // 0-100
  issues: LintIssue[];
}

interface ToolAnalysis {
  name: string;
  schema: ToolDefinition;       // Raw schema from server

  // Quality metrics
  descriptionLength: number;
  descriptionClarity: number;   // 0-100, LLM-evaluated
  parameterCoverage: number;    // % of params with descriptions
  hasExamples: boolean;
  hasErrorDescriptions: boolean;
  constraintCoverage: number;   // % of params with type constraints
  namingScore: number;          // Consistency with conventions

  issues: LintIssue[];
}

interface LintIssue {
  rule: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
  tool?: string;                // Which tool the issue is in
  param?: string;               // Which parameter
  fix?: LintFix;                // Auto-fix if available
}

interface LintFix {
  type: 'replace' | 'add' | 'remove';
  path: string;                 // JSON path to the field
  value?: unknown;              // New value
  description: string;          // Human-readable explanation
}
```

**Rule implementation pattern:**

```typescript
interface LintRule {
  name: string;
  severity: 'error' | 'warn' | 'info';
  description: string;

  // Receives the full server schema, returns issues
  check(analysis: SchemaAnalysis): LintIssue[];

  // Optional: can this rule auto-fix?
  canFix?: boolean;
  fix?(issue: LintIssue, schema: SchemaAnalysis): LintFix;
}
```

Each rule is a separate module, making it easy for plugins to add custom rules. The rule registry loads all built-in rules plus any from `agentdx.config.yaml` and installed plugins.

**The LLM-powered description evaluation** (`description-llm-score`) works like this:

```
Prompt to LLM:
"You are evaluating the quality of an MCP tool description.
A good description helps an AI agent understand:
1. What the tool does (purpose)
2. When to use it vs other tools (differentiation)
3. What each parameter means (clarity)
4. What the output looks like (expectations)

Tool name: search_files
Description: "Searches for files"
Parameters: { path: string, pattern: string }

Score this description 0-100 and explain what's unclear."
```

This score becomes the `descriptionClarity` metric. It's expensive (one LLM call per tool), so it's cached aggressively and only recomputed when descriptions change.

---

### 1.6 Registry Architecture (Cloudflare Stack)

```
┌─────────────────────────────────────────────────────┐
│                  registry.agentdx.dev                    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Cloudflare Pages                    │ │
│  │         (Astro + React frontend)                 │ │
│  │  ┌───────┐ ┌──────────┐ ┌──────────────────┐   │ │
│  │  │Search │ │ Server   │ │ Benchmark        │   │ │
│  │  │ Page  │ │ Detail   │ │ History          │   │ │
│  │  └───────┘ └──────────┘ └──────────────────┘   │ │
│  └─────────────────────────────────────────────────┘ │
│                         │                             │
│  ┌─────────────────────▼───────────────────────────┐ │
│  │           Cloudflare Workers (API)               │ │
│  │                                                   │ │
│  │  Routes:                                          │ │
│  │  GET  /v1/servers          → list/search          │ │
│  │  GET  /v1/servers/:name    → detail + scores      │ │
│  │  POST /v1/servers          → publish (authed)     │ │
│  │  GET  /v1/servers/:name/tools → tool schemas      │ │
│  │  GET  /v1/servers/:name/bench → benchmark data    │ │
│  │  GET  /v1/servers/:name/compat → compatibility    │ │
│  │  POST /v1/auth/github      → OAuth flow           │ │
│  │  GET  /v1/recommend        → capability search    │ │
│  │                                                   │ │
│  └──────────┬───────────┬───────────┬───────────────┘ │
│             │           │           │                  │
│  ┌──────────▼──┐ ┌──────▼──┐ ┌─────▼──────────────┐  │
│  │ D1 Database │ │  R2     │ │ Meilisearch        │  │
│  │ (SQLite)    │ │ Storage │ │ (full-text search)  │  │
│  │             │ │         │ │                     │  │
│  │ - servers   │ │ - .tgz  │ │ - server names     │  │
│  │ - versions  │ │   pkgs  │ │ - descriptions      │  │
│  │ - scores    │ │ - bench │ │ - tool descriptions  │  │
│  │ - users     │ │   data  │ │ - tags              │  │
│  │ - downloads │ │ - docs  │ │                     │  │
│  └─────────────┘ └─────────┘ └─────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**D1 Schema (core tables):**

```sql
-- Servers (one row per server name)
CREATE TABLE servers (
  id          TEXT PRIMARY KEY,          -- e.g. "@agentdx/github"
  name        TEXT NOT NULL,             -- display name
  description TEXT,
  author_id   TEXT REFERENCES users(id),
  repo_url    TEXT,                      -- GitHub link
  license     TEXT,
  visibility  TEXT DEFAULT 'public',     -- public | unlisted | private
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  downloads   INTEGER DEFAULT 0
);

-- Versions (one row per published version)
CREATE TABLE versions (
  id          TEXT PRIMARY KEY,
  server_id   TEXT REFERENCES servers(id),
  version     TEXT NOT NULL,             -- semver
  package_key TEXT NOT NULL,             -- R2 key for .tgz
  readme      TEXT,                      -- rendered markdown
  published_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Quality scores (from agentdx bench at publish time)
  agent_dx_score        REAL,           -- 0-100 composite
  tool_selection_acc     REAL,           -- 0-1
  parameter_acc          REAL,           -- 0-1
  first_try_success      REAL,           -- 0-1
  avg_tool_calls         REAL,
  retry_rate             REAL,           -- 0-1
  description_clarity    REAL,           -- 0-100

  -- Schema snapshot
  tools_json  TEXT,                      -- JSON array of tool schemas
  resources_json TEXT,
  prompts_json TEXT,

  UNIQUE(server_id, version)
);

-- Compatibility matrix
CREATE TABLE compatibility (
  version_id  TEXT REFERENCES versions(id),
  client_name TEXT NOT NULL,             -- "claude-code" | "openclaw" | etc
  status      TEXT NOT NULL,             -- "verified" | "community" | "untested"
  tested_at   TEXT,
  PRIMARY KEY (version_id, client_name)
);

-- Users
CREATE TABLE users (
  id          TEXT PRIMARY KEY,          -- GitHub user ID
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  github_token TEXT,                     -- encrypted
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Download tracking
CREATE TABLE downloads (
  server_id   TEXT REFERENCES servers(id),
  version     TEXT,
  date        TEXT,                      -- YYYY-MM-DD
  count       INTEGER DEFAULT 0,
  PRIMARY KEY (server_id, version, date)
);
```

**Why Cloudflare:**
- **Workers**: Serverless, scales to zero, global edge deployment. Perfect for a registry that starts with 10 req/day and might hit 10K/day.
- **D1**: SQLite at the edge. No server to manage. $5/month for 5GB. More than enough for metadata.
- **R2**: S3-compatible object storage. $0.015/GB/month. Packages + benchmark data.
- **Pages**: Free static hosting. The registry frontend is mostly static with client-side search.
- **Total cost at launch**: ~$0/month (within free tiers). At 10K daily users: ~$20-50/month.

---

### 1.7 Security Model

**Authentication:**
- Registry auth uses GitHub OAuth (standard for dev tools — npm, Vercel, etc.)
- Tokens stored in `~/.agentdx/credentials.json` (encrypted at rest via OS keychain where available)
- No auth required for public server reads
- Publish requires auth + email verification

**Package integrity:**
- Every published package gets a SHA-256 checksum stored in D1
- `agentdx install` verifies checksum before extracting
- Future: sigstore-based package signing

**LLM API keys:**
- Stored in `~/.agentdx/credentials.json` or env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- Never transmitted to the registry
- Never logged to `.agentdx/reports/` or session recordings

**Server sandboxing during tests:**
- `agentdx test` runs the MCP server in a subprocess with constrained env
- No network access by default (configurable via `agentdx.config.yaml`)
- File system access limited to project directory
- Tests that require external services must declare them in scenario files

---

### 1.8 Plugin System

```typescript
interface AgentDXPlugin {
  name: string;
  version: string;

  // Optional hooks
  lintRules?: LintRule[];                    // Custom lint rules
  testGenerators?: TestGenerator[];          // Custom scenario generators
  benchMetrics?: BenchMetric[];              // Custom metrics
  scaffoldTemplates?: ScaffoldTemplate[];    // Custom project templates
  commands?: CLICommand[];                   // Custom CLI commands

  // Lifecycle
  onInit?: (ctx: PluginContext) => Promise<void>;
  onBeforeTest?: (ctx: TestContext) => Promise<void>;
  onAfterTest?: (ctx: TestContext, results: TestResults) => Promise<void>;
  onBeforeBench?: (ctx: BenchContext) => Promise<void>;
  onAfterBench?: (ctx: BenchContext, results: BenchResults) => Promise<void>;
  onBeforePublish?: (ctx: PublishContext) => Promise<void>;
}
```

Plugins are distributed via npm (`agentdx-plugin-*` naming convention) and declared in `agentdx.config.yaml`:

```yaml
plugins:
  - agentdx-plugin-security    # Adds security-focused lint rules
  - agentdx-plugin-openapi     # Enhanced OpenAPI import
  - ./my-custom-plugin      # Local plugin
```

---

### 1.9 Performance Considerations

**CLI startup time** must be under 200ms. This means:
- Lazy-load everything. `agentdx init` shouldn't load the LLM adapter
- Use `tsup` to bundle into a single file (avoid Node module resolution overhead)
- Cache parsed configs in `.agentdx/cache/`

**Test parallelization:**
- Scenarios run in parallel by default (configurable)
- Each parallel scenario gets its own MCP server instance (for stdio) or connection (for SSE/HTTP)
- LLM calls are the bottleneck, not server connections — rate limiting matters

**Benchmark stability:**
- LLM outputs are non-deterministic. Running 10 iterations per scenario and reporting percentiles smooths variance
- Temperature is set to 0 for benchmarks (maximum determinism)
- Cache warming: first run is discarded as warm-up

---

## PART 2: PUBLIC LAUNCH PLAYBOOK

### 2.1 What We Learn From Steinberger

Before the playbook, let's extract the key patterns from the OpenClaw trajectory. Steinberger built 43 projects before one went viral. His approach:

1. **Built for himself first.** OpenClaw started as a personal AI assistant he wanted since April. He wasn't market-testing — he was scratching his own itch.

2. **Shipped absurdly fast.** Prototype in one hour. Functional agent in days. 6,600 commits in January — using AI agents to build the AI agent tool.

3. **Open source from day one.** No freemium, no gating. Full source on GitHub. The community came because they could see everything, fork everything, contribute everything.

4. **Built in public on X.** Every update, every milestone, every funny bug was a tweet. The narrative wasn't "look at my product" — it was "look at what's possible."

5. **Let the community create the viral moment.** He didn't plan MoltBook (the AI social network that went mega-viral). A community member built it on top of OpenClaw. The ecosystem created the virality, not the creator.

6. **Didn't compete on features.** OpenClaw isn't technically novel — the agent loop is the same pattern Claude Code uses. What's novel is the packaging, the accessibility, the vibe. It's "the AI that actually does things."

Now, here's the difference: you're not building a consumer product like OpenClaw. You're building developer infrastructure. The launch mechanics are different.

---

### 2.2 Launch Timeline: 90 Days to Public

```
WEEK 1-2: STEALTH BUILD
├── Working agentdx init + agentdx dev
├── GitHub repo (public from day 1, but no announcement)
├── Set up X account, personal brand positioning
└── Record first demo video (no editing, raw terminal footage)

WEEK 3: SOFT LAUNCH — "Day 0 Post"
├── Publish first tweet: demo video of agentdx init → dev → working server in 60 sec
├── Post to Hacker News (Show HN)
├── Post to r/artificial, r/programming, r/MachineLearning
├── DM 10-15 MCP developers who've been vocal about DX pain points
└── npm publish agentdx@0.1.0-alpha

WEEK 4-5: BUILD LINT + TEST IN PUBLIC
├── Daily/every-other-day X posts showing features being built
├── "Building agentdx test — here's how I'm simulating an AI agent using your tools"
├── Share raw Agent DX Scores for popular MCP servers (creates conversation)
├── Engage every single reply, DM, and issue
└── Write first blog post: "The MCP DX Problem Nobody's Talking About"

WEEK 6-7: BENCH LAUNCH — "The Agent DX Score"
├── Major tweet thread: "I benchmarked 50 MCP servers. Here's how agent-friendly they are."
├── Publish benchmark results as a public leaderboard (creates controversy + sharing)
├── Submit talk proposal to AI/dev conferences
├── Reach out to DevRel at Anthropic — show them the tool, ask for feedback
└── npm publish agentdx@0.2.0-alpha

WEEK 8-10: REGISTRY + PUBLISH
├── Registry goes live with 20-30 seed servers
├── Launch blog post: "AgentDX Registry: Quality-Scored MCP Servers"
├── GitHub Action release for CI/CD
├── Second Hacker News post (deeper technical post)
├── Guest posts on dev blogs (Dev.to, Medium, personal blogs of MCP influencers)
└── npm publish agentdx@0.3.0-beta

WEEK 11-13: COMMUNITY + 1.0
├── Plugin system launch — invite community to build custom rules
├── VS Code extension
├── Docs site launch
├── 1.0 announcement tweet thread + blog post
├── Submit to Product Hunt
└── npm publish agentdx@1.0.0
```

---

### 2.3 Content Strategy

Developer tools live or die on content. Here's the content calendar:

**Recurring content (2-3x per week on X):**

| Type | Example | Purpose |
|---|---|---|
| **Build in public** | "Just shipped agentdx lint --fix. It uses Claude to rewrite bad tool descriptions. Here's before/after:" + screenshot | Shows velocity, creates FOMO |
| **Benchmarks** | "Ran agentdx bench on the official GitHub MCP server. Agent DX Score: 72. Here's what's dragging it down:" | Creates conversation, positions you as authority |
| **Pain point resonance** | "Spent 45 minutes connecting a new MCP server to Claude Code. Got a cryptic error. This is why I'm building agentdx." | Builds empathy with target audience |
| **Tips** | "TIL: if your MCP tool description is under 20 chars, Claude picks the wrong tool 40% of the time. Here's the data:" | Establishes expertise, provides value |
| **Community shoutout** | "Someone just published a agentdx plugin that adds security scanning to lint. This is exactly what the ecosystem needs." | Encourages contributions |

**Long-form content (bi-weekly):**

1. **"The MCP DX Problem Nobody's Talking About"** — Foundational post. Shows the pain, quantifies it, introduces AgentDX as the solution. This is the post you link in every conversation.

2. **"I Benchmarked 50 MCP Servers and Here's What I Found"** — Data-driven post with the Agent DX Score leaderboard. Tag the server authors. Some will be proud (high scores), some will want to fix things (low scores). Both outcomes drive adoption.

3. **"How to Build a Production-Ready MCP Server in 5 Minutes"** — Tutorial that naturally uses agentdx init, dev, lint, test. Becomes the default answer to "how do I build an MCP server?"

4. **"From 45 to 92: How We Improved Our MCP Server's Agent DX Score"** — Case study showing iterative improvement using agentdx bench. Shows the tool's value over time, not just for setup.

5. **"The Architecture of AgentDX"** — Deep technical post for Hacker News. Shows the agent simulation system, the scoring algorithm, the registry design. Attracts serious engineers.

---

### 2.4 Distribution Channels

**Tier 1 — Direct reach (you control these):**

| Channel | Action | Timing |
|---|---|---|
| **X (Twitter)** | Primary platform. Build in public. All announcements here first. | Day 1 onward |
| **GitHub** | Stellar README with animated GIF demo. Contributing guide. Issue templates. | Day 1 onward |
| **npm** | Package published, discoverable via `npx agentdx` | Week 3 |
| **Personal blog** | Technical deep-dives, architecture posts | Week 4 onward |
| **YouTube** | 2-3 minute demo videos. Raw, no polish. Terminal screen recordings. | Week 3 onward |

**Tier 2 — Community amplification (you participate, they amplify):**

| Channel | Action | Timing |
|---|---|---|
| **Hacker News** | Show HN at soft launch + technical post at bench launch | Week 3 + Week 7 |
| **Reddit** | r/artificial, r/MachineLearning, r/programming | Week 3 |
| **Dev.to / Hashnode** | Cross-post technical blog content | Week 5 onward |
| **Discord servers** | MCP community, OpenClaw Discord, Claude community, Cursor community | Week 3 onward |
| **Stack Overflow** | Answer MCP-related questions, naturally reference agentdx | Week 5 onward |

**Tier 3 — Strategic outreach (requires relationship building):**

| Channel | Action | Timing |
|---|---|---|
| **Anthropic DevRel** | Share the tool, ask for feedback, propose inclusion in MCP docs | Week 6 |
| **MCP newsletter / blog** | Pitch a guest post or feature | Week 8 |
| **Dev podcasts** | Pitch appearances on AI/dev-focused podcasts | Week 8 onward |
| **Conference talks** | Submit CFPs to AI Engineer Summit, Node Congress, etc. | Week 7 onward |
| **MCP server authors** | DM authors of popular servers. "I benchmarked your server, here's your score" | Week 6 onward |

---

### 2.5 The Benchmark Leaderboard as a Growth Engine

This is the single most powerful growth mechanism. Here's how it works:

1. **You run `agentdx bench` on the top 50 MCP servers in the official registry.**
2. **You publish results as a public leaderboard on the registry site.**
3. **You tweet the results, tagging server authors.**

This creates three types of engagement:

- **Proud authors** (score > 85): They share their score as a badge. "Our GitHub MCP server scored 92 on Agent DX!" Free marketing for you.
- **Competitive authors** (score 60-85): They want to improve. They install agentdx, run bench themselves, iterate on descriptions. This is your core adoption loop.
- **Embarrassed authors** (score < 60): Some will be annoyed, but most will appreciate knowing their server is hard for agents to use. They become advocates once they improve.

**The leaderboard also attracts attention from the platforms.** When you score Anthropic's own MCP servers and show room for improvement, their DevRel team notices. When you score popular community servers that OpenClaw users rely on, the OpenClaw community notices.

**Update the leaderboard monthly.** Each update is a content moment: "MCP Server Quality Report — February 2026. Average Agent DX Score rose from 64 to 71. Here are the biggest improvers."

---

### 2.6 The Anthropic Relationship

Anthropic created MCP. They donated it to the Linux Foundation's Agentic AI Foundation. They want the ecosystem to thrive. AgentDX directly helps this by improving the quality of MCP servers in the ecosystem.

**How to approach them:**

1. **Don't ask for anything initially.** Just build, ship, and share publicly. Let them discover you.
2. **Week 6: Send a cold DM/email to someone on the MCP team** (David Soria Parra, Justin Spahr-Summers, or their DevRel). Say: "I built this tool that benchmarks MCP server quality. Here are scores for your official servers. Thought you'd find it interesting." Include a link and a 30-second video.
3. **Week 8: Offer to write a guest post** for the MCP blog or docs. "How to Build a Production-Ready MCP Server with AgentDX" — this gets you into their official documentation flow.
4. **Week 12: Propose an official integration.** "What if the MCP Registry showed Agent DX Scores for every server? We have the scoring infrastructure." This is the conversation that leads to "maybe we should just hire this person" or "let's acquire this tool."

**Critical: never position AgentDX as competing with Anthropic's tools.** MCP Inspector is their debugging tool. AgentDX is the quality/lifecycle tool that sits on top. Complementary, not competitive.

---

### 2.7 Community Building

**Discord server** — Launch a small Discord from Week 3. Channels:

- `#announcements` — New releases
- `#help` — Setup questions
- `#showcase` — People sharing their bench scores and published servers
- `#plugins` — Plugin development
- `#feedback` — Feature requests and bug reports
- `#random` — Off-topic, memes, vibes

**GitHub as community hub:**
- Issues as the primary feedback channel (better than Discord for trackable conversations)
- Discussions tab for RFCs and feature proposals
- Good first issues labeled for new contributors
- Monthly "contributor spotlight" in the README

**Don't over-invest in community early.** Discord is a distraction if you have 15 members. Focus on shipping, let the community form organically around the work. Community management becomes important at 200+ members.

---

### 2.8 Metrics & Milestones

**Week 3 (Soft Launch) success looks like:**
- 50+ GitHub stars
- 100+ npm downloads
- 5+ meaningful GitHub issues (feature requests, bug reports)
- 1+ external tweet mentioning agentdx

**Week 7 (Bench Launch) success looks like:**
- 500+ GitHub stars
- 1,000+ npm downloads
- HN front page (at least once)
- 20+ GitHub issues/PRs
- DevRel contact from at least one major AI company
- 5+ servers being built/tested with agentdx

**Week 13 (1.0 Launch) success looks like:**
- 2,000+ GitHub stars
- 5,000+ npm downloads
- 50+ registered servers in the registry
- 10+ community contributors
- Featured in MCP docs or newsletter
- First inbound from an AI company ("let's talk")

**"Escape velocity" signal:**
When server authors start putting "Agent DX Score: 87" badges in their READMEs unprompted, you've won. At that point, the tool markets itself.

---

### 2.9 Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Anthropic builds something similar** | Medium | High | Be first, move fast. If they build their own, they'll likely want to acquire rather than compete if you have community traction. Also: AgentDX is model-agnostic, their tool wouldn't be. |
| **mcptools or similar tool adds features that overlap** | Medium | Medium | Focus on the bench/score angle. Nobody else is building quantitative agent-friendliness scoring. That's the moat. |
| **LLM costs make test/bench too expensive for adoption** | Medium | Medium | Ollama support as zero-cost alternative. Aggressive caching. Sonnet for testing, Haiku for linting. Free tier with shared key for basic lint scoring. |
| **Agent DX Score is gamed / not meaningful** | Low | High | Transparent methodology. Publish the scoring algorithm. Run adversarial testing on the score itself. Iterate based on community feedback. |
| **Low adoption / nobody cares** | Medium | High | This is the biggest risk. Mitigation: the leaderboard creates conversation even if adoption is low. Benchmarking popular servers gets attention regardless of tool downloads. |
| **Burnout (solo project)** | High | High | Scope aggressively. Phase 0 + 1 must be achievable in 5 weeks part-time. Don't build the registry until the core CLI has proven traction. |

---

### 2.10 Decision: Name & Branding

The name needs to be:
- Short (4-6 chars for a CLI command)
- Available on npm
- Memorable
- Related to MCP or developer tooling
- Not confusing with existing tools

**Options:**

| Name | npm available? | CLI command | Vibe |
|---|---|---|---|
| `agentdx` | Needs checking | `agentdx init` | Clean, extends MCP, "x" implies extended/extra |
| `forge` | Likely taken | `forge init` | Strong, evokes craftsmanship |
| `mcp-forge` | Likely available | `mcp-forge init` | Clear but long |
| `anvil` | Needs checking | `anvil init` | Same craftsmanship vibe, shorter |
| `probe` | Needs checking | `probe init` | Evokes testing/inspection |
| `mcpkit` | Likely available | `mcpkit init` | Clear, "toolkit" |
| `dxo` | Needs checking | `dxo init` | "Developer Experience Orchestrator" |

**Recommendation:** `agentdx` if available. It's the clearest signal of what the tool does ("MCP, extended"). If unavailable, `forge` or `anvil` for the craftsmanship angle.

**Logo direction:** Whatever you pick, the logo should be simple and terminal-friendly (it'll show up in ASCII art at CLI startup). Think of how `npm`, `pnpm`, and `bun` handle their branding — minimal, functional, recognizable in monospace.

---

### 2.11 Budget Estimate (First 90 Days)

| Item | Cost | Notes |
|---|---|---|
| **Cloudflare** | $0-5/month | Within free tiers initially |
| **Anthropic API** (development + benchmarking) | $50-150/month | For building and running benchmarks |
| **Domain** | $12/year | agentdx.dev or similar |
| **Meilisearch Cloud** | $0-30/month | Free tier covers early usage |
| **Total first 90 days** | ~$200-500 | Extremely capital-efficient |

No employees. No infrastructure. No VC needed. This is a bootstrapped, zero-overhead project — exactly the kind that gets noticed by companies looking to acqui-hire.

---

*Last updated: February 16, 2026*
*Status: Ready for execution*
