# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-alpha.1] - 2025-05-01

### Added

- `agentdx lint` — static analysis with 19 rules across 4 categories (descriptions, schemas, naming, errors)
- 3 output formats for lint: text (default), JSON, SARIF (for GitHub Code Scanning)
- Lint score (0–100) based on rule pass rates
- `agentdx bench` — LLM-based evaluation producing the Agent DX Score (0–100)
- 5 evaluators: tool selection, parameter accuracy, ambiguity handling, multi-tool, error recovery
- 3 LLM providers: Anthropic (default), OpenAI, Ollama
- Core module extraction: MCP client, config loader, auto-detect

## [0.1.0-alpha.1] - 2025-03-01

### Added

- CLI skeleton using Commander.js and @clack/prompts
- `agentdx init` — interactive MCP server scaffolding
- `agentdx dev` — dev server with REPL and file watching (chokidar)
- Project foundation: TypeScript strict mode, ESM, tsup build

[0.2.0-alpha.1]: https://github.com/agentdx/agentdx/compare/v0.1.0-alpha.1...v0.2.0-alpha.1
[0.1.0-alpha.1]: https://github.com/agentdx/agentdx/releases/tag/v0.1.0-alpha.1
