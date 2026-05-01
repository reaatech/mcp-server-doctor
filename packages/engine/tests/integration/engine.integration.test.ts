import type { MCPClient } from '@reaatech/mcp-server-doctor-client';
import { DiagnosticEngine } from '@reaatech/mcp-server-doctor-engine';
import { describe, expect, it, vi } from 'vitest';

const createMockClient = (overrides = {}): MCPClient => ({
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

describe('DiagnosticEngine Integration', () => {
  describe('run with various client configurations', () => {
    it('handles client with empty tools list', async () => {
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([]),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      expect(report.tools).toHaveLength(0);
      expect(report.checks).toHaveLength(8);
    });

    it('handles client with multiple tools', async () => {
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([
          { name: 'tool1', description: 'First tool', inputSchema: { type: 'object' } },
          { name: 'tool2', description: 'Second tool', inputSchema: { type: 'object' } },
          { name: 'tool3', description: 'Third tool', inputSchema: { type: 'object' } },
        ]),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      expect(report.tools).toHaveLength(3);
    });

    it('handles client with tools that have required parameters', async () => {
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([
          {
            name: 'search',
            description: 'Search tool',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ]),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      const latencyCheck = report.checks.find((c) => c.name === 'latency-profiling');
      expect(latencyCheck?.details.warning).toBeDefined();
    });

    it('handles client sendRequest errors', async () => {
      const client = createMockClient({
        sendRequest: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      const failedChecks = report.checks.filter((c) => !c.passed);
      expect(failedChecks.length).toBeGreaterThan(0);
    });

    it('handles client callTool errors', async () => {
      const client = createMockClient({
        callTool: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      const concurrencyCheck = report.checks.find((c) => c.name === 'concurrency-stress');
      expect(concurrencyCheck?.passed).toBe(false);
    });

    it('handles client with no session ID', async () => {
      const client = createMockClient({
        getSessionId: vi.fn().mockReturnValue(null),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      const transportCheck = report.checks.find((c) => c.name === 'transport-negotiation');
      expect(transportCheck?.details.sessionIdWarning).toBeDefined();
    });

    it('handles client with slow responses', async () => {
      const client = createMockClient({
        sendRequest: vi.fn().mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 10));
          return {};
        }),
        callTool: vi.fn().mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { content: [{ type: 'text', text: 'ok' }] };
        }),
      });
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();

      expect(report.durationMs).toBeGreaterThan(10);
    });

    it('handles client with verbose mode', async () => {
      const client = createMockClient();
      const engine = new DiagnosticEngine(
        client,
        {
          transport: 'http',
          auth: 'none',
          timeout: 30000,
          concurrency: 10,
          verbose: true,
        },
        'http://localhost:8080',
      );

      await client.connect();
      const report = await engine.run();
      expect(report).toBeDefined();
    });
  });

  describe('createErrorReport', () => {
    it('creates error report with correct structure', () => {
      const options = {
        transport: 'http' as const,
        auth: 'none' as const,
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      };
      const error = new Error('Connection timeout');
      const report = DiagnosticEngine.createErrorReport(error, 'http://localhost:8080', options);

      expect(report.error).toBe('Connection timeout');
      expect(report.overallGrade).toBe('F');
      expect(report.endpoint).toBe('http://localhost:8080');
      expect(report.transport).toBe('http');
      expect(report.authMode).toBe('none');
      expect(report.checks).toEqual([]);
      expect(report.tools).toEqual([]);
      expect(report.id).toBeDefined();
      expect(report.version).toBeDefined();
      expect(report.startedAt).toBeDefined();
      expect(report.completedAt).toBeDefined();
    });
  });
});
