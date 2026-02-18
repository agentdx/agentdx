import { describe, it, expect } from 'vitest';
import { evaluateParameters } from '../../../src/bench/evaluators/parameters.js';
import type { BenchScenario } from '../../../src/bench/types.js';
import type { LLMResponse } from '../../../src/bench/llm/adapter.js';

function scenario(expectedParams?: Record<string, unknown>): BenchScenario {
  return {
    id: 'test',
    task: 'test task',
    expectedTool: 'get_weather',
    expectedParams,
    tags: ['positive'],
    difficulty: 'easy',
  };
}

function response(args: Record<string, unknown>): LLMResponse {
  return {
    content: '',
    toolCalls: [{ name: 'get_weather', arguments: args }],
    inputTokens: 0,
    outputTokens: 0,
  };
}

describe('evaluateParameters', () => {
  it('scores exact match at 100', () => {
    const result = evaluateParameters(
      [scenario({ city: 'Tokyo' })],
      [response({ city: 'Tokyo' })],
    );
    expect(result.score).toBe(100);
    expect(result.details[0]!.passed).toBe(true);
  });

  it('gives partial credit for case differences', () => {
    const result = evaluateParameters(
      [scenario({ city: 'New York' })],
      [response({ city: 'new york' })],
    );
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes missing params', () => {
    const result = evaluateParameters(
      [scenario({ city: 'Tokyo', units: 'celsius' })],
      [response({ city: 'Tokyo' })],
    );
    expect(result.score).toBeLessThan(100);
    expect(result.details[0]!.note).toContain('missing');
  });

  it('notes extra unexpected params', () => {
    const result = evaluateParameters(
      [scenario({ city: 'Tokyo' })],
      [response({ city: 'Tokyo', extra: 'value' })],
    );
    expect(result.details[0]!.note).toContain('unexpected');
  });

  it('skips scenarios without expectedParams', () => {
    const result = evaluateParameters(
      [scenario(undefined)],
      [response({ city: 'Tokyo' })],
    );
    expect(result.score).toBe(100);
    expect(result.details).toHaveLength(0);
  });

  it('handles type coercion (string vs number)', () => {
    const result = evaluateParameters(
      [scenario({ limit: 10 })],
      [response({ limit: '10' })],
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it('handles no tool calls gracefully', () => {
    const noCallResponse: LLMResponse = {
      content: 'I cannot help with that.',
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    };
    const result = evaluateParameters(
      [scenario({ city: 'Tokyo' })],
      [noCallResponse],
    );
    expect(result.score).toBeLessThan(50);
  });

  it('returns weight 0.3', () => {
    const result = evaluateParameters([], []);
    expect(result.weight).toBe(0.3);
    expect(result.dimension).toBe('Parameter Accuracy');
  });
});
