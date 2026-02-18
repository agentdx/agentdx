import { describe, it, expect } from 'vitest';
import { evaluateToolSelection } from '../../../src/bench/evaluators/tool-selection.js';
import type { BenchScenario } from '../../../src/bench/types.js';
import type { LLMResponse } from '../../../src/bench/llm/adapter.js';

const AVAILABLE = new Set(['get_weather', 'list_cities']);

function scenario(overrides: Partial<BenchScenario>): BenchScenario {
  return {
    id: 'test',
    task: 'test task',
    expectedTool: 'get_weather',
    tags: ['positive'],
    difficulty: 'easy',
    ...overrides,
  };
}

function response(toolName: string | null, content = ''): LLMResponse {
  return {
    content,
    toolCalls: toolName ? [{ name: toolName, arguments: {} }] : [],
    inputTokens: 0,
    outputTokens: 0,
  };
}

describe('evaluateToolSelection', () => {
  it('scores correct tool selection', () => {
    const result = evaluateToolSelection(
      [scenario({})],
      [response('get_weather')],
      AVAILABLE,
    );
    expect(result.score).toBe(100);
    expect(result.details[0]!.passed).toBe(true);
  });

  it('scores wrong tool selection', () => {
    const result = evaluateToolSelection(
      [scenario({})],
      [response('list_cities')],
      AVAILABLE,
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.passed).toBe(false);
    expect(result.details[0]!.note).toContain('instead of');
  });

  it('detects hallucinated tool', () => {
    const result = evaluateToolSelection(
      [scenario({})],
      [response('non_existent_tool')],
      AVAILABLE,
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.note).toContain('Hallucinated');
  });

  it('detects missing tool call', () => {
    const result = evaluateToolSelection(
      [scenario({})],
      [response(null)],
      AVAILABLE,
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.note).toContain('did not call any tool');
  });

  it('scores correct refusal for negative scenarios', () => {
    const result = evaluateToolSelection(
      [scenario({ expectedTool: null, tags: ['negative'] })],
      [response(null)],
      AVAILABLE,
    );
    expect(result.score).toBe(100);
    expect(result.details[0]!.note).toContain('Correct refusal');
  });

  it('penalizes tool call on negative scenario', () => {
    const result = evaluateToolSelection(
      [scenario({ expectedTool: null, tags: ['negative'] })],
      [response('get_weather')],
      AVAILABLE,
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.passed).toBe(false);
  });

  it('handles mixed scenarios', () => {
    const result = evaluateToolSelection(
      [
        scenario({ id: 's1', expectedTool: 'get_weather' }),
        scenario({ id: 's2', expectedTool: null }),
      ],
      [
        response('get_weather'),
        response(null),
      ],
      AVAILABLE,
    );
    expect(result.score).toBe(100);
    expect(result.details).toHaveLength(2);
  });

  it('returns weight 0.35', () => {
    const result = evaluateToolSelection([], [], AVAILABLE);
    expect(result.weight).toBe(0.35);
    expect(result.dimension).toBe('Tool Selection');
  });
});
