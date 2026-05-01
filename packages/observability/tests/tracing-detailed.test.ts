import * as tracing from '@reaatech/mcp-server-doctor-observability';
import { describe, expect, it } from 'vitest';

describe('Tracing Module', () => {
  it('startSpan executes callback and ends span', () => {
    let executed = false;
    tracing.startSpan('test-span', (_span) => {
      executed = true;
    });
    expect(executed).toBe(true);
  });

  it('startSpan handles errors in callback', () => {
    expect(() => {
      tracing.startSpan('error-span', () => {
        throw new Error('Test error');
      });
    }).toThrow('Test error');
  });

  it('startAsyncSpan executes async callback', async () => {
    const result = await tracing.startAsyncSpan('async-span', async () => {
      return 'async-result';
    });
    expect(result).toBe('async-result');
  });

  it('startAsyncSpan handles errors', async () => {
    await expect(
      tracing.startAsyncSpan('error-async-span', async () => {
        throw new Error('Async error');
      }),
    ).rejects.toThrow('Async error');
  });

  it('exports trace module', () => {
    expect(tracing.trace).toBeDefined();
  });
});
