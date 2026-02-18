import type { LintIssue } from '../core/types.js';

/**
 * Calculate a 0–100 lint score from a list of issues.
 * Formula: 100 - (10 * errors) - (3 * warnings) - (1 * info), clamped to [0, 100].
 */
export function calculateLintScore(issues: LintIssue[]): number {
  let errors = 0;
  let warns = 0;
  let infos = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        errors++;
        break;
      case 'warn':
        warns++;
        break;
      case 'info':
        infos++;
        break;
    }
  }

  const score = 100 - 10 * errors - 3 * warns - 1 * infos;
  return Math.max(0, Math.min(100, score));
}
