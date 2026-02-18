import { existsSync } from 'node:fs';
import type { ToolDefinition } from '../core/types.js';
import type { LLMAdapter, LLMResponse } from './llm/adapter.js';
import type { BenchScenario, DXScore } from './types.js';
import { generateScenarios } from './scenarios/generator.js';
import { loadScenarios } from './scenarios/loader.js';
import { evaluateToolSelection } from './evaluators/tool-selection.js';
import { evaluateParameters } from './evaluators/parameters.js';
import { evaluateAmbiguity } from './evaluators/ambiguity.js';
import { evaluateMultiTool } from './evaluators/multi-tool.js';
import { evaluateErrorRecovery } from './evaluators/error-recovery.js';
import { calculateDXScore } from './score.js';

const DEFAULT_CONCURRENCY = 5;

export interface BenchConfig {
  provider: string;
  model: string;
  scenarios: string;
  runs: number;
  temperature: number;
  skipErrorRecovery?: boolean;
  verbose?: boolean;
  concurrency?: number;
}

export interface BenchEstimate {
  scenarioCount: number;
  runs: number;
  totalCalls: number;
  estimatedCost: number;
  scenarios: BenchScenario[];
}

export interface BenchReport {
  score: DXScore;
  scenarios: BenchScenario[];
  responses: LLMResponse[];
  config: BenchConfig;
  tools: ToolDefinition[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

const BENCH_SYSTEM_PROMPT = `You are an AI assistant with access to tools. When a user gives you a task, decide which tool(s) to call and with what parameters. If no tool is appropriate, explain why you cannot help. If the task is ambiguous, ask for clarification.`;

/**
 * Majority vote: return the most frequent value in an array.
 */
function mode<T>(values: T[]): T | undefined {
  const counts = new Map<string, { value: T; count: number }>();
  for (const v of values) {
    const key = JSON.stringify(v);
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { value: v, count: 1 });
    }
  }
  let best: { value: T; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }
  return best?.value;
}

/**
 * Estimate cost before running the benchmark.
 * Generates (or loads) scenarios and returns the estimate for user confirmation.
 */
export async function estimateBench(
  tools: ToolDefinition[],
  config: BenchConfig,
  adapter: LLMAdapter,
): Promise<BenchEstimate> {
  let scenarios: BenchScenario[];

  if (config.scenarios !== 'auto' && existsSync(config.scenarios)) {
    scenarios = loadScenarios(config.scenarios);
  } else {
    scenarios = await generateScenarios(tools, adapter, { verbose: config.verbose });
  }

  const evalCalls = scenarios.length * config.runs;
  const errorRecoveryCalls = config.skipErrorRecovery
    ? 0
    : scenarios.filter((s) => s.expectedTool !== null).length * config.runs;
  const totalCalls = evalCalls + errorRecoveryCalls;

  // Rough estimate: ~800 input tokens and ~200 output tokens per call
  const estimatedCost = adapter.estimateCost(800 * totalCalls, 200 * totalCalls);

  return {
    scenarioCount: scenarios.length,
    runs: config.runs,
    totalCalls,
    estimatedCost,
    scenarios,
  };
}

/**
 * Run the full bench pipeline.
 * Takes pre-generated scenarios (from estimateBench) to avoid re-generating.
 */
export async function runBench(
  tools: ToolDefinition[],
  config: BenchConfig,
  adapter: LLMAdapter,
  scenarios: BenchScenario[],
  onProgress?: (completed: number, total: number) => void,
): Promise<BenchReport> {
  const availableTools = new Set(tools.map((t) => t.name));
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const totalEvalCalls = scenarios.length * config.runs;
  let completed = 0;
  const concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;

  // Evaluate one scenario: run N times and return majority-vote representative response
  async function evaluateScenario(scenario: BenchScenario): Promise<LLMResponse> {
    const runs: LLMResponse[] = [];

    for (let r = 0; r < config.runs; r++) {
      const response = await adapter.chat({
        system: BENCH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: scenario.task }],
        tools,
        temperature: config.temperature,
      });

      runs.push(response);
      totalInputTokens += response.inputTokens;
      totalOutputTokens += response.outputTokens;

      completed++;
      onProgress?.(completed, totalEvalCalls);
    }

    // Majority vote on tool selection
    const majorityToolName = mode(runs.map((r) => r.toolCalls[0]?.name ?? null));
    return runs.find(
      (r) => (r.toolCalls[0]?.name ?? null) === majorityToolName,
    ) ?? runs[0]!;
  }

  // Run scenario evaluations concurrently with a pool of `concurrency`
  const allResponses: LLMResponse[] = new Array(scenarios.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < scenarios.length) {
      const idx = nextIndex++;
      allResponses[idx] = await evaluateScenario(scenarios[idx]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, scenarios.length) },
    () => worker(),
  );
  await Promise.all(workers);

  // Run evaluators
  const toolSelectionResult = evaluateToolSelection(scenarios, allResponses, availableTools);
  const parametersResult = evaluateParameters(scenarios, allResponses);
  const ambiguityResult = evaluateAmbiguity(scenarios, allResponses);
  const multiToolResult = evaluateMultiTool(scenarios, allResponses, availableTools);

  const evaluatorResults = [
    toolSelectionResult,
    parametersResult,
    ambiguityResult,
    multiToolResult,
  ];

  // Error recovery (optional — requires additional LLM calls)
  if (!config.skipErrorRecovery) {
    const errorRecoveryResult = await evaluateErrorRecovery(
      scenarios,
      allResponses,
      adapter,
      tools,
    );
    totalInputTokens += errorRecoveryResult.details.length * 200; // rough estimate
    totalOutputTokens += errorRecoveryResult.details.length * 100;
    evaluatorResults.push(errorRecoveryResult);
  }

  const score = calculateDXScore(evaluatorResults);
  const totalCost = adapter.estimateCost(totalInputTokens, totalOutputTokens);

  return {
    score,
    scenarios,
    responses: allResponses,
    config,
    tools,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
  };
}
