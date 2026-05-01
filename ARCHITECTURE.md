# ARCHITECTURE.md — mcp-server-doctor

> System-level design for the MCP server diagnostic monorepo.

## Overview

This monorepo implements an MCP server health assessment tool — "Lighthouse for MCP" — with 8 diagnostic checks, multi-transport client, graded report cards, and OpenTelemetry observability across 6 packages.

## Package Boundaries & Dependencies

```
┌──────────────────────────────────────────────────────────────────┐
│                     mcp-server-doctor (monorepo)                  │
├───────────┬──────────┬───────────┬──────────┬──────────┬────────┤
│   core    │   obs    │  client   │  engine  │reporters │  cli   │
│ (types,   │(logger,  │(transports│ (checks, │(console, │(cmds,  │
│  utils,   │ metrics, │  stdio,   │  engine) │  json,   │ entry) │
│  grading) │ tracing) │  sse,http)│          │  md,html)│        │
├───────────┴──────────┴───────────┴──────────┴──────────┴────────┤
│                   Dependency Direction: →                         │
│   core ← observability ← client ← engine ← reporters             │
│                                  ↘              ↙                │
│                                   cli                             │
└──────────────────────────────────────────────────────────────────┘
```

| Package | Directory | Internal Dependencies | External Dependencies |
|---------|-----------|----------------------|----------------------|
| `@reaatech/mcp-server-doctor-core` | `packages/core` | — | `zod` |
| `@reaatech/mcp-server-doctor-observability` | `packages/observability` | — | `pino`, `pino-pretty`, `@opentelemetry/*` |
| `@reaatech/mcp-server-doctor-client` | `packages/client` | `core`, `observability` | `eventsource` |
| `@reaatech/mcp-server-doctor-engine` | `packages/engine` | `core`, `observability`, `client` | — |
| `@reaatech/mcp-server-doctor-reporters` | `packages/reporters` | `core` | `chalk` |
| `@reaatech/mcp-server-doctor-cli` | `packages/cli` | all 5 above | `commander` |

Build order (topological): `core`, `observability` → `client` → `engine`, `reporters` → `cli`.

## Data Flow

### Full Diagnosis (doctor diagnose)

```
CLI parses args → DiagnosticOptions
           │
           ▼
createDoctorClient(endpoint, options) → DoctorMCPClient
           │
           ▼
client.connect()
  ├── negotiateTransport() → stdio | sse | http
  ├── sendRequest('initialize', ...) → server info, session ID
  └── sendRequest('tools/list') → tools[]
           │
           ▼
DiagnosticEngine.run()
  ├── For each of 8 checks (sequential):
  │   ├── check.validate(client, context)
  │   ├── Collect CheckResult
  │   └── recordCheck() → OTel metrics
  ├── computeOverallGrade(checks, latency)
  ├── recordGrade() → OTel gauge
  └── Return DiagnosticReport
           │
           ▼
formatReport(report, format) → string
           │
           ▼
stdout or file write → exit(grade-based code)
```

### Watch Mode (doctor watch)

```
CLI parses args → options
           │
           ▼
┌─ while (running && !aborted) ─────────────────┐
│  createDoctorClient → connect                  │
│  DiagnosticEngine.run() → report               │
│  formatReport → stdout/file                    │
│  if grade < threshold → ALERT                  │
│  disconnect                                    │
│  sleep(interval)                               │
└────────────────────────────────────────────────┘
```

### Compare Mode (doctor compare)

```
CLI parses args → baselinePath, currentPath
           │
           ▼
readFile(baseline) → JSON.parse → Zod validate → DiagnosticReport
readFile(current)   → JSON.parse → Zod validate → DiagnosticReport
           │
           ▼
Compare:
  ├── Overall grade change (improved | regressed | unchanged)
  ├── Per-check grade changes
  ├── Latency delta (p99)
  └── Tool count change
           │
           ▼
Enriched report → formatReport → stdout/file
```

## Diagnostic Engine Architecture

### Engine (`packages/engine/src/engine.ts`)

The `DiagnosticEngine` orchestrates all 8 checks sequentially:

1. Creates a `DiagnosticContext` with `endpoint`, `options`, `requestId`, and `startTime`
2. Calls `client.listTools()` to discover available tools
3. Iterates through checks calling `check.validate(client, context)`
4. Collects individual `CheckResult` objects
5. Computes composite grade via `computeOverallGrade()` (worst of all check grades + raw p99 latency grade)
6. Returns `DiagnosticReport` with id, checks, tools, latency, toolLatencies, and serverInfo

