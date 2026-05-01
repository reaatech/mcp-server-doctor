import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', undefined);
  });

  describe('logger', () => {
    it('creates logger in production mode', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { logger } = await import('@reaatech/mcp-server-doctor-observability');
      expect(logger).toBeDefined();
    });

    it('creates logger in dev mode', async () => {
      vi.stubEnv('NODE_ENV', undefined);
      const { logger } = await import('@reaatech/mcp-server-doctor-observability');
      expect(logger).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('exports record functions without OTEL endpoint', async () => {
      const { recordCheck, recordLatency, recordGrade, getMetricsSummary } = await import(
        '@reaatech/mcp-server-doctor-observability'
      );
      expect(() => recordCheck('test', 'A', 100)).not.toThrow();
      expect(() => recordLatency('tool', 50)).not.toThrow();
      expect(() => recordGrade('B')).not.toThrow();
      expect(getMetricsSummary()).toEqual({ meterProvider: false });
    });

    it('exports record functions with OTEL endpoint', async () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318');
      const { recordCheck, recordLatency, recordGrade, getMetricsSummary } = await import(
        '@reaatech/mcp-server-doctor-observability'
      );
      expect(() => recordCheck('test', 'A', 100)).not.toThrow();
      expect(() => recordLatency('tool', 50)).not.toThrow();
      expect(() => recordGrade('B')).not.toThrow();
      expect(getMetricsSummary()).toEqual({ meterProvider: true });
    });
  });
});
