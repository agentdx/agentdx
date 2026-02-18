import { describe, it, expect } from 'vitest';
import { OllamaAdapter } from '../../../src/bench/llm/ollama.js';

describe('OllamaAdapter', () => {
  it('always returns 0 cost', () => {
    const adapter = new OllamaAdapter('llama3');
    expect(adapter.estimateCost(100000, 50000)).toBe(0);
  });

  it('uses custom baseURL', () => {
    // Just verifying construction doesn't throw
    const adapter = new OllamaAdapter('llama3', 'http://custom:1234/v1');
    expect(adapter).toBeDefined();
    expect(adapter.estimateCost(1, 1)).toBe(0);
  });
});
