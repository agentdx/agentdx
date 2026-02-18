import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/bench/llm/openai.js';
import type { ToolDefinition } from '../../../src/core/types.js';

const TOOLS: ToolDefinition[] = [
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
      },
      required: ['location'],
    },
  },
];

function createMockClient(response: unknown) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(response),
      },
    },
  } as unknown as ConstructorParameters<typeof OpenAIAdapter>[1];
}

describe('OpenAIAdapter', () => {
  it('parses text response', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Let me help you with that.',
            tool_calls: undefined,
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    };
    const client = createMockClient(mockResponse);
    const adapter = new OpenAIAdapter('gpt-4o', client);

    const result = await adapter.chat({
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'What is the weather?' }],
      tools: TOOLS,
      temperature: 0,
    });

    expect(result.content).toBe('Let me help you with that.');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(20);
  });

  it('parses tool_calls response', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location":"Paris"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 120, completion_tokens: 40 },
    };
    const client = createMockClient(mockResponse);
    const adapter = new OpenAIAdapter('gpt-4o', client);

    const result = await adapter.chat({
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Weather in Paris?' }],
      tools: TOOLS,
      temperature: 0,
    });

    expect(result.content).toBe('');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      name: 'get_weather',
      arguments: { location: 'Paris' },
    });
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(40);
  });

  it('passes correct params to SDK', async () => {
    const mockResponse = {
      choices: [{ message: { content: '', tool_calls: undefined } }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
    const client = createMockClient(mockResponse);
    const adapter = new OpenAIAdapter('gpt-4o', client);

    await adapter.chat({
      system: 'System prompt',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: TOOLS,
      temperature: 0.7,
    });

    const createFn = client!.chat.completions.create as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalledOnce();
    const callArgs = createFn.mock.calls[0]![0];
    expect(callArgs.model).toBe('gpt-4o');
    expect(callArgs.temperature).toBe(0.7);
    // System message is first
    expect(callArgs.messages[0]).toEqual({ role: 'system', content: 'System prompt' });
    // Tools in OpenAI format
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].type).toBe('function');
    expect(callArgs.tools[0].function.name).toBe('get_weather');
  });

  it('estimates cost for known models', () => {
    const adapter = new OpenAIAdapter('gpt-4o');
    // 1000 input at $2.5/M = $0.0025, 500 output at $10/M = $0.005
    const cost = adapter.estimateCost(1000, 500);
    expect(cost).toBeCloseTo(0.0075, 5);
  });

  it('falls back to GPT-4o pricing for unknown models', () => {
    const adapter = new OpenAIAdapter('gpt-future');
    const cost = adapter.estimateCost(1000, 500);
    expect(cost).toBeCloseTo(0.0075, 5);
  });
});
