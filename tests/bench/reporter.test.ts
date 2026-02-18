import { describe, it, expect } from 'vitest';
import { formatBenchText, formatBenchJson } from '../../src/bench/reporter.js';
import type { BenchReport } from '../../src/bench/engine.js';

const REPORT: BenchReport = {
  score: {
    overall: 78,
    rating: 'Good',
    dimensions: [
      { dimension: 'Tool Selection', score: 92, weight: 0.35, details: [] },
      { dimension: 'Parameter Accuracy', score: 68, weight: 0.3, details: [
        { scenarioId: 's1', passed: false, expected: '{"city":"Tokyo"}', actual: '{}', note: 'missing "city"' },
      ] },
      { dimension: 'Ambiguity Handling', score: 78, weight: 0.15, details: [] },
      { dimension: 'Multi-tool', score: 90, weight: 0.1, details: [] },
      { dimension: 'Error Recovery', score: 50, weight: 0.1, details: [
        { scenarioId: 's2', passed: false, expected: 'retry', actual: 'no recovery', note: 'Did not recover' },
      ] },
    ],
    topIssues: [
      {
        dimension: 'Error Recovery',
        description: 'Error Recovery: Did not recover',
        suggestion: 'Return structured error messages with actionable information',
      },
      {
        dimension: 'Parameter Accuracy',
        description: 'Parameter Accuracy: missing "city"',
        suggestion: 'Add parameter descriptions and default values to your input schemas',
      },
    ],
  },
  scenarios: [
    { id: 's1', task: "What's the weather?", expectedTool: 'get_weather', tags: ['positive'], difficulty: 'easy' },
    { id: 's2', task: 'Set thermostat', expectedTool: null, tags: ['negative'], difficulty: 'hard' },
  ],
  responses: [
    { content: 'Checking weather.', toolCalls: [{ name: 'get_weather', arguments: {} }], inputTokens: 100, outputTokens: 50 },
    { content: 'Cannot do that.', toolCalls: [], inputTokens: 80, outputTokens: 30 },
  ],
  config: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', scenarios: 'auto', runs: 3, temperature: 0 },
  tools: [{ name: 'get_weather', description: 'Get weather' }],
  totalInputTokens: 180,
  totalOutputTokens: 80,
  totalCost: 0.0012,
};

describe('formatBenchText', () => {
  it('includes header with tool and scenario count', () => {
    const output = formatBenchText(REPORT, 'my-server');
    expect(output).toContain('AgentDX Bench');
    expect(output).toContain('my-server');
    expect(output).toContain('1 tool');
    expect(output).toContain('2 scenarios');
  });

  it('shows all dimension bars with scores', () => {
    const output = formatBenchText(REPORT);
    expect(output).toContain('Tool Selection');
    expect(output).toContain('92%');
    expect(output).toContain('Parameter Accuracy');
    expect(output).toContain('68%');
    expect(output).toContain('Error Recovery');
    expect(output).toContain('50%');
  });

  it('shows score box with rating', () => {
    const output = formatBenchText(REPORT);
    expect(output).toContain('Agent DX Score:  78 / 100');
    expect(output).toContain('Rating: Good');
  });

  it('shows top issues with fix suggestions', () => {
    const output = formatBenchText(REPORT);
    expect(output).toContain('Top issues:');
    expect(output).toContain('Error Recovery');
    expect(output).toContain('Fix:');
  });

  it('shows cost summary', () => {
    const output = formatBenchText(REPORT);
    expect(output).toContain('$0.0012');
  });
});

describe('formatBenchJson', () => {
  it('returns valid JSON with all fields', () => {
    const output = formatBenchJson(REPORT);
    const parsed = JSON.parse(output);

    expect(parsed.score).toBe(78);
    expect(parsed.rating).toBe('Good');
    expect(parsed.dimensions).toHaveLength(5);
    expect(parsed.topIssues).toHaveLength(2);
    expect(parsed.scenarios).toHaveLength(2);
    expect(parsed.tools).toEqual(['get_weather']);
  });

  it('includes scenario responses', () => {
    const parsed = JSON.parse(formatBenchJson(REPORT));
    expect(parsed.scenarios[0].response.toolCalls).toHaveLength(1);
    expect(parsed.scenarios[0].response.toolCalls[0].name).toBe('get_weather');
  });

  it('includes config and cost', () => {
    const parsed = JSON.parse(formatBenchJson(REPORT));
    expect(parsed.config.model).toBe('claude-sonnet-4-5-20250514');
    expect(parsed.cost.estimatedCost).toBe(0.0012);
  });
});
