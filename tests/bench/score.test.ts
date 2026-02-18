import { describe, it, expect } from 'vitest';
import { calculateDXScore } from '../../src/bench/score.js';
import type { EvaluatorResult } from '../../src/bench/types.js';

function result(dimension: string, score: number, weight: number): EvaluatorResult {
  return {
    dimension,
    score,
    weight,
    details: score < 90 ? [{
      scenarioId: 'test',
      passed: false,
      expected: 'expected',
      actual: 'actual',
      note: `${dimension} failed in some scenario`,
    }] : [],
  };
}

describe('calculateDXScore', () => {
  it('calculates weighted average', () => {
    const dx = calculateDXScore([
      result('Tool Selection', 100, 0.35),
      result('Parameter Accuracy', 80, 0.3),
      result('Ambiguity Handling', 60, 0.15),
      result('Multi-tool', 90, 0.1),
      result('Error Recovery', 50, 0.1),
    ]);
    // (100*0.35 + 80*0.3 + 60*0.15 + 90*0.1 + 50*0.1) / 1.0 = 35 + 24 + 9 + 9 + 5 = 82
    expect(dx.overall).toBe(82);
    expect(dx.rating).toBe('Good');
  });

  it('rates Excellent for 90+', () => {
    const dx = calculateDXScore([
      result('Tool Selection', 95, 0.35),
      result('Parameter Accuracy', 92, 0.3),
      result('Ambiguity Handling', 90, 0.15),
      result('Multi-tool', 95, 0.1),
      result('Error Recovery', 90, 0.1),
    ]);
    expect(dx.rating).toBe('Excellent');
  });

  it('rates Good for 75-89', () => {
    const dx = calculateDXScore([result('A', 80, 1)]);
    expect(dx.rating).toBe('Good');
  });

  it('rates Needs work for 50-74', () => {
    const dx = calculateDXScore([result('A', 60, 1)]);
    expect(dx.rating).toBe('Needs work');
  });

  it('rates Poor for 0-49', () => {
    const dx = calculateDXScore([result('A', 30, 1)]);
    expect(dx.rating).toBe('Poor');
  });

  it('extracts top issues from worst dimensions', () => {
    const dx = calculateDXScore([
      result('Tool Selection', 95, 0.35),
      result('Parameter Accuracy', 40, 0.3),
      result('Error Recovery', 30, 0.1),
      result('Ambiguity Handling', 60, 0.15),
    ]);
    expect(dx.topIssues.length).toBeGreaterThanOrEqual(2);
    // Worst dimensions should be first
    expect(dx.topIssues[0]!.dimension).toBe('Error Recovery');
    expect(dx.topIssues[1]!.dimension).toBe('Parameter Accuracy');
    // Each issue should have a suggestion
    for (const issue of dx.topIssues) {
      expect(issue.suggestion.length).toBeGreaterThan(0);
    }
  });

  it('returns empty topIssues when all scores are 90+', () => {
    const dx = calculateDXScore([
      result('Tool Selection', 95, 0.35),
      result('Parameter Accuracy', 92, 0.3),
    ]);
    expect(dx.topIssues).toHaveLength(0);
  });

  it('returns 0 for empty results', () => {
    const dx = calculateDXScore([]);
    expect(dx.overall).toBe(0);
    expect(dx.rating).toBe('Poor');
  });

  it('preserves all dimension results', () => {
    const inputs = [
      result('Tool Selection', 80, 0.35),
      result('Parameter Accuracy', 70, 0.3),
    ];
    const dx = calculateDXScore(inputs);
    expect(dx.dimensions).toHaveLength(2);
    expect(dx.dimensions[0]!.dimension).toBe('Tool Selection');
  });
});
