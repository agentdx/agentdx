# AgentDX

[![npm version](https://img.shields.io/npm/v/agentdx)](https://www.npmjs.com/package/agentdx)
[![license](https://img.shields.io/npm/l/agentdx)](LICENSE)
[![node](https://img.shields.io/node/v/agentdx)](package.json)
[![tests](https://github.com/agentdx/agentdx/actions/workflows/ci.yml/badge.svg)](https://github.com/agentdx/agentdx/actions)

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

## Quick Start

### Lint — static analysis (free, no LLM)

```bash
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

### Bench — LLM evaluation (produces Agent DX Score)

```bash
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

## How It Works

### Lint (19 rules across 4 categories)

Static analysis checks tool descriptions, input schemas, naming conventions, and error handling patterns. No LLM required — runs in seconds.

Output formats: `text` (default), `json`, `sarif` (for GitHub Code Scanning).

### Bench (5 evaluation dimensions)

Sends your tool definitions to a real LLM and measures how well it can use them:

| Dimension | Weight | What it measures |
|---|---|---|
| Tool Selection | 35% | Does the LLM pick the right tool? |
| Parameter Accuracy | 30% | Does it fill parameters correctly? |
| Ambiguity Handling | 15% | Does it ask for clarification when needed? |
| Multi-tool | 10% | Can it compose multiple tool calls? |
| Error Recovery | 10% | Does it handle errors gracefully? |

Scenarios are auto-generated from your tool definitions. Each runs multiple times (default 3) with majority voting for consistency. Evaluations run concurrently for speed.

| Score | Rating |
|---|---|
| 90–100 | Excellent — LLMs reliably use this server |
| 75–89 | Good — works well with minor confusion |
| 50–74 | Needs work — LLMs frequently misuse tools |
| 0–49 | Poor — LLMs struggle to use this server |

## Architecture

```
    ┌──────────┐
    │   cli/   │  Commander commands
    └────┬─────┘
         │ imports entry functions only
    ┌────┴─────┐
    │  core/   │  MCP client, config, auto-detect
    └──┬───┬───┘
       │   │
  ┌────┴┐ ┌┴────┐
  │lint/│ │bench/│  Never import each other
  └─────┘ └─────┘
```

`cli/` orchestrates commands, `core/` provides shared infrastructure (MCP client, config loading, server auto-detection), and `lint/` and `bench/` are independent modules that never import from each other.

## LLM Providers

```bash
# Anthropic (default)
export ANTHROPIC_API_KEY=sk-ant-...
npx agentdx bench

# OpenAI
npx agentdx bench --provider openai --model gpt-4o
# requires OPENAI_API_KEY

# Ollama (local, free)
npx agentdx bench --provider ollama --model llama3.2
# requires Ollama running locally
```

## Commands

| Command | What it does | Needs LLM? |
|---|---|---|
| `agentdx lint` | Static analysis of tool quality | No |
| `agentdx bench` | LLM-based Agent DX Score | Yes |
| `agentdx init` | Scaffold a new MCP server | No |
| `agentdx dev` | Dev server + REPL | No |

### CLI Reference

```
Global options:
  -v, --verbose           Show detailed output
  --config <path>         Path to agentdx.config.yaml
  --help                  Show help
  --version               Show version

Lint options:
  --format <fmt>          Output format: text (default), json, sarif
  --fix                   Auto-fix what's possible
  --rule <id>             Run only specific rule(s)
  --severity <level>      Minimum severity: error, warn, info

Bench options:
  --provider <name>       LLM provider: anthropic (default), openai, ollama
  --model <name>          Model to use (default: claude-sonnet-4-5-20250929)
  --scenarios <path>      Path to custom scenarios YAML
  --runs <n>              Runs per scenario (default: 3)
  --format <fmt>          Output format: text (default), json
  --no-confirm            Skip cost confirmation prompt
  --temperature <n>       LLM temperature (default: 0)
  --skip-error-recovery   Skip error recovery evaluation (faster, cheaper)
```

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
  model: claude-sonnet-4-5-20250929
  runs: 3
  concurrency: 5
```

## CI Integration

```yaml
# .github/workflows/agentdx.yml
- run: npx agentdx lint --format sarif > results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

## Development

```bash
git clone https://github.com/agentdx/agentdx.git
cd agentdx
npm install
npm run build      # tsup → dist/
npm test           # vitest
npm run typecheck  # tsc --noEmit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Documentation

- [Technical Specification](docs/SPEC.md) — detailed spec for lint rules, bench dimensions, scoring
- [Architecture](docs/ARCHITECTURE.md) — internal architecture, data flow, module boundaries

## Roadmap

- [x] CLI skeleton, `init`, `dev`
- [x] `agentdx lint` — 19 rules, 3 formatters, lint score
- [x] `agentdx bench` — 5 evaluators, 3 providers, Agent DX Score
- [ ] `--fix` for auto-fixable lint rules
- [ ] Comparison mode: bench against multiple models
- [ ] CI GitHub Action (`agentdx/lint-action`)
- [ ] MCP server registry integration
- [ ] Landing page at agentdx.dev

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- How to add lint rules, evaluators, or LLM providers
- PR guidelines and code style

Please note that this project has a [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT
