import type { ToolDefinition } from '../../core/types.js';
import type { LLMAdapter } from '../llm/adapter.js';
import type { BenchScenario } from '../types.js';

function buildPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map((t) => {
    const params = t.inputSchema?.properties
      ? Object.entries(t.inputSchema.properties as Record<string, { type?: string; description?: string }>)
          .map(([name, prop]) => `    ${name}: ${prop.type ?? 'unknown'} — ${prop.description ?? 'no description'}`)
          .join('\n')
      : '    (no parameters)';

    const required = t.inputSchema?.required?.join(', ') ?? 'none';

    return `Tool: ${t.name}\nDescription: ${t.description ?? 'no description'}\nParameters:\n${params}\nRequired: ${required}`;
  }).join('\n\n');

  const isMultiTool = tools.length >= 2;

  return `You are generating test scenarios for an MCP (Model Context Protocol) server benchmark.

Given the following tool definitions, generate realistic test scenarios that a user might ask an AI agent to perform.

${toolDescriptions}

For EACH tool, generate exactly:
- 2 "positive" scenarios (easy difficulty) — straightforward tasks that clearly map to this tool
- 1 "optional-params" scenario (medium difficulty) — a task that requires filling optional parameters
- 1 "ambiguous" scenario (medium difficulty) — a task that could be interpreted in multiple ways
- 1 "negative" scenario (hard difficulty) — a task that sounds related but no tool should handle it (expectedTool: null)

${isMultiTool ? `Since there are ${tools.length} tools, also generate:
- 2 "multi-tool" scenarios (medium difficulty) — tasks requiring multiple tool calls in sequence
- 1 "disambiguation" scenario (hard difficulty) — a task where the LLM must choose between similar tools` : ''}

Return ONLY a JSON array of scenario objects with this exact schema:
[
  {
    "id": "unique-id",
    "task": "Natural language task description",
    "expectedTool": "tool_name or null for negative scenarios",
    "expectedParams": { "param": "value" },
    "tags": ["positive"|"negative"|"ambiguous"|"multi-tool"|"optional-params"],
    "difficulty": "easy"|"medium"|"hard"
  }
]

Return ONLY the JSON array, no markdown fences, no explanation.`;
}

/**
 * Auto-generate bench scenarios from tool definitions using an LLM call.
 * Returns an array of BenchScenario objects.
 */
export async function generateScenarios(
  tools: ToolDefinition[],
  adapter: LLMAdapter,
): Promise<BenchScenario[]> {
  const prompt = buildPrompt(tools);

  const response = await adapter.chat({
    system: 'You are a test scenario generator. Output only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
    tools: [], // No tools needed for generation
    temperature: 0,
  });

  let text = response.content.trim();
  // Strip markdown fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(text) as unknown[];
  return parsed.map((item) => {
    const s = item as Record<string, unknown>;
    return {
      id: String(s['id'] ?? ''),
      task: String(s['task'] ?? ''),
      expectedTool: s['expectedTool'] === null ? null : String(s['expectedTool'] ?? ''),
      expectedParams: s['expectedParams'] as Record<string, unknown> | undefined,
      tags: Array.isArray(s['tags']) ? (s['tags'] as string[]) : [],
      difficulty: (['easy', 'medium', 'hard'].includes(String(s['difficulty']))
        ? String(s['difficulty'])
        : 'medium') as BenchScenario['difficulty'],
    };
  });
}
