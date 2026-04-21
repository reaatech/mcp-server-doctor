import { EventSource } from 'eventsource';
import { TransportError } from './errors.js';

export interface SSETransportOptions {
  url: string;
  timeout: number;
  headers?: Record<string, string>;
}

export class SSETransport {
  private eventSource: EventSource | null = null;
  private endpointUrl: string | null = null;
  private messageId = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }
  >();
  private connected = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(private options: SSETransportOptions) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          reject(new Error('SSE connection timeout'));
        }
      }, this.options.timeout);

      this.eventSource = new EventSource(this.options.url, {
        headers: this.options.headers,
      } as EventSourceInit);

      this.eventSource.onopen = () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.connected = true;
        resolve();
      };

      this.eventSource.onerror = () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        if (!this.connected) {
          reject(new Error('SSE connection error'));
        }
      };

      this.eventSource.addEventListener('endpoint', (event: Event) => {
        const msgEvent = event as MessageEvent;
        try {
          const data = JSON.parse(msgEvent.data);
          this.endpointUrl = data.endpoint || msgEvent.data;
        } catch {
          this.endpointUrl = msgEvent.data;
        }
      });

      this.eventSource.addEventListener('message', (event: Event) => {
        const msgEvent = event as MessageEvent;
        try {
          const msg = JSON.parse(msgEvent.data);
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const pending = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            clearTimeout(pending.timeout);
            if (msg.error) {
              const rpcError = msg.error as { message?: string; code?: number; data?: unknown };
              pending.reject(
                new TransportError(
                  rpcError.message || JSON.stringify(msg.error),
                  rpcError.code,
                  rpcError.data,
                ),
              );
            } else {
              pending.resolve(msg.result);
            }
          }
        } catch {
          // Skip non-JSON
        }
      });
    });
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.endpointUrl) {
      throw new Error('SSE endpoint not established');
    }

    const id = ++this.messageId;
    const request = { jsonrpc: '2.0', id, method, params };
    const url = this.endpointUrl;

    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeout);

      this.pending.set(id, { resolve, reject, timeout });

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.options.headers || {}) },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            if (this.pending.has(id)) {
              this.pending.delete(id);
              clearTimeout(timeout);
              reject(new Error(`HTTP ${res.status}: ${text}`));
            }
          }
        })
        .catch((err) => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            clearTimeout(timeout);
            reject(err);
          }
        });
    });
  }

  async disconnect(): Promise<void> {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pending.clear();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
  }
}
