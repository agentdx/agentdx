import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, loadRcConfig, resolveConfig } from '../../src/core/config.js';

const testDir = join(tmpdir(), `agentdx-config-test-${process.pid}`);

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('returns undefined when no config file exists', () => {
    expect(loadConfig(testDir)).toBeUndefined();
  });

  it('parses a valid config file', () => {
    writeFileSync(
      join(testDir, 'agentdx.config.yaml'),
      `server:\n  name: test\n  entry: src/index.ts\n  transport: stdio\n`,
    );
    const config = loadConfig(testDir);
    expect(config).toBeDefined();
    expect(config!.server?.name).toBe('test');
    expect(config!.server?.entry).toBe('src/index.ts');
    expect(config!.server?.transport).toBe('stdio');
  });

  it('accepts a minimal config', () => {
    writeFileSync(join(testDir, 'agentdx.config.yaml'), `server:\n  name: minimal\n`);
    const config = loadConfig(testDir);
    expect(config!.server?.name).toBe('minimal');
  });

  it('validates transport enum', () => {
    writeFileSync(
      join(testDir, 'agentdx.config.yaml'),
      `server:\n  transport: invalid\n`,
    );
    expect(() => loadConfig(testDir)).toThrow();
  });
});

describe('loadRcConfig', () => {
  it('returns undefined when no rc file exists', () => {
    expect(loadRcConfig(testDir)).toBeUndefined();
  });

  it('parses a valid .agentdxrc.json file', () => {
    writeFileSync(
      join(testDir, '.agentdxrc.json'),
      JSON.stringify({ lint: { rules: { 'desc-exists': 'off' } } }),
    );
    const config = loadRcConfig(testDir);
    expect(config).toBeDefined();
    expect(config!.lint?.rules?.['desc-exists']).toBe('off');
  });
});

describe('resolveConfig', () => {
  it('returns defaults when no raw config', () => {
    const resolved = resolveConfig();
    expect(resolved.entry).toBe('');
    expect(resolved.transport).toBe('stdio');
    expect(resolved.lint.rules).toEqual({});
  });

  it('merges raw config with defaults', () => {
    const resolved = resolveConfig({
      server: { entry: 'src/main.ts', transport: 'sse' },
    });
    expect(resolved.entry).toBe('src/main.ts');
    expect(resolved.transport).toBe('sse');
  });

  it('supports legacy entrypoint field', () => {
    const resolved = resolveConfig({
      server: { entrypoint: 'src/server.ts' },
    });
    expect(resolved.entry).toBe('src/server.ts');
  });

  it('merges lint rule overrides', () => {
    const resolved = resolveConfig({
      lint: { rules: { 'desc-exists': 'off', 'schema-exists': 'info' } },
    });
    expect(resolved.lint.rules['desc-exists']).toBe('off');
    expect(resolved.lint.rules['schema-exists']).toBe('info');
  });
});
