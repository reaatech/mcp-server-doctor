import { spawn } from 'node:child_process';
import { logger } from '../../observability/logger.js';
import { TransportError } from './errors.js';

export interface StdioTransportOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
  timeout: number;
}

export class StdioTransport {
  private process: import('node:child_process').ChildProcess | null = null;
  private messageId = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }
  >();
  private buffer = '';

  constructor(private options: StdioTransportOptions) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.options.command, this.options.args, {
        env: { ...process.env, ...this.options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processMessages();
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        logger.error({ stdio: this.options.command }, data.toString().trim());
      });

      this.process.on('error', reject);
      this.process.on('spawn', () => resolve());

      const onExit = (code: number | null) => {
        reject(new Error(`stdio process exited immediately with code ${code}`));
      };
      this.process.once('exit', onExit);
      this.process.once('spawn', () => {
        this.process?.off('exit', onExit);
        // Reject pending requests if the process crashes after successful connection
        this.process?.once('exit', () => {
          for (const [, pending] of this.pending) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('stdio process exited unexpectedly'));
          }
          this.pending.clear();
        });
      });
    });
  }

  private processMessages(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
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
        // Skip non-JSON output
      }
    }
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.process) {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;
    const request = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeout);

      this.pending.set(id, { resolve, reject, timeout });

      try {
        this.process!.stdin!.write(JSON.stringify(request) + '\n');
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async disconnect(): Promise<void> {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pending.clear();

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
