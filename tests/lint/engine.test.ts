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
    // Tool with no description, no schema → should have at least desc-exists and schema-exists errors
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.tools).toHaveLength(1);
  });

  it('returns perfect score for well-defined tools', () => {
    const result = lint([
      tool({
        name: 'get_user',
        description: 'Retrieves a user profile by their unique identifier from the database',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The user ID', default: undefined },
          },
          required: ['id'],
        },
      }),
    ]);
    // Should have very few or no issues
    expect(result.score).toBeGreaterThanOrEqual(90);
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
});
