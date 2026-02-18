import type { Command } from 'commander';
import { loadConfig, resolveConfig } from '../../core/config.js';
import { detectEntry } from '../../core/detect.js';
import { connectToServer } from '../../core/mcp-client.js';
import { lint } from '../../lint/engine.js';
import { formatText } from '../../lint/formatters/text.js';
import { formatJson } from '../../lint/formatters/json.js';
import { formatSarif } from '../../lint/formatters/sarif.js';

export function registerLintCommand(program: Command): void {
  program
    .command('lint')
    .description('Static analysis of MCP tool definitions')
    .option('-f, --format <format>', 'Output format: text, json, sarif', 'text')
    .action(async (opts: { format: string }) => {
      const cwd = process.cwd();

      // Load config
      let raw;
      try {
        raw = loadConfig(cwd);
      } catch (err) {
        console.error(
          `Config error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(2);
      }

      const config = resolveConfig(raw);
      const entry = detectEntry(cwd, config.entry || undefined);

      if (!entry) {
        console.error(
          'Could not detect server entry point. Create agentdx.config.yaml or run from an MCP server project.',
        );
        process.exit(2);
      }

      // Connect to server
      let tools;
      try {
        const conn = await connectToServer({
          entry,
          transport: config.transport,
        });
        tools = conn.tools;
        await conn.close();
      } catch (err) {
        console.error(
          `Could not connect to server: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(2);
      }

      // Run lint
      const result = lint(tools, { rules: config.lint.rules });

      // Format and output
      switch (opts.format) {
        case 'json':
          console.log(formatJson(result));
          break;
        case 'sarif':
          console.log(formatSarif(result));
          break;
        default:
          console.log(formatText(result, config.server?.name));
          break;
      }

      // Exit code: 1 if any errors, 0 otherwise
      const hasErrors = result.issues.some((i) => i.severity === 'error');
      process.exit(hasErrors ? 1 : 0);
    });
}
