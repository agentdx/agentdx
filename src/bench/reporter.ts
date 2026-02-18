import type { BenchReport } from './engine.js';
import type { EvaluatorResult } from './types.js';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

function scoreColor(score: number): string {
  if (score >= 90) return GREEN;
  if (score >= 75) return CYAN;
  if (score >= 50) return YELLOW;
  return RED;
}

function progressBar(score: number, width = 22): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = scoreColor(score);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

function dimensionSummary(result: EvaluatorResult): string {
  const passed = result.details.filter((d) => d.passed).length;
  const total = result.details.length;

  if (total === 0) return '';

  const failedNotes = result.details
    .filter((d) => !d.passed)
    .map((d) => d.note)
    .filter((n): n is string => !!n);

  if (failedNotes.length > 0) return `(${failedNotes[0]})`;
  return `(${passed}/${total} correct)`;
}

/**
 * Format bench results as colored terminal text matching the spec output.
 */
export function formatBenchText(report: BenchReport, serverName?: string): string {
  const lines: string[] = [];
  const toolCount = report.tools.length;
  const scenarioCount = report.scenarios.length;

  const header = serverName
    ? `AgentDX Bench \u2014 ${serverName} (${toolCount} tool${toolCount !== 1 ? 's' : ''}, ${scenarioCount} scenario${scenarioCount !== 1 ? 's' : ''})`
    : `AgentDX Bench \u2014 ${toolCount} tool${toolCount !== 1 ? 's' : ''}, ${scenarioCount} scenario${scenarioCount !== 1 ? 's' : ''}`;

  lines.push('');
  lines.push(`  ${BOLD}${header}${RESET}`);
  lines.push('');

  // Dimension bars
  const maxDimLen = Math.max(...report.score.dimensions.map((d) => d.dimension.length));

  for (const dim of report.score.dimensions) {
    const padded = dim.dimension.padEnd(maxDimLen);
    const bar = progressBar(dim.score);
    const pct = `${dim.score}%`.padStart(4);
    const summary = dimensionSummary(dim);
    lines.push(`  ${padded} ${bar}  ${pct}  ${DIM}${summary}${RESET}`);
  }

  lines.push('');

  // Score box
  const scoreStr = `Agent DX Score:  ${report.score.overall} / 100`;
  const ratingStr = `Rating: ${report.score.rating}`;
  const boxWidth = Math.max(scoreStr.length, ratingStr.length) + 4;
  const topBorder = '\u250C' + '\u2500'.repeat(boxWidth) + '\u2510';
  const botBorder = '\u2514' + '\u2500'.repeat(boxWidth) + '\u2518';

  const color = scoreColor(report.score.overall);
  lines.push(`  ${topBorder}`);
  lines.push(`  \u2502  ${color}${BOLD}${scoreStr}${RESET}${' '.repeat(boxWidth - scoreStr.length - 2)}\u2502`);
  lines.push(`  \u2502  ${ratingStr}${' '.repeat(boxWidth - ratingStr.length - 2)}\u2502`);
  lines.push(`  ${botBorder}`);

  // Top issues
  if (report.score.topIssues.length > 0) {
    lines.push('');
    lines.push(`  ${BOLD}Top issues:${RESET}`);
    for (let i = 0; i < report.score.topIssues.length; i++) {
      const issue = report.score.topIssues[i]!;
      lines.push(`  ${i + 1}. ${issue.description}`);
      lines.push(`     ${DIM}\u2192 Fix: ${issue.suggestion}${RESET}`);
    }
  }

  // Cost summary
  lines.push('');
  if (report.totalCost > 0) {
    lines.push(`  ${DIM}Cost: ~$${report.totalCost.toFixed(4)} (${report.totalInputTokens + report.totalOutputTokens} tokens)${RESET}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format bench results as structured JSON.
 */
export function formatBenchJson(report: BenchReport): string {
  const output = {
    score: report.score.overall,
    rating: report.score.rating,
    dimensions: report.score.dimensions.map((d) => ({
      dimension: d.dimension,
      score: d.score,
      weight: d.weight,
      passed: d.details.filter((det) => det.passed).length,
      total: d.details.length,
      details: d.details,
    })),
    topIssues: report.score.topIssues,
    scenarios: report.scenarios.map((s, i) => ({
      id: s.id,
      task: s.task,
      expectedTool: s.expectedTool,
      expectedParams: s.expectedParams,
      tags: s.tags,
      difficulty: s.difficulty,
      response: report.responses[i] ? {
        content: report.responses[i]!.content,
        toolCalls: report.responses[i]!.toolCalls,
      } : undefined,
    })),
    config: {
      provider: report.config.provider,
      model: report.config.model,
      runs: report.config.runs,
      temperature: report.config.temperature,
    },
    tools: report.tools.map((t) => t.name),
    cost: {
      inputTokens: report.totalInputTokens,
      outputTokens: report.totalOutputTokens,
      estimatedCost: report.totalCost,
    },
  };

  return JSON.stringify(output, null, 2);
}
