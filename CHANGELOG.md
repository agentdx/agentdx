# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0-alpha.1] - 2026-02-18

### Added

- 12 new lint rules informed by academic research (arxiv 2602.14878, Microsoft MCP research)
- Description quality rules: `description-states-purpose`, `description-includes-usage-guidance`, `description-states-limitations`, `description-has-examples`
- Parameter rules: `param-enum-documented`, `param-default-documented`
- Schema rules: `schema-not-too-deep`, `schema-no-excessive-params`
- Provider compatibility rules: `openai-tool-count`, `openai-name-length`, `openai-name-pattern`, `name-not-ambiguous`
- `--fix-suggestions` flag for concrete rewrite suggestions
- `--quiet` flag for CI (errors only)
- `.agentdxrc.json` config file support
- Exit code 2 for warnings-only results

### Changed

- Default output format renamed from `text` to `pretty`
- Total rules: 30 (up from 16)

### Removed

- `agentdx bench` command and all LLM evaluation infrastructure
- LLM provider dependencies (`@anthropic-ai/sdk`, `openai`)
- All bench-related code: evaluators, scenarios, LLM adapters, reporters

## [0.2.0-alpha.1] - 2025-05-01

### Added

- `agentdx lint` — static analysis with 16 rules across 4 categories (descriptions, schemas, naming, errors)
- 3 output formats for lint: text (default), JSON, SARIF (for GitHub Code Scanning)
- Lint score (0-100) based on rule pass rates
- `agentdx bench` — LLM-based evaluation producing the Agent DX Score (0-100)
- 5 evaluators: tool selection, parameter accuracy, ambiguity handling, multi-tool, error recovery
- 3 LLM providers: Anthropic (default), OpenAI, Ollama
- Core module extraction: MCP client, config loader, auto-detect

## [0.1.0-alpha.1] - 2025-03-01

### Added

- CLI skeleton using Commander.js and @clack/prompts
- `agentdx init` — interactive MCP server scaffolding
- `agentdx dev` — dev server with REPL and file watching (chokidar)
- Project foundation: TypeScript strict mode, ESM, tsup build

[0.3.0-alpha.1]: https://github.com/agentdx/agentdx/compare/v0.2.0-alpha.1...v0.3.0-alpha.1
[0.2.0-alpha.1]: https://github.com/agentdx/agentdx/compare/v0.1.0-alpha.1...v0.2.0-alpha.1
[0.1.0-alpha.1]: https://github.com/agentdx/agentdx/releases/tag/v0.1.0-alpha.1
