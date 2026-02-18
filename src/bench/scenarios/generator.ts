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
 * Extract and clean JSON from an LLM response that may contain extra text,
 * markdown fences, trailing commas, or single-line comments.
 */
export function extractJson(raw: string): string {
  let text = raw.trim();

  // Strip markdown fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?\s*```\s*$/m, '');

  // Find the outermost JSON structure (first [ or { to matching last ] or })
  const firstBracket = text.indexOf('[');
  const firstBrace = text.indexOf('{');

  let start: number;
  let endChar: string;

  if (firstBracket === -1 && firstBrace === -1) {
    // No JSON structure found
    return text.trim();
  } else if (firstBracket === -1) {
    start = firstBrace;
    endChar = '}';
  } else if (firstBrace === -1) {
    start = firstBracket;
    endChar = ']';
  } else {
    start = Math.min(firstBracket, firstBrace);
    endChar = start === firstBracket ? ']' : '}';
  }

  const lastEnd = text.lastIndexOf(endChar);
  if (lastEnd > start) {
    text = text.slice(start, lastEnd + 1);
  }

  // Remove single-line comments (// ...)
  text = text.replace(/\/\/[^\n]*/g, '');

  // Remove trailing commas before ] or }
  text = text.replace(/,\s*([}\]])/g, '$1');

  return text.trim();
}

/**
 * Try to salvage a truncated JSON array by finding all complete top-level objects.
 * Works on raw text (after fence-stripping) — finds the first '[' and then
 * tracks brace depth to identify complete objects.
 */
export function salvageTruncatedArray(text: string): { json: string; truncated: boolean } {
  const trimmed = text.trim();

  // Find the opening bracket
  const arrayStart = trimmed.indexOf('[');
  if (arrayStart === -1) {
    return { json: trimmed, truncated: false };
  }

  // If the array is properly closed, not truncated
  const afterBracket = trimmed.slice(arrayStart);
  // Quick check: try parsing as-is first
  try {
    JSON.parse(afterBracket);
    return { json: afterBracket, truncated: false };
  } catch {
    // Continue to salvage
  }

  // Walk through tracking brace depth to find complete top-level objects
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastCompleteObjectEnd = -1;
  const content = afterBracket;

  for (let i = 1; i < content.length; i++) {
    const ch = content[i]!;

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        lastCompleteObjectEnd = i;
      }
    } else if (ch === ']' && depth === 0) {
      // Properly closed array — not truncated
      return { json: content.slice(0, i + 1), truncated: false };
    }
  }

  if (lastCompleteObjectEnd === -1) {
    return { json: trimmed, truncated: false };
  }

  // Close the array after the last complete object
  let salvaged = content.slice(0, lastCompleteObjectEnd + 1);
  // Remove any trailing comma
  salvaged = salvaged.replace(/,\s*$/, '');
  return { json: salvaged + ']', truncated: true };
}

function toScenarios(parsed: unknown[]): BenchScenario[] {
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

export interface GenerateOptions {
  verbose?: boolean;
}

/**
 * Auto-generate bench scenarios from tool definitions using an LLM call.
 * Retries once with a stricter prompt if JSON parsing fails.
 */
export async function generateScenarios(
  tools: ToolDefinition[],
  adapter: LLMAdapter,
  options: GenerateOptions = {},
): Promise<BenchScenario[]> {
  const { verbose } = options;
  const prompt = buildPrompt(tools);

  const chatParams = {
    system: 'You are a test scenario generator. Output only valid JSON.',
    messages: [{ role: 'user' as const, content: prompt }],
    tools: [] as ToolDefinition[],
    temperature: 0,
    maxTokens: 4096,
  };

  // First attempt
  const response = await adapter.chat(chatParams);

  if (verbose) {
    console.error('[verbose] Raw LLM response (%d chars):\n%s', response.content.length, response.content);
  }

  const cleaned = extractJson(response.content);

  if (verbose) {
    console.error('[verbose] After extractJson (%d chars):\n%s', cleaned.length, cleaned);
  }

  try {
    const parsed = JSON.parse(cleaned) as unknown[];
    return toScenarios(parsed);
  } catch {
    // Try salvaging a truncated array from the raw response
    const { json: salvaged, truncated } = salvageTruncatedArray(response.content);
    if (truncated) {
      try {
        const parsed = JSON.parse(salvaged) as unknown[];
        console.error(`Warning: Response was truncated, using ${parsed.length} of expected scenarios`);
        return toScenarios(parsed);
      } catch {
        // Salvage also failed, fall through to retry
      }
    }
    if (verbose) {
      console.error('[verbose] First JSON.parse failed, retrying with stricter prompt...');
    }
  }

  // Retry with explicit instructions
  const retryParams = {
    system: 'You are a JSON generator. Output ONLY a valid JSON array. No text, no markdown, no comments, no trailing commas.',
    messages: [
      {
        role: 'user' as const,
        content: prompt + '\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON array, nothing else.',
      },
    ],
    tools: [] as ToolDefinition[],
    temperature: 0,
    maxTokens: 4096,
  };

  const retryResponse = await adapter.chat(retryParams);

  if (verbose) {
    console.error('[verbose] Retry raw LLM response (%d chars):\n%s', retryResponse.content.length, retryResponse.content);
  }

  const retryCleaned = extractJson(retryResponse.content);

  if (verbose) {
    console.error('[verbose] Retry after extractJson (%d chars):\n%s', retryCleaned.length, retryCleaned);
  }

  try {
    const parsed = JSON.parse(retryCleaned) as unknown[];
    return toScenarios(parsed);
  } catch {
    // Try salvaging a truncated array from the raw retry response
    const { json: salvaged, truncated } = salvageTruncatedArray(retryResponse.content);
    if (truncated) {
      try {
        const parsed = JSON.parse(salvaged) as unknown[];
        console.error(`Warning: Response was truncated, using ${parsed.length} of expected scenarios`);
        return toScenarios(parsed);
      } catch {
        // Salvage also failed, throw
      }
    }
    const preview = retryResponse.content.slice(0, 500);
    throw new Error(
      `Could not parse scenario JSON from LLM response. Try again or provide custom scenarios with --scenarios\n\nRaw response (first 500 chars):\n${preview}`,
    );
  }
}
