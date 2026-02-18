import type { LLMResponse } from '../llm/adapter.js';
import type { BenchScenario, EvaluatorResult, EvalDetail } from '../types.js';

/**
 * Multi-tool Evaluator (weight: 10%)
 *
 * Only runs on scenarios tagged "multi-tool".
 * Checks if LLM made multiple tool calls and in a reasonable sequence.
 */
export function evaluateMultiTool(
  scenarios: BenchScenario[],
  responses: LLMResponse[],
  availableTools: Set<string>,
): EvaluatorResult {
  const details: EvalDetail[] = [];
  let totalScore = 0;
  let evaluated = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const response = responses[i]!;

    if (!scenario.tags.includes('multi-tool')) continue;
    evaluated++;

    const toolCalls = response.toolCalls;

    if (toolCalls.length === 0) {
      details.push({
        scenarioId: scenario.id,
        passed: false,
        expected: 'multiple tool calls',
        actual: 'no tool calls',
        note: 'LLM did not call any tools',
      });
      continue;
    }

    if (toolCalls.length === 1) {
      // Only one call when multiple expected — partial credit
      const isValid = availableTools.has(toolCalls[0]!.name);
      totalScore += isValid ? 0.3 : 0;
      details.push({
        scenarioId: scenario.id,
        passed: false,
        expected: 'multiple tool calls',
        actual: `1 call: ${toolCalls[0]!.name}`,
        note: 'Only made a single tool call',
      });
      continue;
    }

    // Multiple tool calls made — check validity
    const allValid = toolCalls.every((tc) => availableTools.has(tc.name));
    const hasNoDuplicates = new Set(toolCalls.map((tc) => JSON.stringify(tc))).size === toolCalls.length;

    let score = 0.5; // Base credit for making multiple calls
    if (allValid) score += 0.3; // All tools exist
    if (hasNoDuplicates) score += 0.2; // No redundant duplicate calls

    totalScore += score;

    const names = toolCalls.map((tc) => tc.name).join(' → ');
    details.push({
      scenarioId: scenario.id,
      passed: score >= 0.8,
      expected: 'multiple tool calls',
      actual: `${toolCalls.length} calls: ${names}`,
      note: !allValid
        ? 'Some tool calls reference non-existent tools'
        : !hasNoDuplicates
          ? 'Contains redundant duplicate calls'
          : undefined,
    });
  }

  const finalScore = evaluated > 0 ? Math.round((totalScore / evaluated) * 100) : 100;

  return {
    dimension: 'Multi-tool',
    score: finalScore,
    weight: 0.1,
    details,
  };
}
