import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import { scaffoldProject } from '../../../src/cli/commands/init.js';

const testDir = join(tmpdir(), `agentdx-init-test-${process.pid}`);

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('scaffoldProject', () => {
  it('creates all expected files and directories', () => {
    scaffoldProject(testDir, {
      name: 'test-server',
      transport: 'stdio',
      description: 'A test server',
    });

    expect(existsSync(join(testDir, 'package.json'))).toBe(true);
    expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(testDir, 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'agentdx.config.yaml'))).toBe(true);
    expect(existsSync(join(testDir, 'README.md'))).toBe(true);
    expect(existsSync(join(testDir, 'tests', 'scenarios'))).toBe(true);
  });

  it('generates correct package.json', () => {
    scaffoldProject(testDir, {
      name: 'my-server',
      transport: 'stdio',
      description: 'Test',
    });

    const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('my-server');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.type).toBe('module');
    expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(pkg.dependencies['zod']).toBeDefined();
    expect(pkg.devDependencies['typescript']).toBeDefined();
    expect(pkg.devDependencies['tsx']).toBeDefined();
    expect(pkg.scripts.build).toBe('tsc');
    expect(pkg.scripts.dev).toBe('tsx src/index.ts');
  });

  it('generates correct tsconfig.json', () => {
    scaffoldProject(testDir, {
      name: 'my-server',
      transport: 'stdio',
      description: 'Test',
    });

    const tsconfig = JSON.parse(readFileSync(join(testDir, 'tsconfig.json'), 'utf-8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.module).toBe('NodeNext');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('NodeNext');
  });

  it('generates MCP server source with example tool', () => {
    scaffoldProject(testDir, {
      name: 'my-server',
      transport: 'stdio',
      description: 'Test',
    });

    const source = readFileSync(join(testDir, 'src', 'index.ts'), 'utf-8');
    expect(source).toContain('import { McpServer }');
    expect(source).toContain('import { StdioServerTransport }');
    expect(source).toContain("name: 'my-server'");
    expect(source).toContain("registerTool('hello'");
    expect(source).toContain('z.string()');
  });

  it('generates correct agentdx.config.yaml', () => {
    scaffoldProject(testDir, {
      name: 'my-server',
      transport: 'sse',
      description: 'My cool server',
    });

    const config = yamlParse(readFileSync(join(testDir, 'agentdx.config.yaml'), 'utf-8'));
    expect(config.version).toBe(1);
    expect(config.server.name).toBe('my-server');
    expect(config.server.transport).toBe('sse');
    expect(config.server.description).toBe('My cool server');
    expect(config.server.language).toBe('typescript');
    expect(config.server.entrypoint).toBe('src/index.ts');
  });

  it('generates README with project name and description', () => {
    scaffoldProject(testDir, {
      name: 'my-server',
      transport: 'stdio',
      description: 'Does amazing things',
    });

    const readme = readFileSync(join(testDir, 'README.md'), 'utf-8');
    expect(readme).toContain('# my-server');
    expect(readme).toContain('Does amazing things');
    expect(readme).toContain('agentdx dev');
  });
});
