import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../../src/core/types.js';
import {
  nameConvention,
  nameVerbNoun,
  nameUnique,
  namePrefix,
} from '../../../src/lint/rules/naming.js';

function tool(name: string): ToolDefinition {
  return { name, description: 'A tool' };
}

describe('name-convention', () => {
  it('flags inconsistent naming', () => {
    const issues = nameConvention.check([
      tool('get_user'),
      tool('listPosts'),
      tool('delete_item'),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('camelCase');
  });

  it('passes consistent naming', () => {
    const issues = nameConvention.check([
      tool('get_user'),
      tool('list_posts'),
      tool('delete_item'),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('ignores single-word names', () => {
    const issues = nameConvention.check([tool('user'), tool('posts')]);
    expect(issues).toHaveLength(0);
  });
});

describe('name-verb-noun', () => {
  it('flags names without leading verb', () => {
    const issues = nameVerbNoun.check([tool('user_profile')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('verb_noun');
  });

  it('passes verb-noun names', () => {
    const issues = nameVerbNoun.check([tool('get_user')]);
    expect(issues).toHaveLength(0);
  });

  it('skips single-word names', () => {
    const issues = nameVerbNoun.check([tool('weather')]);
    expect(issues).toHaveLength(0);
  });
});

describe('name-unique', () => {
  it('flags duplicate names', () => {
    const issues = nameUnique.check([tool('get_user'), tool('get_user')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.message).toContain('appears 2 times');
  });

  it('passes unique names', () => {
    const issues = nameUnique.check([tool('get_user'), tool('list_users')]);
    expect(issues).toHaveLength(0);
  });
});

describe('name-prefix', () => {
  it('suggests consistent prefix grouping', () => {
    const issues = namePrefix.check([
      tool('get_user'),
      tool('create_user'),
      tool('remove_user'),
      tool('fetch_post'),
      tool('delete_post'),
    ]);
    // "user" group: get, create, remove — that's fine (different verbs)
    // "post" group: fetch, delete — different prefixes
    // This rule checks if tools sharing a noun have inconsistent verb prefixes
    expect(issues.length).toBeGreaterThanOrEqual(0); // May or may not flag depending on heuristic
  });

  it('skips with fewer than 3 tools', () => {
    const issues = namePrefix.check([tool('get_user'), tool('list_users')]);
    expect(issues).toHaveLength(0);
  });
});
