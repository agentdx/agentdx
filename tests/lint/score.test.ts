import { describe, it, expect } from 'vitest';
import { calculateLintScore } from '../../src/lint/score.js';
import { allRules } from '../../src/lint/rules/index.js';
import type { LintIssue } from '../../src/core/types.js';

const totalRules = allRules.length;

function issue(severity: 'error' | 'warn' | 'info', rule = 'test-rule'): LintIssue {
  return { rule, severity, message: 'test' };
}

describe('calculateLintScore', () => {
  it('returns 100 for no issues', () => {
    expect(calculateLintScore([])).toBe(100);
  });

  it('scores based on rule pass rate with severity weighting', () => {
    // 1 rule with error: deduction = 3 out of totalRules * 3
    const score = calculateLintScore([issue('error', 'rule-a')]);
    const expected = Math.round(100 * (1 - 3 / (totalRules * 3)));
    expect(score).toBe(expected);
  });

  it('weighs warnings less than errors', () => {
    const errorScore = calculateLintScore([issue('error', 'rule-a')]);
    const warnScore = calculateLintScore([issue('warn', 'rule-a')]);
    expect(warnScore).toBeGreaterThan(errorScore);
  });

  it('weighs info less than warnings', () => {
    const warnScore = calculateLintScore([issue('warn', 'rule-a')]);
    const infoScore = calculateLintScore([issue('info', 'rule-a')]);
    expect(infoScore).toBeGreaterThan(warnScore);
  });

  it('deduplicates by rule — multiple issues from same rule count once', () => {
    const singleIssue = calculateLintScore([issue('error', 'rule-a')]);
    const multipleIssues = calculateLintScore([
      issue('error', 'rule-a'),
      issue('error', 'rule-a'),
      issue('error', 'rule-a'),
    ]);
    expect(multipleIssues).toBe(singleIssue);
  });

  it('uses worst severity per rule', () => {
    // If a rule has both warn and error, error wins
    const mixedScore = calculateLintScore([
      issue('warn', 'rule-a'),
      issue('error', 'rule-a'),
    ]);
    const errorScore = calculateLintScore([issue('error', 'rule-a')]);
    expect(mixedScore).toBe(errorScore);
  });

  it('clamps to 0 when all rules fail with errors', () => {
    const allErrors = allRules.map((r) => issue('error', r.id));
    expect(calculateLintScore(allErrors)).toBe(0);
  });

  it('combines multiple failing rules', () => {
    const issues = [
      issue('error', 'rule-a'),
      issue('warn', 'rule-b'),
      issue('info', 'rule-c'),
    ];
    // deduction = 3 + 2 + 1 = 6 out of totalRules * 3
    const expected = Math.round(100 * (1 - 6 / (totalRules * 3)));
    expect(calculateLintScore(issues)).toBe(expected);
  });
});
