# Skill: /implement

## When to use
When building a new lint rule, evaluator, or command feature.

## Workflow
1. Read docs/SPEC.md for the feature being implemented
2. Read docs/ARCHITECTURE.md for structural constraints
3. Check existing code in the relevant directory for patterns
4. Implement the feature following existing patterns
5. Write unit tests alongside (lint rules need fixture-based tests, evaluators need mock responses)
6. Run `npm run typecheck` — must pass
7. Run `npm test` — must pass
8. If a lint rule: ensure it's registered in `src/lint/rules/index.ts`
9. If an evaluator: ensure it's registered in the bench engine

## Patterns
- Lint rules: export a `LintRule` object with `id`, `name`, `defaultSeverity`, `run(tools, config) → LintResult[]`
- Evaluators: export an `Evaluator` object with `dimension`, `weight`, `evaluate(scenarios, responses) → EvaluatorResult`
- Both are pure functions — no side effects
