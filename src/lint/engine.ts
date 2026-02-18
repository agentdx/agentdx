import type { ToolDefinition, LintIssue, LintResult, LintSeverity } from '../core/types.js';
import { allRules } from './rules/index.js';
import { calculateLintScore } from './score.js';

export interface LintOptions {
  /** Rule overrides from config. Key is rule id, value is severity or false to disable. */
  rules?: Record<string, string | number | boolean>;
}

/**
 * Run all lint rules against a set of tool definitions.
 * Returns aggregated issues and a 0–100 lint score.
 */
export function lint(tools: ToolDefinition[], options: LintOptions = {}): LintResult {
  const ruleOverrides = options.rules ?? {};
  const issues: LintIssue[] = [];

  for (const rule of allRules) {
    const override = ruleOverrides[rule.id];

    // Disable rule entirely
    if (override === false || override === 'off') continue;

    // Override severity
    let severity: LintSeverity = rule.severity;
    if (override === 'error' || override === 'warn' || override === 'info') {
      severity = override;
    }

    const ruleIssues = rule.check(tools);
    for (const issue of ruleIssues) {
      issues.push({ ...issue, severity });
    }
  }

  const score = calculateLintScore(issues);

  return { issues, tools, score };
}
