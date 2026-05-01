# @reaatech/mcp-server-doctor-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/mcp-server-doctor-cli.svg)](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/mcp-server-doctor/ci.yml?branch=main&label=CI)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

CLI for MCP server diagnostics — run a full health check suite, compare reports, or continuously monitor an endpoint. Ships the `doctor` and `mcp-server-doctor` binaries.

## Installation

```bash
npm install -g @reaatech/mcp-server-doctor-cli
# or
pnpm add -g @reaatech/mcp-server-doctor-cli
```

## Commands

### `doctor diagnose`

Run the full 8-check diagnostic suite against an MCP server endpoint.

```bash
doctor diagnose <endpoint> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--transport <type>` | `auto` | Transport type: `stdio`, `sse`, `http`, `auto` |
| `--auth <mode>` | `none` | Auth mode: `none`, `api-key`, `bearer`, `oauth` |
| `--api-key <key>` | — | API key (prefer `MCP_API_KEY` env var) |
| `--bearer-token <token>` | — | Bearer token (prefer `MCP_BEARER_TOKEN` env var) |
| `--oauth-client-id <id>` | — | OAuth client ID (prefer `MCP_OAUTH_CLIENT_ID` env var) |
| `--oauth-client-secret <secret>` | — | OAuth client secret (prefer `MCP_OAUTH_CLIENT_SECRET` env var) |
| `--format <format>` | `console` | Output format: `console`, `json`, `markdown`, `html` |
| `--output <path>` | — | Write report to file |
| `--verbose` | `false` | Show detailed output |
| `--timeout <ms>` | `30000` | Request timeout in milliseconds |
| `--concurrency <n>` | `10` | Concurrency level for stress tests |

**Exit codes:**
- `0` — grade A, B, or C
- `1` — grade F
- `2` — grade D
- `3` — crash / unreachable

**Examples:**

```bash
# Basic HTTP diagnosis
doctor diagnose http://localhost:8080

# With bearer token auth
doctor diagnose http://localhost:8080 --auth bearer --bearer-token $TOKEN

# Stdio transport (spawn a child process)
doctor diagnose /usr/local/bin/mcp-server --transport stdio

# JSON output to file
doctor diagnose http://localhost:8080 --format json --output report.json

# HTML report
doctor diagnose http://localhost:8080 --format html --output report.html
```

### `doctor compare`

Compare two diagnostic reports and highlight regressions.

```bash
doctor compare <baseline> <current> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `console` | Output format: `console`, `json`, `markdown`, `html` |
| `--output <path>` | — | Write report to file |

**Exit codes:**
- `0` — no regression
- `1` — grade regressed
- `3` — report file not found or invalid

**Examples:**

```bash
# Compare two JSON reports
doctor compare baseline.json current.json

# With markdown output
doctor compare baseline.json current.json --format markdown --output diff.md
```

The comparison report includes:
- Overall grade change (improved / regressed / unchanged)
- Per-check grade changes
- Latency delta (p99 change in ms)
- Tool count change

### `doctor watch`

Continuously monitor an MCP endpoint and alert on grade drops.

```bash
doctor watch <endpoint> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--interval <seconds>` | `60` | Check interval in seconds (minimum 10) |
| `--alert-threshold <grade>` | `C` | Alert when grade drops below this threshold |
| `--transport <type>` | `auto` | Transport type: `stdio`, `sse`, `http`, `auto` |
| `--auth <mode>` | `none` | Auth mode |
| `--format <format>` | `console` | Output format |
| `--output <path>` | — | Write report to file (overwritten each cycle) |

Graceful shutdown on `SIGINT` (Ctrl+C) or `SIGTERM`.

**Example:**

```bash
# Monitor every 30 seconds, alert below B
doctor watch http://localhost:8080 --interval 30 --alert-threshold B
```

## Programmatic Use

All commands are exported and can be used programmatically:

```typescript
import { runDiagnoseCommand, runCompareCommand, runWatchCommand } from "@reaatech/mcp-server-doctor-cli";

// Run a diagnosis programmatically
await runDiagnoseCommand("http://localhost:8080", {
  transport: "http",
  auth: "bearer",
  bearerToken: process.env.MCP_BEARER_TOKEN,
  format: "json",
  output: "report.json",
  verbose: false,
  timeout: "30000",
  concurrency: "10",
});

// Compare two reports
await runCompareCommand("baseline.json", "current.json", {
  format: "console",
});

// Start monitoring
await runWatchCommand("http://localhost:8080", {
  interval: "60",
  alertThreshold: "C",
  transport: "http",
  auth: "none",
  format: "console",
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MCP_API_KEY` | API key for `api-key` auth mode |
| `MCP_BEARER_TOKEN` | Bearer token for `bearer` / `oauth` auth modes |
| `MCP_OAUTH_CLIENT_ID` | OAuth client ID |
| `MCP_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `DOCTOR_WATCH_MIN_INTERVAL_MS` | Minimum watch interval in ms (default: `10000`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Set to enable OpenTelemetry metrics and tracing |
| `LOG_LEVEL` | Override log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `NODE_ENV` | `production` → raw JSON logs; otherwise → pretty-printed |

## Related Packages

- [`@reaatech/mcp-server-doctor-core`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-core) — Types, utilities, and grading
- [`@reaatech/mcp-server-doctor-client`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-client) — MCP transport client
- [`@reaatech/mcp-server-doctor-engine`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-engine) — Diagnostic engine with 8 checks
- [`@reaatech/mcp-server-doctor-reporters`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-reporters) — Report formatters
- [`@reaatech/mcp-server-doctor-observability`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-observability) — Logging and telemetry

## License

[MIT](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
