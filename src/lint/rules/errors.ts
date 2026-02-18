import type { LintRule, LintIssue } from '../../core/types.js';

/**
 * error-content: Checks if tool descriptions mention error behavior.
 * Full runtime error analysis requires `agentdx bench`.
 */
export const errorContent: LintRule = {
  id: 'error-content',
  description: 'Tool should document error behavior in description',
  severity: 'warn',
  check(_tools) {
    // Static analysis can't inspect actual error responses.
    // This rule will be populated by bench results in the future.
    const _issues: LintIssue[] = [];
    return _issues;
  },
};

/**
 * error-types: Checks if tools differentiate error modes.
 * Requires runtime data — placeholder for bench integration.
 */
export const errorTypes: LintRule = {
  id: 'error-types',
  description: 'Tools should differentiate error modes',
  severity: 'info',
  check(_tools) {
    const _issues: LintIssue[] = [];
    return _issues;
  },
};
