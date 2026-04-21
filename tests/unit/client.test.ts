import { describe, it, expect, vi } from 'vitest';
import { createDoctorClient } from '../../src/mcp-client/client.js';

const createMockTransport = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  sendRequest: vi.fn().mockResolvedValue({}),
  getSessionId: vi.fn().mockReturnValue('mock-session'),
});

vi.mock('../../src/mcp-client/transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
  SSETransport: vi.fn().mockImplementation(() => createMockTransport()),
  StreamableHTTPTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

describe('MCP Client', () => {
  describe('createDoctorClient', () => {
    it('creates a client instance', () => {
      const client = createDoctorClient('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      expect(client).toBeDefined();
      expect(typeof client.connect).toBe('function');
      expect(typeof client.disconnect).toBe('function');
      expect(typeof client.sendRequest).toBe('function');
      expect(typeof client.listTools).toBe('function');
      expect(typeof client.callTool).toBe('function');
      expect(typeof client.getSessionId).toBe('function');
      expect(typeof client.getServerInfo).toBe('function');
    });
  });

  describe('client methods', () => {
    it('throws when sending request without connection', async () => {
      const client = createDoctorClient('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      await expect(client.sendRequest('ping', {})).rejects.toThrow('Not connected');
    });

    it('returns null session ID for non-HTTP transports', async () => {
      const client = createDoctorClient('/usr/bin/echo', {
        transport: 'stdio',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      expect(client.getSessionId()).toBeNull();
    });

    it('connects and disconnects with mocked transport', async () => {
      const client = createDoctorClient('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      await client.connect();
      expect(client.getServerInfo()).toBeDefined();
      await client.disconnect();
    });

    it('lists tools after connect', async () => {
      const { StreamableHTTPTransport } = await import('../../src/mcp-client/transports/index.js');
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn().mockResolvedValue({
        tools: [{ name: 'echo', description: 'Echo', inputSchema: {} }],
      });
      vi.mocked(StreamableHTTPTransport).mockImplementationOnce(
        () => mockTransport as unknown as InstanceType<typeof StreamableHTTPTransport>,
      );

      const client = createDoctorClient('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      await client.connect();
      const tools = await client.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]!.name).toBe('echo');
    });

    it('calls a tool', async () => {
      const { StreamableHTTPTransport } = await import('../../src/mcp-client/transports/index.js');
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn().mockResolvedValue({ result: 'pong' });
      vi.mocked(StreamableHTTPTransport).mockImplementationOnce(
        () => mockTransport as unknown as InstanceType<typeof StreamableHTTPTransport>,
      );

      const client = createDoctorClient('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      await client.connect();
      const result = await client.callTool('ping', { message: 'hello' });
      expect(result).toEqual({ result: 'pong' });
    });

    it('returns session ID for HTTP transport', async () => {
      const { StreamableHTTPTransport } = await import('../../src/mcp-client/transports/index.js');
      const mockTransport = createMockTransport();
      mockTransport.getSessionId = vi.fn().mockReturnValue('session-123');
      vi.mocked(StreamableHTTPTransport).mockImplementationOnce(
        () => mockTransport as unknown as InstanceType<typeof StreamableHTTPTransport>,
      );

      const client = createDoctorClient('http://localhost:8080', {
        transport: 'auto',
        auth: 'none',
        timeout: 30000,
        concurrency: 10,
        verbose: false,
      });
      await client.connect();
      expect(client.getSessionId()).toBe('session-123');
    });
  });
});
