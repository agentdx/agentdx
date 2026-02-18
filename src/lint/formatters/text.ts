import type { LintResult, LintSeverity } from '../../core/types.js';

const SYMBOLS: Record<LintSeverity, string> = {
  error: '\u2717 error',
  warn: '\u26A0 warn ',
  info: '\u2139 info ',
};

const COLORS: Record<LintSeverity, string> = {
  error: '\x1b[31m',  // red
  warn: '\x1b[33m',   // yellow
  info: '\x1b[36m',   // cyan
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';

/**
 * Format lint results as colored terminal text.
 * Matches the spec output format from SPEC.md section 3.
 */
export function formatText(result: LintResult, serverName?: string): string {
  const lines: string[] = [];
  const toolCount = result.tools.length;
  const header = serverName
    ? `AgentDX Lint \u2014 ${serverName} (${toolCount} tool${toolCount !== 1 ? 's' : ''})`
    : `AgentDX Lint \u2014 ${toolCount} tool${toolCount !== 1 ? 's' : ''}`;

  lines.push('');
  lines.push(`  ${BOLD}${header}${RESET}`);
  lines.push('');

  // Group issues by severity for ordering: errors first, then warns, then info
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warns = result.issues.filter((i) => i.severity === 'warn');
  const infos = result.issues.filter((i) => i.severity === 'info');
  const sorted = [...errors, ...warns, ...infos];

  for (const issue of sorted) {
    const color = COLORS[issue.severity];
    const symbol = SYMBOLS[issue.severity];
    const ruleTag = `${DIM}[${issue.rule}]${RESET}`;
    lines.push(`  ${color}${symbol}${RESET}  ${issue.message}  ${ruleTag}`);
  }

  // Pass summaries — rules that found no issues
  const rulesWithIssues = new Set(result.issues.map((i) => i.rule));
  const passedChecks: string[] = [];

  if (!rulesWithIssues.has('desc-exists')) {
    passedChecks.push(`${toolCount}/${toolCount} tools have descriptions`);
  }
  if (!rulesWithIssues.has('name-convention')) {
    passedChecks.push('naming is consistent');
  }
  if (!rulesWithIssues.has('name-unique')) {
    passedChecks.push('no duplicate tool names');
  }

  if (passedChecks.length > 0) {
    for (const check of passedChecks) {
      lines.push(`  ${GREEN}\u2713 pass${RESET}   ${check}`);
    }
  }

  lines.push('');

  // Summary line
  const parts: string[] = [];
  if (errors.length > 0) parts.push(`${errors.length} error${errors.length !== 1 ? 's' : ''}`);
  if (warns.length > 0) parts.push(`${warns.length} warning${warns.length !== 1 ? 's' : ''}`);
  if (infos.length > 0) parts.push(`${infos.length} info`);
  if (parts.length > 0) {
    lines.push(`  ${parts.join(' \u00B7 ')}`);
  } else {
    lines.push(`  ${GREEN}No issues found${RESET}`);
  }

  lines.push('');
  lines.push(`  ${BOLD}Lint Score: ${result.score}/100${RESET}`);
  lines.push('');

  return lines.join('\n');
}
