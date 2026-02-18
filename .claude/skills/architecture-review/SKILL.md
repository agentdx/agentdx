# Skill: /architecture-review

context: fork

## When to use
When checking that implementation respects architecture boundaries or before a major refactor.

## Workflow
1. Read docs/ARCHITECTURE.md section 6 (Architecture Boundaries)
2. Scan import statements across all src/ files
3. Verify:
   - core/ has no imports from cli/, lint/, bench/
   - lint/ has no imports from bench/ (and vice versa)
   - No direct @anthropic-ai/sdk or openai imports outside bench/llm/
   - No require() calls anywhere
4. Check that lint rules and evaluators are pure (no fs, no fetch, no process.env reads)
5. Report any violations with file:line references
