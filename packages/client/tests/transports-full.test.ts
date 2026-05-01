import {
  SSETransport,
  StdioTransport,
  StreamableHTTPTransport,
} from '@reaatech/mcp-server-doctor-client';
import { EventSource } from 'eventsource';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- StdioTransport: mock child_process ---
const mockStdinWrite = vi.fn();
const mockKill = vi.fn();
let mockEventHandlers: Map<string, Array<(...args: unknown[]) => void>> = new Map();

const { spawn } = await vi.hoisted(async () => {
  const { vi } = await import('vitest');
  return {
    spawn: vi.fn().mockImplementation(() => {
      mockEventHandlers = new Map();
      const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!mockEventHandlers.has(event)) mockEventHandlers.set(event, []);
        mockEventHandlers.get(event)?.push(cb);
        if (event === 'spawn') {
          setTimeout(() => cb(), 0);
        }
        return { on };
      });
      const once = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!mockEventHandlers.has(event)) mockEventHandlers.set(event, []);
        mockEventHandlers.get(event)?.push(cb);
        return { on, once };
      });
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on,
        once,
        stdin: { write: mockStdinWrite, end: vi.fn() },
        kill: mockKill,
      };
    }),
  };
});

vi.mock('node:child_process', () => ({ spawn }));

// --- HTTP & SSE: mock global.fetch ---
const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

// --- SSE: mock EventSource ---
interface MockEventSource {
  url: string;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  __endpoint?: (event: Event) => void;
  __message?: (event: Event) => void;
}

vi.mock('eventsource', () => ({
  EventSource: vi.fn().mockImplementation((url: string) => {
    const instance: MockEventSource = {
      url,
      onopen: null,
      onerror: null,
      close: vi.fn(),
      addEventListener: vi.fn((event: string, cb: (event: Event) => void) => {
        if (event === 'endpoint') instance.__endpoint = cb;
        if (event === 'message') instance.__message = cb;
      }),
    };
    return instance;
  }),
}));

function getLastEventSource(): MockEventSource {
  const results = (EventSource as unknown as ReturnType<typeof vi.fn>).mock.results;
  const last = results[results.length - 1];
  if (!last) throw new Error('No EventSource instance created');
  return last.value as MockEventSource;
}

