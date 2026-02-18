import { describe, it, expect } from 'vitest';
import { evaluateMultiTool } from '../../../src/bench/evaluators/multi-tool.js';
import type { BenchScenario } from '../../../src/bench/types.js';
import type { LLMResponse } from '../../../src/bench/llm/adapter.js';

const AVAILABLE = new Set(['get_weather', 'list_cities', 'get_forecast']);

function multiScenario(): BenchScenario {
  return {
    id: 'multi-1',
    task: 'Get weather for all cities then forecast',
    expectedTool: 'get_weather',
    tags: ['multi-tool'],
    difficulty: 'medium',
  };
}

function response(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): LLMResponse {
  return {
    content: '',
    toolCalls,
    inputTokens: 0,
    outputTokens: 0,
  };
}

describe('evaluateMultiTool', () => {
  it('scores high for multiple valid tool calls', () => {
    const result = evaluateMultiTool(
      [multiScenario()],
      [response([
        { name: 'get_weather', arguments: { city: 'Tokyo' } },
        { name: 'get_forecast', arguments: { city: 'Tokyo' } },
      ])],
      AVAILABLE,
    );
    expect(result.score).toBe(100);
    expect(result.details[0]!.passed).toBe(true);
  });

  it('penalizes single tool call', () => {
    const result = evaluateMultiTool(
      [multiScenario()],
      [response([{ name: 'get_weather', arguments: { city: 'Tokyo' } }])],
      AVAILABLE,
    );
    expect(result.score).toBeLessThan(50);
    expect(result.details[0]!.note).toContain('single tool call');
  });

  it('scores 0 for no tool calls', () => {
    const result = evaluateMultiTool(
      [multiScenario()],
      [response([])],
      AVAILABLE,
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.note).toContain('did not call any tools');
  });

  it('penalizes non-existent tool calls', () => {
    const result = evaluateMultiTool(
      [multiScenario()],
      [response([
        { name: 'get_weather', arguments: {} },
        { name: 'fake_tool', arguments: {} },
      ])],
      AVAILABLE,
    );
    expect(result.score).toBeLessThan(100);
    expect(result.details[0]!.note).toContain('non-existent');
  });

  it('skips non-multi-tool scenarios', () => {
    const positiveScenario: BenchScenario = {
      id: 'pos-1',
      task: "What's the weather?",
      expectedTool: 'get_weather',
      tags: ['positive'],
      difficulty: 'easy',
    };
    const result = evaluateMultiTool(
      [positiveScenario],
      [response([{ name: 'get_weather', arguments: {} }])],
      AVAILABLE,
    );
    expect(result.score).toBe(100); // No multi-tool scenarios → perfect
    expect(result.details).toHaveLength(0);
  });

  it('returns weight 0.1', () => {
    const result = evaluateMultiTool([], [], AVAILABLE);
    expect(result.weight).toBe(0.1);
    expect(result.dimension).toBe('Multi-tool');
  });
});
