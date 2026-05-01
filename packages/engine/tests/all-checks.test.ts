import type { MCPClient } from '@reaatech/mcp-server-doctor-client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@reaatech/mcp-server-doctor-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@reaatech/mcp-server-doctor-client')>();
  return {
    ...actual,
    createDoctorClient: vi.fn(),
  };
});

import { CheckCategory, Severity } from '@reaatech/mcp-server-doctor-core';
import {
  AuthVerificationCheck,
  ConcurrencyStressCheck,
  ErrorFormatCheck,
  LatencyProfilingCheck,
  PayloadLimitsCheck,
  TimeoutBehaviorCheck,
  ToolSchemaValidationCheck,
  TransportNegotiationCheck,
} from '@reaatech/mcp-server-doctor-engine';

const createContext = (overrides = {}) => ({
  endpoint: 'http://localhost:8080',
  options: {
    transport: 'http' as const,
    auth: 'none' as const,
    timeout: 30000,
    concurrency: 10,
    verbose: false,
  },
  requestId: 'test-123',
  startTime: Date.now(),
  ...overrides,
});

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

describe('All Diagnostic Checks', () => {
  describe('TransportNegotiationCheck', () => {
    it('has correct metadata', () => {
      const check = new TransportNegotiationCheck();
      expect(check.name).toBe('transport-negotiation');
      expect(check.category).toBe(CheckCategory.TRANSPORT);
      expect(check.severity).toBe(Severity.CRITICAL);
    });

    it('returns passing result on success', async () => {
      const check = new TransportNegotiationCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.grade).not.toBe('F');
    });

    it('returns failing result when sendRequest throws', async () => {
      const check = new TransportNegotiationCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockRejectedValue(new Error('Connection failed')),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(false);
      expect(result.grade).toBe('F');
    });

    it('warns about slow ping', async () => {
      const check = new TransportNegotiationCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 6000));
          return {};
        }),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.pingWarning).toBe('Ping took > 5s');
    }, 10000);

    it('warns about missing server info', async () => {
      const check = new TransportNegotiationCheck();
      const client = createMockClient({
        getServerInfo: vi.fn().mockReturnValue({}),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.serverInfoWarning).toBe('Server info missing or incomplete');
    });

    it('does not warn about session ID for stdio transport', async () => {
      const check = new TransportNegotiationCheck();
      const client = createMockClient();
      const context = createContext({
        options: { ...createContext().options, transport: 'stdio' },
      });
      const result = await check.validate(client, context);
      expect(result.details.sessionIdWarning).toBeUndefined();
    });

    it('does not warn about session ID for auto transport with non-URL endpoint', async () => {
      const check = new TransportNegotiationCheck();
      const client = createMockClient();
      const context = createContext({
        endpoint: '/usr/bin/node',
        options: { ...createContext().options, transport: 'auto' },
      });
      const result = await check.validate(client, context);
      expect(result.details.sessionIdWarning).toBeUndefined();
    });
  });

  describe('ToolSchemaValidationCheck', () => {
    it('has correct metadata', () => {
      const check = new ToolSchemaValidationCheck();
      expect(check.name).toBe('tool-schema-validation');
      expect(check.category).toBe(CheckCategory.SCHEMA);
    });

    it('validates tools with valid schemas', async () => {
      const check = new ToolSchemaValidationCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.toolCount).toBe(1);
    });

    it('reports invalid tool names', async () => {
      const check = new ToolSchemaValidationCheck();
      const client = createMockClient({
        listTools: vi
          .fn()
          .mockResolvedValue([{ name: '123-invalid', description: 'Bad name', inputSchema: {} }]),
      });
      const result = await check.validate(client, createContext());
      expect(result.details.invalidCount).toBeGreaterThan(0);
    });

    it('warns about missing descriptions', async () => {
      const check = new ToolSchemaValidationCheck();
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([{ name: 'tool', description: '', inputSchema: {} }]),
      });
      const result = await check.validate(client, createContext());
      expect(result.details.invalidCount).toBeGreaterThan(0);
    });
  });

  describe('LatencyProfilingCheck', () => {
    it('has correct metadata', () => {
      const check = new LatencyProfilingCheck();
      expect(check.name).toBe('latency-profiling');
      expect(check.category).toBe(CheckCategory.LATENCY);
    });

    it('returns warning when no testable tools', async () => {
      const check = new LatencyProfilingCheck();
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([
          {
            name: 'tool',
            description: 'Tool',
            inputSchema: {
              type: 'object',
              properties: { param: { type: 'string' } },
              required: ['param'],
            },
          },
        ]),
      });
      const result = await check.validate(client, createContext());
      expect(result.details.warning).toBeDefined();
    });

    it('measures latency for empty-schema tools', async () => {
      const check = new LatencyProfilingCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.grade).not.toBe('F');
    });
  });

  describe('AuthVerificationCheck', () => {
    it('has correct metadata', () => {
      const check = new AuthVerificationCheck();
      expect(check.name).toBe('auth-verification');
      expect(check.category).toBe(CheckCategory.AUTH);
    });

    it('passes with no auth mode', async () => {
      const check = new AuthVerificationCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
    });

    it('passes with bearer auth mode', async () => {
      const check = new AuthVerificationCheck();
      const client = createMockClient();
      const context = {
        ...createContext(),
        options: { ...createContext().options, auth: 'bearer' as const },
      };
      const result = await check.validate(client, context);
      expect(result.passed).toBe(true);
    });

    it('returns note for stdio transport when auth is configured', async () => {
      const check = new AuthVerificationCheck();
      const client = createMockClient();
      const context = createContext({
        options: { ...createContext().options, transport: 'stdio', auth: 'bearer' as const },
      });
      const result = await check.validate(client, context);
      expect(result.passed).toBe(true);
      expect(result.details.note).toContain('manual verification recommended');
    });

    it('warns when configured auth fails', async () => {
      const check = new AuthVerificationCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockRejectedValue(new Error('Unauthorized')),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(false);
      expect(result.grade).toBe('F');
    });

    it('detects unauthenticated request acceptance', async () => {
      const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
      vi.mocked(createDoctorClient).mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        sendRequest: vi.fn().mockResolvedValue({}),
      } as unknown as MCPClient);

      const check = new AuthVerificationCheck();
      const client = createMockClient();
      const context = createContext({
        options: { ...createContext().options, auth: 'bearer' as const },
      });
      const result = await check.validate(client, context);
      expect(result.details.unauthenticatedAccepted).toBe(true);
      expect(result.passed).toBe(false);
    });

    it('detects unauthenticated request rejection', async () => {
      const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
      vi.mocked(createDoctorClient).mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        sendRequest: vi.fn().mockRejectedValue(new Error('Unauthorized')),
      } as unknown as MCPClient);

      const check = new AuthVerificationCheck();
      const client = createMockClient();
      const context = createContext({
        options: { ...createContext().options, auth: 'bearer' as const },
      });
      const result = await check.validate(client, context);
      expect(result.details.unauthenticatedRejected).toBe(true);
      expect(result.passed).toBe(true);
    });
  });

  describe('PayloadLimitsCheck', () => {
    it('has correct metadata', () => {
      const check = new PayloadLimitsCheck();
      expect(check.name).toBe('payload-limits');
      expect(check.category).toBe(CheckCategory.PAYLOAD);
    });

    it('returns warning when no testable tools', async () => {
      const check = new PayloadLimitsCheck();
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([
          {
            name: 'tool',
            description: 'Tool',
            inputSchema: { type: 'object', properties: { param: { type: 'number' } } },
          },
        ]),
      });
      const result = await check.validate(client, createContext());
      expect(result.details.warning).toBeDefined();
    });
  });

  describe('TimeoutBehaviorCheck', () => {
    it('has correct metadata', () => {
      const check = new TimeoutBehaviorCheck();
      expect(check.name).toBe('timeout-behavior');
      expect(check.category).toBe(CheckCategory.TIMEOUT);
    });

    it('passes when baseline and post-timeout pings succeed', async () => {
      const check = new TimeoutBehaviorCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
    });

    it('returns failing result when baseline ping throws', async () => {
      const check = new TimeoutBehaviorCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockRejectedValue(new Error('Connection failed')),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(false);
      expect(result.grade).toBe('F');
    });

    it('handles temp client timeout trigger', async () => {
      const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
      vi.mocked(createDoctorClient).mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        sendRequest: vi.fn().mockRejectedValue(new Error('Request timeout: ping')),
      } as unknown as MCPClient);

      const check = new TimeoutBehaviorCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.shortTimeoutTriggered).toBe(true);
    });

    it('handles temp client non-timeout error', async () => {
      const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
      vi.mocked(createDoctorClient).mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        sendRequest: vi.fn().mockRejectedValue(new Error('Some other error')),
      } as unknown as MCPClient);

      const check = new TimeoutBehaviorCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.shortTimeoutError).toBe('Some other error');
    });

    it('fails when connection cleanup fails after timeout', async () => {
      const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
      vi.mocked(createDoctorClient).mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
        sendRequest: vi.fn().mockRejectedValue(new Error('Request timeout: ping')),
      } as unknown as MCPClient);

      const check = new TimeoutBehaviorCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(false);
      expect(result.details.connectionLeakWarning).toBeDefined();
    });

    it('handles temp client connect failure gracefully', async () => {
      const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
      vi.mocked(createDoctorClient).mockReturnValue({
        connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
        disconnect: vi.fn().mockResolvedValue(undefined),
        sendRequest: vi.fn().mockResolvedValue({}),
      } as unknown as MCPClient);

      const check = new TimeoutBehaviorCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.tempClientError).toBe('Connection refused');
    });
  });

  describe('ErrorFormatCheck', () => {
    it('has correct metadata', () => {
      const check = new ErrorFormatCheck();
      expect(check.name).toBe('error-format');
      expect(check.category).toBe(CheckCategory.ERROR_FORMAT);
    });

    it('validates error format for unknown methods', async () => {
      const check = new ErrorFormatCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockImplementation((method: string) => {
          if (method === 'nonexistent_method_xyz') {
            return Promise.reject(
              new Error(JSON.stringify({ code: -32601, message: 'Method not found' })),
            );
          }
          return Promise.resolve({});
        }),
        callTool: vi.fn().mockImplementation((name: string) => {
          if (name === 'nonexistent_tool_xyz') {
            return Promise.reject(
              new Error(JSON.stringify({ code: -32602, message: 'Invalid params' })),
            );
          }
          return Promise.resolve({});
        }),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
    });

    it('warns when unknown method returns success', async () => {
      const check = new ErrorFormatCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockImplementation((method: string) => {
          if (method === 'nonexistent_method_xyz') {
            return Promise.resolve({ unexpected: 'success' });
          }
          return Promise.resolve({});
        }),
        callTool: vi.fn().mockImplementation((name: string) => {
          if (name === 'nonexistent_tool_xyz') {
            return Promise.reject(
              new Error(JSON.stringify({ code: -32602, message: 'Invalid params' })),
            );
          }
          return Promise.resolve({});
        }),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.metrics.warnings).toBeGreaterThan(0);
    });

    it('fails when unknown tool returns success', async () => {
      const check = new ErrorFormatCheck();
      const client = createMockClient({
        sendRequest: vi
          .fn()
          .mockRejectedValue(
            new Error(JSON.stringify({ code: -32601, message: 'Method not found' })),
          ),
        callTool: vi.fn().mockResolvedValue({ unexpected: 'success' }),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(false);
      expect(result.grade).toBe('F');
    });

    it('handles malformed JSON-RPC errors', async () => {
      const check = new ErrorFormatCheck();
      const client = createMockClient({
        sendRequest: vi
          .fn()
          .mockRejectedValue(new Error(JSON.stringify({ message: 'Missing code' }))),
        callTool: vi
          .fn()
          .mockRejectedValue(new Error(JSON.stringify({ code: 400, message: 'Positive code' }))),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(false);
      expect(result.details.validSamples).toBe(0);
    });

    it('handles non-JSON error messages', async () => {
      const check = new ErrorFormatCheck();
      const client = createMockClient({
        sendRequest: vi.fn().mockRejectedValue(new Error('plain text error')),
        callTool: vi.fn().mockRejectedValue(new Error('another plain error')),
      });
      const result = await check.validate(client, createContext());
      expect(result.passed).toBe(true);
      expect(result.details.validSamples).toBe(2);
    });
  });

  describe('ConcurrencyStressCheck', () => {
    it('has correct metadata', () => {
      const check = new ConcurrencyStressCheck();
      expect(check.name).toBe('concurrency-stress');
      expect(check.category).toBe(CheckCategory.CONCURRENCY);
    });

    it('returns warning when no testable tools', async () => {
      const check = new ConcurrencyStressCheck();
      const client = createMockClient({
        listTools: vi.fn().mockResolvedValue([
          {
            name: 'tool',
            description: 'Tool',
            inputSchema: {
              type: 'object',
              properties: { param: { type: 'string' } },
              required: ['param'],
            },
          },
        ]),
      });
      const result = await check.validate(client, createContext());
      expect(result.details.warning).toBeDefined();
    });

    it('tests concurrency levels', async () => {
      const check = new ConcurrencyStressCheck();
      const client = createMockClient();
      const result = await check.validate(client, createContext());
      expect(result.details.concurrencyResults).toBeDefined();
    });
  });
});
