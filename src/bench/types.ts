/** A test scenario for benchmarking. */
export interface BenchScenario {
  id: string;
  task: string;
  expectedTool: string | null;
  expectedParams?: Record<string, unknown>;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/** Detail for a single scenario evaluation. */
export interface EvalDetail {
  scenarioId: string;
  passed: boolean;
  expected: string;
  actual: string;
  note?: string;
}

/** Result from a single evaluator dimension. */
export interface EvaluatorResult {
  dimension: string;
  score: number;
  weight: number;
  details: EvalDetail[];
}

/** A top issue with actionable fix suggestion. */
export interface TopIssue {
  dimension: string;
  description: string;
  suggestion: string;
}

/** The overall Agent DX Score. */
export interface DXScore {
  overall: number;
  rating: 'Excellent' | 'Good' | 'Needs work' | 'Poor';
  dimensions: EvaluatorResult[];
  topIssues: TopIssue[];
}
