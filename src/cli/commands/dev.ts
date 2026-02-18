import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { watch as watchFiles } from 'chokidar';
import { connectToServer } from '../../core/mcp-client.js';
import { loadConfig, resolveConfig } from '../../core/config.js';
import { detectEntry } from '../../core/detect.js';
import type { ServerConnection, ToolDefinition } from '../../core/types.js';

export function registerDevCommand(program: Command): void {
  program
    .command('dev [entrypoint]')
    .description('Start a local dev server with interactive console')
    .option('--no-watch', 'Disable hot-reload')
    .action(async (entrypoint: string | undefined, options: { watch: boolean }) => {
      await runDevServer(entrypoint, options.watch);
    });
}

function printTools(tools: ToolDefinition[]): void {
  if (tools.length === 0) {
    console.log('  (no tools registered)');
    return;
  }
  for (const tool of tools) {
    console.log(`  ${tool.name} — ${tool.description ?? '(no description)'}`);
  }
}

async function createSession(entry: string): Promise<ServerConnection> {
  return connectToServer({
    entry,
    onStderr(line) {
      console.error(`  [server] ${line}`);
    },
  });
}

async function runDevServer(entrypointArg?: string, watchEnabled = true): Promise<void> {
  // 1. Resolve entry point
  const raw = loadConfig();
  const config = resolveConfig(raw);
  const entry = entrypointArg ?? detectEntry(process.cwd(), config.entry);

  if (!entry) {
    console.error(
      'Error: No entrypoint found. Provide one as argument or create agentdx.config.yaml.',
    );
    process.exit(1);
  }
  const entrypoint: string = entry;

  if (!existsSync(resolve(entrypoint))) {
    console.error(`Error: Entrypoint "${entrypoint}" not found.`);
    process.exit(1);
  }

  // 2. Connect
  console.log(`Starting MCP server: ${entrypoint}`);
  let conn: ServerConnection;
  try {
    conn = await createSession(entrypoint);
  } catch (err) {
    console.error(
      `Failed to connect: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  console.log(`\nConnected. ${conn.tools.length} tool(s) available:`);
  printTools(conn.tools);
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
    await conn.close();
    try {
      conn = await createSession(entrypoint);
      console.log(`Reconnected. ${conn.tools.length} tool(s) available.`);
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
    await conn.close();
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
        await handleInput(input, conn, reconnect, shutdown);
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
  conn: ServerConnection,
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
    printTools(conn.tools);
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
    const tool = conn.tools.find((t) => t.name === toolName);
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

    const tool = conn.tools.find((t) => t.name === toolName);
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
      const result = await conn.callTool(toolName, args);
      if (result.isError) {
        console.log('Tool returned an error:');
      }
      for (const item of result.content) {
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
