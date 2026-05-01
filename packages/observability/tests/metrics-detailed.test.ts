import * as metrics from '@reaatech/mcp-server-doctor-observability';
import { describe, expect, it } from 'vitest';

describe('Metrics Module', () => {
  it('records check metrics', () => {
    metrics.recordCheck('test-check', 'A', 100);
  });

  it('records check metrics with different grades', () => {
    metrics.recordCheck('latency-check', 'B', 200);
    metrics.recordCheck('auth-check', 'F', 50);
  });

  it('records latency metrics', () => {
    metrics.recordLatency('echo-tool', 45);
    metrics.recordLatency('search-tool', 200);
  });

  it('records grade metrics', () => {
    metrics.recordGrade('A');
    metrics.recordGrade('C');
    metrics.recordGrade('F');
  });

  it('gets metrics summary', () => {
    const summary = metrics.getMetricsSummary();
    expect(summary).toBeDefined();
    expect(typeof summary.meterProvider).toBe('boolean');
  });
});
