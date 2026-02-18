import { describe, it, expect } from 'vitest';
import { createAdapter } from '../../../src/bench/llm/adapter.js';

describe('createAdapter', () => {
  it('creates an Anthropic adapter', async () => {
    const adapter = await createAdapter('anthropic', 'claude-sonnet-4-5-20250514');
    expect(adapter).toBeDefined();
    expect(adapter.chat).toBeTypeOf('function');
    expect(adapter.estimateCost).toBeTypeOf('function');
  });

  it('creates an OpenAI adapter', async () => {
    const adapter = await createAdapter('openai', 'gpt-4o');
    expect(adapter).toBeDefined();
    expect(adapter.chat).toBeTypeOf('function');
  });

  it('creates an Ollama adapter', async () => {
    const adapter = await createAdapter('ollama', 'llama3');
    expect(adapter).toBeDefined();
    expect(adapter.chat).toBeTypeOf('function');
  });

  it('throws on unknown provider', async () => {
    await expect(createAdapter('unknown', 'model')).rejects.toThrow('Unknown LLM provider');
  });
});
