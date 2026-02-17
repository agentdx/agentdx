# AgentDX — Claude Code Setup

Extract `agentdx-claude-code-setup.tar.gz` into your project root. It creates:

```
CLAUDE.md                                    ← Project context, loaded every session
.claude/
├── agents/
│   ├── spec-checker.md                      ← Validates code against docs/SPEC.md (Opus, read-only)
│   └── code-reviewer.md                     ← Reviews code quality and arch violations (Sonnet, read-only)
├── skills/
│   ├── implement/SKILL.md                   ← /implement <feature> — full build workflow
│   ├── test-verify/SKILL.md                 ← /test-verify <module> — write tests + verify
│   ├── architecture-review/SKILL.md         ← /architecture-review — checks module boundaries (forked)
│   └── research/SKILL.md                    ← /research <topic> — explore codebase in isolation (forked)
```

## How It Works

**CLAUDE.md** is loaded at the start of every Claude Code session. It tells Claude:
- What the project is and how it's structured
- The tech stack and conventions
- How to build, test, and typecheck
- Architecture rules that must not be broken

**Agents** (`.claude/agents/`) run in isolated context windows. Claude delegates to them
automatically when a task matches their description, or you invoke them. They don't
pollute your main conversation context.

**Skills** (`.claude/skills/`) are invocable workflows. Use them as slash commands:
- `/implement add OpenAPI import to agentdx init` — builds the feature following conventions
- `/test-verify schema-engine` — writes and runs tests for the schema engine
- `/architecture-review` — runs a full boundary check in a forked context
- `/research how the LLM adapter handles caching` — explores in isolation, reports back

## Setup

```bash
# In your agentdx project root:
tar xzf agentdx-claude-code-setup.tar.gz

# Copy your spec docs into the project:
mkdir -p docs
cp path/to/agentdx-spec.md docs/SPEC.md
cp path/to/agentdx-architecture-and-launch.md docs/ARCHITECTURE.md

# Then start Claude Code:
claude
```

## Tips for Max 20x (Opus 4.6)

- Use `/research` and `/architecture-review` liberally — they fork context, so
  exploration doesn't eat your main window
- Use Plan Mode (Shift+Tab twice) before big features to let Opus think through
  the approach without writing code
- Run `/compact` when conversation gets long rather than `/clear` — it preserves
  key context from CLAUDE.md
- The spec-checker agent uses Opus for deeper reasoning about spec compliance.
  The code-reviewer uses Sonnet for faster, cheaper reviews.
- If you hit the context limit, start a new session — CLAUDE.md re-loads automatically
