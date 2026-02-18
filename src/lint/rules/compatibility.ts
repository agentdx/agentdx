import type { LintRule, LintIssue } from '../../core/types.js';

export const openaiToolCount: LintRule = {
  id: 'openai-tool-count',
  description: 'Too many tools degrade LLM selection accuracy',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    if (tools.length > 128) {
      issues.push({
        rule: this.id,
        severity: 'error',
        message: `Server exposes ${tools.length} tools — exceeds OpenAI's 128 tool hard limit`,
        fix: `Split your server into multiple focused servers or namespace tools by domain`,
        docs: 'https://platform.openai.com/docs/guides/function-calling',
      });
    } else if (tools.length > 20) {
      issues.push({
        rule: this.id,
        severity: this.severity,
        message: `Server exposes ${tools.length} tools — OpenAI recommends ≤20 for reliable selection`,
        fix: `Consider splitting into multiple servers or using tool namespacing to reduce the tool space`,
        docs: 'https://platform.openai.com/docs/guides/function-calling',
      });
    }
    return issues;
  },
};

export const openaiNameLength: LintRule = {
  id: 'openai-name-length',
  description: 'Tool names must be ≤64 characters for provider compatibility',
  severity: 'error',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (tool.name.length > 64) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: name is ${tool.name.length} characters — exceeds 64 char limit`,
          tool: tool.name,
          fix: `Shorten the tool name to ≤64 characters`,
          docs: 'https://platform.openai.com/docs/guides/function-calling',
        });
      }
    }
    return issues;
  },
};

const VALID_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const openaiNamePattern: LintRule = {
  id: 'openai-name-pattern',
  description: 'Tool names must only contain letters, numbers, underscores, and hyphens',
  severity: 'error',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (!VALID_NAME_PATTERN.test(tool.name)) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: name contains invalid characters — must match /^[a-zA-Z0-9_-]+$/`,
          tool: tool.name,
          fix: `Rename to use only letters, numbers, underscores, and hyphens`,
          docs: 'https://platform.openai.com/docs/guides/function-calling',
        });
      }
    }
    return issues;
  },
};

const AMBIGUOUS_NAMES = new Set([
  'search', 'get', 'run', 'do', 'execute', 'process', 'handle',
  'query', 'find', 'fetch', 'read', 'write', 'send', 'call',
  'data', 'action', 'operation', 'task', 'request', 'update',
  'tool', 'function', 'method', 'helper', 'util', 'misc',
]);

export const nameNotAmbiguous: LintRule = {
  id: 'name-not-ambiguous',
  description: 'Generic tool names cause collisions across MCP servers',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const lower = tool.name.toLowerCase();
      if (AMBIGUOUS_NAMES.has(lower)) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: generic name causes collisions when multiple MCP servers are loaded`,
          tool: tool.name,
          fix: `Add a domain-specific prefix or noun: "${tool.name}" → "weather_${tool.name}" or "${tool.name}_users"`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};
