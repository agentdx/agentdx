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
  model: 'claude-sonnet-4-5-20250929',
  scenarios: 'auto',
  runs: 1,
  temperature: 0,
  skipErrorRecovery: true,
};

/**
 * Map tasks to responses by keyword matching.
 * Works correctly with concurrent execution since responses are based on task content, not call order.
 */
const TASK_RESPONSES: Record<string, LLMResponse> = {
  'Tokyo': {
    content: "I'll check the weather in Tokyo for you.",
    toolCalls: [{ name: 'get_weather', arguments: { city: 'Tokyo' } }],
    inputTokens: 100,
    outputTokens: 50,
  },
  'Paris': {
    content: "Let me get the forecast for Paris.",
    toolCalls: [{ name: 'get_forecast', arguments: { city: 'Paris' } }],
    inputTokens: 100,
    outputTokens: 50,
  },
  'going to be': {
    content: 'Could you please specify which city you want the weather for?',
    toolCalls: [],
    inputTokens: 80,
    outputTokens: 30,
  },
  'thermostat': {
    content: "I don't have a tool to control thermostats.",
    toolCalls: [],
    inputTokens: 80,
    outputTokens: 30,
  },
  'London': {
    content: "I'll check both current weather and forecast for London.",
    toolCalls: [
      { name: 'get_weather', arguments: { city: 'London' } },
      { name: 'get_forecast', arguments: { city: 'London' } },
    ],
    inputTokens: 120,
    outputTokens: 60,
  },
};

const DEFAULT_RESPONSE: LLMResponse = {
  content: 'No matching tool.',
  toolCalls: [],
  inputTokens: 50,
  outputTokens: 20,
};

function createMockAdapter(): LLMAdapter {
  let isFirstCall = true;

  return {
    chat: vi.fn().mockImplementation((params: { messages: Array<{ content: string }> }) => {
      // First call from estimateBench is scenario generation
      if (isFirstCall) {
        isFirstCall = false;
        return Promise.resolve({
          content: JSON.stringify(SCENARIOS),
          toolCalls: [],
          inputTokens: 200,
          outputTokens: 400,
        } satisfies LLMResponse);
      }

      const task = params.messages[0]?.content ?? '';
      for (const [keyword, response] of Object.entries(TASK_RESPONSES)) {
        if (task.includes(keyword)) {
          return Promise.resolve(response);
        }
      }
      return Promise.resolve(DEFAULT_RESPONSE);
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

  it('runs evaluations concurrently up to concurrency limit', async () => {
    let activeCalls = 0;
    let maxActiveCalls = 0;

    const adapter: LLMAdapter = {
      chat: vi.fn().mockImplementation(async (params: { messages: Array<{ content: string }> }) => {
        activeCalls++;
        if (activeCalls > maxActiveCalls) maxActiveCalls = activeCalls;

        // Simulate async delay to allow concurrency
        await new Promise((resolve) => setTimeout(resolve, 10));

        activeCalls--;

        const task = params.messages[0]?.content ?? '';
        for (const [keyword, response] of Object.entries(TASK_RESPONSES)) {
          if (task.includes(keyword)) {
            return response;
          }
        }
        return DEFAULT_RESPONSE;
      }),
      estimateCost: vi.fn().mockReturnValue(0.01),
    };

    const report = await runBench(
      TOOLS,
      { ...CONFIG, concurrency: 3 },
      adapter,
      SCENARIOS,
    );

    // With 5 scenarios and concurrency 3, peak should be at most 3
    expect(maxActiveCalls).toBeLessThanOrEqual(3);
    // Should still have run all 5 scenarios
    expect(report.responses).toHaveLength(5);
    // With concurrency > 1 and async delay, should have overlapped
    expect(maxActiveCalls).toBeGreaterThan(1);
  });
});
