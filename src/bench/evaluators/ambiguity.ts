import type { LLMResponse } from '../llm/adapter.js';
import type { BenchScenario, EvaluatorResult, EvalDetail } from '../types.js';

const CLARIFICATION_PATTERNS = [
  /could you (please )?(clarify|specify|tell me|provide)/i,
  /which (one|tool|option)/i,
  /do you mean/i,
  /i'?m not sure (which|what|if)/i,
  /can you be more specific/i,
  /there are (multiple|several|a few)/i,
  /did you mean/i,
  /i need more (information|details|context)/i,
  /please (specify|clarify|provide)/i,
  /\?$/m, // Ends a line with a question mark
];

/**
 * Ambiguity Evaluator (weight: 15%)
 *
 * Only runs on scenarios tagged "ambiguous".
 * Checks if LLM asked for clarification or made a reasonable default choice.
 * Penalizes silent wrong guesses.
 */
export function evaluateAmbiguity(
  scenarios: BenchScenario[],
  responses: LLMResponse[],
): EvaluatorResult {
  const details: EvalDetail[] = [];
  let totalScore = 0;
  let evaluated = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const response = responses[i]!;

    if (!scenario.tags.includes('ambiguous')) continue;
    evaluated++;

    const content = response.content;
    const madeToolCall = response.toolCalls.length > 0;
    const askedForClarification = CLARIFICATION_PATTERNS.some((p) => p.test(content));

    if (askedForClarification && !madeToolCall) {
      // Best case: asked for clarification without guessing
      totalScore += 1;
      details.push({
        scenarioId: scenario.id,
        passed: true,
        expected: 'clarification or reasonable default',
        actual: 'asked for clarification',
      });
    } else if (askedForClarification && madeToolCall) {
      // Acceptable: made a call but also acknowledged ambiguity
      totalScore += 0.7;
      details.push({
        scenarioId: scenario.id,
        passed: true,
        expected: 'clarification or reasonable default',
        actual: 'made tool call with clarification note',
        note: 'Acknowledged ambiguity while making a default choice',
      });
    } else if (madeToolCall && content.length > 20) {
      // Made a call with explanation — partial credit
      totalScore += 0.5;
      details.push({
        scenarioId: scenario.id,
        passed: false,
        expected: 'clarification or reasonable default',
        actual: `called ${response.toolCalls[0]?.name ?? 'unknown'} with explanation`,
        note: 'Made assumption without acknowledging ambiguity',
      });
    } else {
      // Silent guess or no response — worst case
      totalScore += 0;
      details.push({
        scenarioId: scenario.id,
        passed: false,
        expected: 'clarification or reasonable default',
        actual: madeToolCall
          ? `silently called ${response.toolCalls[0]?.name ?? 'unknown'}`
          : 'no response',
        note: 'Did not acknowledge ambiguity',
      });
    }
  }

  const finalScore = evaluated > 0 ? Math.round((totalScore / evaluated) * 100) : 100;

  return {
    dimension: 'Ambiguity Handling',
    score: finalScore,
    weight: 0.15,
    details,
  };
}
