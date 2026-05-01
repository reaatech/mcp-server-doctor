import { runDiagnoseCommand } from '@reaatech/mcp-server-doctor-cli';
import { DiagnosticEngine } from '@reaatech/mcp-server-doctor-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@reaatech/mcp-server-doctor-engine', () => ({
  DiagnosticEngine: Object.assign(
    vi.fn().mockImplementation(() => ({
      run: vi.fn().mockResolvedValue({
        id: 'test-id',
        endpoint: 'http://localhost:8080',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:01:00.000Z',
        durationMs: 60000,
        version: '1.0.0',
        transport: 'http',
        authMode: 'none',
        overallGrade: 'A',
        checks: [],
        tools: [],
        latency: { p50: 100, p90: 200, p99: 300, min: 50, max: 500, mean: 150, samples: 100 },
        toolLatencies: [],
        serverInfo: {},
      }),
    })),
    {
      createErrorReport: vi.fn().mockReturnValue({
        id: 'test-id',
        endpoint: 'http://localhost:8080',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:01:00.000Z',
        durationMs: 60000,
        version: '1.0.0',
        transport: 'http',
        authMode: 'none',
        overallGrade: 'F',
        checks: [],
        tools: [],
        latency: { p50: 100, p90: 200, p99: 300, min: 50, max: 500, mean: 150, samples: 100 },
        toolLatencies: [],
        serverInfo: {},
        error: 'Connection refused',
      }),
    },
  ),
}));

vi.mock('@reaatech/mcp-server-doctor-reporters', () => ({
  formatReport: vi.fn().mockReturnValue('report output'),
}));

vi.mock('@reaatech/mcp-server-doctor-client', () => ({
  createDoctorClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendRequest: vi.fn().mockResolvedValue({}),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({}),
    getSessionId: vi.fn().mockReturnValue(null),
    getServerInfo: vi.fn().mockReturnValue({}),
  }),
}));

const originalExit = process.exit;
const originalStdoutWrite = process.stdout.write;

describe('runDiagnoseCommand Extended', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
    vi.clearAllMocks();
  });

  it('runs diagnosis with markdown format', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'http',
      auth: 'none',
      format: 'markdown',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('runs diagnosis with html format', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'http',
      auth: 'none',
      format: 'html',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('runs diagnosis with json format', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'http',
      auth: 'none',
      format: 'json',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('runs diagnosis with output file', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'http',
      auth: 'none',
      format: 'json',
      output: '/tmp/test-report.json',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('runs diagnosis with verbose mode', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'http',
      auth: 'none',
      format: 'console',
      verbose: true,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('runs diagnosis with stdio transport', async () => {
    await runDiagnoseCommand('/usr/bin/node', {
      transport: 'stdio',
      auth: 'none',
      format: 'console',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('runs diagnosis with sse transport', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'sse',
      auth: 'none',
      format: 'console',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('handles NaN concurrency by defaulting to 10', async () => {
    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'auto',
      auth: 'none',
      format: 'console',
      verbose: false,
      timeout: '30000',
      concurrency: 'invalid',
    });
    expect(DiagnosticEngine).toHaveBeenCalled();
  });

  it('handles engine connection failure', async () => {
    vi.mocked(DiagnosticEngine).mockImplementation(
      () =>
        ({
          run: vi.fn().mockRejectedValue(new Error('Connection refused')),
        }) as unknown as DiagnosticEngine,
    );

    await runDiagnoseCommand('http://localhost:8080', {
      transport: 'auto',
      auth: 'none',
      format: 'json',
      verbose: false,
      timeout: '30000',
      concurrency: '10',
    });
    expect(process.exitCode).toBe(3);
  });
});
