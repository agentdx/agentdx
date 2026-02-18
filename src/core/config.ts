import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { z } from 'zod';
import type { ResolvedConfig } from './types.js';

const ConfigSchema = z
  .object({
    server: z
      .object({
        name: z.string().optional(),
        entry: z.string().optional(),
        entrypoint: z.string().optional(),
        transport: z.enum(['stdio', 'sse']).optional(),
      })
      .optional(),
    lint: z
      .object({
        rules: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      })
      .optional(),
    bench: z
      .object({
        provider: z.string().optional(),
        model: z.string().optional(),
        scenarios: z.string().optional(),
        runs: z.number().int().positive().optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
      .optional(),
  })
  .passthrough();

export type RawConfig = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: ResolvedConfig = {
  entry: '',
  transport: 'stdio',
  lint: {
    rules: {},
  },
  bench: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    scenarios: 'auto',
    runs: 3,
    temperature: 0,
  },
};

/**
 * Load and validate agentdx.config.yaml from the given directory.
 * Returns undefined if the file does not exist.
 * Throws on parse/validation errors.
 */
export function loadConfig(dir = process.cwd()): RawConfig | undefined {
  const filePath = resolve(dir, 'agentdx.config.yaml');
  if (!existsSync(filePath)) return undefined;

  const raw = yamlParse(readFileSync(filePath, 'utf-8')) as unknown;
  return ConfigSchema.parse(raw);
}

/**
 * Merge a raw config (if any) with defaults to produce a fully resolved config.
 * The `entry` field is NOT resolved here — use `detectEntry()` for that.
 */
export function resolveConfig(raw?: RawConfig): ResolvedConfig {
  return {
    entry: raw?.server?.entry ?? raw?.server?.entrypoint ?? DEFAULT_CONFIG.entry,
    transport: raw?.server?.transport ?? DEFAULT_CONFIG.transport,
    server: raw?.server ? { name: raw.server.name } : undefined,
    lint: {
      rules: {
        ...DEFAULT_CONFIG.lint.rules,
        ...(raw?.lint?.rules as Record<string, string | number | boolean> | undefined),
      },
    },
    bench: {
      provider: raw?.bench?.provider ?? DEFAULT_CONFIG.bench.provider,
      model: raw?.bench?.model ?? DEFAULT_CONFIG.bench.model,
      scenarios: raw?.bench?.scenarios ?? DEFAULT_CONFIG.bench.scenarios,
      runs: raw?.bench?.runs ?? DEFAULT_CONFIG.bench.runs,
      temperature: raw?.bench?.temperature ?? DEFAULT_CONFIG.bench.temperature,
    },
  };
}