Check failures do not halt execution — all 8 checks always run. Individual check errors produce an `F` grade and are recorded.

### Check Interface

Every check implements:

```typescript
interface Check {
  name: string;
  category: CheckCategory;
  severity: Severity;
  validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult>;
}
```

### Individual Checks

| # | Check Class | Category | File |
|---|-------------|----------|------|
| 1 | `TransportNegotiationCheck` | `TRANSPORT` | `packages/engine/src/checks/transport-negotiation.check.ts` |
| 2 | `ToolSchemaValidationCheck` | `SCHEMA` | `packages/engine/src/checks/tool-schema-validation.check.ts` |
| 3 | `LatencyProfilingCheck` | `LATENCY` | `packages/engine/src/checks/latency-profiling.check.ts` |
| 4 | `AuthVerificationCheck` | `AUTH` | `packages/engine/src/checks/auth-verification.check.ts` |
| 5 | `PayloadLimitsCheck` | `PAYLOAD` | `packages/engine/src/checks/payload-limits.check.ts` |
| 6 | `ErrorFormatCheck` | `ERROR_FORMAT` | `packages/engine/src/checks/error-format.check.ts` |
| 7 | `TimeoutBehaviorCheck` | `TIMEOUT` | `packages/engine/src/checks/timeout-behavior.check.ts` |
| 8 | `ConcurrencyStressCheck` | `CONCURRENCY` | `packages/engine/src/checks/concurrency-stress.check.ts` |

Each check measures its own duration, calls `recordCheck()` for OTel instrumentation, and returns a `CheckResult` with `grade`, `passed`, `message`, `details`, `metrics`, and `remediation`.

## MCP Client Architecture

### Client (`packages/client/src/client.ts`)

`DoctorMCPClient` wraps transport negotiation and implements the `MCPClient` interface:

```typescript
interface MCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(method: string, params?: unknown): Promise<unknown>;
  listTools(): Promise<ToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  getSessionId(): string | null;
  getServerInfo(): Record<string, unknown>;
}
```

### Transport Strategies

| Transport | File | Mode | When |
|-----------|------|------|------|
| `StreamableHTTPTransport` | `packages/client/src/transports/streamable-http.ts` | `fetch()` + POST | URL endpoints (default for `auto`) |
| `SSETransport` | `packages/client/src/transports/sse.ts` | EventSource + POST | Explicit `--transport sse`, or auto-fallback from HTTP |
| `StdioTransport` | `packages/client/src/transports/stdio.ts` | `child_process.spawn()` | Non-URL endpoints (e.g., `/usr/bin/mcp-server`) |

**Auto-negotiation logic:**
- URL endpoint → HTTP (`StreamableHTTPTransport`)
- On HTTP failure → fallback to `SSETransport`
- Non-URL string → `StdioTransport` (spawns as child process)
- Explicit `--transport` flag overrides auto-detection

### Credential Injection

| Auth Mode | HTTP/SSE Headers | Stdio Env Vars |
|-----------|------------------|----------------|
| `api-key` | `X-Api-Key` header | `MCP_API_KEY` |
| `bearer` | `Authorization: Bearer ...` | `MCP_BEARER_TOKEN` |
| `oauth` | `Authorization: Basic ...` (client credentials) | `MCP_OAUTH_CLIENT_ID` + `MCP_OAUTH_CLIENT_SECRET` |

## Grading System

### Threshold Table (`packages/core/src/grading/benchmarks.ts`)

| Grade | p99 Latency | Error Rate | Concurrency (≥95% success) | Payload Limit |
|-------|:-----------:|:----------:|:--------------------------:|:-------------:|
| A | < 1 s | 0% | 50+ | > 5 MB |
| B | < 3 s | < 1% | 25+ | > 1 MB |
| C | < 5 s | < 5% | 10+ | > 500 KB |
| D | < 10 s | < 10% | 5+ | > 100 KB |
| F | ≥ 10 s | ≥ 10% | < 5 | ≤ 100 KB |

### Grading Functions (`packages/core/src/grading/`)

