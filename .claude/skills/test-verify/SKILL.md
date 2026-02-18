# Skill: /test-verify

## When to use
When writing tests for lint rules or evaluators, or verifying existing features.

## Workflow
1. Identify what's being tested (lint rule, evaluator, command, core module)
2. Create test file in the matching `tests/` directory
3. For lint rules: create fixture ToolDefinition arrays (good and bad examples), assert LintResult output
4. For evaluators: create mock BenchScenario + LLMResponse pairs, assert EvaluatorResult scores
5. For commands: integration test — scaffold a fixture server, run the command, assert output
6. Run `npm test` — all must pass
7. Run `npm run typecheck` — must pass
8. Check coverage for the module: `npx vitest --coverage <file>`

## Test patterns
- Lint rules: test with `[]` tools (empty), single tool (one issue), multiple tools (mixed results)
- Evaluators: test with perfect responses, partial failures, complete failures
- Never make real LLM calls in tests — use mock adapter
- Fixture servers live in `tests/fixtures/`
