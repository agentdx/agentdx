# AgentDX — Architecture

> Internal technical architecture for the lint engine.

**Version:** 0.3.0
**Last updated:** 2026-02-18

---

## 1. System Overview

AgentDX is a linter for MCP servers. It connects to a server, discovers tools, runs 30 lint rules, and produces a score.

```
┌──────────────┐
│  agentdx     │
│  lint        │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│         Core Layer               │
│  ┌──────────┐ ┌───────────────┐  │
│  │ MCP      │ │ Config /      │  │
│  │ Client   │ │ Auto-detect   │  │
│  └──────────┘ └───────────────┘  │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│      MCP Server (user's)         │
│      Spawned as child process    │
└──────────────────────────────────┘
```

---

## 2. Core Layer

### 2.1 MCP Client (`src/core/mcp-client.ts`)

Shared module used by `dev` and `lint`. It:

1. Spawns the MCP server as a child process
2. Connects as an MCP client using `@modelcontextprotocol/sdk`'s `Client` class
3. Calls `tools/list` to discover all tools
4. Returns a structured `ServerConnection` object

```typescript
interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

interface ServerConnection {
  tools: ToolDefinition[];
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
  close(): Promise<void>;
}
```

### 2.2 Config & Auto-detect (`src/core/config.ts`, `src/core/detect.ts`)

**Config loading:**

- Parse `agentdx.config.yaml` or `.agentdxrc.json`
- Validate with zod schema
- Merge with CLI flags (CLI flags win)
- All config is optional — everything has sensible defaults

**Auto-detection:**

- Entry point: walk the priority list (config → package.json → common files)
- Transport: scan entry file for transport class imports
- Language: check file extension (.ts → TypeScript, .py → Python, .js → JavaScript)

```typescript
interface ResolvedConfig {
  entry: string;
  transport: 'stdio' | 'sse';
  server?: { name?: string };
  lint: {
    rules: Record<string, string | number | boolean>;
  };
}
```

---

## 3. Lint Engine

### 3.1 Architecture

```
agentdx lint
    │
    ▼
┌─────────────┐     ┌──────────────┐
│ Connect to  │────▶│ Get tools    │
│ MCP server  │     │ list         │
└─────────────┘     └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Run all      │
                    │ lint rules   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Calculate    │
                    │ lint score   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Format       │
                    │ output       │
                    └──────────────┘
```

### 3.2 Rule System

Each lint rule is a pure function implementing the `LintRule` interface:

```typescript
interface LintRule {
  id: string;
  description: string;
  severity: 'error' | 'warn' | 'info';
  check(tools: ToolDefinition[]): LintIssue[];
}

interface LintIssue {
  rule: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
  tool?: string;
  param?: string;
  fix?: string;
  docs?: string;
}
```

Rules are registered in a central registry:

```typescript
// src/lint/rules/index.ts
export const allRules: LintRule[] = [
  ...descriptionRules, // 10 rules
  ...schemaRules, // 11 rules
  ...namingRules, // 4 rules
  ...compatibilityRules, // 4 rules — new in 0.3.0, previously "errors"
];
```

### 3.3 Rule Categories (30 rules)

**Description Quality (10)**

- `desc-exists` (error) — tool has a description
- `desc-min-length` (warn) — at least 20 characters
- `desc-max-length` (warn) — under 200 characters
- `desc-action-verb` (warn) — starts with a verb
- `desc-clarity` (info) — no vague terms
- `desc-unique` (warn) — no near-identical descriptions
- `description-states-purpose` (warn) — clearly states what the tool does
- `description-includes-usage-guidance` (info) — explains when/how to use
- `description-states-limitations` (info) — mentions constraints or caveats
- `description-has-examples` (info) — complex tools include example inputs

**Schema & Parameters (11)**

- `schema-exists` (error) — tool defines an input schema
- `schema-valid` (error) — schema type is "object"
- `schema-param-desc` (warn) — every parameter has a description
- `schema-required` (warn) — required parameters are marked
- `schema-enum-bool` (info) — suggests enums over booleans
- `schema-no-any` (warn) — every parameter has a type
- `schema-defaults` (info) — optional parameters document defaults
- `param-enum-documented` (warn) — enum values explained in description
- `param-default-documented` (info) — defaults mentioned in description
- `schema-not-too-deep` (warn) — nesting depth ≤ 3
- `schema-no-excessive-params` (warn) — ≤ 10 parameters

