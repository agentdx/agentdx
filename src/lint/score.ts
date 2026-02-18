import type { LintIssue } from '../core/types.js';
import { allRules } from './rules/index.js';

/**
 * Calculate a 0–100 lint score based on rule pass rate.
 *
 * The score reflects the percentage of rules that passed with no issues,
 * weighted by severity: errors count 3x, warnings count 2x, infos count 1x.
 *
 * This approach normalizes naturally — a server with 20 tools and a server
 * with 1 tool are scored on the same scale (rules passed vs. rules failed).
 */
export function calculateLintScore(issues: LintIssue[]): number {
  const totalRules = allRules.length;
  if (totalRules === 0) return 100;

  // Group issues by rule and track the worst severity per rule
  const ruleWorstSeverity = new Map<string, 'error' | 'warn' | 'info'>();
  for (const issue of issues) {
    const current = ruleWorstSeverity.get(issue.rule);
    if (!current || severityWeight(issue.severity) > severityWeight(current)) {
      ruleWorstSeverity.set(issue.rule, issue.severity);
    }
  }

  // Calculate weighted deductions
  let deduction = 0;
  for (const severity of ruleWorstSeverity.values()) {
    switch (severity) {
      case 'error':
        deduction += 3;
        break;
      case 'warn':
        deduction += 2;
        break;
      case 'info':
        deduction += 1;
        break;
    }
  }

  // Max possible deduction = totalRules * 3 (if every rule had an error)
  const maxDeduction = totalRules * 3;
  const score = Math.round(100 * (1 - deduction / maxDeduction));
  return Math.max(0, Math.min(100, score));
}

function severityWeight(severity: 'error' | 'warn' | 'info'): number {
  switch (severity) {
    case 'error': return 3;
    case 'warn': return 2;
    case 'info': return 1;
  }
}
