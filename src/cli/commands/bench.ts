import type { Command } from 'commander';
import { loadConfig, resolveConfig } from '../../core/config.js';
import { detectEntry } from '../../core/detect.js';
import { connectToServer } from '../../core/mcp-client.js';
import { createAdapter } from '../../bench/llm/adapter.js';
import { estimateBench, runBench } from '../../bench/engine.js';
import { formatBenchText, formatBenchJson } from '../../bench/reporter.js';

interface BenchOpts {
  provider?: string;
  model?: string;
  scenarios?: string;
  runs?: string;
  format: string;
  confirm: boolean;
  temperature?: string;
  skipErrorRecovery?: boolean;
}

export function registerBenchCommand(program: Command): void {
  program
    .command('bench')
    .description('LLM-based evaluation of MCP server tool quality (Agent DX Score)')
    .option('--provider <name>', 'LLM provider: anthropic, openai, ollama')
    .option('--model <name>', 'Model to use')
    .option('--scenarios <path>', 'Path to custom scenarios YAML file')
    .option('--runs <n>', 'Runs per scenario')
    .option('-f, --format <format>', 'Output format: text, json', 'text')
    .option('--no-confirm', 'Skip cost confirmation prompt')
    .option('--temperature <n>', 'LLM temperature')
    .option('--skip-error-recovery', 'Skip error recovery evaluation')
    .action(async (opts: BenchOpts) => {
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

      // Merge CLI flags with config
      const benchConfig = {
        provider: opts.provider ?? config.bench.provider,
        model: opts.model ?? config.bench.model,
        scenarios: opts.scenarios ?? config.bench.scenarios,
        runs: opts.runs ? parseInt(opts.runs, 10) : config.bench.runs,
        temperature: opts.temperature ? parseFloat(opts.temperature) : config.bench.temperature,
        skipErrorRecovery: opts.skipErrorRecovery ?? false,
      };

      // Connect to server to discover tools
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

      if (tools.length === 0) {
        console.error('Server has no tools. Nothing to benchmark.');
        process.exit(2);
      }

      // Create LLM adapter
      let adapter;
      try {
        adapter = await createAdapter(benchConfig.provider, benchConfig.model);
      } catch (err) {
        console.error(
          `LLM adapter error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(2);
      }

      // Estimate cost
      let estimate;
      try {
        estimate = await estimateBench(tools, benchConfig, adapter);
      } catch (err) {
        console.error(
          `Scenario generation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(2);
      }

      // Cost confirmation
      if (opts.confirm && estimate.estimatedCost > 0) {
        const costStr = `$${estimate.estimatedCost.toFixed(2)}`;
        console.log(
          `\nThis benchmark will run ${estimate.scenarioCount} scenarios \u00D7 ${benchConfig.runs} runs = ${estimate.totalCalls} LLM calls`,
        );
        console.log(`Estimated cost: ~${costStr} (${benchConfig.model})`);

        const { createInterface } = await import('node:readline');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          rl.question('Proceed? [Y/n] ', (a) => {
            rl.close();
            resolve(a.trim().toLowerCase());
          });
        });

        if (answer === 'n' || answer === 'no') {
          console.log('Aborted.');
          process.exit(0);
        }
      }

      // Show progress header
      if (opts.format === 'text') {
        console.log(`\n  Running with ${benchConfig.model} (${benchConfig.runs} run${benchConfig.runs !== 1 ? 's' : ''} per scenario)...\n`);
      }

      // Run bench
      let report;
      try {
        report = await runBench(
          tools,
          benchConfig,
          adapter,
          estimate.scenarios,
          opts.format === 'text'
            ? (completed, total) => {
                process.stdout.write(`\r  Progress: ${completed}/${total} calls`);
              }
            : undefined,
        );
      } catch (err) {
        console.error(
          `\nBench failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(2);
      }

      // Clear progress line
      if (opts.format === 'text') {
        process.stdout.write('\r' + ' '.repeat(50) + '\r');
      }

      // Format and output
      switch (opts.format) {
        case 'json':
          console.log(formatBenchJson(report));
          break;
        default:
          console.log(formatBenchText(report, config.server?.name));
          break;
      }

      // Exit code 0 always — bench is informational
      process.exit(0);
    });
}
