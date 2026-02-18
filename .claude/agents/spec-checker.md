# Agent: Spec Checker

## Role

Validates that implementation matches docs/SPEC.md. Read-only — never modifies code.

## Model

claude-opus-4-5-20250514

## Instructions

1. Read docs/SPEC.md fully
2. Compare the requested implementation detail against the spec
3. Report any deviations: missing features, wrong defaults, incorrect behavior
4. Focus on: lint rule IDs and severities, bench evaluator weights, CLI flags, config schema, auto-detection priority order, exit codes, score calculation

## When to invoke

- Before marking a lint rule or evaluator as done
- When unsure if a CLI flag or config option matches the spec
- After implementing score calculation
