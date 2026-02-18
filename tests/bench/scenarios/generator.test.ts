import { describe, it, expect, vi } from 'vitest';
import { generateScenarios } from '../../../src/bench/scenarios/generator.js';
import type { ToolDefinition } from '../../../src/core/types.js';
import type { LLMAdapter, LLMResponse } from '../../../src/bench/llm/adapter.js';

const TOOLS: ToolDefinition[] = [
  {
    name: 'get_weather',
    description: 'Get current weather for a city',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
        units: { type: 'string', description: 'celsius or fahrenheit' },
      },
      required: ['city'],
    },
  },
];

const MOCK_SCENARIOS = [
  {
    id: 'weather-1',
    task: "What's the weather in Tokyo?",
    expectedTool: 'get_weather',
    expectedParams: { city: 'Tokyo' },
    tags: ['positive'],
    difficulty: 'easy',
  },
  {
    id: 'weather-2',
    task: 'Temperature in Paris in Fahrenheit',
    expectedTool: 'get_weather',
    expectedParams: { city: 'Paris', units: 'fahrenheit' },
    tags: ['optional-params'],
    difficulty: 'medium',
  },
  {
    id: 'weather-neg',
    task: 'Set the thermostat to 22 degrees',
    expectedTool: null,
    tags: ['negative'],
    difficulty: 'hard',
  },
];

function createMockAdapter(jsonResponse: string): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({
      content: jsonResponse,
      toolCalls: [],
      inputTokens: 100,
      outputTokens: 200,
    } satisfies LLMResponse),
    estimateCost: vi.fn().mockReturnValue(0),
  };
}

describe('generateScenarios', () => {
  it('parses LLM JSON response into BenchScenario[]', async () => {
    const adapter = createMockAdapter(JSON.stringify(MOCK_SCENARIOS));
    const scenarios = await generateScenarios(TOOLS, adapter);

    expect(scenarios).toHaveLength(3);
    expect(scenarios[0]!.id).toBe('weather-1');
    expect(scenarios[0]!.expectedTool).toBe('get_weather');
    expect(scenarios[0]!.tags).toContain('positive');
    expect(scenarios[2]!.expectedTool).toBeNull();
  });

  it('handles markdown-fenced JSON response', async () => {
    const fenced = '```json\n' + JSON.stringify(MOCK_SCENARIOS) + '\n```';
    const adapter = createMockAdapter(fenced);
    const scenarios = await generateScenarios(TOOLS, adapter);

    expect(scenarios).toHaveLength(3);
  });

  it('passes tools to LLM with system prompt', async () => {
    const adapter = createMockAdapter(JSON.stringify(MOCK_SCENARIOS));
    await generateScenarios(TOOLS, adapter);

    const chatFn = adapter.chat as ReturnType<typeof vi.fn>;
    expect(chatFn).toHaveBeenCalledOnce();
    const params = chatFn.mock.calls[0]![0];
    expect(params.system).toContain('JSON');
    expect(params.messages[0].content).toContain('get_weather');
    expect(params.tools).toEqual([]);
    expect(params.temperature).toBe(0);
  });

  it('defaults invalid difficulty to medium', async () => {
    const badScenario = [{ id: 'x', task: 'do stuff', expectedTool: 'a', tags: [], difficulty: 'extreme' }];
    const adapter = createMockAdapter(JSON.stringify(badScenario));
    const scenarios = await generateScenarios(TOOLS, adapter);

    expect(scenarios[0]!.difficulty).toBe('medium');
  });

  it('throws on invalid JSON', async () => {
    const adapter = createMockAdapter('not json at all');
    await expect(generateScenarios(TOOLS, adapter)).rejects.toThrow();
  });
});
