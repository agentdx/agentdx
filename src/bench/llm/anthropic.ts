import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter, ChatParams, LLMResponse } from './adapter.js';
import type { ToolDefinition } from '../../core/types.js';

/** Per-million-token pricing for Claude models. [input, output] */
const PRICING: Record<string, [number, number]> = {
  'claude-sonnet-4-5-20250929': [3, 15],
  'claude-haiku-3-5-20241022': [0.8, 4],
  'claude-opus-4-20250514': [15, 75],
};

function convertTools(tools: ToolDefinition[]): Anthropic.Messages.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: {
      type: 'object' as const,
      properties: t.inputSchema?.properties ?? {},
      ...(t.inputSchema?.required ? { required: t.inputSchema.required } : {}),
    },
  }));
}

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(model: string, client?: Anthropic) {
    this.model = model;
    this.client = client ?? new Anthropic();
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools: convertTools(params.tools),
      temperature: params.temperature,
    });

    let content = '';
    const toolCalls: LLMResponse['toolCalls'] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[this.model];
    if (!pricing) {
      // Fallback to Sonnet pricing for unknown models
      return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
    }
    const [inputRate, outputRate] = pricing;
    return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  }
}
