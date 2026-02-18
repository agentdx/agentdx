import type { Command } from 'commander';
import * as p from '@clack/prompts';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify as yamlStringify } from 'yaml';

interface InitOptions {
  name: string;
  transport: string;
  description: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init [project-name]')
    .description('Scaffold a new MCP server project')
    .action(async (projectNameArg?: string) => {
      await runInitWizard(projectNameArg);
    });
}

async function runInitWizard(projectNameArg?: string): Promise<void> {
  p.intro('agentdx — Create a new MCP server');

  // 1. Project name
  let projectName: string;
  if (projectNameArg) {
    projectName = projectNameArg;
  } else {
    const result = await p.text({
      message: 'Project name',
      placeholder: 'my-mcp-server',
      validate(value) {
        if (!value.trim()) return 'Project name is required';
        if (!/^[a-z0-9-]+$/i.test(value)) return 'Use letters, numbers, and hyphens only';
      },
    });
    if (p.isCancel(result)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    projectName = result;
  }

  // Check if directory already exists
  const projectDir = resolve(projectName);
  if (existsSync(projectDir)) {
    p.cancel(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  // 2. Language
  const language = await p.select({
    message: 'Language',
    options: [
      { value: 'typescript' as const, label: 'TypeScript', hint: 'recommended' },
      { value: 'python' as const, label: 'Python', hint: 'coming soon' },
    ],
  });
  if (p.isCancel(language)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  if (language === 'python') {
    p.cancel('Python support is coming soon. Please select TypeScript for now.');
    process.exit(0);
  }

  // 3. Transport
  const transport = await p.select({
    message: 'Transport',
    options: [
      { value: 'stdio' as const, label: 'stdio', hint: 'recommended for most use cases' },
      { value: 'sse' as const, label: 'SSE', hint: 'for web-based clients' },
    ],
  });
  if (p.isCancel(transport)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  // 4. Description
  const description = await p.text({
    message: 'Description (optional)',
    placeholder: 'A useful MCP server for agents',
    defaultValue: '',
  });
  if (p.isCancel(description)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  // 5. Confirm
  const confirmed = await p.confirm({
    message: `Create "${projectName}" with TypeScript + ${transport}?`,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  // 6. Scaffold
  const s = p.spinner();
  s.start('Scaffolding project...');

  scaffoldProject(projectDir, {
    name: projectName,
    transport,
    description: description || `An MCP server built with AgentDX`,
  });

  s.stop('Project scaffolded.');

  p.outro(`Done! Next steps:\n\n  cd ${projectName}\n  npm install\n  agentdx dev`);
}

export function scaffoldProject(dir: string, options: InitOptions): void {
  const { name, transport, description } = options;

  // Create directories
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'tests', 'scenarios'), { recursive: true });

  // package.json
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        type: 'module',
        scripts: {
          build: 'tsc',
          dev: 'tsx src/index.ts',
          test: 'vitest run',
        },
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.12.1',
          zod: '^3.24.2',
        },
        devDependencies: {
          '@types/node': '^22.13.4',
          tsx: '^4.19.3',
          typescript: '^5.7.3',
        },
      },
      null,
      2,
    ) + '\n',
  );

  // tsconfig.json
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2023',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          outDir: 'build',
          rootDir: 'src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          isolatedModules: true,
        },
        include: ['src'],
        exclude: ['node_modules', 'build'],
      },
      null,
      2,
    ) + '\n',
  );

  // src/index.ts
  writeFileSync(join(dir, 'src', 'index.ts'), generateServerSource(name));

  // agentdx.config.yaml
  writeFileSync(
    join(dir, 'agentdx.config.yaml'),
    yamlStringify({
      version: 1,
      server: {
        name,
        version: '0.1.0',
        description,
        transport,
        language: 'typescript',
        entrypoint: 'src/index.ts',
      },
      lint: {
        rules: {
          'description-min-length': 20,
          'description-max-length': 500,
          'require-examples': true,
          'naming-convention': 'kebab-case',
        },
      },
      test: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        scenarios: 'tests/scenarios/',
        timeout: '30s',
      },
    }),
  );

  // README.md
  writeFileSync(join(dir, 'README.md'), generateReadme(name, description));
}

function generateServerSource(name: string): string {
  return `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: '${name}',
  version: '0.1.0',
});

server.registerTool('hello', {
  description: 'Returns a friendly greeting. Provide a name and get a personalized welcome message.',
  inputSchema: {
    name: z.string().describe('Name of the person to greet'),
  },
}, async ({ name }) => ({
  content: [{ type: 'text', text: \`Hello, \${name}! Welcome to the ${name} MCP server.\` }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
`;
}

function generateReadme(name: string, description: string): string {
  return `# ${name}

${description}

An MCP server built with [AgentDX](https://github.com/agentdx/agentdx).

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Development

\`\`\`bash
# Start dev server with AgentDX
agentdx dev

# Lint tool schemas
agentdx lint

# Run agent simulation tests
agentdx test
\`\`\`

## Tools

- **hello** — Returns a friendly greeting
`;
}
