import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../../src/core/types.js';
import {
  schemaExists,
  schemaValid,
  schemaParamDesc,
  schemaRequired,
  schemaEnumBool,
  schemaNoAny,
  schemaDefaults,
} from '../../../src/lint/rules/schemas.js';

function tool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return {
    name: overrides.name,
    description: overrides.description ?? 'A tool',
    inputSchema: overrides.inputSchema,
  };
}

describe('schema-exists', () => {
  it('flags tool with no schema', () => {
    const issues = schemaExists.check([tool({ name: 'get_user' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('schema-exists');
  });

  it('passes tool with schema', () => {
    const issues = schemaExists.check([
      tool({ name: 'get_user', inputSchema: { type: 'object', properties: {} } }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-valid', () => {
  it('flags schema with wrong type', () => {
    const issues = schemaValid.check([
      tool({ name: 'get_user', inputSchema: { type: 'array' } }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('must be "object"');
  });

  it('passes valid schema', () => {
    const issues = schemaValid.check([
      tool({ name: 'get_user', inputSchema: { type: 'object' } }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-param-desc', () => {
  it('flags params without descriptions', () => {
    const issues = schemaParamDesc.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.param).toBe('id');
  });

  it('passes params with descriptions', () => {
    const issues = schemaParamDesc.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'The user ID' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-required', () => {
  it('flags when no params marked required', () => {
    const issues = schemaRequired.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
  });

  it('passes when required is set', () => {
    const issues = schemaRequired.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-enum-bool', () => {
  it('flags boolean params', () => {
    const issues = schemaEnumBool.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { verbose: { type: 'boolean' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('consider an enum');
  });

  it('ignores non-boolean params', () => {
    const issues = schemaEnumBool.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-no-any', () => {
  it('flags untyped params', () => {
    const issues = schemaNoAny.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { data: {} },
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('no type');
  });

  it('passes typed params', () => {
    const issues = schemaNoAny.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('schema-defaults', () => {
  it('flags optional params without defaults', () => {
    const issues = schemaDefaults.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number' } },
          required: [],
        },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('no default value');
  });

  it('passes optional params with defaults', () => {
    const issues = schemaDefaults.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', default: 10 } },
          required: [],
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('ignores required params', () => {
    const issues = schemaDefaults.check([
      tool({
        name: 'get_user',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      }),
    ]);
    expect(issues).toHaveLength(0);
  });
});
