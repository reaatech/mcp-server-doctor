import { DiagnosticEngine } from '@reaatech/mcp-server-doctor-engine';
import { describe, expect, it, vi } from 'vitest';

const createMockClient = (overrides = {}) => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  sendRequest: vi.fn().mockResolvedValue({}),
  listTools: vi
    .fn()
    .mockResolvedValue([
      { name: 'echo', description: 'Echo tool', inputSchema: { type: 'object' } },
    ]),
  callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
  getSessionId: vi.fn().mockReturnValue('session-123'),
  getServerInfo: vi.fn().mockReturnValue({ serverInfo: { name: 'test', version: '1.0.0' } }),
  ...overrides,
});

describe('DiagnosticEngine', () => {
  describe('constructor', () => {
    it('creates engine with client, options, and endpoint', () => {
      const client = createMockClient();
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const engine = new DiagnosticEngine(client, options, 'http://localhost:8080');
      expect(engine).toBeInstanceOf(DiagnosticEngine);
    });
  });

  describe('run', () => {
    it('runs all 8 checks and returns a report', async () => {
      const client = createMockClient();
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const engine = new DiagnosticEngine(client, options, 'http://localhost:8080');

      await client.connect();
      const report = await engine.run();

      expect(report.id).toBeDefined();
      expect(report.endpoint).toBe('http://localhost:8080');
      expect(report.checks).toHaveLength(8);
      expect(report.tools).toHaveLength(1);
      expect(report.version).toBeDefined();
      expect(report.overallGrade).toBeDefined();
    });

    it('sets report endpoint from constructor parameter', async () => {
      const client = createMockClient();
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const engine = new DiagnosticEngine(client, options, 'http://example.com');
      await client.connect();
      const report = await engine.run();
      expect(report.endpoint).toBe('http://example.com');
    });

    it('includes server info in report', async () => {
      const client = createMockClient({
        getServerInfo: vi.fn().mockReturnValue({
          serverInfo: { name: 'my-server', version: '2.0.0', capabilities: { tools: {} } },
        }),
      });
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const engine = new DiagnosticEngine(client, options, 'http://localhost:8080');
      await client.connect();
      const report = await engine.run();
      expect(report.serverInfo).toBeDefined();
    });

    it('handles check failures gracefully', async () => {
      const client = createMockClient({
        callTool: vi.fn().mockRejectedValue(new Error('Tool failed')),
      });
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const engine = new DiagnosticEngine(client, options, 'http://localhost:8080');
      await client.connect();
      const report = await engine.run();
      expect(report.checks.length).toBe(8);
      const failedChecks = report.checks.filter((c) => !c.passed);
      expect(failedChecks.length).toBeGreaterThan(0);
    });
  });

  describe('createErrorReport', () => {
    it('creates error report with grade F', () => {
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const error = new Error('Connection failed');
      const report = DiagnosticEngine.createErrorReport(error, 'http://localhost:8080', options);

      expect(report.overallGrade).toBe('F');
      expect(report.error).toBe('Connection failed');
      expect(report.endpoint).toBe('http://localhost:8080');
      expect(report.checks).toHaveLength(0);
      expect(report.tools).toHaveLength(0);
      expect(report.id).toBeDefined();
      expect(report.version).toBeDefined();
    });

    it('sets transport and auth mode from options', () => {
      const options = {
        transport: 'stdio' as const,
        auth: 'bearer' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const error = new Error('Test');
      const report = DiagnosticEngine.createErrorReport(error, 'test', options);

      expect(report.transport).toBe('stdio');
      expect(report.authMode).toBe('bearer');
    });
  });
});
