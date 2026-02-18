import { describe, it, expect } from 'vitest';
import { evaluateAmbiguity } from '../../../src/bench/evaluators/ambiguity.js';
import type { BenchScenario } from '../../../src/bench/types.js';
import type { LLMResponse } from '../../../src/bench/llm/adapter.js';

function ambiguousScenario(): BenchScenario {
  return {
    id: 'ambig-1',
    task: "How's the weather?",
    expectedTool: 'get_weather',
    tags: ['ambiguous'],
    difficulty: 'medium',
  };
}

function response(content: string, toolName?: string): LLMResponse {
  return {
    content,
    toolCalls: toolName ? [{ name: toolName, arguments: {} }] : [],
    inputTokens: 0,
    outputTokens: 0,
  };
}

describe('evaluateAmbiguity', () => {
  it('scores 100 for asking clarification without tool call', () => {
    const result = evaluateAmbiguity(
      [ambiguousScenario()],
      [response('Could you please specify which city you want the weather for?')],
    );
    expect(result.score).toBe(100);
    expect(result.details[0]!.passed).toBe(true);
  });

  it('gives partial credit for tool call with clarification', () => {
    const result = evaluateAmbiguity(
      [ambiguousScenario()],
      [response(
        "I'm not sure which city you mean, but I'll check your default location.",
        'get_weather',
      )],
    );
    expect(result.score).toBe(70);
    expect(result.details[0]!.passed).toBe(true);
  });

  it('penalizes silent tool call with explanation', () => {
    const result = evaluateAmbiguity(
      [ambiguousScenario()],
      [response(
        "Let me check the weather for your area. Here's what I found for the local region.",
        'get_weather',
      )],
    );
    expect(result.score).toBe(50);
    expect(result.details[0]!.passed).toBe(false);
  });

  it('scores 0 for silent tool call without explanation', () => {
    const result = evaluateAmbiguity(
      [ambiguousScenario()],
      [response('', 'get_weather')],
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.note).toContain('Did not acknowledge');
  });

  it('skips non-ambiguous scenarios', () => {
    const positiveScenario: BenchScenario = {
      id: 'pos-1',
      task: "What's the weather in Tokyo?",
      expectedTool: 'get_weather',
      tags: ['positive'],
      difficulty: 'easy',
    };
    const result = evaluateAmbiguity(
      [positiveScenario],
      [response('', 'get_weather')],
    );
    expect(result.score).toBe(100); // No ambiguous scenarios → perfect
    expect(result.details).toHaveLength(0);
  });

  it('returns weight 0.15', () => {
    const result = evaluateAmbiguity([], []);
    expect(result.weight).toBe(0.15);
    expect(result.dimension).toBe('Ambiguity Handling');
  });
});
