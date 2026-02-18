import type { Command } from 'commander';
import { loadConfig, loadRcConfig, resolveConfig } from '../../core/config.js';
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
    .option('-f, --format <format>', 'Output format: pretty, json, sarif', 'pretty')
    .option('--fix-suggestions', 'Show concrete fix suggestions for each failing rule')
    .option('--quiet', 'Only show errors, suppress warnings and info')
    .option('-c, --config <path>', 'Path to .agentdxrc.json config file')
    .action(
      async (opts: {
        format: string;
        fixSuggestions?: boolean;
        quiet?: boolean;
        config?: string;
      }) => {
        const cwd = process.cwd();

        // Load config — try .agentdxrc.json first if --config specified, then agentdx.config.yaml
        let raw;
        try {
          if (opts.config) {
            const { existsSync, readFileSync } = await import('node:fs');
            const { resolve } = await import('node:path');
            const filePath = resolve(cwd, opts.config);
            if (existsSync(filePath)) {
              const { z } = await import('zod');
              const content = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
              raw = z
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
                })
                .passthrough()
                .parse(content);
            }
          } else {
            raw = loadRcConfig(cwd) ?? loadConfig(cwd);
          }
        } catch (err) {
          console.error(`Config error: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }

        const config = resolveConfig(raw);
        const entry = detectEntry(cwd, config.entry || undefined);

        if (!entry) {
          console.error(
            'Could not detect server entry point. Create agentdx.config.yaml or run from an MCP server project.',
          );
          process.exit(1);
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
          process.exit(1);
        }

        // Run lint
        const result = lint(tools, { rules: config.lint.rules });

        // Filter for --quiet mode: only show errors
        if (opts.quiet) {
          result.issues = result.issues.filter((i) => i.severity === 'error');
        }

        // Format and output
        const format = opts.format === 'text' ? 'pretty' : opts.format;
        switch (format) {
          case 'json':
            console.log(formatJson(result));
            break;
          case 'sarif':
            console.log(formatSarif(result));
            break;
          default:
            console.log(
              formatText(result, config.server?.name, { fixSuggestions: opts.fixSuggestions }),
            );
            break;
        }

        // Exit codes: 0 = all pass, 1 = errors found, 2 = warnings only
        const hasErrors = result.issues.some((i) => i.severity === 'error');
        const hasWarnings = result.issues.some((i) => i.severity === 'warn');
        if (hasErrors) {
          process.exit(1);
        } else if (hasWarnings && !opts.quiet) {
          process.exit(2);
        } else {
          process.exit(0);
        }
      },
    );
}
