import { describe, it, expect, vi } from 'vitest';
import { DiagnosticEngine } from '../../src/doctor/engine.js';
import { MCPClient } from '../../src/mcp-client/client.js';

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

describe('DiagnosticEngine Edge Cases', () => {
  it('handles auth mode api-key', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'http',
        auth: 'api-key',
        apiKey: 'test-key',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      },
      'http://localhost:8080',
    );

    await client.connect();
    const report = await engine.run();
    expect(report.authMode).toBe('api-key');
  });

  it('handles auth mode oauth', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'http',
        auth: 'oauth',
        bearerToken: 'oauth-token',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      },
      'http://localhost:8080',
    );

    await client.connect();
    const report = await engine.run();
    expect(report.authMode).toBe('oauth');
  });

  it('handles stdio transport mode', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'stdio',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      },
      '/usr/bin/node',
    );

    await client.connect();
    const report = await engine.run();
    expect(report.transport).toBe('stdio');
  });

  it('handles sse transport mode', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'sse',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      },
      'http://localhost:8080',
    );

    await client.connect();
    const report = await engine.run();
    expect(report.transport).toBe('sse');
  });

  it('handles high concurrency setting', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'http',
        auth: 'none',
        timeout: 30000,
        concurrency: 50,
        verbose: false,
      },
      'http://localhost:8080',
    );

    await client.connect();
    const report = await engine.run();
    expect(report).toBeDefined();
  });

  it('handles verbose mode enabled', async () => {
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
