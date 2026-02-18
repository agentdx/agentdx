import { describe, it, expect } from 'vitest';
import type { ToolDefinition } from '../../../src/core/types.js';
import {
  openaiToolCount,
  openaiNameLength,
  openaiNamePattern,
  nameNotAmbiguous,
} from '../../../src/lint/rules/compatibility.js';

function tool(name: string): ToolDefinition {
  return { name, description: 'A tool that does something' };
}

describe('openai-tool-count', () => {
  it('flags more than 128 tools as error', () => {
    const tools = Array.from({ length: 130 }, (_, i) => tool(`tool_${i}`));
    const issues = openaiToolCount.check(tools);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.message).toContain('128');
  });

  it('warns about more than 20 tools', () => {
    const tools = Array.from({ length: 25 }, (_, i) => tool(`tool_${i}`));
    const issues = openaiToolCount.check(tools);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warn');
    expect(issues[0]!.message).toContain('20');
  });

  it('passes with ≤20 tools', () => {
    const tools = Array.from({ length: 15 }, (_, i) => tool(`tool_${i}`));
    const issues = openaiToolCount.check(tools);
    expect(issues).toHaveLength(0);
  });

  it('passes with exactly 20 tools', () => {
    const tools = Array.from({ length: 20 }, (_, i) => tool(`tool_${i}`));
    const issues = openaiToolCount.check(tools);
    expect(issues).toHaveLength(0);
  });
});

describe('openai-name-length', () => {
  it('flags names longer than 64 characters', () => {
    const longName = 'a'.repeat(65);
    const issues = openaiNameLength.check([tool(longName)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('openai-name-length');
    expect(issues[0]!.message).toContain('65 characters');
  });

  it('passes names within limit', () => {
    const issues = openaiNameLength.check([tool('get_user_profile')]);
    expect(issues).toHaveLength(0);
  });

  it('passes names at exactly 64 characters', () => {
    const name64 = 'a'.repeat(64);
    const issues = openaiNameLength.check([tool(name64)]);
    expect(issues).toHaveLength(0);
  });
});

describe('openai-name-pattern', () => {
  it('flags names with spaces', () => {
    const issues = openaiNamePattern.check([tool('get user')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('openai-name-pattern');
  });

  it('flags names with dots', () => {
    const issues = openaiNamePattern.check([tool('get.user')]);
    expect(issues).toHaveLength(1);
  });

  it('flags names with special characters', () => {
    const issues = openaiNamePattern.check([tool('get@user!')]);
    expect(issues).toHaveLength(1);
  });

  it('passes valid names with underscores', () => {
    const issues = openaiNamePattern.check([tool('get_user_profile')]);
    expect(issues).toHaveLength(0);
  });

  it('passes valid names with hyphens', () => {
    const issues = openaiNamePattern.check([tool('get-user-profile')]);
    expect(issues).toHaveLength(0);
  });

  it('passes alphanumeric names', () => {
    const issues = openaiNamePattern.check([tool('getUser2')]);
    expect(issues).toHaveLength(0);
  });
});

describe('name-not-ambiguous', () => {
  it('flags generic names like "search"', () => {
    const issues = nameNotAmbiguous.check([tool('search')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('name-not-ambiguous');
    expect(issues[0]!.fix).toContain('prefix');
  });

  it('flags generic names like "get"', () => {
    const issues = nameNotAmbiguous.check([tool('get')]);
    expect(issues).toHaveLength(1);
  });

  it('flags generic names like "run"', () => {
    const issues = nameNotAmbiguous.check([tool('run')]);
    expect(issues).toHaveLength(1);
  });

  it('passes specific names', () => {
    const issues = nameNotAmbiguous.check([tool('search_documents')]);
    expect(issues).toHaveLength(0);
  });

  it('passes domain-prefixed names', () => {
    const issues = nameNotAmbiguous.check([tool('weather_search')]);
    expect(issues).toHaveLength(0);
  });
});
