import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';

function loadPackageJson(): { version: string } {
  let dir = import.meta.dirname;
  while (true) {
    try {
      const content = readFileSync(join(dir, 'package.json'), 'utf-8');
      return JSON.parse(content) as { version: string };
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error('Could not find package.json');
      dir = parent;
    }
  }
}

const pkg = loadPackageJson();

const program = new Command();

program
  .name('agentdx')
  .description(
    'The MCP developer toolkit. Scaffold, lint, test, benchmark, and publish MCP servers.',
  )
  .version(pkg.version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Path to agentdx.config.yaml');

registerInitCommand(program);

program
  .command('dev [entrypoint]')
  .description('Start a local dev server with interactive console')
  .action((_entrypoint: string | undefined) => {
    console.log('agentdx dev — not implemented yet');
  });

program
  .command('doctor [entrypoint]')
  .description('Diagnose problems with your MCP server setup')
  .action((_entrypoint: string | undefined) => {
    console.log('agentdx doctor — not implemented yet');
  });

program.parse();
