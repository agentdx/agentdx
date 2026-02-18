# AgentDX — Architecture

> Internal technical architecture for the lint and bench engines.

**Version:** 0.2.0
**Last updated:** 2026-02-17

---

## 1. System Overview

AgentDX has two core engines and a shared infrastructure layer:

```
┌──────────────┐     ┌──────────────┐
│  agentdx     │     │  agentdx     │
│  lint        │     │  bench       │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
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

Both lint and bench need to connect to the user's MCP server to discover tools. They share the core MCP client module.

---

## 2. Core Layer

### 2.1 MCP Client (`src/core/mcp-client.ts`)

This is the shared module that both `dev`, `lint`, and `bench` use. It:

1. Spawns the MCP server as a child process
2. Connects as an MCP client using `@modelcontextprotocol/sdk`'s `Client` class
3. Calls `tools/list` to discover all tools
4. Returns a structured `ServerConnection` object

```typescript
interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: JSONSchema;
}

interface ServerConnection {
  tools: ToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  close: () => Promise<void>;
}

// Usage
const conn = await connectToServer({ entry: 'src/index.ts', transport: 'stdio' });
console.log(conn.tools); // [{ name: "get_weather", description: "...", inputSchema: {...} }]
await conn.close();
```

**Important**: The `dev` command already has this logic. Phase 1 starts by extracting it into this shared module.

### 2.2 Config & Auto-detect (`src/core/config.ts`, `src/core/detect.ts`)

**Config loading:**

- Parse `agentdx.config.yaml` with `yaml` package
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
  language: 'typescript' | 'javascript' | 'python';
  lint: LintConfig;
  bench: BenchConfig;
}

async function resolveConfig(cliFlags?: Partial<CliFlags>): Promise<ResolvedConfig>;
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

Each lint rule is a pure function:

```typescript
interface LintResult {
  ruleId: string;
  severity: 'error' | 'warn' | 'info';
  tool: string; // which tool triggered it
  message: string; // human-readable explanation
  suggestion?: string; // how to fix it
  fixable?: boolean; // can --fix handle this?
}

