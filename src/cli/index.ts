import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerDevCommand } from './commands/dev.js';
import { registerLintCommand } from './commands/lint.js';

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
    'The linter for MCP servers. Catches what agents can\'t tell you.',
  )
  .version(pkg.version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Path to agentdx.config.yaml');

registerInitCommand(program);
registerDevCommand(program);
registerLintCommand(program);

program.parse();
