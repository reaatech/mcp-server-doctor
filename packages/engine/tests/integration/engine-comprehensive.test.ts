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

describe('DiagnosticEngine Comprehensive', () => {
  it('handles client with missing server info', async () => {
    const client = createMockClient({
      getServerInfo: vi.fn().mockReturnValue({}),
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
    expect(report.serverInfo).toEqual({});
  });

  it('handles client with null session ID on http', async () => {
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

  it('handles client with large tool list', async () => {
    const manyTools = Array.from({ length: 20 }, (_, i) => ({
      name: `tool-${i}`,
      description: `Tool number ${i}`,
      inputSchema: { type: 'object' },
    }));
    const client = createMockClient({
      listTools: vi.fn().mockResolvedValue(manyTools),
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
    expect(report.tools).toHaveLength(20);
  });

  it('handles client with malformed tool definitions', async () => {
    const client = createMockClient({
      listTools: vi.fn().mockResolvedValue([
        { name: '', description: '', inputSchema: {} },
        { name: 'valid-tool', description: 'A valid tool', inputSchema: { type: 'object' } },
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
    const schemaCheck = report.checks.find((c) => c.name === 'tool-schema-validation');
    expect(schemaCheck?.details.invalidCount).toBe(1);
  });

  it('handles engine with stdio transport option', async () => {
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

  it('handles engine with sse transport option', async () => {
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

  it('handles engine with auto transport option', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      },
      'http://localhost:8080',
    );

    await client.connect();
    const report = await engine.run();
    expect(report.transport).toBe('auto');
  });

  it('handles engine with bearer auth mode', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'http',
        auth: 'bearer',
        bearerToken: 'test-token',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      },
      'http://localhost:8080',
    );

    await client.connect();
    const report = await engine.run();
    expect(report.authMode).toBe('bearer');
  });

  it('handles engine with oauth auth mode', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'http',
        auth: 'oauth',
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
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

  it('handles engine with api-key auth mode', async () => {
    const client = createMockClient();
    const engine = new DiagnosticEngine(
      client,
      {
        transport: 'http',
        auth: 'api-key',
        apiKey: 'test-api-key',
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
});
