import { describe, it, expect, vi } from 'vitest';
import { generateScenarios, extractJson, salvageTruncatedArray } from '../../../src/bench/scenarios/generator.js';
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

describe('extractJson', () => {
  it('passes through clean JSON', () => {
    const input = '[{"id":"a"}]';
    expect(extractJson(input)).toBe('[{"id":"a"}]');
  });

  it('strips markdown fences', () => {
    const input = '```json\n[{"id":"a"}]\n```';
    expect(extractJson(input)).toBe('[{"id":"a"}]');
  });

  it('strips bare markdown fences', () => {
    const input = '```\n[{"id":"a"}]\n```';
    expect(extractJson(input)).toBe('[{"id":"a"}]');
  });

  it('extracts JSON from surrounding text', () => {
    const input = 'Here are the scenarios:\n[{"id":"a"}]\nHope that helps!';
    expect(extractJson(input)).toBe('[{"id":"a"}]');
  });

  it('removes trailing commas', () => {
    const input = '[{"id":"a",},]';
    expect(extractJson(input)).toBe('[{"id":"a"}]');
  });

  it('removes single-line comments', () => {
    const input = '[\n  {"id":"a"} // this is a comment\n]';
    const result = extractJson(input);
    expect(result).not.toContain('//');
    expect(JSON.parse(result)).toEqual([{ id: 'a' }]);
  });

  it('handles object at top level', () => {
    const input = 'Result: {"key": "value"} done';
    expect(extractJson(input)).toBe('{"key": "value"}');
  });

  it('returns raw text when no JSON structure found', () => {
    const input = 'no json here';
    expect(extractJson(input)).toBe('no json here');
  });
});

