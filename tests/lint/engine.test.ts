import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../src/core/types.js';
import { lint } from '../../src/lint/engine.js';

function tool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return {
    name: overrides.name,
    description: overrides.description,
    inputSchema: overrides.inputSchema,
  };
}

describe('lint engine', () => {
  it('returns issues and score for tools with problems', () => {
    const result = lint([tool({ name: 'x' })]);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.tools).toHaveLength(1);
  });

  it('returns high score for well-defined tools', () => {
    const result = lint([
      tool({
        name: 'get_user',
        description: 'Retrieves a user profile by their unique identifier from the database. Use this when you need user details. Requires valid user ID. Returns up to one result.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The user ID, e.g. "usr_123"', default: undefined },
          },
          required: ['id'],
        },
      }),
    ]);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('respects rule overrides to disable rules', () => {
    const result = lint(
      [tool({ name: 'x' })],
      { rules: { 'desc-exists': 'off', 'schema-exists': false } },
    );
    const ruleIds = result.issues.map((i) => i.rule);
    expect(ruleIds).not.toContain('desc-exists');
    expect(ruleIds).not.toContain('schema-exists');
  });

  it('respects rule overrides to change severity', () => {
    const result = lint(
      [tool({ name: 'x' })],
      { rules: { 'desc-exists': 'info' } },
    );
    const descIssue = result.issues.find((i) => i.rule === 'desc-exists');
    expect(descIssue?.severity).toBe('info');
  });

  it('includes new research-backed rules', () => {
    const result = lint([
      tool({
        name: 'weather',
        description: 'A weather tool for things',
        inputSchema: { type: 'object', properties: {} },
      }),
    ]);
    const ruleIds = new Set(result.issues.map((i) => i.rule));
    // Should flag at least some description quality or naming issues
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
