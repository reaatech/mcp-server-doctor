# mcp-server-doctor

[![CI](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

> **Lighthouse for MCP servers** — A CLI diagnostic and profiling tool for Model Context Protocol (MCP) endpoints. Connects to any MCP server and runs 8 rigorous health checks, producing a graded A–F report card.

This monorepo provides the diagnostic engine, MCP transport client, multi-format reporters, observability instrumentation, and CLI entry point.

## Features

- **8 diagnostic checks** — transport negotiation, schema validation, latency profiling, auth verification, payload limits, error compliance, timeout analysis, concurrency stress
- **Multi-transport client** — auto-negotiates stdio, SSE, and streamable HTTP transports
- **A–F grading** — strict quantitative benchmarks for latency, error rate, concurrency, and payload
- **Multi-format reports** — console (color-coded), JSON, markdown, and standalone HTML
- **Watch mode** — continuous monitoring with configurable interval and alert thresholds
- **OpenTelemetry** — structured Pino logging, metrics export, and distributed tracing

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# CLI (includes the `doctor` and `mcp-server-doctor` binaries)
pnpm add @reaatech/mcp-server-doctor-cli

# Core types, utilities, and grading
pnpm add @reaatech/mcp-server-doctor-core

# MCP transport client
pnpm add @reaatech/mcp-server-doctor-client

# Diagnostic engine (8 checks)
pnpm add @reaatech/mcp-server-doctor-engine

# Report formatters (console, JSON, markdown, HTML)
pnpm add @reaatech/mcp-server-doctor-reporters

# Observability (Pino logging + OpenTelemetry)
pnpm add @reaatech/mcp-server-doctor-observability
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/mcp-server-doctor.git
cd mcp-server-doctor

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Run linting
pnpm lint
```

## Quick Start

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
doctor watch http://localhost:8080 --interval 30 --alert-threshold B
```

## Packages

| Package | Description |
|---------|-------------|
| [`@reaatech/mcp-server-doctor-core`](./packages/core) | Core types, Zerod schemas, grading, utilities, constants |
| [`@reaatech/mcp-server-doctor-observability`](./packages/observability) | Structured Pino logging, OpenTelemetry metrics and tracing |
| [`@reaatech/mcp-server-doctor-client`](./packages/client) | MCP transport client (stdio, SSE, streamable HTTP) |
| [`@reaatech/mcp-server-doctor-engine`](./packages/engine) | Diagnostic engine with 8 health checks |
| [`@reaatech/mcp-server-doctor-reporters`](./packages/reporters) | Report formatters (console, JSON, markdown, HTML) |
| [`@reaatech/mcp-server-doctor-cli`](./packages/cli) | CLI entry point (diagnose, compare, watch) |

## Grading Benchmarks

Grades are assigned based on strict quantitative thresholds:

| Grade | p99 Latency | Error Rate | Concurrency | Payload Limit |
|:-----:|:-----------:|:----------:|:-----------:|:-------------:|
| **A** | < 1 s       | 0%         | 50+         | > 5 MB        |
| **B** | < 3 s       | < 1%       | 25+         | > 1 MB        |
| **C** | < 5 s       | < 5%       | 10+         | > 500 KB      |
| **D** | < 10 s      | < 10%      | 5+          | > 100 KB      |
| **F** | ≥ 10 s      | ≥ 10%      | < 5         | ≤ 100 KB      |

## CI/CD Integration

Integrate into your CI pipeline to enforce quality gates:

```yaml
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
      - run: npm install -g @reaatech/mcp-server-doctor-cli
      - run: doctor diagnose http://localhost:8080 --format json --output report.json
      - name: Fail on critical issues
        run: |
          GRADE=$(jq -r .overallGrade report.json)
          if [ "$GRADE" = "F" ]; then exit 1; fi
          if [ "$GRADE" = "D" ]; then exit 2; fi
```

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design, package relationships, and data flows
- [`AGENTS.md`](./AGENTS.md) — Coding conventions and development guidelines
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribution workflow and release process


## License

[MIT](LICENSE)
