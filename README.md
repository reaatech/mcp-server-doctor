# mcp-server-doctor

[![npm version](https://img.shields.io/npm/v/mcp-server-doctor.svg)](https://www.npmjs.com/package/mcp-server-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> **Lighthouse for MCP servers** — A comprehensive CLI diagnostic and profiling tool for Model Context Protocol (MCP) endpoints.

`mcp-server-doctor` connects to any MCP server endpoint and executes eight rigorous diagnostic checks, producing a detailed report card with letter grades (A–F), quantitative metrics, and actionable remediation guidance.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Report Card Example](#report-card-example)
- [Grading Benchmarks](#grading-benchmarks)
- [CLI Reference](#cli-reference)
- [Exit Codes](#exit-codes)
- [Library API](#library-api)
- [CI/CD Integration](#cicd-integration)
- [Observability](#observability)
- [Related Tools](#related-tools)
- [License](#license)

---

## Features

| Diagnostic Check | Description |
|------------------|-------------|
| **Transport Negotiation** | Auto-detects and validates stdio, SSE, and StreamableHTTP transports |
| **Tool Schema Validation** | Validates input schemas for every exposed tool |
| **Latency Profiling** | Measures p50/p90/p99 per tool with warm/cold start analysis |
| **Auth Verification** | Tests API key, Bearer token, OAuth, and no-auth configurations |
| **Payload Limits** | Determines maximum request/response size via binary search |
| **Timeout Behavior** | Validates timeout handling and connection cleanup |
| **Error Format Compliance** | Validates JSON-RPC 2.0 error structure conformance |
| **Concurrency Stress** | Stress-tests with 5–50 parallel requests and degradation analysis |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- An MCP server endpoint to diagnose

### Installation

```bash
npm install -g mcp-server-doctor
```

### Usage

```bash
# Run the full diagnostic suite
doctor diagnose http://localhost:8080

# Authenticated endpoint
doctor diagnose http://localhost:8080 --auth bearer --bearer-token $TOKEN

# Export report as JSON
doctor diagnose http://localhost:8080 --format json --output report.json

# Compare two diagnostic reports
doctor compare baseline.json current.json

# Continuous monitoring with alerting
doctor watch http://localhost:8080 --interval 60 --alert-threshold C
```

---

## Report Card Example

```
MCP Server Diagnostic Report

Endpoint:    http://localhost:8080
Time:        2024-01-01T00:01:00.000Z
Duration:    45000ms
Transport:   http | Auth: none

Overall Grade: 🟢 B

── Checks ──
  ✅ A  transport-negotiation  — Transport negotiation successful via http
  ✅ A  tool-schema-validation — Validated 5 tool schemas (0 with issues)
  🟢 B  latency-profiling      — Latency p99: 2500ms across 3 tools
  ✅ A  auth-verification      — Auth verification passed for mode: none
  🟡 C  payload-limits         — Max payload: 750.0 KB (min rejected: 750.1 KB)
  ✅ A  timeout-behavior       — Timeout behavior check passed
  ✅ A  error-format           — Error format validation: 2/2 compliant
  🟢 B  concurrency-stress     — Max concurrent requests: 25 (error rate: 0.0%)

── Latency Summary ──
  p50: 120ms   p90: 1800ms   p99: 2500ms
  min: 45ms    max: 4200ms   mean: 350ms
  samples: 60
```

---

## Grading Benchmarks

Grades are assigned based on strict quantitative thresholds:

| Grade | p99 Latency | Error Rate | Concurrency | Payload Limit |
|:-----:|:-----------:|:----------:|:-----------:|:-------------:|
| **A** | < 1 s       | 0%         | 50+         | > 5 MB        |
| **B** | < 3 s       | < 1%       | 25+         | > 1 MB        |
| **C** | < 5 s       | < 5%       | 10+         | > 500 KB      |
| **D** | < 10 s      | < 10%      | 5+          | > 100 KB      |
| **F** | ≥ 10 s      | ≥ 10%      | < 5         | ≤ 100 KB      |

---

## CLI Reference

### `doctor diagnose <endpoint>`

Run the complete diagnostic suite against an MCP endpoint.

| Option | Description | Default |
|--------|-------------|---------|
| `--transport` | Transport protocol: `stdio`, `sse`, `http`, `auto` | `auto` |
| `--auth` | Authentication mode: `none`, `api-key`, `bearer`, `oauth` | `none` |
| `--api-key` | API key for `api-key` authentication | — |
| `--bearer-token` | Bearer token for `bearer` authentication | — |
| `--format` | Output format: `console`, `json`, `markdown`, `html` | `console` |
| `--output` | Write report to file path | stdout |
| `--timeout` | Request timeout in milliseconds | `30000` |
| `--concurrency` | Concurrency level for stress tests | `10` |
| `--verbose` | Enable detailed debug output | `false` |

### `doctor compare <baseline> <current>`

Compare two diagnostic reports and highlight grade changes, regressions, and improvements.

### `doctor watch <endpoint>`

Continuously monitor an MCP endpoint at a configurable interval.

| Option | Description | Default |
|--------|-------------|---------|
| `--interval` | Polling interval in seconds | `60` |
| `--alert-threshold` | Minimum grade to trigger an alert | `C` |

---

## Exit Codes

| Code | Meaning |
|:----:|---------|
| `0`  | All checks achieved grade C or better |
| `1`  | One or more checks received an F grade (critical failure) |
| `2`  | One or more checks received a D grade (warning) |
| `3`  | Execution error (network, timeout, or authentication failure) |

---

## Library API

`mcp-server-doctor` can also be used programmatically as a Node.js library:

```typescript
import {
  DiagnosticEngine,
  createDoctorClient,
  formatReport,
  DiagnosticOptions,
} from 'mcp-server-doctor';

const options: DiagnosticOptions = {
  transport: 'http',
  auth: 'none',
  timeout: 30000,
  concurrency: 10,
  verbose: false,
};

const client = createDoctorClient('http://localhost:8080', options);

await client.connect();

const engine = new DiagnosticEngine(client, options);
const report = await engine.run();

await client.disconnect();

const html = await formatReport(report, 'html');
```

---

## CI/CD Integration

Integrate `mcp-server-doctor` into your continuous integration pipeline to enforce quality gates:

```yaml
# .github/workflows/doctor.yml
name: MCP Server Health Check
on: [push, pull_request]

jobs:
  health:
    runs-on: ubuntu-latest
    services:
      mcp-server:
        image: my-mcp-server:latest
        ports: [8080:8080]
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g mcp-server-doctor
      - run: doctor diagnose http://localhost:8080 --format json --output report.json
      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: doctor-report
          path: report.json
      - name: Fail on critical issues
        run: |
          GRADE=$(jq -r .overallGrade report.json)
          if [ "$GRADE" = "F" ]; then exit 1; fi
          if [ "$GRADE" = "D" ]; then exit 2; fi
```

---

## Observability

### Structured Logging

Set the `LOG_LEVEL` environment variable to control verbosity. All credentials are automatically redacted from logs.

### OpenTelemetry Metrics

Export traces and metrics by setting `OTEL_EXPORTER_OTLP_ENDPOINT`:

| Metric | Type | Description |
|--------|------|-------------|
| `doctor_checks_total` | Counter | Total checks executed, labeled by name and grade |
| `doctor_check_duration_ms` | Histogram | Check execution duration |
| `doctor_latency_ms` | Histogram | Per-tool latency measurements |
| `doctor_grade` | Gauge | Overall grade as a numeric value |

---

## Related Tools

| Tool | Purpose | Recommended Use Case |
|------|---------|----------------------|
| [mcp-contract-kit](https://github.com/modelcontextprotocol/contract-kit) | CI conformance testing | Pre-merge validation and registry compliance |
| **mcp-server-doctor** | Real-time diagnostics | Debugging, performance profiling, and production health monitoring |

Use **mcp-contract-kit** in CI pipelines to validate protocol compliance before deployment. Use **mcp-server-doctor** for interactive debugging and continuous production monitoring.

---

## License

[MIT](LICENSE) © mcp-server-doctor contributors
