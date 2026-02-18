import { describe, it, expect } from 'vitest';
import type { LintResult } from '../../src/core/types.js';
import { formatText } from '../../src/lint/formatters/text.js';
import { formatJson } from '../../src/lint/formatters/json.js';
import { formatSarif } from '../../src/lint/formatters/sarif.js';

const result: LintResult = {
  score: 80,
  tools: [
    { name: 'get_user', description: 'Retrieves a user by ID' },
    { name: 'list_posts', description: 'Lists all posts' },
  ],
  issues: [
    { rule: 'schema-exists', severity: 'error', message: 'get_user: no input schema defined', tool: 'get_user' },
    { rule: 'desc-min-length', severity: 'warn', message: 'list_posts: description is 15 chars', tool: 'list_posts' },
    { rule: 'name-verb-noun', severity: 'info', message: 'list_posts: consider verb_noun', tool: 'list_posts' },
  ],
};

describe('formatText', () => {
  it('includes header with tool count', () => {
    const output = formatText(result, 'test-server');
    expect(output).toContain('AgentDX Lint');
    expect(output).toContain('test-server');
    expect(output).toContain('2 tools');
  });

  it('includes all issue severities', () => {
    const output = formatText(result);
    expect(output).toContain('error');
    expect(output).toContain('warn');
    expect(output).toContain('info');
  });

  it('includes score', () => {
    const output = formatText(result);
    expect(output).toContain('Lint Score: 80/100');
  });

  it('shows no issues message when clean', () => {
    const clean: LintResult = { score: 100, tools: [{ name: 'a' }], issues: [] };
    const output = formatText(clean);
    expect(output).toContain('No issues found');
  });
});

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const output = formatJson(result);
    const parsed = JSON.parse(output);
    expect(parsed.score).toBe(80);
    expect(parsed.toolCount).toBe(2);
    expect(parsed.issues).toHaveLength(3);
  });

  it('includes summary counts', () => {
    const parsed = JSON.parse(formatJson(result));
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.summary.warnings).toBe(1);
    expect(parsed.summary.info).toBe(1);
  });
});

describe('formatSarif', () => {
  it('returns valid SARIF structure', () => {
    const output = formatSarif(result);
    const parsed = JSON.parse(output);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.$schema).toContain('sarif');
    expect(parsed.runs).toHaveLength(1);
  });

  it('includes rules and results', () => {
    const parsed = JSON.parse(formatSarif(result));
    const run = parsed.runs[0];
    expect(run.tool.driver.name).toBe('agentdx');
    expect(run.tool.driver.rules.length).toBeGreaterThan(0);
    expect(run.results).toHaveLength(3);
  });

  it('maps severities correctly', () => {
    const parsed = JSON.parse(formatSarif(result));
    const levels = parsed.runs[0].results.map((r: { level: string }) => r.level);
    expect(levels).toContain('error');
    expect(levels).toContain('warning');
    expect(levels).toContain('note');
  });
});
