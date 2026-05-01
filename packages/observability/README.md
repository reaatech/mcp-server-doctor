# @reaatech/mcp-server-doctor-observability

[![npm version](https://img.shields.io/npm/v/@reaatech/mcp-server-doctor-observability.svg)](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-observability)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/mcp-server-doctor/ci.yml?branch=main&label=CI)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Structured logging, OpenTelemetry metrics, and distributed tracing for MCP server diagnostics. Built on [Pino](https://github.com/pinojs/pino) for logging and the OpenTelemetry SDK for metrics and span export.

## Installation

```bash
npm install @reaatech/mcp-server-doctor-observability
# or
pnpm add @reaatech/mcp-server-doctor-observability
```

## Feature Overview

- **Structured JSON logging** — Pino-powered, fast and low-overhead with automatic credential redaction
- **OpenTelemetry metrics** — counter, histogram, and gauge instruments for check results, latency, and grades
- **Distributed tracing** — span-based execution tracking with OTLP export
- **Automatic pretty-printing** — human-readable output in development, raw JSON in production
- **Opt-in telemetry** — metrics and tracing only activate when `OTEL_EXPORTER_OTLP_ENDPOINT` is set

## Quick Start

```typescript
import { logger, recordCheck, recordLatency, startSpan } from "@reaatech/mcp-server-doctor-observability";

// Log with structured context
logger.info({ endpoint: "http://localhost:8080", check: "latency-profiling" }, "Running check");

// Record an OTel metric (no-op if OTEL_EXPORTER_OTLP_ENDPOINT is not set)
recordCheck("latency-profiling", "A", 2500);
recordLatency("echo", 42);

// Start a traced span
startSpan("diagnose", (span) => {
  // ... diagnostic work ...
  span.end();
});
```

## API Reference

### Logger

A singleton Pino logger with credential redaction. Access via `logger`.

```typescript
import { logger } from "@reaatech/mcp-server-doctor-observability";

logger.info({ check: "transport-negotiation" }, "Running check");
logger.warn({ endpoint: "http://localhost:8080" }, "Connecting to private endpoint");
logger.error({ error: err }, "Check failed");
```

| Level | When |
|-------|------|
| `info` | Normal operation (check start/complete, connection established) |
| `warn` | Recoverable issues (private endpoint, latency sample failed) |
| `error` | Check failures, transport errors, unexpected exceptions |
| `debug` | Verbose per-round latency samples (when `--verbose` is set) |

Environment behavior:
- **Development** (`NODE_ENV !== "production"`): enables `pino-pretty` with colorized output
- **Production** (`NODE_ENV === "production"`): raw JSON output for log aggregators

Credential redaction: API keys, bearer tokens, and OAuth secrets are automatically redacted from log output via Pino's `redact` configuration.

### Metrics

All metric functions are no-ops when `OTEL_EXPORTER_OTLP_ENDPOINT` is not set.

#### `recordCheck(checkName: string, grade: string, durationMs: number): void`

Records a diagnostic check result as an OTel counter and histogram.

| Metric | Type | Labels |
|--------|------|--------|
| `doctor_checks_total` | Counter | `check`, `grade` |
| `doctor_check_duration_ms` | Histogram | `check` |

#### `recordLatency(toolName: string, p99Ms: number): void`

Records per-tool latency as an OTel histogram.

| Metric | Type | Labels |
|--------|------|--------|
| `doctor_latency_ms` | Histogram | `tool` |

#### `recordGrade(grade: string): void`

Sets the current overall grade as an OTel gauge.

| Metric | Type | Labels |
|--------|------|--------|
| `doctor_grade` | Gauge | `grade` |

### Tracing

Traces are auto-started when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (module side-effect). Functions are no-ops otherwise.

#### `startSpan(name: string, fn: (span: Span) => void): void`

Execute `fn` within a traced span. The span is automatically ended after `fn` returns.

#### `startAsyncSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>`

Execute an async `fn` within a traced span. Errors are recorded as span events with `ERROR` status.

## Usage Patterns

### Structured Context

```typescript
logger.info({
  endpoint: "http://localhost:8080",
  transport: "http",
  check: "latency-profiling",
  grade: "A",
  passed: true,
  durationMs: 2500,
}, "Check complete");
```

### Error Logging

```typescript
try {
  await client.connect();
} catch (error) {
  logger.error({ error, endpoint }, "Connection failed");
}
```

### Instrumenting Custom Checks

```typescript
import { recordCheck } from "@reaatech/mcp-server-doctor-observability";

export class MyCheck {
  async validate(client, context) {
    const startTime = performance.now();
    const grade = computeGrade(/* ... */);
    const durationMs = Math.round(performance.now() - startTime);
    recordCheck(this.name, grade, durationMs);
    return { /* CheckResult */ };
  }
}
```

## Related Packages

- [`@reaatech/mcp-server-doctor-core`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-core) — Types, utilities, and grading
- [`@reaatech/mcp-server-doctor-engine`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-engine) — Diagnostic engine (consumer of this package)

## License

[MIT](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
