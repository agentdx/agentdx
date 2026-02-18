# Skill: /implement

## When to use

When building a new lint rule or command feature.

## Workflow

1. Read docs/SPEC.md for the feature being implemented
2. Read docs/ARCHITECTURE.md for structural constraints
3. Check existing code in the relevant directory for patterns
4. Implement the feature following existing patterns
5. Write unit tests alongside (lint rules need fixture-based tests)
6. Run `npm run typecheck` — must pass
7. Run `npm test` — must pass
8. Run `npm run lint:code` — must pass
9. If a lint rule: ensure it's registered in `src/lint/rules/index.ts`

## Patterns

- Lint rules: export a `LintRule` object with `id`, `description`, `severity`, `check(tools) → LintIssue[]`
- Rules are pure functions — no side effects
