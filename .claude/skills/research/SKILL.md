---
name: research
description: Research how something works in the codebase or in the MCP ecosystem. Runs in isolation to avoid polluting main context.
context: fork
agent: Explore
---

# Research: $ARGUMENTS

## Instructions

Investigate the topic thoroughly within this codebase and report back with findings.

1. Use Glob to find relevant files by name patterns
2. Use Grep to find relevant code by content (function names, imports, type names)
3. Read the most relevant files
4. Check `docs/SPEC.md` and `docs/ARCHITECTURE.md` for spec-level context
5. Check `package.json` for relevant dependencies

## Report Format

- **Summary:** 2-3 sentences on what you found
- **Key Files:** List the most important files with one-line descriptions
- **How It Works:** Brief explanation of the mechanism or pattern
- **Connections:** What other parts of the codebase depend on or interact with this
- **Gaps:** Anything that seems missing, incomplete, or inconsistent
