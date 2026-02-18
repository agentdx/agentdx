# AgentDX

[![npm version](https://img.shields.io/npm/v/agentdx)](https://www.npmjs.com/package/agentdx)
[![license](https://img.shields.io/npm/l/agentdx)](LICENSE)
[![node](https://img.shields.io/node/v/agentdx)](package.json)
[![tests](https://github.com/agentdx/agentdx/actions/workflows/ci.yml/badge.svg)](https://github.com/agentdx/agentdx/actions)

**ESLint for MCP servers.**

AgentDX is a linter that catches the tool description, schema, and naming problems that make LLMs pick the wrong tool, guess parameters, and fail silently. No API keys needed — runs in seconds.

```bash
npx agentdx lint
```

## Why?

Research shows **97.1% of MCP tools have description quality issues** ([arxiv 2602.14878](https://arxiv.org/abs/2602.14878)). Common problems:

- Tool descriptions too vague for an LLM to understand
- Missing parameter descriptions — the LLM guesses what to pass
- Similar tools with overlapping names — the LLM picks the wrong one
- Deeply nested schemas — LLM performance drops 47% with complex nesting
- Too many tools — selection accuracy degrades past 20 tools

**AgentDX finds these problems before your users do.**

## Quick Start

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

✓ 22 rules passed | ⚠ 2 warnings | ✗ 1 error

Lint Score: 84/100
```

## Install

```bash
npm install -g agentdx
# or use npx for zero-install
```

## Rules

AgentDX ships with 30 rules across 4 categories, informed by academic research and real-world LLM behavior.

### Description Quality (10 rules)

| Rule                                  | Severity | What it checks                                                |
| ------------------------------------- | -------- | ------------------------------------------------------------- |
| `desc-exists`                         | error    | Tool has a description                                        |
| `desc-min-length`                     | warn     | Description is at least 20 characters                         |
| `desc-max-length`                     | warn     | Description is under 200 characters                           |
| `desc-action-verb`                    | warn     | Description starts with a verb ("Retrieves...", "Creates...") |
| `desc-clarity`                        | info     | Flags vague terms like "handles", "processes", "misc"         |
| `desc-unique`                         | warn     | No two tools have near-identical descriptions                 |
| `description-states-purpose`          | warn     | Description clearly states what the tool does                 |
| `description-includes-usage-guidance` | info     | Explains when or how to use the tool                          |
| `description-states-limitations`      | info     | Mentions constraints, rate limits, or caveats                 |
| `description-has-examples`            | info     | Complex tools (3+ params) include example inputs              |

### Schema & Parameters (11 rules)

| Rule                         | Severity | What it checks                              |
| ---------------------------- | -------- | ------------------------------------------- |
| `schema-exists`              | error    | Tool defines an input schema                |
| `schema-valid`               | error    | Schema type is "object"                     |
| `schema-param-desc`          | warn     | Every parameter has a description           |
| `schema-required`            | warn     | Required parameters are marked              |
| `schema-enum-bool`           | info     | Suggests enums over booleans for clarity    |
| `schema-no-any`              | warn     | Every parameter has a type                  |
| `schema-defaults`            | info     | Optional parameters document defaults       |
| `param-enum-documented`      | warn     | Enum values are explained in description    |
| `param-default-documented`   | info     | Default values are mentioned in description |
| `schema-not-too-deep`        | warn     | Nesting doesn't exceed depth 3              |
| `schema-no-excessive-params` | warn     | Tool has 10 or fewer parameters             |

### Naming Conventions (4 rules)

| Rule              | Severity | What it checks                                           |
| ----------------- | -------- | -------------------------------------------------------- |
| `name-convention` | warn     | Consistent naming (snake_case, camelCase, or kebab-case) |
| `name-verb-noun`  | info     | Follows verb_noun pattern (e.g. `get_user`)              |
| `name-unique`     | error    | No duplicate tool names                                  |
| `name-prefix`     | info     | Related tools share a common prefix                      |

### Provider Compatibility (4 rules)

| Rule                  | Severity   | What it checks                                 |
| --------------------- | ---------- | ---------------------------------------------- |
| `openai-tool-count`   | warn/error | Warns >20 tools, errors >128 (provider limits) |
| `openai-name-length`  | error      | Names are ≤64 characters                       |
| `openai-name-pattern` | error      | Names match `/^[a-zA-Z0-9_-]+$/`               |
| `name-not-ambiguous`  | warn       | No generic names like "search", "get", "run"   |

## Architecture

```
    ┌──────────┐
    │   cli/   │  Commander commands
    └────┬─────┘
         │ imports entry functions only
    ┌────┴─────┐
    │  core/   │  MCP client, config, auto-detect
    └────┬─────┘
         │
    ┌────┴─────┐
    │  lint/   │  Rule engine, rules, formatters
    └──────────┘
```

`cli/` orchestrates commands, `core/` provides shared infrastructure (MCP client, config loading, server auto-detection), and `lint/` contains the rule engine, 30 rules across 4 categories, and 3 output formatters.

## CLI Reference

```
agentdx lint [options]

Options:
  -f, --format <format>   Output format: pretty (default), json, sarif
  --fix-suggestions       Show concrete fix suggestions for each failing rule
  --quiet                 Only show errors, suppress warnings and info (CI mode)
  -c, --config <path>     Path to .agentdxrc.json config file
  -v, --verbose           Enable verbose output
  --help                  Show help
  --version               Show version
```

### Exit Codes

| Code | Meaning                    |
| ---- | -------------------------- |
| `0`  | All rules passed           |
| `1`  | Errors found               |
| `2`  | Warnings found (no errors) |

### Output Formats

- **`pretty`** (default) — colored terminal output with summary
- **`json`** — structured JSON with score, issues, and tool list
- **`sarif`** — SARIF v2.1.0 for GitHub Code Scanning integration

## Configuration

AgentDX works zero-config. It auto-detects your server entry point. Optionally configure rules via `agentdx.config.yaml` or `.agentdxrc.json`:

```yaml
# agentdx.config.yaml
server:
  entry: src/index.ts
  transport: stdio

lint:
  rules:
    desc-min-length: 30 # override threshold
    schema-enum-bool: off # disable rule
    description-states-limitations: warn # escalate to warning
```

```json
// .agentdxrc.json
{
  "lint": {
    "rules": {
      "desc-min-length": 30,
      "schema-enum-bool": "off"
    }
  }
}
```

## CI Integration

```yaml
# .github/workflows/agentdx.yml
name: Lint MCP Server
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npx agentdx lint --format sarif > results.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

Use `--quiet` for CI pipelines that should only fail on errors:

```bash
npx agentdx lint --quiet  # exit 0 unless errors found
```

## Research

AgentDX rules are informed by academic research on LLM-tool interaction:

- **"MCP Tool Descriptions Are Smelly"** ([arxiv 2602.14878](https://arxiv.org/abs/2602.14878)) — analyzed 1,899 MCP tools and found 97.1% have description quality issues. Identified 5 smell categories: missing purpose, missing guidance, vague language, missing constraints, and duplicates.

- **Microsoft MCP Interviewer research** — found 775 naming collisions across the MCP ecosystem, tool selection accuracy drops past 20 tools, and deeply nested schemas (up to 20 levels) cause 47% performance degradation.

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

## Roadmap

- [x] CLI skeleton, `init`, `dev`
- [x] `agentdx lint` — 30 rules, 3 formatters, lint score
- [ ] `--fix` for auto-fixable lint rules
- [ ] CI GitHub Action (`agentdx/lint-action`)
- [ ] MCP server registry integration
- [ ] Landing page at agentdx.dev

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup
- How to add lint rules
- PR guidelines and code style

Please note that this project has a [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT
