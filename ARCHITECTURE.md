# ARCHITECTURE.md — mcp-server-doctor

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                │
│  ┌─────────────┐    ┌─────────────┐                                  │
│  │     CLI     │    │   Library   │                                  │
│  │  (doctor)   │    │   API       │                                  │
│  └──────┬──────┘    └──────┬──────┘                                  │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────────────┐
│                        Diagnostic Engine                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    DiagnosticEngine                             │  │
│  │   1. Connect client    2. Run checks    3. Compute grades      │  │
│  │   4. Aggregate results    5. Generate report                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Transport│ │  Tool    │ │ Latency  │ │   Auth   │                 │
│  │Negotiation│ │ Schema   │ │Profiling │ │Verify    │                 │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Payload  │ │ Timeout  │ │  Error   │ │Concurrent│                 │
│  │ Limits   │ │Behavior  │ │ Format   │ │ Stress   │                 │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                         MCP Client                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │ StreamableHTTP  │  │      SSE        │  │     stdio       │       │
│  │   Transport     │  │   Transport     │  │   Transport     │       │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                       Target MCP Server                               │
└──────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                          Reporters                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Console   │  │    JSON     │  │  Markdown   │  │    HTML     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Non-Destructive Testing** — All checks are read-only. No data is modified on the target server.
2. **Idempotent Execution** — Running the same diagnostic twice produces identical results.
3. **Fast Feedback** — Default timeout of 30s; most checks complete in under 5s.
4. **Clear Failures** — Every failure includes a remediation suggestion.
5. **Extensible Architecture** — New checks implement a simple `Check` interface.

## Component Deep Dive

### Diagnostic Engine (`src/doctor/engine.ts`)

The orchestrator that runs all checks sequentially:

1. Creates a `DiagnosticContext` with endpoint, options, and request ID
2. Connects the MCP client
3. Iterates through all 8 checks, calling `check.validate(client, context)`
4. Aggregates results into a `DiagnosticReport`
5. Computes overall grade from individual check grades + latency metrics

### Check Interface

Every diagnostic check implements:

```typescript
interface Check {
  name: string;
  category: CheckCategory;
  severity: Severity;
  validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult>;
}
```

### MCP Client (`src/mcp-client/client.ts`)

`DoctorMCPClient` wraps three transport implementations:

- **StreamableHTTPTransport** — Primary. Uses `POST /mcp` with session management via `mcp-session-id` header.
- **SSETransport** — Legacy. Connects to SSE endpoint, receives `endpoint` event, then POSTs to the returned URL.
- **StdioTransport** — Spawns a subprocess, communicates via stdin/stdout with JSON-RPC messages.

Transport auto-negotiation selects StreamableHTTP for URLs and stdio for commands. SSE can be selected explicitly via `--transport sse`.

### Grading System (`src/grading/`)

`benchmarks.ts` defines numeric thresholds for each grade. `grader.ts` converts raw metrics into letter grades:

- `gradeLatency(p99Ms)` — Based on p99 latency thresholds
- `gradeErrorRate(rate)` — Based on error rate
- `gradeConcurrency(maxParallel)` — Based on max concurrent requests handled
- `gradePayload(maxBytes)` — Based on max payload size
- `gradeCompliance(passed, warnings)` — For schema/format compliance checks
- `worstGrade(...grades)` — Computes overall grade as worst of all individual grades

### Reporter System (`src/reporters/`)

Four output formats:

| Format | Use Case |
|--------|----------|
| Console | Interactive terminal use with colors and icons |
| JSON | Machine-readable, for CI/CD or programmatic consumption |
| Markdown | GitHub issues, documentation, PR comments |
| HTML | Interactive report card dashboard |

## Data Flow

### Test Execution Flow

```
1. CLI parses arguments → DiagnosticOptions
2. createDoctorClient(endpoint, options) → DoctorMCPClient
3. client.connect() → transport negotiation + initialize + tools/list
4. engine.run()
   ├── For each check:
   │   ├── check.validate(client, context)
   │   ├── Collect CheckResult
   │   └── Record metrics (OTel)
   ├── computeOverallGrade()
   └── Return DiagnosticReport
5. formatReport(report, format) → string
6. Write to stdout or file
7. Exit with appropriate code
```

### Check Execution Flow (per check)

```
1. Start timer
2. Execute check-specific logic (e.g., call tools, measure latency)
3. Collect metrics and details
4. Compute grade from metrics + benchmarks
5. Record OTel metrics
6. Return CheckResult with grade, message, remediation
```

## Error Handling

| Error Type | Detection | Recovery |
|------------|-----------|----------|
| Network error | Connection refused, timeout | Fail with exit code 3 |
| Auth failure | 401/403 response | Report as auth check failure, continue with other checks |
| Protocol error | Invalid JSON-RPC response | Report as error format failure, continue |
| Tool not found | tools/list returns empty | Report as schema validation warning, skip tool-dependent checks |
| Server crash | Connection reset | Report as critical failure, stop testing |

## Observability

### Structured Logging (Pino)

All significant events are logged with structured fields:
- `endpoint`, `transport`, `auth` — Connection context
- `check`, `grade`, `passed` — Check results
- `error` — Errors with full stack traces

PII redaction paths: `apiKey`, `bearerToken`, `oauthClientSecret`, `password`, `token`, `secret`, `authorization`.

### Metrics (OpenTelemetry)

| Metric | Type | Description |
|--------|------|-------------|
| `doctor_checks_total` | Counter | Total checks executed, by check name and grade |
| `doctor_check_duration_ms` | Histogram | Check execution duration |
| `doctor_latency_ms` | Histogram | Tool latency measurements |
| `doctor_grade` | Gauge | Overall grade as numeric |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `production` or `development` | `development` |
| `LOG_LEVEL` | Pino log level | `debug` (dev), `info` (prod) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint for traces/metrics | (disabled) |

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--transport` | `stdio`, `sse`, `http`, `auto` | `auto` |
| `--auth` | `none`, `api-key`, `bearer`, `oauth` | `none` |
| `--timeout` | Request timeout in ms | `30000` |
| `--concurrency` | Concurrency level for stress tests | `10` |
| `--format` | `console`, `json`, `markdown`, `html` | `console` |
| `--verbose` | Show detailed debug output | `false` |
