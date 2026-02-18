# Skill: /architecture-review

context: fork

## When to use

When checking that implementation respects architecture boundaries or before a major refactor.

## Workflow

1. Read docs/ARCHITECTURE.md section 4 (Architecture Boundaries)
2. Scan import statements across all src/ files
3. Verify:
   - core/ has no imports from cli/ or lint/
   - cli/ only imports command entry functions from lint/
   - No require() calls anywhere
4. Check that lint rules are pure (no fs, no fetch, no process.env reads)
5. Report any violations with file:line references
