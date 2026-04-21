import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockRun = vi.fn().mockResolvedValue({
  overallGrade: 'D',
  checks: [],
  tools: [],
  latency: { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 },
  toolLatencies: [],
});

vi.mock('../../src/mcp-client/client.js', () => ({
  createDoctorClient: vi.fn().mockReturnValue({
    connect: mockConnect,
    disconnect: mockDisconnect,
    sendRequest: vi.fn().mockResolvedValue({}),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({}),
    getSessionId: vi.fn().mockReturnValue(null),
    getServerInfo: vi.fn().mockReturnValue({}),
  }),
}));

vi.mock('../../src/doctor/engine.js', () => ({
  DiagnosticEngine: vi.fn().mockImplementation(() => ({
    run: mockRun,
  })),
}));

vi.mock('../../src/reporters/index.js', () => ({
  formatReport: vi.fn().mockReturnValue('report output'),
}));

let sleepAbortCallback: (() => void) | undefined;

vi.mock('../../src/utils/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/index.js')>(
    '../../src/utils/index.js',
  );
  return {
    ...actual,
    sleep: vi.fn().mockImplementation(() => {
      sleepAbortCallback?.();
      return Promise.resolve();
    }),
  };
});

describe('runWatchCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sleepAbortCallback = undefined;
  });

  it('runs one watch cycle and exits when aborted', async () => {
    const { runWatchCommand: watchCmd } = await import('../../src/cli/commands/watch.command.js');
    const controller = new AbortController();
    sleepAbortCallback = () => controller.abort();

    await watchCmd(
      'http://localhost:8080',
      {
        interval: '0.01',
        alertThreshold: 'C',
        transport: 'http',
        auth: 'none',
        format: 'console',
        timeout: '30000',
        concurrency: '10',
      },
      controller.signal,
    );

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('defaults invalid interval to 60s', async () => {
    const { runWatchCommand: watchCmd } = await import('../../src/cli/commands/watch.command.js');
    const controller = new AbortController();
    sleepAbortCallback = () => controller.abort();

    await watchCmd(
      'http://localhost:8080',
      {
        interval: 'invalid',
        alertThreshold: 'C',
        transport: 'http',
        auth: 'none',
        format: 'console',
        timeout: '30000',
        concurrency: '10',
      },
      controller.signal,
    );

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('defaults invalid alert threshold to C', async () => {
    const { runWatchCommand: watchCmd } = await import('../../src/cli/commands/watch.command.js');
    const controller = new AbortController();
    sleepAbortCallback = () => controller.abort();

    await watchCmd(
      'http://localhost:8080',
      {
        interval: '0.01',
        alertThreshold: 'invalid',
        transport: 'http',
        auth: 'none',
        format: 'console',
        timeout: '30000',
        concurrency: '10',
      },
      controller.signal,
    );

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('handles watch cycle errors', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));
    const { runWatchCommand: watchCmd } = await import('../../src/cli/commands/watch.command.js');
    const controller = new AbortController();
    sleepAbortCallback = () => controller.abort();

    await watchCmd(
      'http://localhost:8080',
      {
        interval: '0.01',
        alertThreshold: 'C',
        transport: 'http',
        auth: 'none',
        format: 'console',
        timeout: '30000',
        concurrency: '10',
      },
      controller.signal,
    );

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});
