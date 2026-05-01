import type { MCPClient } from '@reaatech/mcp-server-doctor-client';
import type { ToolDefinition } from '@reaatech/mcp-server-doctor-core';

export class MockMCPClient implements MCPClient {
  tools: ToolDefinition[] = [];
  serverInfo: Record<string, unknown> = {};
  shouldFail = false;
  latencyMs = 10;

  constructor(
    options: {
      tools?: ToolDefinition[];
      serverInfo?: Record<string, unknown>;
      shouldFail?: boolean;
      latencyMs?: number;
    } = {},
  ) {
    this.tools = options.tools || [
      { name: 'echo', description: 'Echo tool', inputSchema: { type: 'object' } },
      { name: 'health', description: 'Health check', inputSchema: { type: 'object' } },
    ];
    this.serverInfo = options.serverInfo || {
      serverInfo: { name: 'mock-server', version: '1.0.0' },
    };
    this.shouldFail = options.shouldFail || false;
    this.latencyMs = options.latencyMs || 10;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async sendRequest(method: string): Promise<unknown> {
    if (this.shouldFail) {
      throw new Error('Mock client failure');
    }
    await new Promise((r) => setTimeout(r, this.latencyMs));
    if (method === 'ping') return {};
    if (method === 'nonexistent_method_xyz') {
      throw new Error(JSON.stringify({ code: -32601, message: 'Method not found' }));
    }
    return {};
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this.tools;
  }

  async callTool(name: string): Promise<unknown> {
    if (this.shouldFail) {
      throw new Error('Tool call failed');
    }
    await new Promise((r) => setTimeout(r, this.latencyMs));
    if (name === 'nonexistent_tool_xyz') {
      throw new Error(JSON.stringify({ code: -32602, message: 'Invalid params' }));
    }
    return { content: [{ type: 'text', text: 'ok' }] };
  }

  getSessionId(): string | null {
    return 'mock-session-123';
  }

  getServerInfo(): Record<string, unknown> {
    return this.serverInfo;
  }
}
