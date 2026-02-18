import { describe, it, expect, vi } from 'vitest';
import { evaluateErrorRecovery } from '../../../src/bench/evaluators/error-recovery.js';
import type { BenchScenario } from '../../../src/bench/types.js';
import type { LLMAdapter, LLMResponse } from '../../../src/bench/llm/adapter.js';
import type { ToolDefinition } from '../../../src/core/types.js';

const TOOLS: ToolDefinition[] = [
  {
    name: 'get_weather',
    description: 'Get weather for a city',
    inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
  },
];

function scenario(): BenchScenario {
  return {
    id: 'err-1',
    task: "What's the weather in Tokyo?",
    expectedTool: 'get_weather',
    tags: ['positive'],
    difficulty: 'easy',
  };
}

function initialResponse(): LLMResponse {
  return {
    content: "I'll check the weather for you.",
    toolCalls: [{ name: 'get_weather', arguments: { city: 'Tokyo' } }],
    inputTokens: 100,
    outputTokens: 50,
  };
}

function createMockAdapter(recoveryResponse: LLMResponse): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue(recoveryResponse),
    estimateCost: vi.fn().mockReturnValue(0),
  };
}

describe('evaluateErrorRecovery', () => {
  it('scores high when LLM retries with explanation', async () => {
    const adapter = createMockAdapter({
      content: 'I apologize for the error. Let me try again with corrected parameters.',
      toolCalls: [{ name: 'get_weather', arguments: { city: 'Tokyo' } }],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery(
      [scenario()],
      [initialResponse()],
      adapter,
      TOOLS,
    );
    expect(result.score).toBe(100);
    expect(result.details[0]!.passed).toBe(true);
  });

  it('scores well when LLM retries without explanation', async () => {
    const adapter = createMockAdapter({
      content: '',
      toolCalls: [{ name: 'get_weather', arguments: { city: 'Tokyo' } }],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery(
      [scenario()],
      [initialResponse()],
      adapter,
      TOOLS,
    );
    expect(result.score).toBe(80);
  });

  it('gives partial credit for error explanation without retry', async () => {
    const adapter = createMockAdapter({
      content: "I'm sorry, there was an error with the weather service. The tool couldn't process the request.",
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery(
      [scenario()],
      [initialResponse()],
      adapter,
      TOOLS,
    );
    expect(result.score).toBe(50);
  });

  it('scores 0 for no recovery attempt', async () => {
    const adapter = createMockAdapter({
      content: 'Here is some unrelated response.',
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery(
      [scenario()],
      [initialResponse()],
      adapter,
      TOOLS,
    );
    expect(result.score).toBe(0);
    expect(result.details[0]!.passed).toBe(false);
  });

  it('skips scenarios where no tool was called', async () => {
    const noToolResponse: LLMResponse = {
      content: 'I cannot help with that.',
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    };
    const adapter = createMockAdapter({
      content: '',
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery(
      [scenario()],
      [noToolResponse],
      adapter,
      TOOLS,
    );
    expect(result.score).toBe(100); // No scenarios evaluated → perfect
    expect(result.details).toHaveLength(0);
  });

  it('skips negative scenarios', async () => {
    const negScenario: BenchScenario = {
      ...scenario(),
      expectedTool: null,
      tags: ['negative'],
    };
    const adapter = createMockAdapter({
      content: '',
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery(
      [negScenario],
      [initialResponse()],
      adapter,
      TOOLS,
    );
    expect(result.score).toBe(100);
  });

  it('returns weight 0.1', async () => {
    const adapter = createMockAdapter({
      content: '',
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
    });
    const result = await evaluateErrorRecovery([], [], adapter, TOOLS);
    expect(result.weight).toBe(0.1);
    expect(result.dimension).toBe('Error Recovery');
  });
});
