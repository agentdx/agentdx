import type { ToolDefinition } from '../../core/types.js';

/** A single tool call made by the LLM. */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** A message in the conversation. */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Parameters for a chat request to the LLM. */
export interface ChatParams {
  system: string;
  messages: Message[];
  tools: ToolDefinition[];
  temperature: number;
  maxTokens?: number;
}

/** Response from the LLM. */
export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
}

/** Abstract interface for LLM providers. */
export interface LLMAdapter {
  chat(params: ChatParams): Promise<LLMResponse>;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

/**
 * Factory function to create an LLM adapter for the given provider.
 * Dynamically imports the provider module to avoid loading unused SDKs.
 */
export async function createAdapter(provider: string, model: string): Promise<LLMAdapter> {
  switch (provider) {
    case 'anthropic': {
      const { AnthropicAdapter } = await import('./anthropic.js');
      return new AnthropicAdapter(model);
    }
    case 'openai': {
      const { OpenAIAdapter } = await import('./openai.js');
      return new OpenAIAdapter(model);
    }
    case 'ollama': {
      const { OllamaAdapter } = await import('./ollama.js');
      return new OllamaAdapter(model);
    }
    default:
      throw new Error(`Unknown LLM provider: "${provider}". Supported: anthropic, openai, ollama`);
  }
}
