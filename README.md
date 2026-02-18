# AgentDX

**What's your MCP server's Agent DX Score?**

AgentDX measures how well AI agents can actually use your MCP server. It catches vague descriptions, broken schemas, and ambiguous tool names that make LLMs pick the wrong tool.

```bash
npx agentdx lint    # Static analysis — fast, free, no LLM needed
npx agentdx bench   # LLM evaluation — produces the Agent DX Score (0-100)
```

## Why?

MCP servers are being built faster than ever. But most of them have:
- Tool descriptions too vague for an LLM to understand
- Missing parameter descriptions — the LLM guesses what to pass
- Similar tools with overlapping names — the LLM picks the wrong one
- No error handling — the LLM doesn't know what went wrong

**AgentDX finds these problems before your users do.**

## Quick start

```bash
# In any MCP server project — zero config needed
cd my-mcp-server
npx agentdx lint
```

```
AgentDX Lint — my-weather-server (5 tools)

✗ error  get_forecast: no input schema defined                    [schema-exists]
⚠ warn   get_weather: parameter "units" has no description        [schema-param-desc]
⚠ warn   get_alerts: description is 12 chars — too vague          [desc-min-length]
✓ pass   naming is consistent (snake_case)

Lint Score: 58/100
```

```bash
# Benchmark against a real LLM
export ANTHROPIC_API_KEY=sk-ant-...
npx agentdx bench
```

```
Agent DX Score: 78/100 — Good

Tool Selection     92%  (17/18 correct)
Parameter Accuracy 68%  (units param confused in 4 cases)
Error Recovery     50%  (LLM can't parse error format)

Top fix: add default "celsius" to units param — LLM omits it 60% of the time
```

## Install

```bash
npm install -g agentdx
# or use npx for zero-install
```

## Commands

| Command | What it does | Needs LLM? |
|---|---|---|
| `agentdx lint` | Static analysis of tool quality | No |
| `agentdx bench` | LLM-based Agent DX Score | Yes |
| `agentdx init` | Scaffold a new MCP server | No |
| `agentdx dev` | Dev server + REPL | No |

## Configuration (optional)

AgentDX works zero-config. It auto-detects your server entry point. Optionally create `agentdx.config.yaml`:

```yaml
server:
  entry: src/index.ts
  transport: stdio

lint:
  rules:
    description-min-length: 20
    require-param-descriptions: true

bench:
  provider: anthropic
  model: claude-sonnet-4-5-20250514
  runs: 3
```

## CI Integration

```yaml
# .github/workflows/agentdx.yml
- run: npx agentdx lint --format sarif > results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

## Status

Early alpha. Lint and bench are under active development.

- [x] CLI skeleton
- [x] `agentdx init` — scaffold projects
- [x] `agentdx dev` — REPL + hot-reload
- [ ] `agentdx lint` — static analysis (in progress)
- [ ] `agentdx bench` — Agent DX Score (next)

## License

MIT
