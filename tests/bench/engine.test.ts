import { describe, it, expect, vi } from 'vitest';
import { estimateBench, runBench } from '../../src/bench/engine.js';
import type { ToolDefinition } from '../../src/core/types.js';
import type { LLMAdapter, LLMResponse } from '../../src/bench/llm/adapter.js';
import type { BenchScenario } from '../../src/bench/types.js';
import type { BenchConfig } from '../../src/bench/engine.js';

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
  {
    name: 'get_forecast',
    description: 'Get 5-day weather forecast for a city',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
      },
      required: ['city'],
    },
  },
];

const SCENARIOS: BenchScenario[] = [
  {
    id: 'pos-1',
    task: "What's the weather in Tokyo?",
    expectedTool: 'get_weather',
    expectedParams: { city: 'Tokyo' },
    tags: ['positive'],
    difficulty: 'easy',
  },
  {
    id: 'pos-2',
    task: 'Weather forecast for Paris',
    expectedTool: 'get_forecast',
    expectedParams: { city: 'Paris' },
    tags: ['positive'],
    difficulty: 'easy',
  },
  {
    id: 'ambig-1',
    task: "How's the weather going to be?",
    expectedTool: 'get_weather',
    tags: ['ambiguous'],
    difficulty: 'medium',
  },
  {
    id: 'neg-1',
    task: 'Set the thermostat to 22 degrees',
    expectedTool: null,
    tags: ['negative'],
    difficulty: 'hard',
  },
  {
    id: 'multi-1',
    task: 'Current weather and forecast for London',
    expectedTool: 'get_weather',
    tags: ['multi-tool'],
    difficulty: 'medium',
  },
];

const CONFIG: BenchConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250514',
  scenarios: 'auto',
  runs: 1,
  temperature: 0,
  skipErrorRecovery: true,
};

/**
 * Create a mock adapter that returns predetermined responses based on the task content.
 */
function createMockAdapter(): LLMAdapter {
  let callIndex = 0;
  const scenarioResponses: LLMResponse[] = [
    // pos-1: correct tool selection with params
    {
      content: "I'll check the weather in Tokyo for you.",
      toolCalls: [{ name: 'get_weather', arguments: { city: 'Tokyo' } }],
      inputTokens: 100,
      outputTokens: 50,
    },
    // pos-2: correct tool selection with params
    {
      content: "Let me get the forecast for Paris.",
      toolCalls: [{ name: 'get_forecast', arguments: { city: 'Paris' } }],
      inputTokens: 100,
      outputTokens: 50,
    },
    // ambig-1: asks for clarification
    {
      content: 'Could you please specify which city you want the weather for?',
      toolCalls: [],
      inputTokens: 80,
      outputTokens: 30,
    },
    // neg-1: correct refusal
    {
      content: "I don't have a tool to control thermostats.",
      toolCalls: [],
      inputTokens: 80,
      outputTokens: 30,
    },
    // multi-1: multiple tool calls
    {
      content: "I'll check both current weather and forecast for London.",
      toolCalls: [
        { name: 'get_weather', arguments: { city: 'London' } },
        { name: 'get_forecast', arguments: { city: 'London' } },
      ],
      inputTokens: 120,
      outputTokens: 60,
    },
  ];

  // For scenario generation (first call from estimateBench)
  const generationResponse: LLMResponse = {
    content: JSON.stringify(SCENARIOS),
    toolCalls: [],
    inputTokens: 200,
    outputTokens: 400,
  };

  return {
    chat: vi.fn().mockImplementation(() => {
      if (callIndex === 0) {
        callIndex++;
        return Promise.resolve(generationResponse);
      }
      const idx = callIndex - 1;
      callIndex++;
      return Promise.resolve(scenarioResponses[idx % scenarioResponses.length]!);
    }),
    estimateCost: vi.fn().mockReturnValue(0.01),
  };
}

describe('estimateBench', () => {
  it('returns cost estimate with scenario count', async () => {
    const adapter = createMockAdapter();
    const estimate = await estimateBench(TOOLS, CONFIG, adapter);

    expect(estimate.scenarioCount).toBe(5);
    expect(estimate.runs).toBe(1);
    expect(estimate.totalCalls).toBeGreaterThan(0);
    expect(estimate.estimatedCost).toBeGreaterThan(0);
    expect(estimate.scenarios).toHaveLength(5);
  });
});

describe('runBench', () => {
  it('runs full pipeline and produces a report', async () => {
    const adapter = createMockAdapter();
    // Consume the generation call first
    await (adapter.chat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(SCENARIOS),
      toolCalls: [],
      inputTokens: 200,
      outputTokens: 400,
    });

    const report = await runBench(TOOLS, CONFIG, adapter, SCENARIOS);

    expect(report.score).toBeDefined();
    expect(report.score.overall).toBeGreaterThanOrEqual(0);
    expect(report.score.overall).toBeLessThanOrEqual(100);
    expect(report.score.rating).toBeDefined();
    expect(report.score.dimensions.length).toBeGreaterThanOrEqual(4);
    expect(report.scenarios).toHaveLength(5);
    expect(report.responses).toHaveLength(5);
    expect(report.tools).toEqual(TOOLS);
  });

  it('calls onProgress callback', async () => {
    const adapter = createMockAdapter();
    const progressCalls: Array<[number, number]> = [];

    await runBench(TOOLS, CONFIG, adapter, SCENARIOS, (completed, total) => {
      progressCalls.push([completed, total]);
    });

    expect(progressCalls.length).toBe(5); // 5 scenarios × 1 run
    expect(progressCalls[progressCalls.length - 1]![0]).toBe(5);
  });

  it('includes token counts and cost', async () => {
    const adapter = createMockAdapter();
    const report = await runBench(TOOLS, CONFIG, adapter, SCENARIOS);

    expect(report.totalInputTokens).toBeGreaterThan(0);
    expect(report.totalOutputTokens).toBeGreaterThan(0);
    expect(report.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('skips error recovery when configured', async () => {
    const adapter = createMockAdapter();
    const report = await runBench(
      TOOLS,
      { ...CONFIG, skipErrorRecovery: true },
      adapter,
      SCENARIOS,
    );

    const dims = report.score.dimensions.map((d) => d.dimension);
    expect(dims).not.toContain('Error Recovery');
  });

  it('includes error recovery when not skipped', async () => {
    const adapter = createMockAdapter();
    const report = await runBench(
      TOOLS,
      { ...CONFIG, skipErrorRecovery: false },
      adapter,
      SCENARIOS,
    );

    const dims = report.score.dimensions.map((d) => d.dimension);
    expect(dims).toContain('Error Recovery');
  });
});
