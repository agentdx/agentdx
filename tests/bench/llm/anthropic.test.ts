import { describe, it, expect, vi } from 'vitest';
import { AnthropicAdapter } from '../../../src/bench/llm/anthropic.js';
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
    messages: {
      create: vi.fn().mockResolvedValue(response),
    },
  } as unknown as ConstructorParameters<typeof AnthropicAdapter>[1];
}

describe('AnthropicAdapter', () => {
  it('parses text response', async () => {
    const mockResponse = {
      content: [{ type: 'text', text: 'I need to check the weather.' }],
      usage: { input_tokens: 100, output_tokens: 30 },
    };
    const client = createMockClient(mockResponse);
    const adapter = new AnthropicAdapter('claude-sonnet-4-5-20250929', client);

    const result = await adapter.chat({
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
      tools: TOOLS,
      temperature: 0,
    });

    expect(result.content).toBe('I need to check the weather.');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(30);
  });

  it('parses tool_use response', async () => {
    const mockResponse = {
      content: [
        { type: 'text', text: 'Let me check the weather.' },
        {
          type: 'tool_use',
          id: 'call_123',
          name: 'get_weather',
          input: { location: 'Paris' },
        },
      ],
      usage: { input_tokens: 150, output_tokens: 50 },
    };
    const client = createMockClient(mockResponse);
    const adapter = new AnthropicAdapter('claude-sonnet-4-5-20250929', client);

    const result = await adapter.chat({
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
      tools: TOOLS,
      temperature: 0,
    });

    expect(result.content).toBe('Let me check the weather.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      name: 'get_weather',
      arguments: { location: 'Paris' },
    });
    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(50);
  });

  it('passes correct params to SDK', async () => {
    const mockResponse = {
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    };
    const client = createMockClient(mockResponse);
    const adapter = new AnthropicAdapter('claude-sonnet-4-5-20250929', client);

    await adapter.chat({
      system: 'System prompt',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: TOOLS,
      temperature: 0.5,
    });

    const createFn = client!.messages.create as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalledOnce();
    const callArgs = createFn.mock.calls[0]![0];
    expect(callArgs.model).toBe('claude-sonnet-4-5-20250929');
    expect(callArgs.system).toBe('System prompt');
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.max_tokens).toBe(1024);
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe('get_weather');
    expect(callArgs.tools[0].input_schema.type).toBe('object');
  });

  it('estimates cost for known models', () => {
    const adapter = new AnthropicAdapter('claude-sonnet-4-5-20250929');
    // 1000 input tokens at $3/M = $0.003, 500 output at $15/M = $0.0075
    const cost = adapter.estimateCost(1000, 500);
    expect(cost).toBeCloseTo(0.0105, 5);
  });

  it('falls back to Sonnet pricing for unknown models', () => {
    const adapter = new AnthropicAdapter('claude-future-model');
    const cost = adapter.estimateCost(1000, 500);
    expect(cost).toBeCloseTo(0.0105, 5);
  });
});