interface LintRule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: 'error' | 'warn' | 'info';
  run: (tools: ToolDefinition[], config: LintConfig) => LintResult[];
}
```

Rules are registered in a central registry:

```typescript
// src/lint/rules/index.ts
export const allRules: LintRule[] = [
  ...descriptionRules,
  ...schemaRules,
  ...namingRules,
  ...errorRules,
];
```

This makes it easy to add new rules later and to let users disable/configure individual rules.

### 3.3 Lint Score Calculation

The lint score is deterministic — same input always produces same score. No LLM involved.

```typescript
function calculateLintScore(results: LintResult[], totalTools: number): number {
  // Start at 100, deduct points
  let score = 100;

  for (const result of results) {
    switch (result.severity) {
      case 'error':
        score -= 10;
        break;
      case 'warn':
        score -= 3;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}
```

### 3.4 Formatters

Three output formats, all implementing the same interface:

```typescript
interface LintFormatter {
  format(results: LintResult[], score: number, metadata: LintMetadata): string;
}
```

- **TextFormatter**: Colored terminal output with grouping and summary
- **JsonFormatter**: Structured JSON for programmatic consumption
- **SarifFormatter**: SARIF v2.1.0 for GitHub Code Scanning integration

---

## 4. Bench Engine

### 4.1 Architecture

```
agentdx bench
    │
    ▼
┌─────────────┐     ┌──────────────┐
│ Connect to  │────▶│ Get tools    │
│ MCP server  │     │ list         │
└─────────────┘     └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Generate or  │
                    │ load         │
                    │ scenarios    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ For each     │──── LLM API call
                    │ scenario:    │◀─── (tool_use response)
                    │ evaluate     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Score +      │
                    │ report       │
                    └──────────────┘
```

### 4.2 Scenario Generator (`src/bench/scenarios/generator.ts`)

Auto-generates test scenarios from tool definitions using an LLM.

**Input**: Array of `ToolDefinition` objects
**Output**: Array of `BenchScenario` objects

```typescript
interface BenchScenario {
  id: string;
  task: string; // Natural language task
  expectedTool: string | null; // Expected tool (null = should refuse)
  expectedParams?: Record<string, unknown>;
  tags: string[]; // "positive", "negative", "ambiguous", "multi-tool"
  difficulty: 'easy' | 'medium' | 'hard';
}
```

**Generation strategy:**

For each tool, generate:

- 2 straightforward positive scenarios (easy — clear match to this tool)
- 1 scenario with all optional params (medium — tests parameter filling)
- 1 ambiguous scenario (medium — could be this tool or another)
- 1 negative scenario (hard — sounds related but no tool should be used)

For multi-tool servers:

- 2 multi-step scenarios requiring multiple tool calls
- 1 scenario requiring the LLM to pick between similar tools

The generator uses a single LLM call with a structured prompt that returns JSON.

### 4.3 Scenario Loader (`src/bench/scenarios/loader.ts`)

Loads custom scenarios from a YAML file. Validates against the `BenchScenario` schema using zod.

### 4.4 LLM Adapter (`src/bench/llm/adapter.ts`)

Abstract interface for LLM providers:

```typescript
interface LLMAdapter {
  chat(params: {
    system: string;
    messages: Message[];
    tools: ToolDefinition[];
    temperature: number;
  }): Promise<LLMResponse>;

  estimateCost(inputTokens: number, outputTokens: number): number;
}

interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}
```

**Implementations:**

- **AnthropicAdapter** (`anthropic.ts`): Uses `@anthropic-ai/sdk`. Claude models natively support `tool_use` — AgentDX sends tools in Anthropic's tool format and reads back `tool_use` content blocks.

- **OpenAIAdapter** (`openai.ts`): Uses `openai` SDK. Converts MCP tool schemas to OpenAI function calling format. Works with GPT-4o, GPT-4-turbo, etc.

- **OllamaAdapter** (`ollama.ts`): Uses `openai` SDK pointed at `http://localhost:11434/v1`. Same interface as OpenAI but local. Free, no API key needed.

**Key design decision**: The adapter only handles the LLM API call. It does NOT execute the actual MCP tools. The bench engine examines the LLM's **intent** (which tool it would call with what params) without actually calling the tools. This is faster, cheaper, and avoids side effects.

### 4.5 Evaluators

Each evaluator scores one dimension of the Agent DX Score:

```typescript
interface EvaluatorResult {
  dimension: string;
  score: number; // 0-100
  weight: number; // how much this matters in the overall score
  details: EvalDetail[]; // per-scenario breakdown
}

interface EvalDetail {
  scenarioId: string;
  passed: boolean;
  expected: string;
  actual: string;
  note?: string;
}

interface Evaluator {
  dimension: string;
  weight: number;
  evaluate(scenarios: BenchScenario[], responses: LLMResponse[]): EvaluatorResult;
}
```

**Tool Selection Evaluator** (weight: 35%)

- Compares `response.toolCalls[0].name` with `scenario.expectedTool`
- Handles: correct, wrong, hallucinated, correct refusal

**Parameter Evaluator** (weight: 30%)

- Deep comparison of `response.toolCalls[0].arguments` with `scenario.expectedParams`
- Checks: all required present, correct types, valid enum values
- Partial credit for close-but-not-exact (e.g., "new york" vs "New York")

**Ambiguity Evaluator** (weight: 15%)

- Only runs on scenarios tagged `ambiguous`
- Checks if LLM asked for clarification or made a reasonable default choice
- Penalizes silent wrong guesses

**Multi-tool Evaluator** (weight: 10%)

- Only runs on scenarios tagged `multi-tool`
- Checks if LLM made correct sequence of tool calls
- Validates data flow between calls

**Error Recovery Evaluator** (weight: 10%)

- After initial eval, simulates tool error responses
- Checks if LLM retries with corrected params or explains the error
- This requires a second LLM call (more expensive, can be skipped with `--skip-error-recovery`)

### 4.6 Score Calculation (`src/bench/score.ts`)

```typescript
function calculateDXScore(evaluatorResults: EvaluatorResult[]): DXScore {
  const weightedScore = evaluatorResults.reduce((sum, r) => sum + r.score * r.weight, 0);

  const totalWeight = evaluatorResults.reduce((sum, r) => sum + r.weight, 0);

  const overall = Math.round(weightedScore / totalWeight);

  return {
    overall,
    rating: scoreToRating(overall),
    dimensions: evaluatorResults,
    topIssues: extractTopIssues(evaluatorResults),
  };
}
```

### 4.7 Consistency via Multiple Runs

LLMs are non-deterministic even at temperature 0. AgentDX runs each scenario N times (default 3) and takes the majority result.

```typescript
// For each scenario, run N times
const runs = await Promise.all(
  Array.from({ length: config.runs }, () =>
    adapter.chat({ ... })
  )
);

// Majority vote for tool selection
const selectedTools = runs.map(r => r.toolCalls[0]?.name ?? null);
const majorityTool = mode(selectedTools); // most common value
```

---

## 5. Data Flow: Full Bench Run

```
1. Resolve config (auto-detect or load yaml)
2. Spawn MCP server, connect, list tools
3. Disconnect from server (we only need tool metadata from here)
4. Generate scenarios (or load from file)
   └── 1 LLM call to generate ~20 scenarios
5. Estimate cost, ask for confirmation
6. For each scenario × N runs:
   └── 1 LLM call with tools + task
       └── Parse tool_use response
7. Run evaluators on all responses
8. Calculate overall DX Score
9. Generate top issues (actionable recommendations)
10. Format and display output
```

**Total LLM calls per bench run:**

- 1 for scenario generation
- (scenarios × runs) for evaluation
- (error scenarios × runs) for error recovery (optional)

Example: 20 scenarios × 3 runs = 61 LLM calls. At Claude Sonnet pricing (~$0.003/call), that's ~$0.18.

---

## 6. Architecture Boundaries

### Rules

1. **`src/cli/` never imports from `src/lint/` or `src/bench/` internals** — only the command functions
2. **`src/lint/` and `src/bench/` never import from each other** — fully independent engines
3. **`src/core/` never imports from `src/cli/`, `src/lint/`, or `src/bench/`** — pure shared utilities
4. **All LLM calls go through the adapter** — never call `@anthropic-ai/sdk` directly from evaluators
5. **Lint rules are pure functions** — no side effects, no network calls, no file I/O
6. **Evaluators are pure functions** — take scenarios + responses, return scores

### Dependency direction

```
cli/ → commands import from lint/ and bench/
lint/ → imports from core/
bench/ → imports from core/
core/ → imports from node_modules only
```

### Error handling

- Network/LLM errors: Catch, explain clearly, suggest fix (missing API key, Ollama not running, etc.)
- Server spawn errors: Show stderr output, suggest checking the entry point
- Schema errors: Show exactly what's wrong, with file/line if possible
- Always exit with appropriate code (0 success, 1 lint errors, 2 system errors)

---

## 7. Testing Strategy

### Unit tests (Vitest)

- **Lint rules**: Test each rule with fixture tool definitions. These are the easiest tests — pure functions with known inputs/outputs.
- **Evaluators**: Test with mock LLM responses. No actual LLM calls.
- **Score calculation**: Deterministic, test with known inputs.
- **Config resolution**: Test auto-detection with various project structures.

### Integration tests

- **Lint command**: Scaffold a test MCP server, run `agentdx lint`, assert output.
- **Bench command**: Use a mock LLM adapter that returns predetermined responses. Test the full pipeline without real LLM calls.

### Fixture servers

Create small MCP server fixtures for testing:

```
tests/fixtures/
├── good-server/          # Well-built server (should score high)
├── bad-server/           # Poorly built server (should score low)
├── no-descriptions/      # Tools with missing descriptions
├── ambiguous-tools/      # Tools with overlapping names/descriptions
└── single-tool/          # Minimal server with one tool
```

### LLM tests (optional, expensive)

A small set of tests that actually call the LLM. Run only in CI with real API keys. These are smoke tests, not unit tests — they verify the adapter works, not the scoring logic.

```bash
# Run without LLM (fast, free)
npm test

# Run with real LLM calls (slow, costs money)
AGENTDX_INTEGRATION=true npm test
```

---

## 8. Build & Release

### Build

```bash
npm run build    # tsup → dist/index.js (ESM, node22 target)
npm run dev      # tsx for local development
npm test         # Vitest
npm run typecheck # tsc --noEmit
```

### Publishing

```bash
# Bump version
npm version patch  # or minor / major

# Publish
npm publish --access public

# For prereleases
npm version 0.2.0-alpha.1
npm publish --access public --tag alpha
```

### Version strategy

- `0.1.x` — Current (Phase 0, init/dev only)
- `0.2.0` — Phase 1 complete (lint working)
- `0.3.0` — Phase 2 complete (bench working)
- `1.0.0` — Both lint and bench stable, zero-config works reliably
