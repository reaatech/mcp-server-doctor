export const LATENCY_BENCHMARKS = {
  A: { p99: 1000 },
  B: { p99: 3000 },
  C: { p99: 5000 },
  D: { p99: 10000 },
};

export const ERROR_RATE_BENCHMARKS = {
  A: 0,
  B: 0.01,
  C: 0.05,
  D: 0.1,
};

export const CONCURRENCY_BENCHMARKS = {
  A: 50,
  B: 25,
  C: 10,
  D: 5,
};

export const PAYLOAD_BENCHMARKS = {
  A: 5 * 1024 * 1024,
  B: 1 * 1024 * 1024,
  C: 500 * 1024,
  D: 100 * 1024,
};

export const GRADE_ORDER: Array<'A' | 'B' | 'C' | 'D' | 'F'> = ['A', 'B', 'C', 'D', 'F'];

const GRADE_INDEX = new Map<string, number>(GRADE_ORDER.map((g, i) => [g, i]));

export function gradeLatency(p99Ms: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (p99Ms <= LATENCY_BENCHMARKS.A.p99) return 'A';
  if (p99Ms <= LATENCY_BENCHMARKS.B.p99) return 'B';
  if (p99Ms <= LATENCY_BENCHMARKS.C.p99) return 'C';
  if (p99Ms <= LATENCY_BENCHMARKS.D.p99) return 'D';
  return 'F';
}

export function gradeErrorRate(rate: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (rate <= ERROR_RATE_BENCHMARKS.A) return 'A';
  if (rate <= ERROR_RATE_BENCHMARKS.B) return 'B';
  if (rate <= ERROR_RATE_BENCHMARKS.C) return 'C';
  if (rate <= ERROR_RATE_BENCHMARKS.D) return 'D';
  return 'F';
}

export function gradeConcurrency(maxParallel: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (maxParallel >= CONCURRENCY_BENCHMARKS.A) return 'A';
  if (maxParallel >= CONCURRENCY_BENCHMARKS.B) return 'B';
  if (maxParallel >= CONCURRENCY_BENCHMARKS.C) return 'C';
  if (maxParallel >= CONCURRENCY_BENCHMARKS.D) return 'D';
  return 'F';
}

export function gradePayload(maxBytes: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (maxBytes >= PAYLOAD_BENCHMARKS.A) return 'A';
  if (maxBytes >= PAYLOAD_BENCHMARKS.B) return 'B';
  if (maxBytes >= PAYLOAD_BENCHMARKS.C) return 'C';
  if (maxBytes >= PAYLOAD_BENCHMARKS.D) return 'D';
  return 'F';
}

export function gradeCompliance(passed: boolean, warnings = 0): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (!passed) return 'F';
  if (warnings === 0) return 'A';
  if (warnings <= 2) return 'B';
  if (warnings <= 5) return 'C';
  if (warnings <= 9) return 'D';
  return 'F';
}

export function worstGrade(
  ...grades: Array<'A' | 'B' | 'C' | 'D' | 'F'>
): 'A' | 'B' | 'C' | 'D' | 'F' {
  let worst: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  for (const g of grades) {
    if ((GRADE_INDEX.get(g) ?? 0) > (GRADE_INDEX.get(worst) ?? 0)) {
      worst = g;
    }
  }
  return worst;
}

export function gradeToNumber(grade: 'A' | 'B' | 'C' | 'D' | 'F'): number {
  const map: Record<'A' | 'B' | 'C' | 'D' | 'F', number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  return map[grade];
}

export function numberToGrade(n: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (n >= 3.5) return 'A';
  if (n >= 2.5) return 'B';
  if (n >= 1.5) return 'C';
  if (n >= 0.5) return 'D';
  return 'F';
}