describe('salvageTruncatedArray', () => {
  it('returns unchanged when array is complete', () => {
    const result = salvageTruncatedArray('[{"id":"a"},{"id":"b"}]');
    expect(result.truncated).toBe(false);
    expect(JSON.parse(result.json)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('closes truncated array at last complete object', () => {
    const truncated = '[{"id":"a"},{"id":"b"},{"id":"c","ta';
    const result = salvageTruncatedArray(truncated);
    expect(result.truncated).toBe(true);
    expect(JSON.parse(result.json)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('handles nested arrays and objects', () => {
    const truncated = '[{"id":"a","tags":["positive"]},{"id":"b","nested":{"x":1}},{"id":"c","ta';
    const result = salvageTruncatedArray(truncated);
    expect(result.truncated).toBe(true);
    const parsed = JSON.parse(result.json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].tags).toEqual(['positive']);
    expect(parsed[1].nested).toEqual({ x: 1 });
  });

  it('handles trailing comma before truncation', () => {
    const truncated = '[{"id":"a"},';
    const result = salvageTruncatedArray(truncated);
    expect(result.truncated).toBe(true);
    expect(JSON.parse(result.json)).toEqual([{ id: 'a' }]);
  });

  it('handles strings with escaped quotes', () => {
    const truncated = '[{"id":"a","task":"say \\"hello\\""},{"id":"b","tr';
    const result = salvageTruncatedArray(truncated);
    expect(result.truncated).toBe(true);
    const parsed = JSON.parse(result.json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].task).toBe('say "hello"');
  });

  it('returns unchanged for non-array input', () => {
    const result = salvageTruncatedArray('{"key":"value"');
    expect(result.truncated).toBe(false);
  });

  it('returns unchanged when no complete object found', () => {
    const result = salvageTruncatedArray('[{"id":');
    expect(result.truncated).toBe(false);
  });

  it('handles surrounding text before array', () => {
    const truncated = 'Here are scenarios:\n[{"id":"a"},{"id":"b","tru';
    const result = salvageTruncatedArray(truncated);
    expect(result.truncated).toBe(true);
    expect(JSON.parse(result.json)).toEqual([{ id: 'a' }]);
  });
});

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

  it('handles JSON with surrounding text', async () => {
    const messy = 'Here are the scenarios:\n' + JSON.stringify(MOCK_SCENARIOS) + '\nDone.';
    const adapter = createMockAdapter(messy);
    const scenarios = await generateScenarios(TOOLS, adapter);

    expect(scenarios).toHaveLength(3);
  });

  it('handles trailing commas in JSON', async () => {
    const withTrailing = '[\n  {"id":"a","task":"do it","expectedTool":"get_weather","tags":["positive"],"difficulty":"easy",},\n]';
    const adapter = createMockAdapter(withTrailing);
    const scenarios = await generateScenarios(TOOLS, adapter);

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]!.id).toBe('a');
  });

  it('passes tools to LLM with system prompt and maxTokens', async () => {
    const adapter = createMockAdapter(JSON.stringify(MOCK_SCENARIOS));
    await generateScenarios(TOOLS, adapter);

    const chatFn = adapter.chat as ReturnType<typeof vi.fn>;
    expect(chatFn).toHaveBeenCalledOnce();
    const params = chatFn.mock.calls[0]![0];
    expect(params.system).toContain('JSON');
    expect(params.messages[0].content).toContain('get_weather');
    expect(params.tools).toEqual([]);
    expect(params.temperature).toBe(0);
    expect(params.maxTokens).toBe(4096);
  });

  it('defaults invalid difficulty to medium', async () => {
    const badScenario = [{ id: 'x', task: 'do stuff', expectedTool: 'a', tags: [], difficulty: 'extreme' }];
    const adapter = createMockAdapter(JSON.stringify(badScenario));
    const scenarios = await generateScenarios(TOOLS, adapter);

    expect(scenarios[0]!.difficulty).toBe('medium');
  });

  it('salvages truncated JSON response without retrying', async () => {
    const full = JSON.stringify(MOCK_SCENARIOS);
    // Truncate mid-way through the third object
    const truncated = full.slice(0, full.lastIndexOf('{') + 5);

    const adapter = createMockAdapter(truncated);
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const scenarios = await generateScenarios(TOOLS, adapter);

    // Should have salvaged the first 2 complete scenarios
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]!.id).toBe('weather-1');
    expect(scenarios[1]!.id).toBe('weather-2');

    // Should warn about truncation
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Response was truncated, using 2 of expected scenarios'),
    );

    // Should NOT retry — salvage succeeded on first attempt
    const chatFn = adapter.chat as ReturnType<typeof vi.fn>;
    expect(chatFn).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it('retries on invalid JSON and succeeds', async () => {
    const chatFn = vi.fn()
      .mockResolvedValueOnce({
        content: 'This is not valid JSON at all',
        toolCalls: [],
        inputTokens: 100,
        outputTokens: 50,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(MOCK_SCENARIOS),
        toolCalls: [],
        inputTokens: 100,
        outputTokens: 200,
      });

    const adapter: LLMAdapter = {
      chat: chatFn,
      estimateCost: vi.fn().mockReturnValue(0),
    };

    const scenarios = await generateScenarios(TOOLS, adapter);
    expect(scenarios).toHaveLength(3);
    expect(chatFn).toHaveBeenCalledTimes(2);
    // Retry prompt should mention previous failure
    const retryCall = chatFn.mock.calls[1]![0];
    expect(retryCall.messages[0].content).toContain('not valid JSON');
  });

  it('throws helpful error after both attempts fail', async () => {
    const chatFn = vi.fn().mockResolvedValue({
      content: 'completely broken response with no JSON',
      toolCalls: [],
      inputTokens: 100,
      outputTokens: 50,
    });

    const adapter: LLMAdapter = {
      chat: chatFn,
      estimateCost: vi.fn().mockReturnValue(0),
    };

    await expect(generateScenarios(TOOLS, adapter)).rejects.toThrow(
      'Could not parse scenario JSON from LLM response',
    );
    expect(chatFn).toHaveBeenCalledTimes(2);
  });
});
