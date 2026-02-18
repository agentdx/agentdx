import type { LintResult } from '../../core/types.js';

/**
 * Format lint results as structured JSON.
 */
export function formatJson(result: LintResult): string {
  const output = {
    score: result.score,
    toolCount: result.tools.length,
    summary: {
      errors: result.issues.filter((i) => i.severity === 'error').length,
      warnings: result.issues.filter((i) => i.severity === 'warn').length,
      info: result.issues.filter((i) => i.severity === 'info').length,
    },
    issues: result.issues.map((issue) => ({
      rule: issue.rule,
      severity: issue.severity,
      message: issue.message,
      ...(issue.tool ? { tool: issue.tool } : {}),
      ...(issue.param ? { param: issue.param } : {}),
    })),
    tools: result.tools.map((t) => t.name),
  };

  return JSON.stringify(output, null, 2);
}
