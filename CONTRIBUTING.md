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

# Lint & format check
npm run lint:code
```

## Project Structure

```
src/
├── cli/              # CLI entry + commands
│   ├── index.ts      # Commander program
│   └── commands/     # init, dev, lint
├── core/             # Shared: MCP client, config, auto-detect
├── lint/             # Rule engine + rules + formatters
│   ├── rules/        # Pure functions: descriptions, schemas, naming, compatibility
│   └── formatters/   # pretty (text), json, sarif
└── shared/           # Logger, utilities
```

## Architecture Rules

These boundaries are enforced by convention and code review:

1. `core/` never imports from `cli/` or `lint/`
2. `cli/` only imports command entry functions, not internals
3. Lint rules are pure functions — no side effects, no I/O

## Code Style

- **ESM only** — `import`/`export`, no `require`
- **No classes** unless stateful — lint rules are plain functions
- **TypeScript strict mode** — no `any`, no implicit returns
- **Errors** — catch at command level, show human-readable message, exit with code
- **ESLint** — typescript-eslint for static analysis
- **Prettier** — single quotes, trailing commas, 100 char width

## How to Add a New Lint Rule

1. Choose the appropriate category file in `src/lint/rules/`:
   - `descriptions.ts` — tool description quality
   - `schemas.ts` — input schema and parameter validation
   - `naming.ts` — naming conventions
   - `compatibility.ts` — provider compatibility checks

2. Write the rule as a pure function:

```typescript
export const myNewRule: LintRule = {
  id: 'my-rule-id',
  description: 'What this rule checks',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (/* problem detected */) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          tool: tool.name,
          message: 'What went wrong',
          fix: 'How to fix it',
          docs: 'https://link-to-relevant-docs',
        });
      }
    }
    return issues;
  },
};
```

3. Register it in `src/lint/rules/index.ts`
4. Add tests in `tests/lint/rules/`

## Pull Request Guidelines

### Before submitting

- Run `npm test` — all tests must pass
- Run `npm run typecheck` — no type errors
- Run `npm run build` — build must succeed
- Run `npm run lint:code` — ESLint + Prettier must pass

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new lint rule for param ordering
fix: handle empty tool list in lint engine
docs: update README with new CLI flags
test: add tests for compatibility rules
```

### PR checklist

- [ ] Tests pass (`npm test`)
- [ ] Type check clean (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint & format clean (`npm run lint:code`)
- [ ] No `console.log` left in production code
- [ ] New features have tests
- [ ] Breaking changes documented

## Issue Reporting

- **Bugs**: Use the [bug report template](https://github.com/agentdx/agentdx/issues/new?template=bug_report.yml)
- **Features**: Use the [feature request template](https://github.com/agentdx/agentdx/issues/new?template=feature_request.yml)

## Questions?

Open a [discussion](https://github.com/agentdx/agentdx/discussions) or file an issue.
