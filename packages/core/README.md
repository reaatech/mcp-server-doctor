# @reaatech/mcp-server-doctor-core

[![npm version](https://img.shields.io/npm/v/@reaatech/mcp-server-doctor-core.svg)](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/mcp-server-doctor/ci.yml?branch=main&label=CI)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Core types, utilities, grading benchmarks, and constants for MCP server diagnostics. This package is the single source of truth for all domain shapes used throughout the `@reaatech/mcp-server-doctor-*` ecosystem.

## Installation

```bash
npm install @reaatech/mcp-server-doctor-core
# or
pnpm add @reaatech/mcp-server-doctor-core
```

## Feature Overview

- **Domain types** — `DiagnosticReport`, `CheckResult`, `DiagnosticOptions`, `LatencyMetrics`, and more
- **Zod schemas** — runtime validation for diagnostic reports and domain objects
- **Grading system** — A–F grade computation with configurable latency, error-rate, concurrency, and payload thresholds
- **Utility functions** — `generateUUID`, `percentile`, `calculateStats`, `retry`, `sleep`, URL sanitization, and more
- **Version resolution** — programmatic version access from `package.json`
- **Zero runtime dependencies** beyond `zod` — lightweight and tree-shakeable
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  type CheckResult,
  type DiagnosticReport,
  CheckCategory,
  Severity,
  gradeCompliance,
  gradeLatency,
  generateUUID,
  calculateStats,
} from "@reaatech/mcp-server-doctor-core";

// Grade a check by warning count
const grade = gradeCompliance(true, 2); // → "B"

// Grade raw latency (p99 in ms)
const latencyGrade = gradeLatency(4200); // → "B"

// Compute percentile stats from raw samples
const stats = calculateStats([100, 200, 150, 300, 250]);
console.log(stats.p99); // → 300
```

## Exports

### Types

| Export | Description |
|--------|-------------|
| `CheckResult` | Single diagnostic check outcome (name, category, grade, message, metrics, remediation) |
| `DiagnosticReport` | Full diagnostic report (id, endpoint, overallGrade, checks[], tools[], latency) |
| `DiagnosticOptions` | Configuration for a diagnostic run (transport, auth, timeout, concurrency) |
| `DiagnosticContext` | Runtime context passed to each check (endpoint, options, requestId) |
| `ToolDefinition` | MCP tool descriptor (name, description, inputSchema) |
| `LatencyMetrics` | Percentile statistics (p50, p90, p99, min, max, mean, samples) |
| `ToolLatencyMetrics` | Per-tool latency breakdown (toolName, latency, samples) |

### Enums

| Export | Description |
|--------|-------------|
| `CheckCategory` | `TRANSPORT`, `SCHEMA`, `LATENCY`, `AUTH`, `PAYLOAD`, `ERROR_FORMAT`, `TIMEOUT`, `CONCURRENCY` |
| `Severity` | `CRITICAL`, `WARNING`, `INFO` |
| `Grade` | `'A'` \| `'B'` \| `'C'` \| `'D'` \| `'F'` |

### Grading

| Export | Description |
|--------|-------------|
| `gradeCompliance(passed, warnings)` | Grade A–F by warning count (0→A, 1-2→B, 3-5→C, 6-9→D, 10+→F) |
| `gradeLatency(p99Ms)` | Grade by p99 latency (≤1s→A, ≤3s→B, ≤5s→C, ≤10s→D, >10s→F) |
| `gradeErrorRate(rate)` | Grade by error rate (≤1%→A, ≤5%→B, ≤10%→C, ≤20%→D, >20%→F) |
| `gradeConcurrency(maxConcurrent)` | Grade by concurrent capacity (≥50→A, ≥25→B, ≥10→C, ≥5→D, <5→F) |
| `gradePayload(bytes)` | Grade by max payload (≥5MB→A, ≥1MB→B, ≥500KB→C, ≥100KB→D, <100KB→F) |
| `worstGrade(...grades)` | Returns the lowest (worst) grade from a set |
| `computeOverallGrade({checks, latency})` | Composite grade across all checks + raw latency |
| `gradeToNumber(grade)` | Convert `'A'`→`4`, `'B'`→`3`, ..., `'F'`→`0` |

### Utilities

| Export | Description |
|--------|-------------|
| `generateUUID()` | Generate a v4 UUID |
| `now()` | Current ISO 8601 timestamp |
| `measureTimeAsync(fn)` | Execute `fn` and return `{ result, durationMs }` |
| `sleep(ms)` | Promise-based delay |
| `retry(fn, options)` | Retry with exponential backoff |
| `percentile(sortedValues, p)` | Compute p-th percentile (0–100) |
| `calculateStats(values)` | Full stats object: p50, p90, p99, min, max, mean, samples |
| `isValidURL(str)` | Check if string is a parseable URL |
| `isPrivateURL(str)` | Detect localhost / private IP ranges |
| `sanitizeUrl(str)` | Redact query params / credentials from URL for logging |

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `MCP_PROTOCOL_VERSION` | `'2024-11-05'` | Advertised protocol version |
| `DEFAULT_TIMEOUT_MS` | `30000` | Default request timeout |
| `DEFAULT_CONCURRENCY` | `10` | Default concurrency level |
| `CONCURRENCY_LEVELS` | `[5, 10, 25, 50]` | Stress-test concurrency levels |
| `WARMUP_ROUNDS` | `3` | Latency warmup rounds |
| `MEASUREMENT_ROUNDS` | `20` | Latency measurement rounds |
| `MIN_PAYLOAD_BYTES` | `1024` | Binary search lower bound |
| `MAX_PAYLOAD_BYTES` | `5242880` | Binary search upper bound (5 MB) |

## Related Packages

- [`@reaatech/mcp-server-doctor-client`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-client) — MCP transport client
- [`@reaatech/mcp-server-doctor-engine`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-engine) — Diagnostic engine
- [`@reaatech/mcp-server-doctor-observability`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-observability) — Logging and OpenTelemetry

## License

[MIT](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
