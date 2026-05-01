import { CheckCategory, Severity, computeOverallGrade } from '@reaatech/mcp-server-doctor-core';
import { describe, expect, it } from 'vitest';

describe('grader', () => {
  describe('computeOverallGrade', () => {
    it('computes overall grade from checks and latency', () => {
      const input = {
        checks: [
          {
            name: 'check1',
            grade: 'A' as const,
            passed: true,
            category: CheckCategory.TRANSPORT,
            severity: Severity.CRITICAL,
            message: '',
            details: {},
            metrics: {},
            remediation: '',
            durationMs: 0,
            timestamp: '',
          },
          {
            name: 'check2',
            grade: 'B' as const,
            passed: true,
            category: CheckCategory.SCHEMA,
            severity: Severity.CRITICAL,
            message: '',
            details: {},
            metrics: {},
            remediation: '',
            durationMs: 0,
            timestamp: '',
          },
        ],
        latency: { p50: 100, p90: 200, p99: 500, min: 50, max: 600, mean: 150, samples: 10 },
      };
      const grade = computeOverallGrade(input);
      expect(grade).toBe('B');
    });

    it('returns F when latency is F', () => {
      const input = {
        checks: [
          {
            name: 'check1',
            grade: 'A' as const,
            passed: true,
            category: CheckCategory.TRANSPORT,
            severity: Severity.CRITICAL,
            message: '',
            details: {},
            metrics: {},
            remediation: '',
            durationMs: 0,
            timestamp: '',
          },
        ],
        latency: {
          p50: 5000,
          p90: 8000,
          p99: 15000,
          min: 4000,
          max: 20000,
          mean: 7000,
          samples: 10,
        },
      };
      const grade = computeOverallGrade(input);
      expect(grade).toBe('F');
    });
  });
});
