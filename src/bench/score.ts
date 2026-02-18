import type { EvaluatorResult, DXScore, TopIssue } from './types.js';

function scoreToRating(score: number): DXScore['rating'] {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Poor';
}

function extractTopIssues(results: EvaluatorResult[]): TopIssue[] {
  const issues: TopIssue[] = [];

  // Sort dimensions by score (lowest first) to find the worst areas
  const sorted = [...results].sort((a, b) => a.score - b.score);

  for (const result of sorted) {
    if (result.score >= 90) continue; // Skip dimensions that are doing well
    if (issues.length >= 3) break;

    // Find the most common failure pattern in this dimension
    const failedDetails = result.details.filter((d) => !d.passed);
    if (failedDetails.length === 0) continue;

    const notes = failedDetails
      .map((d) => d.note)
      .filter((n): n is string => !!n);

    const description = notes.length > 0
      ? `${result.dimension}: ${notes[0]}`
      : `${result.dimension}: ${failedDetails.length} scenario(s) failed`;

    let suggestion: string;
    switch (result.dimension) {
      case 'Tool Selection':
        suggestion = 'Improve tool descriptions to be more specific and distinct from each other';
        break;
      case 'Parameter Accuracy':
        suggestion = 'Add parameter descriptions and default values to your input schemas';
        break;
      case 'Ambiguity Handling':
        suggestion = 'Make tool descriptions clearer about when each tool should be used';
        break;
      case 'Multi-tool':
        suggestion = 'Consider adding tool descriptions that explain relationships between tools';
        break;
      case 'Error Recovery':
        suggestion = 'Return structured error messages with actionable information';
        break;
      default:
        suggestion = 'Review tool definitions for clarity';
    }

    issues.push({ dimension: result.dimension, description, suggestion });
  }

  return issues;
}

/**
 * Calculate the Agent DX Score from evaluator results.
 * Weighted average of all evaluator scores.
 */
export function calculateDXScore(results: EvaluatorResult[]): DXScore {
  const weightedScore = results.reduce(
    (sum, r) => sum + r.score * r.weight,
    0,
  );

  const totalWeight = results.reduce(
    (sum, r) => sum + r.weight,
    0,
  );

  const overall = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  return {
    overall,
    rating: scoreToRating(overall),
    dimensions: results,
    topIssues: extractTopIssues(results),
  };
}
