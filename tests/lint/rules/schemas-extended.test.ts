import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../../src/core/types.js';
import {
  paramEnumDocumented,
  paramDefaultDocumented,
  schemaNotTooDeep,
  schemaNoExcessiveParams,
} from '../../../src/lint/rules/schemas.js';

function tool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return {
    name: overrides.name,
    description: overrides.description ?? 'A tool',
    inputSchema: overrides.inputSchema,
  };
}

describe('param-enum-documented', () => {
  it('flags enum param without documentation of values', () => {
    const issues = paramEnumDocumented.check([
      tool({
        name: 'get_data',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'csv', 'xml'], description: 'Output format' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('param-enum-documented');
    expect(issues[0]!.fix).toBeDefined();
  });

  it('passes when enum values are documented in description', () => {
    const issues = paramEnumDocumented.check([
      tool({
        name: 'get_data',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['json', 'csv'],
              description: 'Output format: json for structured data, csv for spreadsheet import',
            },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('ignores params without enum', () => {
    const issues = paramEnumDocumented.check([
      tool({
        name: 'get_data',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string', description: 'Name' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('param-default-documented', () => {
  it('flags param with default not mentioned in description', () => {
    const issues = paramDefaultDocumented.check([
      tool({
        name: 'list_items',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10, description: 'Max items to return' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('param-default-documented');
  });

  it('passes when default is mentioned in description', () => {
    const issues = paramDefaultDocumented.check([
      tool({
        name: 'list_items',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10, description: 'Max items to return. Defaults to 10' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('passes when default value appears in description', () => {
    const issues = paramDefaultDocumented.check([
      tool({
        name: 'list_items',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10, description: 'Max items, returns 10 if omitted' },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('ignores params without defaults', () => {
    const issues = paramDefaultDocumented.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'User ID' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-not-too-deep', () => {
  it('flags deeply nested schemas (depth > 3)', () => {
    const issues = schemaNotTooDeep.check([
      tool({
        name: 'complex_tool',
        inputSchema: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: {
                          type: 'object',
                          properties: {
                            value: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('schema-not-too-deep');
    expect(issues[0]!.message).toContain('nesting depth');
  });

  it('passes schemas within depth limit', () => {
    const issues = schemaNotTooDeep.check([
      tool({
        name: 'query',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              properties: {
                field: { type: 'string' },
              },
            },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('handles arrays with nested objects', () => {
    const issues = schemaNotTooDeep.check([
      tool({
        name: 'bulk_op',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nested: {
                    type: 'object',
                    properties: {
                      deep: {
                        type: 'object',
                        properties: {
                          veryDeep: {
                            type: 'object',
                            properties: {
                              value: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
  });

  it('skips tools without schema', () => {
    const issues = schemaNotTooDeep.check([tool({ name: 'simple' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-no-excessive-params', () => {
  it('flags tools with too many parameters', () => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < 11; i++) {
      properties[`param${i}`] = { type: 'string' };
    }
    const issues = schemaNoExcessiveParams.check([
      tool({
        name: 'big_tool',
        inputSchema: { type: 'object', properties },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('schema-no-excessive-params');
    expect(issues[0]!.message).toContain('11 parameters');
  });

  it('passes tools with ≤10 parameters', () => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < 10; i++) {
      properties[`param${i}`] = { type: 'string' };
    }
    const issues = schemaNoExcessiveParams.check([
      tool({
        name: 'ok_tool',
        inputSchema: { type: 'object', properties },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});
