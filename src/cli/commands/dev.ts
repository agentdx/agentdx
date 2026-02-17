import type { Command } from 'commander';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parse as yamlParse } from 'yaml';
import { watch as watchFiles } from 'chokidar';

export function registerDevCommand(program: Command): void {
  program
    .command('dev [entrypoint]')
    .description('Start a local dev server with interactive console')
    .option('--no-watch', 'Disable hot-reload')
    .action(async (entrypoint: string | undefined, options: { watch: boolean }) => {
      await runDevServer(entrypoint, options.watch);
    });
}

async function connectToServer(entrypoint: string) {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', entrypoint],
    stderr: 'pipe',
  });

  const client = new Client({ name: 'agentdx', version: '0.1.0' });
  await client.connect(transport);

  if (transport.stderr) {
    transport.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trimEnd();
      if (text) {
        for (const line of text.split('\n')) {
          console.error(`  [server] ${line}`);
        }
      }
    });
  }

  const { tools } = await client.listTools();
  return { client, transport, tools };
}

type DevSession = Awaited<ReturnType<typeof connectToServer>>;

async function closeSession(session: DevSession): Promise<void> {
  try {
    await session.transport.close();
  } catch {
    // Ignore cleanup errors
  }
}

function printTools(tools: DevSession['tools']): void {
  if (tools.length === 0) {
    console.log('  (no tools registered)');
    return;
  }
  for (const tool of tools) {
    console.log(`  ${tool.name} — ${tool.description ?? '(no description)'}`);
  }
}

async function runDevServer(entrypointArg?: string, watchEnabled = true): Promise<void> {
  // 1. Read config
  const configPath = resolve('agentdx.config.yaml');
  let configEntrypoint: string | undefined;
  if (existsSync(configPath)) {
    try {
      const raw = yamlParse(readFileSync(configPath, 'utf-8')) as
        | { server?: { entrypoint?: string } }
        | undefined;
      configEntrypoint = raw?.server?.entrypoint;
    } catch {
      // Ignore parse errors
    }
  }

  const rawEntrypoint = entrypointArg ?? configEntrypoint;
  if (!rawEntrypoint) {
    console.error(
      'Error: No entrypoint found. Provide one as argument or create agentdx.config.yaml.',
    );
    process.exit(1);
  }
  const entrypoint: string = rawEntrypoint;

  if (!existsSync(resolve(entrypoint))) {
    console.error(`Error: Entrypoint "${entrypoint}" not found.`);
    process.exit(1);
  }

  // 2. Connect
  console.log(`Starting MCP server: ${entrypoint}`);
  let session: DevSession;
  try {
    session = await connectToServer(entrypoint);
  } catch (err) {
    console.error(
      `Failed to connect: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  console.log(`\nConnected. ${session.tools.length} tool(s) available:`);
  printTools(session.tools);
  console.log('\nType .help for available commands.\n');

  // 3. REPL
  let isReconnecting = false;
  let isShuttingDown = false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'agentdx> ',
  });

  async function reconnect(): Promise<void> {
    if (isReconnecting) return;
    isReconnecting = true;
    console.log('\nReconnecting...');
    await closeSession(session);
    try {
      session = await connectToServer(entrypoint);
      console.log(`Reconnected. ${session.tools.length} tool(s) available.`);
    } catch (err) {
      console.error(
        `Failed to reconnect: ${err instanceof Error ? err.message : err}`,
      );
      console.log('Use .reconnect to try again.');
    }
    isReconnecting = false;
    rl.prompt();
  }

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\nShutting down...');
    if (watcher) await watcher.close();
    rl.close();
    await closeSession(session);
    process.exit(0);
  }

  // 4. File watcher
  let watcher: ReturnType<typeof watchFiles> | undefined;
  if (watchEnabled) {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    watcher = watchFiles('src/**/*.ts', { ignoreInitial: true });
    watcher.on('all', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void reconnect(), 300);
    });
    console.log('Watching src/**/*.ts for changes.\n');
  }

  // 5. Handle input
  rl.on('line', (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    void (async () => {
      try {
        await handleInput(input, session, reconnect, shutdown);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
      }
      if (!isShuttingDown) rl.prompt();
    })();
  });

  rl.on('close', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  rl.prompt();
}

async function handleInput(
  input: string,
  session: DevSession,
  reconnect: () => Promise<void>,
  shutdown: () => Promise<void>,
): Promise<void> {
  if (input === '.help') {
    console.log(`
Available commands:
  .tools              List all tools with descriptions
  .call <tool> <json> Call a tool with JSON arguments
  .schema <tool>      Show a tool's input schema
  .reconnect          Restart server and reconnect
  .help               Show this help
  .exit               Shut down and exit`);
    return;
  }

  if (input === '.tools') {
    printTools(session.tools);
    return;
  }

  if (input === '.exit') {
    await shutdown();
    return;
  }

  if (input === '.reconnect') {
    await reconnect();
    return;
  }

  if (input.startsWith('.schema ')) {
    const toolName = input.slice('.schema '.length).trim();
    const tool = session.tools.find((t) => t.name === toolName);
    if (!tool) {
      console.log(`Unknown tool: ${toolName}. Use .tools to see available tools.`);
    } else {
      console.log(JSON.stringify(tool.inputSchema, null, 2));
    }
    return;
  }

  if (input.startsWith('.call ')) {
    const rest = input.slice('.call '.length).trim();
    const spaceIdx = rest.indexOf(' ');
    const toolName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const argsStr = spaceIdx === -1 ? undefined : rest.slice(spaceIdx + 1).trim();

    if (!toolName) {
      console.log('Usage: .call <tool-name> [json-args]');
      return;
    }

    const tool = session.tools.find((t) => t.name === toolName);
    if (!tool) {
      console.log(`Unknown tool: ${toolName}. Use .tools to see available tools.`);
      return;
    }

    let args: Record<string, unknown> | undefined;
    if (argsStr) {
      try {
        args = JSON.parse(argsStr) as Record<string, unknown>;
      } catch {
        console.log('Invalid JSON. Example: .call hello {"name":"world"}');
        return;
      }
    }

    try {
      const result = await session.client.callTool({
        name: toolName,
        arguments: args,
      });
      if (result.isError) {
        console.log('Tool returned an error:');
      }
      for (const item of result.content as Array<{ type: string; text?: string }>) {
        if (item.type === 'text' && item.text) {
          console.log(item.text);
        } else {
          console.log(JSON.stringify(item, null, 2));
        }
      }
    } catch (err) {
      console.log(`Error calling tool: ${err instanceof Error ? err.message : err}`);
    }
    return;
  }

  console.log(`Unknown command: ${input}. Type .help for available commands.`);
}
