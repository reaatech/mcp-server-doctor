import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDiagnoseCommand } from '../../src/cli/commands/diagnose.command.js';
import { runCompareCommand } from '../../src/cli/commands/compare.command.js';
import { DiagnosticEngine } from '../../src/doctor/engine.js';
import * as reporters from '../../src/reporters/index.js';

const mockReport = {
  id: 'test-id',
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
  serverInfo: {},
};

vi.mock('../../src/doctor/engine.js', () => ({
  DiagnosticEngine: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue(mockReport),
  })),
}));

vi.mock('../../src/reporters/index.js', () => ({
  formatReport: vi.fn().mockResolvedValue('report output'),
}));

vi.mock('../../src/mcp-client/client.js', () => ({
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

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
    vi.clearAllMocks();
  });

  describe('runDiagnoseCommand', () => {
    it('runs diagnosis with default options', async () => {
      await runDiagnoseCommand('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        format: 'console',
        verbose: false,
        timeout: '30000',
        concurrency: '10',
      });
      expect(DiagnosticEngine).toHaveBeenCalled();
      expect(reporters.formatReport).toHaveBeenCalled();
    });

    it('runs diagnosis with bearer auth', async () => {
      await runDiagnoseCommand('http://localhost:8080', {
        transport: 'http',
        auth: 'bearer',
        bearerToken: 'test-token',
        format: 'json',
        verbose: false,
        timeout: '30000',
        concurrency: '10',
      });
      expect(DiagnosticEngine).toHaveBeenCalled();
    });

    it('exits with code 1 for F grade', async () => {
      vi.mocked(DiagnosticEngine).mockImplementation(
        () =>
          ({
            run: vi.fn().mockResolvedValue({ ...mockReport, overallGrade: 'F' }),
          }) as unknown as DiagnosticEngine,
      );

      await runDiagnoseCommand('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        format: 'console',
        verbose: false,
        timeout: '30000',
        concurrency: '10',
      });
      expect(process.exitCode).toBe(1);
    });

    it('exits with code 2 for D grade', async () => {
      vi.mocked(DiagnosticEngine).mockImplementation(
        () =>
          ({
            run: vi.fn().mockResolvedValue({ ...mockReport, overallGrade: 'D' }),
          }) as unknown as DiagnosticEngine,
      );

      await runDiagnoseCommand('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        format: 'console',
        verbose: false,
        timeout: '30000',
        concurrency: '10',
      });
      expect(process.exitCode).toBe(2);
    });

    it('handles invalid timeout by defaulting to 30000', async () => {
      await runDiagnoseCommand('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        format: 'console',
        verbose: false,
        timeout: 'invalid',
        concurrency: '10',
      });
      expect(DiagnosticEngine).toHaveBeenCalled();
    });
  });

  describe('runCompareCommand', () => {
    it('fails when baseline file not found', async () => {
      await runCompareCommand('/nonexistent/baseline.json', '/nonexistent/current.json', {
        format: 'json',
      });
      expect(process.exit).toHaveBeenCalledWith(3);
    });
  });
});
