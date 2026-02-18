# Contributing to AgentDX

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- Node.js 22+
- git

## Development Setup

```bash
# Fork and clone
git clone https://github.com/<your-username>/agentdx.git
cd agentdx

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck
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

These boundaries are enforced by convention and code review:

1. `core/` never imports from `cli/`, `lint/`, or `bench/`
2. `lint/` and `bench/` never import from each other
3. `cli/` only imports command entry functions, not internals
4. All LLM calls go through `bench/llm/adapter.ts` — never call SDKs directly from evaluators
5. Lint rules are pure functions — no side effects, no I/O
6. Evaluators are pure functions — take inputs, return scores

## Code Style

- **ESM only** — `import`/`export`, no `require`
- **No classes** unless stateful — lint rules and evaluators are plain functions
- **TypeScript strict mode** — no `any`, no implicit returns
- **Errors** — catch at command level, show human-readable message, exit with code

## How to Add a New Lint Rule

1. Choose the appropriate category file in `src/lint/rules/`:
   - `descriptions.ts` — tool description quality
   - `schemas.ts` — input schema validation
   - `naming.ts` — naming conventions
   - `errors.ts` — error handling patterns

2. Write the rule as a pure function:

```typescript
export const myNewRule: LintRule = {
  id: 'my-rule-id',
  name: 'My Rule Name',
  description: 'What this rule checks',
  defaultSeverity: 'warn',
  run(tools, config) {
    const results: LintResult[] = [];
    for (const tool of tools) {
      if (/* problem detected */) {
        results.push({
          ruleId: 'my-rule-id',
          severity: 'warn',
          tool: tool.name,
          message: 'What went wrong',
          suggestion: 'How to fix it',
        });
      }
    }
    return results;
  },
};
```

3. Register it in `src/lint/rules/index.ts`
4. Add tests in `tests/lint/rules/`

## How to Add a New Evaluator

1. Create a new file in `src/bench/evaluators/`
2. Implement the `Evaluator` interface:

```typescript
export const myEvaluator: Evaluator = {
  dimension: 'my-dimension',
  weight: 0.10,
  evaluate(scenarios, responses) {
    return {
      dimension: 'my-dimension',
      score: calculatedScore,
      weight: 0.10,
      details: perScenarioResults,
    };
  },
};
```

3. Register it in the bench engine (`src/bench/engine.ts`)
4. Add tests in `tests/bench/evaluators/`

## How to Add a New LLM Provider

1. Create a new file in `src/bench/llm/` (e.g., `my-provider.ts`)
2. Implement the `LLMAdapter` interface:

```typescript
export class MyProviderAdapter implements LLMAdapter {
  async chat(params: ChatParams): Promise<LLMResponse> {
    // Call your LLM API...
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Return estimated cost in dollars
  }
}
```

3. Add the provider to the factory in `src/bench/llm/adapter.ts`
4. Add tests in `tests/bench/llm/`

## Pull Request Guidelines

### Before submitting

- Run `npm test` — all tests must pass
- Run `npm run typecheck` — no type errors
- Run `npm run build` — build must succeed

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new lint rule for param ordering
fix: handle empty tool list in bench engine
docs: update README with new CLI flags
test: add tests for ambiguity evaluator
```

### PR checklist

- [ ] Tests pass (`npm test`)
- [ ] Type check clean (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] No `console.log` left in production code
- [ ] New features have tests
- [ ] Breaking changes documented

## Issue Reporting

- **Bugs**: Use the [bug report template](https://github.com/agentdx/agentdx/issues/new?template=bug_report.md)
- **Features**: Use the [feature request template](https://github.com/agentdx/agentdx/issues/new?template=feature_request.md)

## Questions?

Open a [discussion](https://github.com/agentdx/agentdx/discussions) or file an issue.
