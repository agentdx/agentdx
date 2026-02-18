import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectEntry, detectTransport } from '../../src/core/detect.js';

const testDir = join(tmpdir(), `agentdx-detect-test-${process.pid}`);

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('detectEntry', () => {
  it('uses config entry when file exists', () => {
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'main.ts'), '');
    expect(detectEntry(testDir, 'src/main.ts')).toBe('src/main.ts');
  });

  it('ignores config entry if file does not exist', () => {
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'index.ts'), '');
    expect(detectEntry(testDir, 'src/missing.ts')).toBe('src/index.ts');
  });

  it('reads bin field from package.json', () => {
    mkdirSync(join(testDir, 'dist'), { recursive: true });
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ bin: { cli: 'dist/cli.js' } }));
    writeFileSync(join(testDir, 'dist', 'cli.js'), '');
    expect(detectEntry(testDir)).toBe('dist/cli.js');
  });

  it('reads main field from package.json', () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ main: 'lib/server.js' }));
    mkdirSync(join(testDir, 'lib'), { recursive: true });
    writeFileSync(join(testDir, 'lib', 'server.js'), '');
    expect(detectEntry(testDir)).toBe('lib/server.js');
  });

  it('falls back to src/index.ts', () => {
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'index.ts'), '');
    expect(detectEntry(testDir)).toBe('src/index.ts');
  });

  it('falls back to index.ts', () => {
    writeFileSync(join(testDir, 'index.ts'), '');
    expect(detectEntry(testDir)).toBe('index.ts');
  });

  it('returns undefined when nothing found', () => {
    expect(detectEntry(testDir)).toBeUndefined();
  });
});

describe('detectTransport', () => {
  it('returns config transport when provided', () => {
    expect(detectTransport(testDir, 'src/index.ts', 'sse')).toBe('sse');
  });

  it('detects SSE from source import', () => {
    writeFileSync(join(testDir, 'server.ts'), `import { SSEServerTransport } from '@mcp/sdk';\n`);
    expect(detectTransport(testDir, 'server.ts')).toBe('sse');
  });

  it('defaults to stdio', () => {
    writeFileSync(join(testDir, 'server.ts'), `import { StdioServerTransport } from '@mcp/sdk';\n`);
    expect(detectTransport(testDir, 'server.ts')).toBe('stdio');
  });

  it('defaults to stdio when no entry', () => {
    expect(detectTransport(testDir)).toBe('stdio');
  });
});
