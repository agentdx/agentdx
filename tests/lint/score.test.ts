import { describe, it, expect } from 'vitest';
import { calculateLintScore } from '../../src/lint/score.js';
import type { LintIssue } from '../../src/core/types.js';

function issue(severity: 'error' | 'warn' | 'info'): LintIssue {
  return { rule: 'test', severity, message: 'test' };
}

describe('calculateLintScore', () => {
  it('returns 100 for no issues', () => {
    expect(calculateLintScore([])).toBe(100);
  });

  it('deducts 10 per error', () => {
    expect(calculateLintScore([issue('error')])).toBe(90);
    expect(calculateLintScore([issue('error'), issue('error')])).toBe(80);
  });

  it('deducts 3 per warning', () => {
    expect(calculateLintScore([issue('warn')])).toBe(97);
  });

  it('deducts 1 per info', () => {
    expect(calculateLintScore([issue('info')])).toBe(99);
  });

  it('combines deductions', () => {
    expect(calculateLintScore([issue('error'), issue('warn'), issue('info')])).toBe(86);
  });

  it('clamps to 0', () => {
    const manyErrors = Array.from({ length: 20 }, () => issue('error'));
    expect(calculateLintScore(manyErrors)).toBe(0);
  });
});
