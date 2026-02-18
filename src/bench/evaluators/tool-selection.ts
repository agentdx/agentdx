import type { LLMResponse } from '../llm/adapter.js';
import type { BenchScenario, EvaluatorResult, EvalDetail } from '../types.js';

/**
 * Tool Selection Evaluator (weight: 35%)
 *
 * Compares the LLM's first tool call with the expected tool.
 * Handles: correct selection, wrong selection, hallucination, correct refusal.
 */
export function evaluateToolSelection(
  scenarios: BenchScenario[],
  responses: LLMResponse[],
  availableTools: Set<string>,
): EvaluatorResult {
  const details: EvalDetail[] = [];
  let passed = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const response = responses[i]!;
    const actualTool = response.toolCalls[0]?.name ?? null;
    const expected = scenario.expectedTool;

    if (expected === null) {
      // Negative scenario — LLM should NOT call any tool
      if (actualTool === null) {
        passed++;
        details.push({
          scenarioId: scenario.id,
          passed: true,
          expected: 'no tool call',
          actual: 'no tool call',
          note: 'Correct refusal',
        });
      } else {
        details.push({
          scenarioId: scenario.id,
          passed: false,
          expected: 'no tool call',
          actual: actualTool,
          note: availableTools.has(actualTool)
            ? `Wrong — called ${actualTool} when no tool should be used`
            : `Hallucinated tool "${actualTool}" that doesn't exist`,
        });
      }
    } else {
      // Positive scenario — LLM should call the expected tool
      if (actualTool === expected) {
        passed++;
        details.push({
          scenarioId: scenario.id,
          passed: true,
          expected,
          actual: actualTool,
        });
      } else if (actualTool === null) {
        details.push({
          scenarioId: scenario.id,
          passed: false,
          expected,
          actual: 'no tool call',
          note: 'LLM did not call any tool',
        });
      } else if (!availableTools.has(actualTool)) {
        details.push({
          scenarioId: scenario.id,
          passed: false,
          expected,
          actual: actualTool,
          note: `Hallucinated tool "${actualTool}"`,
        });
      } else {
        details.push({
          scenarioId: scenario.id,
          passed: false,
          expected,
          actual: actualTool,
          note: `Called ${actualTool} instead of ${expected}`,
        });
      }
    }
  }

  const total = scenarios.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  return {
    dimension: 'Tool Selection',
    score,
    weight: 0.35,
    details,
  };
}
