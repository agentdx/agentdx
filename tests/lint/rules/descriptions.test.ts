import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../../src/core/types.js';
import {
  descExists,
  descMinLength,
  descMaxLength,
  descActionVerb,
  descClarity,
  descUnique,
} from '../../../src/lint/rules/descriptions.js';

function tool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return { name: overrides.name, description: overrides.description, inputSchema: overrides.inputSchema };
}

describe('desc-exists', () => {
  it('flags tool with no description', () => {
    const issues = descExists.check([tool({ name: 'get_user' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('desc-exists');
  });

  it('flags tool with empty description', () => {
    const issues = descExists.check([tool({ name: 'get_user', description: '  ' })]);
    expect(issues).toHaveLength(1);
  });

  it('passes when description exists', () => {
    const issues = descExists.check([tool({ name: 'get_user', description: 'Retrieves a user by ID' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('desc-min-length', () => {
  it('flags short description', () => {
    const issues = descMinLength.check([tool({ name: 'get_user', description: 'Gets data' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('too vague');
  });

  it('passes adequate description', () => {
    const issues = descMinLength.check([tool({ name: 'get_user', description: 'Retrieves a user profile by their unique ID' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('desc-max-length', () => {
  it('flags long description', () => {
    const issues = descMaxLength.check([tool({ name: 'get_user', description: 'a'.repeat(201) })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('consider shortening');
  });

  it('passes normal description', () => {
    const issues = descMaxLength.check([tool({ name: 'get_user', description: 'Retrieves a user by ID' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('desc-action-verb', () => {
  it('flags description not starting with verb', () => {
    const issues = descActionVerb.check([tool({ name: 'get_user', description: 'A tool that retrieves users' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('start with a verb');
  });

  it('passes description starting with verb', () => {
    const issues = descActionVerb.check([tool({ name: 'get_user', description: 'Retrieves a user by ID' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('desc-clarity', () => {
  it('flags vague terms', () => {
    const issues = descClarity.check([tool({ name: 'do_stuff', description: 'Handles various data processing tasks' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('vague term');
  });

  it('passes specific descriptions', () => {
    const issues = descClarity.check([tool({ name: 'get_user', description: 'Retrieves a user profile by their unique identifier' })]);
    expect(issues).toHaveLength(0);
  });
});

describe('desc-unique', () => {
  it('flags near-identical descriptions', () => {
    const issues = descUnique.check([
      tool({ name: 'get_user', description: 'Retrieves a user from the database by ID' }),
      tool({ name: 'fetch_user', description: 'Retrieves a user from the database by ID' }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('too similar');
  });

  it('passes distinct descriptions', () => {
    const issues = descUnique.check([
      tool({ name: 'get_user', description: 'Retrieves a user profile by ID' }),
      tool({ name: 'list_posts', description: 'Lists all blog posts sorted by date' }),
    ]);
    expect(issues).toHaveLength(0);
  });
});
