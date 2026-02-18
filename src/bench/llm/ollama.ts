import OpenAI from 'openai';
import { OpenAIAdapter } from './openai.js';

/**
 * Ollama adapter — uses the OpenAI-compatible API at localhost:11434/v1.
 * Same interface as OpenAI but local and free.
 */
export class OllamaAdapter extends OpenAIAdapter {
  constructor(model: string, baseURL?: string) {
    const client = new OpenAI({
      baseURL: baseURL ?? 'http://localhost:11434/v1',
      apiKey: 'ollama', // Ollama doesn't need a real key but the SDK requires one
    });
    super(model, client);
  }

  /** Local models are free. */
  estimateCost(): number {
    return 0;
  }
}
