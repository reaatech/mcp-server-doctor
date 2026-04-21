import { describe, it, expect, vi } from 'vitest';
import { StdioTransport } from '../../src/mcp-client/transports/stdio.js';
import { StreamableHTTPTransport } from '../../src/mcp-client/transports/streamable-http.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'spawn') cb();
    }),
    stdin: { write: vi.fn() },
    kill: vi.fn(),
  }),
}));

describe('Transports', () => {
  describe('StdioTransport', () => {
    it('creates transport with options', () => {
      const transport = new StdioTransport({
        command: '/usr/bin/echo',
        args: [],
        timeout: 30000,
      });
      expect(transport).toBeDefined();
    });

    it('connects successfully', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/echo',
        args: [],
        timeout: 30000,
      });
      await transport.connect();
      expect(transport).toBeDefined();
    });

    it('disconnects cleanly', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/echo',
        args: [],
        timeout: 30000,
      });
      await transport.connect();
      await transport.disconnect();
    });
  });

  describe('StreamableHTTPTransport', () => {
    it('creates transport with options', () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 30000,
      });
      expect(transport).toBeDefined();
    });

    it('returns null session ID before connect', () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 30000,
      });
      expect(transport.getSessionId()).toBeNull();
    });
  });
});
