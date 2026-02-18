import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadScenarios } from '../../../src/bench/scenarios/loader.js';

const testDir = join(tmpdir(), `agentdx-loader-test-${process.pid}`);

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('loadScenarios', () => {
  it('loads and validates a YAML scenarios file', () => {
    const yaml = `
scenarios:
  - task: "What's the weather in Tokyo?"
    expect:
      tool: get_weather
      params:
        city: "Tokyo"
    tags: [positive]
    difficulty: easy

  - task: "Set the temperature to 25 degrees"
    expect:
      tool: none
    tags: [negative]
    difficulty: hard
`;
    const file = join(testDir, 'scenarios.yaml');
    writeFileSync(file, yaml);

    const scenarios = loadScenarios(file);
    expect(scenarios).toHaveLength(2);

    expect(scenarios[0]!.task).toBe("What's the weather in Tokyo?");
    expect(scenarios[0]!.expectedTool).toBe('get_weather');
    expect(scenarios[0]!.expectedParams).toEqual({ city: 'Tokyo' });
    expect(scenarios[0]!.tags).toEqual(['positive']);
    expect(scenarios[0]!.difficulty).toBe('easy');

    expect(scenarios[1]!.expectedTool).toBeNull();
    expect(scenarios[1]!.tags).toEqual(['negative']);
  });

  it('auto-generates IDs when not provided', () => {
    const yaml = `
scenarios:
  - task: "Do something"
    expect:
      tool: some_tool
  - task: "Do another thing"
    expect:
      tool: other_tool
`;
    const file = join(testDir, 'scenarios.yaml');
    writeFileSync(file, yaml);

    const scenarios = loadScenarios(file);
    expect(scenarios[0]!.id).toBe('scenario-1');
    expect(scenarios[1]!.id).toBe('scenario-2');
  });

  it('uses custom IDs when provided', () => {
    const yaml = `
scenarios:
  - id: my-custom-id
    task: "Do something"
    expect:
      tool: some_tool
`;
    const file = join(testDir, 'scenarios.yaml');
    writeFileSync(file, yaml);

    const scenarios = loadScenarios(file);
    expect(scenarios[0]!.id).toBe('my-custom-id');
  });

  it('defaults to medium difficulty and positive tag', () => {
    const yaml = `
scenarios:
  - task: "Do something"
    expect:
      tool: some_tool
`;
    const file = join(testDir, 'scenarios.yaml');
    writeFileSync(file, yaml);

    const scenarios = loadScenarios(file);
    expect(scenarios[0]!.difficulty).toBe('medium');
    expect(scenarios[0]!.tags).toEqual(['positive']);
  });

  it('throws on invalid YAML structure', () => {
    const yaml = 'not a valid scenarios file';
    const file = join(testDir, 'bad.yaml');
    writeFileSync(file, yaml);

    expect(() => loadScenarios(file)).toThrow();
  });
});
