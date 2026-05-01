import { DISCONNECT_TIMEOUT_MS } from '@reaatech/mcp-server-doctor-core';
import { TransportError } from './errors.js';

export interface StreamableHTTPTransportOptions {
  url: string;
  timeout: number;
  headers?: Record<string, string>;
}

export class StreamableHTTPTransport {
  private sessionId: string | null = null;
  private messageId = 0;

  constructor(private options: StreamableHTTPTransportOptions) {}

  async connect(): Promise<void> {
    // Initialization happens on the first sendRequest('initialize') call
    // so that DoctorMCPClient drives the full MCP lifecycle.
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.sessionId && method !== 'initialize') {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;
    const request = { jsonrpc: '2.0', id, method, params };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers,
    };

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const response = await fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.options.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as Record<string, unknown>;
    if ((result as { error?: { message?: string; code?: number; data?: unknown } }).error) {
      const rpcError = (result as { error: { message?: string; code?: number; data?: unknown } })
        .error;
      throw new TransportError(
        rpcError.message || JSON.stringify(result.error),
        rpcError.code,
        rpcError.data,
      );
    }

    if (method === 'initialize') {
      this.sessionId = response.headers.get('mcp-session-id');
    }

    return (result as { result?: unknown }).result;
  }

  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await fetch(this.options.url, {
          method: 'DELETE',
          headers: { 'mcp-session-id': this.sessionId, ...this.options.headers },
          signal: AbortSignal.timeout(DISCONNECT_TIMEOUT_MS),
        });
      } catch {
        // Ignore disconnect errors
      }
      this.sessionId = null;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}
