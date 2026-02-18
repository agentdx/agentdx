/** A tool definition as returned by an MCP server's listTools(). */
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/** Result of calling a tool via MCP. */
export interface ToolCallResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

/** A live connection to an MCP server. */
export interface ServerConnection {
  tools: ToolDefinition[];
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
  close(): Promise<void>;
}

/** Severity levels for lint rules. */
export type LintSeverity = 'error' | 'warn' | 'info';

/** A single lint issue found by a rule. */
export interface LintIssue {
  rule: string;
  severity: LintSeverity;
  message: string;
  tool?: string;
  param?: string;
}

/** Interface that all lint rules implement. */
export interface LintRule {
  id: string;
  description: string;
  severity: LintSeverity;
  check(tools: ToolDefinition[]): LintIssue[];
}

/** Aggregated lint results. */
export interface LintResult {
  issues: LintIssue[];
  tools: ToolDefinition[];
  score: number;
}

/** Transport type for MCP server connections. */
export type Transport = 'stdio' | 'sse';

/** Resolved configuration with all defaults applied. */
export interface ResolvedConfig {
  entry: string;
  transport: Transport;
  server?: {
    name?: string;
  };
  lint: {
    rules: Record<string, string | number | boolean>;
  };
  bench: {
    provider: string;
    model: string;
    scenarios: string;
    runs: number;
    temperature: number;
  };
}
