import { readFileSync } from 'node:fs';
import { parse as yamlParse } from 'yaml';
import { z } from 'zod';
import type { BenchScenario } from '../types.js';

const ScenarioSchema = z.object({
  id: z.string().optional(),
  task: z.string(),
  expect: z.object({
    tool: z.string().nullable().optional(),
    tools: z.array(z.string()).optional(),
    params: z.record(z.unknown()).optional(),
    description: z.string().optional(),
  }),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

const ScenariosFileSchema = z.object({
  scenarios: z.array(ScenarioSchema),
});

/**
 * Load bench scenarios from a YAML file.
 * Validates structure with zod and normalizes to BenchScenario[].
 */
export function loadScenarios(filePath: string): BenchScenario[] {
  const raw = yamlParse(readFileSync(filePath, 'utf-8')) as unknown;
  const parsed = ScenariosFileSchema.parse(raw);

  return parsed.scenarios.map((s, i) => ({
    id: s.id ?? `scenario-${i + 1}`,
    task: s.task,
    expectedTool: s.expect.tool === 'none' ? null : (s.expect.tool ?? s.expect.tools?.[0] ?? null),
    expectedParams: s.expect.params,
    tags: s.tags ?? (s.expect.tool === 'none' ? ['negative'] : ['positive']),
    difficulty: s.difficulty ?? 'medium',
  }));
}