| Function | Description |
|----------|-------------|
| `gradeLatency(p99Ms)` | Grade by p99 latency threshold |
| `gradeErrorRate(rate)` | Grade by error rate |
| `gradeConcurrency(maxConcurrent)` | Grade by concurrent capacity |
| `gradePayload(bytes)` | Grade by max payload size |
| `gradeCompliance(passed, warnings)` | Grade by warning count (0→A, 1-2→B, 3-5→C, 6-9→D, 10+→F) |
| `worstGrade(...grades)` | Returns the lowest grade from a set |
| `computeOverallGrade({checks, latency})` | Composite: worst of all check grades + raw p99 latency grade |

## Reporter Architecture

Four output formats, each in a single file under `packages/reporters/src/`:

| Format | Class | File | Output |
|--------|-------|------|--------|
| Console | Terminal | `console.reporter.ts` | Color-coded text with `chalk` |
| JSON | Machine | `json.reporter.ts` | `JSON.stringify(report, null, 2)` |
| Markdown | Docs | `markdown.reporter.ts` | Tables with emoji grades |
| HTML | Web | `html.reporter.ts` | Standalone HTML with embedded CSS |

All formats consume `DiagnosticReport` and return a `string`. The `formatReport()` dispatch function in `index.ts` routes based on format string.

## Observability

### Logging (`packages/observability/src/logger.ts`)

- **Pino** singleton with automatic `pino-pretty` in development
- Credential redaction via Pino's `redact` configuration (paths: `apiKey`, `bearerToken`, `oauthClientSecret`, `password`, `token`, `secret`, `authorization`)
- Environment-driven: `NODE_ENV=production` → raw JSON; otherwise → pretty-printed
- Log level controlled by `LOG_LEVEL` env var or test config

### Metrics (`packages/observability/src/metrics.ts`)

All functions are no-ops unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set:

| Metric | Type | Labels | Recorded By |
|--------|------|--------|-------------|
| `doctor_checks_total` | Counter | `check`, `grade` | `recordCheck()` |
| `doctor_check_duration_ms` | Histogram | `check` | `recordCheck()` |
| `doctor_latency_ms` | Histogram | `tool` | `recordLatency()` |
| `doctor_grade` | Gauge | `grade` | `recordGrade()` |

### Tracing (`packages/observability/src/tracing.ts`)

- OpenTelemetry `NodeSDK` with OTLP trace exporter
- Module side-effect: SDK starts automatically if `OTEL_EXPORTER_OTLP_ENDPOINT` is set
- `startSpan()` and `startAsyncSpan()` for synchronous and asynchronous traced execution

## Error Handling

| Error Type | Detection | Behavior |
|------------|-----------|----------|
| Network error | `ECONNREFUSED` / `fetch failed` | Exit code 3, error report generated |
| Auth failure | 401/403 response | Recorded as auth check failure; suite continues |
| Protocol error | Invalid JSON-RPC response | Recorded as error format failure; suite continues |
| No tools | `tools/list` returns empty | Schema check warns; tool-dependent checks skip with C grade |
| Check crash | Exception in `validate()` | Individual check gets F grade; suite continues |
| Transport negotiation failure | Connection refused on all transports | Engine records error; report generated with F grade |

## Technology Stack

| Tool | Purpose |
|------|---------|
| **pnpm** 10.22 | Package manager with workspace protocol |
| **turbo** 2.5 | Monorepo task orchestrator with `^build` ordering |
| **tsup** 8.4 | Dual ESM/CJS build with DTS generation |
| **TypeScript** 5.8 | Strict mode, `NodeNext` module resolution, `verbatimModuleSyntax` |
| **vitest** 3.1 | Test runner with v8 coverage |
| **biome** 1.9 | Linting and formatting (replaces ESLint + Prettier) |
| **changesets** | Versioning and changelog management |
| **Pino** 10 | Structured JSON logging |
| **OpenTelemetry** | Metrics and distributed tracing |
| **Zod** 3.24 | Runtime schema validation |
| **Commander** 13 | CLI argument parsing |
| **chalk** 5 | Terminal color output |

## Extension Points

- **Custom Check** — Implement `validate(client, context)` interface, register in `packages/engine/src/engine.ts`
- **Custom Reporter** — Add a new formatter file in `packages/reporters/src/` and register in `formatReport()`
- **Custom Transport** — Implement transport interface under `packages/client/src/transports/` and add to auto-negotiation
- **Custom Grading** — Add new grading function in `packages/core/src/grading/benchmarks.ts`
