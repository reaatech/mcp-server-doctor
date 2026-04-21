import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('logger', () => {
    it('creates logger in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/observability/logger.js');
      expect(logger).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });

    it('creates logger in dev mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/observability/logger.js');
      expect(logger).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('metrics', () => {
    it('exports record functions without OTEL endpoint', async () => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      const { recordCheck, recordLatency, recordGrade, getMetricsSummary } =
        await import('../../src/observability/metrics.js');
      expect(() => recordCheck('test', 'A', 100)).not.toThrow();
      expect(() => recordLatency('tool', 50)).not.toThrow();
      expect(() => recordGrade('B')).not.toThrow();
      expect(getMetricsSummary()).toEqual({ meterProvider: false });
    });

    it('exports record functions with OTEL endpoint', async () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
      const { recordCheck, recordLatency, recordGrade, getMetricsSummary } =
        await import('../../src/observability/metrics.js');
      expect(() => recordCheck('test', 'A', 100)).not.toThrow();
      expect(() => recordLatency('tool', 50)).not.toThrow();
      expect(() => recordGrade('B')).not.toThrow();
      expect(getMetricsSummary()).toEqual({ meterProvider: true });
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    });
  });
});
