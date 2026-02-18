import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ServerConnection, ToolDefinition, ToolCallResult } from './types.js';

export interface ConnectOptions {
  /** Path to the server entry file (e.g. "src/index.ts"). */
  entry: string;
  /** Transport type. Only 'stdio' is currently supported. */
  transport?: 'stdio' | 'sse';
  /** Callback for server stderr output. */
  onStderr?: (line: string) => void;
}

/**
 * Spawn an MCP server and connect to it as a client.
 * Returns a ServerConnection that can list tools, call tools, and close.
 */
export async function connectToServer(options: ConnectOptions): Promise<ServerConnection> {
  const { entry, onStderr } = options;

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', entry],
    stderr: 'pipe',
  });

  const client = new Client({ name: 'agentdx', version: '0.1.0' });
  await client.connect(transport);

  if (transport.stderr && onStderr) {
    transport.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trimEnd();
      if (text) {
        for (const line of text.split('\n')) {
          onStderr(line);
        }
      }
    });
  }

  const { tools: rawTools } = await client.listTools();

  const tools: ToolDefinition[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  async function callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult> {
    const result = await client.callTool({ name, arguments: args });
    return {
      content: result.content as ToolCallResult['content'],
      isError: result.isError as boolean | undefined,
    };
  }

  async function close(): Promise<void> {
    try {
      await transport.close();
    } catch {
      // Ignore cleanup errors
    }
  }

  return { tools, callTool, close };
}
