# @reaatech/mcp-server-doctor-engine

[![npm version](https://img.shields.io/npm/v/@reaatech/mcp-server-doctor-engine.svg)](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/mcp-server-doctor/ci.yml?branch=main&label=CI)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Diagnostic engine that runs 8 health checks against an MCP server, computes a composite A–F grade, and produces a structured `DiagnosticReport`. This is the core assessment logic used by the `@reaatech/mcp-server-doctor-cli` and available for programmatic use.

## Installation

```bash
npm install @reaatech/mcp-server-doctor-engine
# or
pnpm add @reaatech/mcp-server-doctor-engine
```

## Feature Overview

- **8 diagnostic checks** — transport negotiation, schema validation, latency profiling, auth verification, payload limits, error format, timeout behavior, concurrency stress
- **Composite grading** — A–F grade computed from all checks plus raw latency percentiles
- **OpenTelemetry integration** — check results and grades automatically recorded via the observability package
- **Extensible check system** — add custom checks by implementing the `validate(client, context)` interface
- **Error resilience** — individual check failures do not halt the full diagnostic run

## Quick Start

```typescript
import { DiagnosticEngine } from "@reaatech/mcp-server-doctor-engine";
import { createDoctorClient } from "@reaatech/mcp-server-doctor-client";

const client = createDoctorClient("http://localhost:8080", {
  transport: "auto",
  auth: "none",
  timeout: 30000,
  concurrency: 10,
  verbose: false,
});

await client.connect();

const engine = new DiagnosticEngine(client, options, "http://localhost:8080");
const report = await engine.run();

console.log(`Overall Grade: ${report.overallGrade}`);
console.log(`Checks run: ${report.checks.length}`);
console.log(`Latency p99: ${report.latency.p99}ms`);

await client.disconnect();
```

## API Reference

### `DiagnosticEngine`

```typescript
class DiagnosticEngine {
  constructor(client: MCPClient, options: DiagnosticOptions, endpoint: string);
  run(): Promise<DiagnosticReport>;
  static createErrorReport(error: Error, endpoint: string, options: DiagnosticOptions, durationMs?: number): DiagnosticReport;
}
```

| Method | Description |
|--------|-------------|
| `run()` | Connects (if not already), discovers tools, runs all 8 checks sequentially, computes overall grade, returns `DiagnosticReport` |
| `createErrorReport(error, ...)` | Static factory for producing a `grade: "F"` error report when connection fails |

### Checks

All 8 checks are exported individually and can be used standalone:

```typescript
import {
  TransportNegotiationCheck,
  ToolSchemaValidationCheck,
  LatencyProfilingCheck,
  AuthVerificationCheck,
  PayloadLimitsCheck,
  TimeoutBehaviorCheck,
  ErrorFormatCheck,
  ConcurrencyStressCheck,
} from "@reaatech/mcp-server-doctor-engine";

const check = new LatencyProfilingCheck();
const result = await check.validate(client, context);
```

| Check | Category | Severity | What it tests |
|-------|----------|----------|---------------|
| `TransportNegotiationCheck` | `TRANSPORT` | `WARNING` | Server ping, session ID, server info |
| `ToolSchemaValidationCheck` | `SCHEMA` | `CRITICAL` | Tool name format, description, inputSchema structure |
| `LatencyProfilingCheck` | `LATENCY` | `CRITICAL` | 20 measurement rounds per tool, p50/p90/p99 stats |
| `AuthVerificationCheck` | `AUTH` | `CRITICAL` | Auth success + unauthenticated rejection test |
| `PayloadLimitsCheck` | `PAYLOAD` | `WARNING` | Binary search (1KB–5MB) for max accepted payload |
| `ErrorFormatCheck` | `ERROR_FORMAT` | `WARNING` | Invalid method & tool calls, JSON-RPC 2.0 error compliance |
| `TimeoutBehaviorCheck` | `TIMEOUT` | `CRITICAL` | 1ms timeout client, cleanup verification, post-timeout health |
| `ConcurrencyStressCheck` | `CONCURRENCY` | `WARNING` | 5/10/25/50 concurrent tool calls, success rate, error rate |

### DiagnosticReport

```typescript
interface DiagnosticReport {
  id: string;
  endpoint: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  version: string;
  transport: string;
  authMode: string;
  overallGrade: Grade;
  checks: CheckResult[];
  tools: ToolDefinition[];
  latency: LatencyMetrics;
  toolLatencies: ToolLatencyMetrics[];
  serverInfo?: Record<string, unknown>;
  error?: string;
}
```

### Grading

The overall grade is computed as the **worst** grade among:
- Each of the 8 check grades
- Raw p99 latency across all tools (A≤1s, B≤3s, C≤5s, D≤10s, F>10s)

Individual checks use `gradeCompliance(passed, warnings)` or specialized graders (`gradeLatency`, `gradePayload`, `gradeConcurrency`, `gradeErrorRate`).

## Writing Custom Checks

Custom checks implement the same interface as built-in checks:

```typescript
import type { CheckResult, DiagnosticContext } from "@reaatech/mcp-server-doctor-core";
import { CheckCategory, Severity, now, gradeCompliance } from "@reaatech/mcp-server-doctor-core";
import type { MCPClient } from "@reaatech/mcp-server-doctor-client";
import { recordCheck } from "@reaatech/mcp-server-doctor-observability";

export class MyCheck {
  name = "my-check";
  category = CheckCategory.TRANSPORT;
  severity = Severity.WARNING;

  async validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const grade = gradeCompliance(true, 0);
    const durationMs = Math.round(performance.now() - startTime);
    recordCheck(this.name, grade, durationMs);
    return {
      name: this.name,
      category: this.category,
      grade,
      passed: true,
      severity: this.severity,
      message: "Check passed",
      details: {},
      metrics: { durationMs },
      remediation: "All good",
      durationMs,
      timestamp: now(),
    };
  }
}
```

Then register it on the engine:

```typescript
import { DiagnosticEngine } from "@reaatech/mcp-server-doctor-engine";
import { MyCheck } from "./my-check.js";

const engine = new DiagnosticEngine(client, options, endpoint);
// Add check via private field extension or subclass
```

## Related Packages

- [`@reaatech/mcp-server-doctor-core`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-core) — Types, utilities, and grading
- [`@reaatech/mcp-server-doctor-client`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-client) — MCP transport client
- [`@reaatech/mcp-server-doctor-reporters`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-reporters) — Report formatters
- [`@reaatech/mcp-server-doctor-cli`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-cli) — CLI entry point

## License

[MIT](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
