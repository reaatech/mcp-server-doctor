import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { runCompareCommand as RunCompareCommandType } from '../src/cli/compare.command.js';
import type { runDiagnoseCommand as RunDiagnoseCommandType } from '../src/cli/diagnose.command.js';
import type { runWatchCommand as RunWatchCommandType } from '../src/cli/watch.command.js';

vi.mock('../src/cli/diagnose.command.js', () => ({
  runDiagnoseCommand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/cli/compare.command.js', () => ({
  runCompareCommand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/cli/watch.command.js', () => ({
  runWatchCommand: vi.fn().mockResolvedValue(undefined),
}));

describe('CLI entry point', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('parses diagnose command with arguments', async () => {
    const originalArgv = process.argv;
    process.argv = [
      'node',
      'doctor',
      'diagnose',
      'http://localhost:8080',
      '--transport',
      'http',
      '--auth',
      'bearer',
      '--bearer-token',
      'token123',
    ];

    const { runDiagnoseCommand } = await import('../src/cli/diagnose.command.js');
    await import('../src/cli.js');

    const mock = runDiagnoseCommand as MockedFunction<typeof RunDiagnoseCommandType>;
    expect(mock).toHaveBeenCalledOnce();
    expect(mock.mock.calls[0]?.[0]).toBe('http://localhost:8080');
    expect(mock.mock.calls[0]?.[1]).toMatchObject({
      transport: 'http',
      auth: 'bearer',
      bearerToken: 'token123',
    });

    process.argv = originalArgv;
  });

  it('parses compare command with arguments', async () => {
    const originalArgv = process.argv;
    process.argv = [
      'node',
      'doctor',
      'compare',
      'baseline.json',
      'current.json',
      '--format',
      'json',
    ];

    const { runCompareCommand } = await import('../src/cli/compare.command.js');
    await import('../src/cli.js');

    const mock = runCompareCommand as MockedFunction<typeof RunCompareCommandType>;
    expect(mock).toHaveBeenCalledOnce();
    expect(mock.mock.calls[0]?.[0]).toBe('baseline.json');
    expect(mock.mock.calls[0]?.[1]).toBe('current.json');
    expect(mock.mock.calls[0]?.[2]).toMatchObject({
      format: 'json',
    });

    process.argv = originalArgv;
  });

  it('parses watch command with arguments', async () => {
    const originalArgv = process.argv;
    process.argv = [
      'node',
      'doctor',
      'watch',
      'http://localhost:8080',
      '--interval',
      '30',
      '--alert-threshold',
      'B',
    ];

    const { runWatchCommand } = await import('../src/cli/watch.command.js');
    await import('../src/cli.js');

    const mock = runWatchCommand as MockedFunction<typeof RunWatchCommandType>;
    expect(mock).toHaveBeenCalledOnce();
    expect(mock.mock.calls[0]?.[0]).toBe('http://localhost:8080');
    expect(mock.mock.calls[0]?.[1]).toMatchObject({
      interval: '30',
      alertThreshold: 'B',
    });

    process.argv = originalArgv;
  });
});
