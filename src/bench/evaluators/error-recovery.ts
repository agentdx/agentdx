import type { LLMAdapter, LLMResponse } from '../llm/adapter.js';
import type { ToolDefinition } from '../../core/types.js';
import type { BenchScenario, EvaluatorResult, EvalDetail } from '../types.js';

const RECOVERY_PATTERNS = [
  /try (again|a different|another)/i,
  /let me (retry|try|attempt)/i,
  /error|failed|issue|problem/i,
  /apologize|sorry/i,
  /alternative|instead/i,
  /couldn'?t|unable|cannot/i,
];

/**
 * Error Recovery Evaluator (weight: 10%)
 *
 * Simulates tool errors and checks if the LLM retries or explains.
 * Requires additional LLM calls — can be skipped.
 */
export async function evaluateErrorRecovery(
  scenarios: BenchScenario[],
  responses: LLMResponse[],
  adapter: LLMAdapter,
  tools: ToolDefinition[],
): Promise<EvaluatorResult> {
  const details: EvalDetail[] = [];
  let totalScore = 0;
  let evaluated = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const response = responses[i]!;

    // Only test error recovery on scenarios where a tool was called
    if (response.toolCalls.length === 0) continue;
    if (scenario.expectedTool === null) continue;
    evaluated++;

    const toolCall = response.toolCalls[0]!;

    // Simulate error by sending a follow-up with an error message
    try {
      const recoveryResponse = await adapter.chat({
        system: 'You are a helpful assistant that uses tools to complete tasks.',
        messages: [
          { role: 'user', content: scenario.task },
          { role: 'assistant', content: response.content || `I'll use ${toolCall.name} to help with that.` },
          {
            role: 'user',
            content: `Error: The tool "${toolCall.name}" returned an error: "Invalid parameters: the request could not be processed. Please check your inputs and try again."`,
          },
        ],
        tools,
        temperature: 0,
      });

      const content = recoveryResponse.content;
      const madeRetry = recoveryResponse.toolCalls.length > 0;
      const acknowledgedError = RECOVERY_PATTERNS.some((p) => p.test(content));

      if (madeRetry && acknowledgedError) {
        // Best: retried with explanation
        totalScore += 1;
        details.push({
          scenarioId: scenario.id,
          passed: true,
          expected: 'retry or explain error',
          actual: `retried ${recoveryResponse.toolCalls[0]?.name ?? 'tool'} with explanation`,
        });
      } else if (madeRetry) {
        // Retried without explanation — still good
        totalScore += 0.8;
        details.push({
          scenarioId: scenario.id,
          passed: true,
          expected: 'retry or explain error',
          actual: `retried ${recoveryResponse.toolCalls[0]?.name ?? 'tool'}`,
          note: 'Retried but did not explain the error',
        });
      } else if (acknowledgedError) {
        // Explained error but didn't retry — acceptable
        totalScore += 0.5;
        details.push({
          scenarioId: scenario.id,
          passed: false,
          expected: 'retry or explain error',
          actual: 'explained error without retry',
          note: 'Acknowledged error but did not attempt recovery',
        });
      } else {
        // No recovery
        totalScore += 0;
        details.push({
          scenarioId: scenario.id,
          passed: false,
          expected: 'retry or explain error',
          actual: 'no recovery attempt',
          note: 'Did not acknowledge or recover from error',
        });
      }
    } catch {
      // If the LLM call itself fails, skip this scenario
      details.push({
        scenarioId: scenario.id,
        passed: false,
        expected: 'retry or explain error',
        actual: 'evaluation failed',
        note: 'LLM call failed during error recovery test',
      });
    }
  }

  const finalScore = evaluated > 0 ? Math.round((totalScore / evaluated) * 100) : 100;

  return {
    dimension: 'Error Recovery',
    score: finalScore,
    weight: 0.1,
    details,
  };
}
