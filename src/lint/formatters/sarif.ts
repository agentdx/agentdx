import type { LintResult, LintSeverity } from '../../core/types.js';

/**
 * Map lint severity to SARIF level.
 */
function sarifLevel(severity: LintSeverity): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'info':
      return 'note';
  }
}

/**
 * Format lint results as SARIF v2.1.0.
 * Suitable for upload to GitHub Code Scanning via github/codeql-action/upload-sarif.
 */
export function formatSarif(result: LintResult): string {
  const rules = new Map<string, { id: string; description: string; severity: LintSeverity }>();

  for (const issue of result.issues) {
    if (!rules.has(issue.rule)) {
      rules.set(issue.rule, {
        id: issue.rule,
        description: issue.message,
        severity: issue.severity,
      });
    }
  }

  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0' as const,
    runs: [
      {
        tool: {
          driver: {
            name: 'agentdx',
            informationUri: 'https://github.com/agentdx/agentdx',
            rules: [...rules.values()].map((r) => ({
              id: r.id,
              shortDescription: { text: r.description },
              defaultConfiguration: { level: sarifLevel(r.severity) },
            })),
          },
        },
        results: result.issues.map((issue) => ({
          ruleId: issue.rule,
          level: sarifLevel(issue.severity),
          message: { text: issue.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: issue.tool ? `tool://${issue.tool}` : 'tool://unknown',
                },
              },
            },
          ],
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
