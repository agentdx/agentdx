import OpenAI from 'openai';
import type { LLMAdapter, ChatParams, LLMResponse } from './adapter.js';
import type { ToolDefinition } from '../../core/types.js';

/** Per-million-token pricing for OpenAI models. [input, output] */
const PRICING: Record<string, [number, number]> = {
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4-turbo': [10, 30],
  'gpt-4': [30, 60],
};

function convertTools(tools: ToolDefinition[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: {
        type: 'object',
        properties: t.inputSchema?.properties ?? {},
        ...(t.inputSchema?.required ? { required: t.inputSchema.required } : {}),
      },
    },
  }));
}

export class OpenAIAdapter implements LLMAdapter {
  protected client: OpenAI;
  protected model: string;

  constructor(model: string, client?: OpenAI) {
    this.model = model;
    this.client = client ?? new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'] ?? 'not-configured',
    });
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
      ...params.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: convertTools(params.tools),
      temperature: params.temperature,
    });

    const choice = response.choices[0];
    const message = choice?.message;
    const toolCalls: LLMResponse['toolCalls'] = [];

    if (message?.tool_calls) {
      for (const call of message.tool_calls) {
        toolCalls.push({
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
        });
      }
    }

    return {
      content: message?.content ?? '',
      toolCalls,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[this.model];
    if (!pricing) {
      // Fallback to GPT-4o pricing for unknown models
      return (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;
    }
    const [inputRate, outputRate] = pricing;
    return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  }
}
