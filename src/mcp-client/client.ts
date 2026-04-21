import { isValidURL, isPrivateURL } from '../utils/index.js';
import { getProgramVersion } from '../version.js';
import { StdioTransport, SSETransport, StreamableHTTPTransport } from './transports/index.js';
import { ToolDefinition, DiagnosticOptions } from '../types/domain.js';
import { logger } from '../observability/logger.js';

export interface MCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(method: string, params?: unknown): Promise<unknown>;
  listTools(): Promise<ToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  getSessionId(): string | null;
  getServerInfo(): Record<string, unknown>;
}

export function createDoctorClient(endpoint: string, options: DiagnosticOptions): MCPClient {
  return new DoctorMCPClient(endpoint, options);
}

class DoctorMCPClient implements MCPClient {
  private transport: StdioTransport | SSETransport | StreamableHTTPTransport | null = null;
  private serverInfo: Record<string, unknown> = {};
  private tools: ToolDefinition[] = [];

  constructor(
    private endpoint: string,
    private options: DiagnosticOptions,
  ) {}

  async connect(): Promise<void> {
    if (isPrivateURL(this.endpoint)) {
      logger.warn({ endpoint: this.endpoint }, 'Connecting to a private/internal endpoint');
    }

    let transport = await this.negotiateTransport();

    try {
      await transport.connect();
    } catch (connectError) {
      // Auto-negotiation fallback: HTTP → SSE
      if (this.options.transport === 'auto' && transport instanceof StreamableHTTPTransport) {
        logger.warn(
          { error: connectError instanceof Error ? connectError.message : String(connectError) },
          'HTTP transport failed, falling back to SSE',
        );
        transport = new SSETransport({
          url: this.endpoint,
          timeout: this.options.timeout,
          headers: this.buildHeaders(),
        });
        await transport.connect();
      } else {
        throw connectError;
      }
    }

    this.transport = transport;

    logger.info(
      { transport: this.options.transport, endpoint: this.endpoint },
      'Connected via transport',
    );

    const initResult = await transport.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-server-doctor', version: getProgramVersion() },
    });
    const initRecord = initResult as Record<string, unknown>;
    this.serverInfo = (initRecord.serverInfo as Record<string, unknown>) || initRecord;

    const toolsResult = await transport.sendRequest('tools/list');
    const toolsArray = (toolsResult as { tools?: Array<Record<string, unknown>> })?.tools || [];
    this.tools = toolsArray.map((t) => ({
      name: t.name as string,
      description: (t.description as string) || '',
      inputSchema: (t.inputSchema as Record<string, unknown>) || {},
    }));

    // The 'initialized' notification is sent to inform the server that the client is ready.
    // Not all transports implement sendNotification; we fire-and-forget where supported.
    const notifyTransport = transport as unknown as {
      sendNotification?: (method: string, params?: unknown) => Promise<void>;
    };
    if (typeof notifyTransport.sendNotification === 'function') {
      await notifyTransport.sendNotification('initialized', {});
    }
  }

  private async negotiateTransport(): Promise<
    StdioTransport | SSETransport | StreamableHTTPTransport
  > {
    const requested = this.options.transport;
    const isUrl = isValidURL(this.endpoint);

    if (requested === 'stdio') {
      return new StdioTransport({
        command: this.endpoint,
        args: [],
        timeout: this.options.timeout,
        env: this.buildStdioEnv(),
      });
    }

    if (requested === 'http') {
      if (!isUrl) {
        throw new Error('HTTP transport requires a URL endpoint');
      }
      return new StreamableHTTPTransport({
        url: this.endpoint,
        timeout: this.options.timeout,
        headers: this.buildHeaders(),
      });
    }

    if (requested === 'sse') {
      if (!isUrl) {
        throw new Error('SSE transport requires a URL endpoint');
      }
      return new SSETransport({
        url: this.endpoint,
        timeout: this.options.timeout,
        headers: this.buildHeaders(),
      });
    }

    if (requested === 'auto') {
      if (!isUrl) {
        return new StdioTransport({
          command: this.endpoint,
          args: [],
          timeout: this.options.timeout,
          env: this.buildStdioEnv(),
        });
      }
      return new StreamableHTTPTransport({
        url: this.endpoint,
        timeout: this.options.timeout,
        headers: this.buildHeaders(),
      });
    }

    throw new Error(`Unknown transport: ${requested}`);
  }

  private buildStdioEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    switch (this.options.auth) {
      case 'api-key':
        if (this.options.apiKey) {
          env.MCP_API_KEY = this.options.apiKey;
        }
        break;
      case 'bearer':
        if (this.options.bearerToken) {
          env.MCP_BEARER_TOKEN = this.options.bearerToken;
        }
        break;
      case 'oauth':
        if (this.options.oauthClientId) {
          env.MCP_OAUTH_CLIENT_ID = this.options.oauthClientId;
        }
        if (this.options.oauthClientSecret) {
          env.MCP_OAUTH_CLIENT_SECRET = this.options.oauthClientSecret;
        }
        break;
    }
    return env;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    switch (this.options.auth) {
      case 'api-key':
        if (this.options.apiKey) {
          headers['X-Api-Key'] = this.options.apiKey;
        }
        break;
      case 'bearer':
        if (this.options.bearerToken) {
          headers['Authorization'] = `Bearer ${this.options.bearerToken}`;
        }
        break;
      case 'oauth':
        if (this.options.oauthClientId && this.options.oauthClientSecret) {
          // Experimental: Basic OAuth2 client credentials header.
          // Full token exchange is not yet implemented; this sends client_id:client_secret as Basic auth.
          headers['Authorization'] =
            `Basic ${Buffer.from(`${this.options.oauthClientId}:${this.options.oauthClientSecret}`).toString('base64')}`;
        } else if (this.options.bearerToken) {
          headers['Authorization'] = `Bearer ${this.options.bearerToken}`;
        }
        break;
    }

    return headers;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    return this.transport.sendRequest(method, params);
  }

  async listTools(): Promise<ToolDefinition[]> {
    return [...this.tools];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  getSessionId(): string | null {
    if (this.transport && 'getSessionId' in this.transport) {
      return (this.transport as StreamableHTTPTransport).getSessionId();
    }
    return null;
  }

  getServerInfo(): Record<string, unknown> {
    return { ...this.serverInfo };
  }
}
