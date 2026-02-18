/**
 * Test agentdx lint against real MCP server tool definitions.
 *
 * Usage: npx tsx scripts/test-real-servers.ts
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { lint } from '../src/lint/engine.js';
import { formatText } from '../src/lint/formatters/text.js';
import type { ToolDefinition } from '../src/core/types.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../tests/fixtures/real-servers');
const EXAMPLES_DIR = resolve(import.meta.dirname, '../examples');

interface FixtureFile {
  server: string;
  source: string;
  tools: ToolDefinition[];
}

function main() {
  mkdirSync(EXAMPLES_DIR, { recursive: true });

  const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AgentDX Lint — Real Server Validation`);
  console.log(`  Testing ${files.length} servers`);
  console.log(`${'='.repeat(60)}\n`);

  const results: Array<{ server: string; score: number; errors: number; warns: number; infos: number; total: number }> = [];

  for (const file of files) {
    const raw = readFileSync(resolve(FIXTURES_DIR, file), 'utf-8');
    const fixture: FixtureFile = JSON.parse(raw);

    const result = lint(fixture.tools);
    const output = formatText(result, fixture.server, { fixSuggestions: true });

    // Print to stdout
    console.log(output);
    console.log(`  Source: ${fixture.source}`);
    console.log(`${'─'.repeat(60)}`);

    // Save to examples
    const exampleName = basename(file, '.json');
    writeFileSync(
      resolve(EXAMPLES_DIR, `${exampleName}-lint.txt`),
      stripAnsi(output),
      'utf-8'
    );

    // Also save JSON output
    writeFileSync(
      resolve(EXAMPLES_DIR, `${exampleName}-lint.json`),
      JSON.stringify({
        server: fixture.server,
        score: result.score,
        toolCount: result.tools.length,
        issues: result.issues,
      }, null, 2),
      'utf-8'
    );

    const errors = result.issues.filter(i => i.severity === 'error').length;
    const warns = result.issues.filter(i => i.severity === 'warn').length;
    const infos = result.issues.filter(i => i.severity === 'info').length;

    results.push({
      server: fixture.server,
      score: result.score,
      errors,
      warns,
      infos,
      total: result.tools.length,
    });
  }

  // Summary table
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Summary`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`  ${'Server'.padEnd(40)} ${'Score'.padEnd(8)} ${'E'.padEnd(4)} ${'W'.padEnd(4)} ${'I'.padEnd(4)} Tools`);
  console.log(`  ${'─'.repeat(40)} ${'─'.repeat(5)}  ${'─'.repeat(3)} ${'─'.repeat(3)} ${'─'.repeat(3)} ${'─'.repeat(5)}`);

  for (const r of results) {
    console.log(
      `  ${r.server.padEnd(40)} ${String(r.score).padStart(3)}/100  ${String(r.errors).padStart(3)} ${String(r.warns).padStart(3)} ${String(r.infos).padStart(3)} ${String(r.total).padStart(5)}`
    );
  }
  console.log('');
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

main();
