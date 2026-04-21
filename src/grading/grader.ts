import { CheckResult, Grade, LatencyMetrics } from '../types/domain.js';
import { worstGrade, gradeLatency } from './benchmarks.js';

export interface GradingInput {
  checks: CheckResult[];
  latency: LatencyMetrics;
}

export function computeOverallGrade(input: GradingInput): Grade {
  const checkGrades = input.checks.map((c) => c.grade);
  // Latency is already factored into the latency-profiling check grade;
  // we also grade the raw p99 as a safety net in case that check errored out.
  const latencyGrade = gradeLatency(input.latency.p99);
  return worstGrade(...checkGrades, latencyGrade);
}