**Naming Conventions (4)**

- `name-convention` (warn) — consistent naming style
- `name-verb-noun` (info) — follows verb_noun pattern
- `name-unique` (error) — no duplicate tool names
- `name-prefix` (info) — related tools share a prefix

**Provider Compatibility (4)**

- `openai-tool-count` (warn/error) — warns >20 tools, errors >128
- `openai-name-length` (error) — names ≤ 64 characters
- `openai-name-pattern` (error) — names match `/^[a-zA-Z0-9_-]+$/`
- `name-not-ambiguous` (warn) — no generic names like "search", "get", "run"

### 3.4 Lint Score Calculation

The score is a rule-based pass rate weighted by severity:

```typescript
function calculateLintScore(issues: LintIssue[]): number {
  // Group by rule, track worst severity per rule
  const ruleWorstSeverity = new Map<string, 'error' | 'warn' | 'info'>();
  for (const issue of issues) {
    const current = ruleWorstSeverity.get(issue.rule);
    if (!current || severityWeight(issue.severity) > severityWeight(current)) {
      ruleWorstSeverity.set(issue.rule, issue.severity);
    }
  }

  // Calculate weighted deductions: error=3, warn=2, info=1
  let deduction = 0;
  for (const severity of ruleWorstSeverity.values()) {
    deduction += severityWeight(severity);
  }

  // Normalize: max deduction = totalRules * 3
  const score = Math.round(100 * (1 - deduction / (totalRules * 3)));
  return Math.max(0, Math.min(100, score));
}
```

Key properties:

- **Deterministic** — same input always produces same score, no LLM involved
- **Per-rule, not per-issue** — multiple issues from the same rule count once
- **Severity-weighted** — errors hurt more than warnings, which hurt more than info
- **Normalized** — servers of any size are scored on the same 0-100 scale

### 3.5 Formatters

Three output formats, all rendering the same `LintResult`:

- **Pretty** (default): Colored terminal output with grouping and summary
- **JSON**: Structured JSON with score, issues, and tool list
- **SARIF**: SARIF v2.1.0 for GitHub Code Scanning integration

---

## 4. Architecture Boundaries

### Rules

1. **`src/cli/` never imports from `src/lint/` internals** — only the command entry functions
2. **`src/core/` never imports from `src/cli/` or `src/lint/`** — pure shared utilities
3. **Lint rules are pure functions** — no side effects, no network calls, no file I/O

### Dependency direction

```
cli/ → commands import from lint/
lint/ → imports from core/
core/ → imports from node_modules only
```

### Error handling

- Server spawn errors: Show stderr output, suggest checking the entry point
- Schema errors: Show exactly what's wrong
- Always exit with appropriate code (0 success, 1 lint errors, 2 warnings only)

---

## 5. Testing Strategy

### Unit tests (Vitest)

- **Lint rules**: Test each rule with fixture tool definitions. Pure functions with known inputs/outputs.
- **Score calculation**: Deterministic, test with known inputs.
- **Config resolution**: Test auto-detection with various project structures.
- **Engine**: Test rule execution, severity overrides, and disabling rules.

### Real-server validation

Fixture files in `tests/fixtures/real-servers/` contain actual tool definitions from popular MCP servers:

- `filesystem.json` — @modelcontextprotocol/server-filesystem (14 tools)
- `everything.json` — @modelcontextprotocol/server-everything (18 tools)
- `fetch.json` — @modelcontextprotocol/server-fetch (1 tool)
- `playwright.json` — @playwright/mcp (19 tools)

These are validated via `scripts/test-real-servers.ts` to catch false positives.

### Test structure

```
tests/
├── cli/commands/        # Command integration tests
├── core/                # Config and detect tests
├── lint/
│   ├── engine.test.ts   # Rule engine tests
│   ├── formatters.test.ts
│   ├── score.test.ts
│   └── rules/           # Per-category rule tests
└── fixtures/
    └── real-servers/     # JSON fixtures from real MCP servers
```

---

## 6. Build & Release

### Build

```bash
npm run build      # tsup → dist/index.js (ESM, node22 target)
npm run dev        # tsx for local development
npm test           # Vitest (136 tests)
npm run typecheck  # tsc --noEmit
npm run lint:code  # eslint + prettier
```

### Publishing

```bash
npm version 0.3.0-alpha.2
npm publish --access public --tag alpha
```