describe('Transport Implementations', () => {
  beforeEach(() => {
    mockStdinWrite.mockReset();
    mockKill.mockClear();
    mockFetch.mockReset();
  });

  describe('StdioTransport', () => {
    it('creates transport with command and args', () => {
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: ['--version'],
        timeout: 5000,
      });
      expect(transport).toBeDefined();
    });

    it('connects and calls spawn callback', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      expect(transport).toBeDefined();
    });

    it('disconnects and cleans up process', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      await transport.disconnect();
      expect(mockKill).toHaveBeenCalled();
    });

    it('rejects pending requests on disconnect', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      const pendingPromise = transport.sendRequest('slow', {});
      await transport.disconnect();
      await expect(pendingPromise).rejects.toThrow('Transport disconnected');
    });

    it('throws when sending request without connection', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await expect(transport.sendRequest('ping', {})).rejects.toThrow('Not connected');
    });

    it('handles write errors on sendRequest', async () => {
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      mockStdinWrite.mockImplementation(() => {
        throw new Error('write EPIPE');
      });
      await expect(transport.sendRequest('ping', {})).rejects.toThrow('write EPIPE');
    });

    it('rejects connect when process exits immediately', async () => {
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'exit') {
            setTimeout(() => cb(1), 0);
          }
          return { on, once: vi.fn() };
        });
        const once = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'exit') {
            setTimeout(() => cb(1), 0);
          }
          return { on, once };
        });
        return {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on,
          once,
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await expect(transport.connect()).rejects.toThrow('exited immediately');
    });

    it('rejects connect on spawn error', async () => {
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('spawn ENOENT')), 0);
          }
          return { on, once: vi.fn() };
        });
        return {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on,
          once: vi.fn(),
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/nonexistent/binary',
        args: [],
        timeout: 5000,
      });
      await expect(transport.connect()).rejects.toThrow('spawn ENOENT');
    });

    it('parses JSON responses from stdout', async () => {
      let stdoutCb: ((data: Buffer) => void) | undefined;
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => cb(), 0);
          }
          return { on, once: vi.fn() };
        });
        const stdoutOn = vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCb = cb;
        });
        return {
          stdout: { on: stdoutOn },
          stderr: { on: vi.fn() },
          on,
          once: vi.fn(),
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      const requestPromise = transport.sendRequest('ping', {});
      stdoutCb?.(Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'pong' })}\n`));
      const result = await requestPromise;
      expect(result).toBe('pong');
    });

    it('handles RPC errors from stdout', async () => {
      let stdoutCb: ((data: Buffer) => void) | undefined;
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => cb(), 0);
          }
          return { on, once: vi.fn() };
        });
        const stdoutOn = vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCb = cb;
        });
        return {
          stdout: { on: stdoutOn },
          stderr: { on: vi.fn() },
          on,
          once: vi.fn(),
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      const requestPromise = transport.sendRequest('ping', {});
      stdoutCb?.(
        Buffer.from(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32600, message: 'Bad Request' },
          })}\n`,
        ),
      );
      await expect(requestPromise).rejects.toThrow('Bad Request');
    });

    it('skips non-JSON stdout lines', async () => {
      let stdoutCb: ((data: Buffer) => void) | undefined;
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => cb(), 0);
          }
          return { on, once: vi.fn() };
        });
        const stdoutOn = vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stdoutCb = cb;
        });
        return {
          stdout: { on: stdoutOn },
          stderr: { on: vi.fn() },
          on,
          once: vi.fn(),
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      const requestPromise = transport.sendRequest('ping', {});
      stdoutCb?.(Buffer.from('some log output\n'));
      stdoutCb?.(Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'pong' })}\n`));
      const result = await requestPromise;
      expect(result).toBe('pong');
    });

    it('logs stderr data', async () => {
      let stderrCb: ((data: Buffer) => void) | undefined;
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => cb(), 0);
          }
          return { on, once: vi.fn() };
        });
        const stderrOn = vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') stderrCb = cb;
        });
        return {
          stdout: { on: vi.fn() },
          stderr: { on: stderrOn },
          on,
          once: vi.fn(),
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      await transport.connect();
      stderrCb?.(Buffer.from('error: something went wrong\n'));
      expect(transport).toBeDefined();
    });

    it('rejects pending requests when process exits after connect', async () => {
      const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!handlers.has(event)) handlers.set(event, []);
          handlers.get(event)?.push(cb);
          return { on, once, off };
        });
        const once = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!handlers.has(event)) handlers.set(event, []);
          handlers.get(event)?.push(cb);
          return { on, once, off };
        });
        const off = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          const eventHandlers = handlers.get(event);
          if (eventHandlers) {
            const idx = eventHandlers.indexOf(cb);
            if (idx >= 0) eventHandlers.splice(idx, 1);
          }
          return { on, once, off };
        });
        return {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on,
          once,
          off,
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const spawnCallbacks = handlers.get('spawn');
      if (spawnCallbacks) {
        for (const cb of spawnCallbacks) {
          cb();
        }
      }
      await connectPromise;
      const pendingPromise = transport.sendRequest('slow', {});
      const exitHandlers = handlers.get('exit') || [];
      expect(exitHandlers.length).toBeGreaterThan(0);
      exitHandlers[exitHandlers.length - 1]?.(1);
      await expect(pendingPromise).rejects.toThrow('stdio process exited unexpectedly');
    });

    it('times out pending requests', async () => {
      spawn.mockImplementationOnce(() => {
        const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => cb(), 0);
          }
          return { on, once: vi.fn() };
        });
        const stdoutOn = vi.fn();
        return {
          stdout: { on: stdoutOn },
          stderr: { on: vi.fn() },
          on,
          once: vi.fn(),
          stdin: { write: vi.fn(), end: vi.fn() },
          kill: vi.fn(),
        };
      });
      const transport = new StdioTransport({
        command: '/usr/bin/node',
        args: [],
        timeout: 10,
      });
      await transport.connect();
      await expect(transport.sendRequest('slow', {})).rejects.toThrow('Request timeout: slow');
    });
  });

  describe('StreamableHTTPTransport', () => {
    it('creates transport with URL', () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      expect(transport).toBeDefined();
    });

    it('returns null session ID before connect', () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      expect(transport.getSessionId()).toBeNull();
    });

    it('creates transport with headers', () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
        headers: { 'X-Custom': 'value' },
      });
      expect(transport).toBeDefined();
    });

    it('connect() is a no-op', async () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await transport.connect();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sendRequest() with initialize stores session ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('session-123') },
        json: vi.fn().mockResolvedValue({ result: { capabilities: {} } }),
      });
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await transport.connect();
      await transport.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      });
      expect(transport.getSessionId()).toBe('session-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('sendRequest() throws when not connected', async () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await expect(transport.sendRequest('ping', {})).rejects.toThrow('Not connected');
    });

    it('sendRequest() throws on HTTP error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('session-123') },
          json: vi.fn().mockResolvedValue({ result: {} }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: vi.fn().mockResolvedValue({}),
        });
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await transport.connect();
      await transport.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      });
      await expect(transport.sendRequest('ping', {})).rejects.toThrow('HTTP 404');
    });

    it('sendRequest() throws on JSON-RPC error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('session-123') },
          json: vi.fn().mockResolvedValue({ result: {} }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ error: { message: 'Method not found' } }),
        });
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await transport.connect();
      await transport.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      });
      await expect(transport.sendRequest('unknown', {})).rejects.toThrow('Method not found');
    });

    it('disconnect() sends DELETE with session ID', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('session-123') },
          json: vi.fn().mockResolvedValue({ result: {} }),
        })
        .mockResolvedValueOnce({ ok: true });
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await transport.connect();
      await transport.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      });
      await transport.disconnect();
      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:8080',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(transport.getSessionId()).toBeNull();
    });

    it('disconnect() is no-op without session ID', async () => {
      const transport = new StreamableHTTPTransport({
        url: 'http://localhost:8080',
        timeout: 5000,
      });
      await transport.disconnect();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe.sequential('SSETransport', () => {
    it('creates transport with URL', () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      expect(transport).toBeDefined();
    });

    it('disconnects cleanly without connection', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      await transport.disconnect();
    });

    it('connect() succeeds on onopen', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.onopen?.();
      await connectPromise;
    });

    it('connect() rejects on timeout', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 10,
      });
      await expect(transport.connect()).rejects.toThrow('SSE connection timeout');
    });

    it('connect() rejects on error before open', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.onerror?.();
      await expect(connectPromise).rejects.toThrow('SSE connection error');
    });

    it('receives endpoint event as JSON', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.__endpoint?.({
        data: JSON.stringify({ endpoint: 'http://localhost:8080/sse' }),
      } as unknown as Event);
      es.onopen?.();
      await connectPromise;

      mockFetch.mockImplementationOnce(() => new Promise(() => {}));
      const sendPromise = transport.sendRequest('ping', {});
      es.__message?.({ data: JSON.stringify({ id: 1, result: 'pong' }) } as unknown as Event);
      const result = await sendPromise;
      expect(result).toBe('pong');
    });

    it('receives endpoint event as plain string', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.__endpoint?.({ data: 'http://localhost:8080/sse' } as unknown as Event);
      es.onopen?.();
      await connectPromise;

      mockFetch.mockImplementationOnce(() => new Promise(() => {}));
      const sendPromise = transport.sendRequest('ping', {});
      es.__message?.({ data: JSON.stringify({ id: 1, result: 'pong' }) } as unknown as Event);
      const result = await sendPromise;
      expect(result).toBe('pong');
    });

    it('sendRequest() throws without endpoint', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      await expect(transport.sendRequest('ping', {})).rejects.toThrow(
        'SSE endpoint not established',
      );
    });

    it('sendRequest() handles fetch failure', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.__endpoint?.({ data: 'http://localhost:8080/sse' } as unknown as Event);
      es.onopen?.();
      await connectPromise;

      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(transport.sendRequest('ping', {})).rejects.toThrow('Network error');
    });

    it('sendRequest() handles timeout', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 10,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.__endpoint?.({ data: 'http://localhost:8080/sse' } as unknown as Event);
      es.onopen?.();
      await connectPromise;

      mockFetch.mockImplementationOnce(() => new Promise(() => {}));
      await expect(transport.sendRequest('slow', {})).rejects.toThrow('Request timeout');
    });

    it('disconnect() cleans up pending requests', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.__endpoint?.({ data: 'http://localhost:8080/sse' } as unknown as Event);
      es.onopen?.();
      await connectPromise;

      mockFetch.mockImplementationOnce(() => new Promise(() => {}));
      const pending = transport.sendRequest('slow', {});
      await transport.disconnect();
      await expect(pending).rejects.toThrow('Transport disconnected');
    });

    it('receives message responses via EventSource', async () => {
      const transport = new SSETransport({
        url: 'http://localhost:8080/events',
        timeout: 5000,
      });
      const connectPromise = transport.connect();
      const es = getLastEventSource();
      es.__endpoint?.({ data: 'http://localhost:8080/sse' } as unknown as Event);
      es.onopen?.();
      await connectPromise;

      mockFetch.mockImplementationOnce(() => new Promise(() => {}));
      const sendPromise = transport.sendRequest('ping', {});
      es.__message?.({ data: JSON.stringify({ id: 1, result: 'pong' }) } as unknown as Event);
      const result = await sendPromise;
      expect(result).toBe('pong');
    });
  });
});
