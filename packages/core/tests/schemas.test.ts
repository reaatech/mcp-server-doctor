import {
  DiagnosticReportSchema,
  LatencyMetricsSchema,
  ToolDefinitionSchema,
} from '@reaatech/mcp-server-doctor-core';
import { describe, expect, it } from 'vitest';

describe('schemas', () => {
  describe('LatencyMetricsSchema', () => {
    it('validates correct latency metrics', () => {
      const result = LatencyMetricsSchema.safeParse({
        p50: 100,
        p90: 200,
        p99: 300,
        min: 50,
        max: 500,
        mean: 150,
        samples: 100,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid latency metrics', () => {
      const result = LatencyMetricsSchema.safeParse({ p50: 'not a number' });
      expect(result.success).toBe(false);
    });
  });

  describe('ToolDefinitionSchema', () => {
    it('validates correct tool definition', () => {
      const result = ToolDefinitionSchema.safeParse({
        name: 'echo',
        description: 'Echo tool',
        inputSchema: { type: 'object' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty tool name', () => {
      const result = ToolDefinitionSchema.safeParse({
        name: '',
        description: 'Echo tool',
        inputSchema: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DiagnosticReportSchema', () => {
    it('validates complete report', () => {
      const result = DiagnosticReportSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        endpoint: 'http://localhost:8080',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:01:00.000Z',
        durationMs: 60000,
        version: '1.0.0',
        transport: 'http',
        authMode: 'none',
        overallGrade: 'B',
        checks: [],
        tools: [],
        latency: { p50: 100, p90: 200, p99: 300, min: 50, max: 500, mean: 150, samples: 100 },
        toolLatencies: [],
      });
      expect(result.success).toBe(true);
    });
  });
});
