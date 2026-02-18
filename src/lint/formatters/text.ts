import type { LintResult, LintSeverity } from '../../core/types.js';
import { allRules } from '../rules/index.js';

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
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';

export interface FormatTextOptions {
  fixSuggestions?: boolean;
}

/**
 * Format lint results as colored terminal text.
 */
export function formatText(result: LintResult, serverName?: string, options: FormatTextOptions = {}): string {
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

    if (options.fixSuggestions && issue.fix) {
      lines.push(`         ${DIM}\u2192 ${issue.fix}${RESET}`);
    }
  }

  // Pass summaries — rules that found no issues
  const rulesWithIssues = new Set(result.issues.map((i) => i.rule));
  const passedCount = allRules.filter((r) => !rulesWithIssues.has(r.id)).length;

  if (sorted.length === 0) {
    lines.push(`  ${GREEN}\u2713 All ${allRules.length} rules passed${RESET}`);
  }

  lines.push('');

  // Summary line: ✓ 12 rules passed | ⚠ 3 warnings | ✗ 2 errors
  const parts: string[] = [];
  if (passedCount > 0) {
    parts.push(`${GREEN}\u2713 ${passedCount} rules passed${RESET}`);
  }
  if (warns.length > 0) {
    parts.push(`${YELLOW}\u26A0 ${warns.length} warning${warns.length !== 1 ? 's' : ''}${RESET}`);
  }
  if (errors.length > 0) {
    parts.push(`${RED}\u2717 ${errors.length} error${errors.length !== 1 ? 's' : ''}${RESET}`);
  }
  if (infos.length > 0) {
    parts.push(`${DIM}\u2139 ${infos.length} info${RESET}`);
  }
  lines.push(`  ${parts.join(' | ')}`);

  lines.push('');
  lines.push(`  ${BOLD}Lint Score: ${result.score}/100${RESET}`);
  lines.push('');

  return lines.join('\n');
}
