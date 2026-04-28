import * as opentelemetry from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

const sdk = new opentelemetry.NodeSDK({
  traceExporter: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? new OTLPTraceExporter() : undefined,
  instrumentations: [],
});

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  sdk.start();
  process.on('SIGTERM', () => sdk.shutdown().catch(() => {}));
}

const TRACER_NAME = 'mcp-server-doctor';

export function startSpan(name: string, fn: (span: Span) => void): void {
  const tracer = trace.getTracer(TRACER_NAME);
  tracer.startActiveSpan(name, (span) => {
    try {
      fn(span);
      span.end();
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });
}

export async function startAsyncSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });
}

export { trace };
