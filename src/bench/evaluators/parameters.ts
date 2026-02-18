import type { LLMResponse } from '../llm/adapter.js';
import type { BenchScenario, EvaluatorResult, EvalDetail } from '../types.js';

/**
 * Normalize a value for fuzzy comparison.
 * Handles case differences and whitespace.
 */
function normalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().trim();
}

/**
 * Compare two parameter objects and return a similarity score (0–1).
 * Gives partial credit for close matches.
 */
function compareParams(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): { score: number; mismatches: string[] } {
  const expectedKeys = Object.keys(expected);
  if (expectedKeys.length === 0) return { score: 1, mismatches: [] };

  let matched = 0;
  const mismatches: string[] = [];

  for (const key of expectedKeys) {
    const expectedVal = expected[key];
    const actualVal = actual[key];

    if (actualVal === undefined) {
      mismatches.push(`missing "${key}"`);
      continue;
    }

    // Exact match
    if (expectedVal === actualVal) {
      matched++;
      continue;
    }

    // Fuzzy string match (case-insensitive)
    if (normalize(expectedVal) === normalize(actualVal)) {
      matched += 0.8; // Partial credit
      continue;
    }

    // Type-coerced match (e.g., "10" vs 10)
    if (String(expectedVal) === String(actualVal)) {
      matched += 0.5;
      continue;
    }

    mismatches.push(`"${key}": expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actualVal)}`);
  }

  // Penalize extra unexpected params slightly
  const actualKeys = Object.keys(actual);
  const extraKeys = actualKeys.filter((k) => !(k in expected));
  if (extraKeys.length > 0) {
    mismatches.push(`unexpected params: ${extraKeys.join(', ')}`);
  }

  return {
    score: matched / expectedKeys.length,
    mismatches,
  };
}

/**
 * Parameter Evaluator (weight: 30%)
 *
 * Deep comparison of actual tool call arguments with expected parameters.
 * Only evaluates scenarios that have expectedParams defined.
 */
export function evaluateParameters(
  scenarios: BenchScenario[],
  responses: LLMResponse[],
): EvaluatorResult {
  const details: EvalDetail[] = [];
  let totalScore = 0;
  let evaluated = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const response = responses[i]!;

    // Only evaluate scenarios with expected params
    if (!scenario.expectedParams) continue;
    evaluated++;

    const actualArgs = response.toolCalls[0]?.arguments ?? {};
    const { score, mismatches } = compareParams(scenario.expectedParams, actualArgs);

    totalScore += score;

    details.push({
      scenarioId: scenario.id,
      passed: score >= 0.8,
      expected: JSON.stringify(scenario.expectedParams),
      actual: JSON.stringify(actualArgs),
      note: mismatches.length > 0 ? mismatches.join('; ') : undefined,
    });
  }

  const finalScore = evaluated > 0 ? Math.round((totalScore / evaluated) * 100) : 100;

  return {
    dimension: 'Parameter Accuracy',
    score: finalScore,
    weight: 0.3,
    details,
  };
}
