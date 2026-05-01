import { describe, expect, it, vi } from 'vitest';
import { createDoctorClient } from '../src/client.js';
import { StreamableHTTPTransport } from '../src/transports/index.js';

const createMockTransport = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  sendRequest: vi.fn().mockResolvedValue({}),
  getSessionId: vi.fn().mockReturnValue('mock-session'),
});

vi.mock('../src/transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createMockTransport()),
  SSETransport: vi.fn().mockImplementation(() => createMockTransport()),
  StreamableHTTPTransport: vi.fn().mockImplementation(() => createMockTransport()),
}));

vi.mock('@reaatech/mcp-server-doctor-observability', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ tools: [{ name: 'echo', description: 'Echo', inputSchema: {} }] });

      vi.mocked(StreamableHTTPTransport).mockImplementationOnce(
        () => mockTransport as unknown as StreamableHTTPTransport,
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
      expect(tools[0]?.name).toBe('echo');
    });

    it('calls a tool', async () => {
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ tools: [] })
        .mockResolvedValueOnce({ result: 'pong' });

      vi.mocked(StreamableHTTPTransport).mockImplementationOnce(
        () => mockTransport as unknown as StreamableHTTPTransport,
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
      const mockTransport = createMockTransport();
      mockTransport.getSessionId = vi.fn().mockReturnValue('session-123');
      mockTransport.sendRequest = vi.fn().mockResolvedValue({});

      vi.mocked(StreamableHTTPTransport).mockImplementationOnce(
        () => mockTransport as unknown as StreamableHTTPTransport,
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
