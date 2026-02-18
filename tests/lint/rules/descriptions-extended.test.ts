import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../../src/core/types.js';
import {
  descStatesPurpose,
  descIncludesUsageGuidance,
  descStatesLimitations,
  descHasExamples,
} from '../../../src/lint/rules/descriptions.js';

function tool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return { name: overrides.name, description: overrides.description, inputSchema: overrides.inputSchema };
}

describe('description-states-purpose', () => {
  it('flags description that does not state purpose', () => {
    const issues = descStatesPurpose.check([tool({ name: 'weather', description: 'A weather tool' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('description-states-purpose');
    expect(issues[0]!.fix).toBeDefined();
  });

  it('passes description with clear action', () => {
    const issues = descStatesPurpose.check([
      tool({ name: 'get_weather', description: 'Retrieves current weather data for a given city' }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('passes when description is long enough even without action verb', () => {
    const issues = descStatesPurpose.check([
      tool({
        name: 'weather',
        description: 'This tool provides access to the comprehensive weather data API including temperature, humidity, and wind speed information',
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('skips tools with no description', () => {
    const issues = descStatesPurpose.check([tool({ name: 'weather' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('description-includes-usage-guidance', () => {
  it('flags description without usage guidance', () => {
    const issues = descIncludesUsageGuidance.check([
      tool({ name: 'search_docs', description: 'Searches documentation for relevant articles and pages' }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('description-includes-usage-guidance');
  });

  it('passes description with usage guidance', () => {
    const issues = descIncludesUsageGuidance.check([
      tool({
        name: 'search_docs',
        description: 'Searches documentation. Use this when the user asks about API usage or configuration options',
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('skips short descriptions', () => {
    const issues = descIncludesUsageGuidance.check([
      tool({ name: 'x', description: 'Gets data' }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('description-states-limitations', () => {
  it('flags description without limitations', () => {
    const issues = descStatesLimitations.check([
      tool({
        name: 'search_users',
        description: 'Searches the user database and returns matching user profiles with details',
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('description-states-limitations');
  });

  it('passes description mentioning limits', () => {
    const issues = descStatesLimitations.check([
      tool({
        name: 'search_users',
        description: 'Searches the user database. Returns up to 100 results per request',
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('passes description with "only" constraint', () => {
    const issues = descStatesLimitations.check([
      tool({
        name: 'get_file',
        description: 'Retrieves file contents. Only supports text files under 10MB',
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('skips short descriptions', () => {
    const issues = descStatesLimitations.check([
      tool({ name: 'x', description: 'Gets users from the DB' }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('description-has-examples', () => {
  it('flags complex tool without examples', () => {
    const issues = descHasExamples.check([
      tool({
        name: 'search',
        description: 'Searches records in the database with filtering',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort field' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('description-has-examples');
  });

  it('passes complex tool with examples in description', () => {
    const issues = descHasExamples.check([
      tool({
        name: 'search',
        description: 'Searches records, e.g. {"query": "weather"}',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            filter: { type: 'string' },
            sort: { type: 'string' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('passes complex tool with examples in param descriptions', () => {
    const issues = descHasExamples.check([
      tool({
        name: 'search',
        description: 'Searches records',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term, e.g. "weather forecast"' },
            filter: { type: 'string', description: 'Filter' },
            sort: { type: 'string', description: 'Sort' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('skips simple tools with fewer than 3 params', () => {
    const issues = descHasExamples.check([
      tool({
        name: 'get_user',
        description: 'Gets a user',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});
