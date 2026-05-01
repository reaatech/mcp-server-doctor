# AGENTS.md — mcp-server-doctor

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     mcp-server-doctor (monorepo)                  │
├───────────┬──────────┬───────────┬──────────┬──────────┬────────┤
│   core    │   obs    │  client   │  engine  │reporters │  cli   │
│ (types,   │(logger,  │(transports│ (checks, │(console, │(cmds,  │
│  utils,   │ metrics, │  stdio,   │  engine) │  json,   │ entry) │
│  grading) │ tracing) │  sse,http)│          │  md,html)│        │
└───────────┴──────────┴───────────┴──────────┴──────────┴────────┘
```

`mcp-server-doctor` is a diagnostic CLI monorepo that connects to any MCP server endpoint and runs 8 diagnostic checks, producing a graded report card. Six packages:

| Package | Name | Description |
|---------|------|-------------|
| `packages/core` | `@reaatech/mcp-server-doctor-core` | Types, utils, constants, version, grading |
| `packages/observability` | `@reaatech/mcp-server-doctor-observability` | Structured logging, OTel metrics and tracing |
| `packages/client` | `@reaatech/mcp-server-doctor-client` | MCP transport client (stdio, SSE, HTTP) |
| `packages/engine` | `@reaatech/mcp-server-doctor-engine` | Diagnostic engine with 8 checks |
| `packages/reporters` | `@reaatech/mcp-server-doctor-reporters` | Report formatters (console, JSON, markdown, HTML) |
| `packages/cli` | `@reaatech/mcp-server-doctor-cli` | CLI entry point (diagnose, compare, watch) |

## Quick Start

```bash
# Install
pnpm install

# Build all packages
pnpm run build

# Run full diagnosis
pnpm --filter @reaatech/mcp-server-doctor-cli exec doctor diagnose http://localhost:8080

# Or install globally
npm install -g @reaatech/mcp-server-doctor-cli
doctor diagnose http://localhost:8080

# With auth
doctor diagnose http://localhost:8080 --auth bearer --bearer-token $TOKEN

# Output as JSON
doctor diagnose http://localhost:8080 --format json --output report.json

# Compare two reports
doctor compare baseline.json current.json

# Continuous monitoring
doctor watch http://localhost:8080 --interval 60 --alert-threshold C
```

## Monorepo Tooling

| Tool | Purpose |
|------|---------|
| pnpm | Package manager with workspace protocol |
| turbo | Monorepo task orchestrator |
| tsup | Dual ESM/CJS build with DTS generation |
| biome | Linting and formatting |
| changesets | Versioning and changelog management |
| vitest | Test runner |

## Skill System

| Skill ID | File | Description |
|----------|------|-------------|
| `transport-negotiation` | `skills/transport-negotiation/skill.md` | Auto-detect and validate transport protocols |
| `tool-schema-validation` | `skills/tool-schema-validation/skill.md` | Validate every tool's input schema |
| `latency-profiling` | `skills/latency-profiling/skill.md` | Measure p50/p90/p99 latency per tool |
| `auth-verification` | `skills/auth-verification/skill.md` | Validate auth flows (API key, Bearer, OAuth) |
| `payload-limits` | `skills/payload-limits/skill.md` | Binary search for max payload size |
| `error-compliance` | `skills/error-compliance/skill.md` | Validate JSON-RPC 2.0 error format |
| `timeout-analysis` | `skills/timeout-analysis/skill.md` | Test timeout behavior and connection cleanup |
| `concurrency-stress` | `skills/concurrency-stress/skill.md` | Stress-test with 10–50 parallel tool calls |

## Security Considerations

**No Secrets in Logs:** All credentials (API keys, bearer tokens, OAuth secrets) are redacted from logs and observability data via Pino's `redact` configuration.

**Read-Only Testing:** All diagnostic checks are non-destructive. No data is written to the target server.

**Private Network Detection:** The `isPrivateURL()` utility detects localhost and private IP ranges to warn users about testing internal servers from external networks.

## Observability

### Structured Logging

```json
{
  "level": "info",
  "endpoint": "http://localhost:8080",
  "transport": "http",
  "check": "latency-profiling",
  "grade": "A",
  "passed": true,
  "durationMs": 2500
}
```

### OpenTelemetry Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `doctor_checks_total` | Counter | `check`, `grade` |
| `doctor_check_duration_ms` | Histogram | `check` |
| `doctor_latency_ms` | Histogram | `tool` |
| `doctor_grade` | Gauge | `grade` |

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces and metrics.

## Production Readiness Checklist

- [ ] All 8 diagnostic checks pass with grade C or better
- [ ] Latency p99 is under 5s
- [ ] Error rate is under 5%
- [ ] Server handles 10+ concurrent requests
- [ ] Payload limits are above 500KB
- [ ] Error responses follow JSON-RPC 2.0 spec
- [ ] Auth flows work correctly for all configured modes
- [ ] Transport negotiation succeeds for intended protocols

## Writing Custom Checks

To add a new diagnostic check:

1. Create `packages/engine/src/checks/my-check.check.ts`:

```typescript
import type { CheckResult, DiagnosticContext } from '@reaatech/mcp-server-doctor-core';
import { CheckCategory, Severity, now, gradeCompliance } from '@reaatech/mcp-server-doctor-core';
import type { MCPClient } from '@reaatech/mcp-server-doctor-client';
import { recordCheck } from '@reaatech/mcp-server-doctor-observability';

export class MyCheck {
  name = 'my-check';
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
      message: 'Check passed',
      details: {},
      metrics: { durationMs },
      remediation: 'All good',
      durationMs,
      timestamp: now(),
    };
  }
}
```

2. Register in `packages/engine/src/engine.ts`:

```typescript
import { MyCheck } from './checks/my-check.check.js';

private checks = [
  // ... existing checks ...
  new MyCheck(),
];
```

3. Export from `packages/engine/src/checks/index.ts` and `packages/engine/src/index.ts`.

4. Add tests in `packages/engine/tests/`.

### Grading Notes

`gradeCompliance(passed, warnings)` uses strict thresholds:
- **A**: passed with 0 warnings
- **B**: passed with 1–2 warnings
- **C**: passed with 3–5 warnings
- **D**: passed with 6–9 warnings
- **F**: failed or 10+ warnings

## Testing Locally

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run all tests
pnpm run test

# Run tests for a specific package
pnpm --filter @reaatech/mcp-server-doctor-core test

# Check types
pnpm run typecheck

# Lint
pnpm run lint

# Format
pnpm run format
```

## Common Conformance Issues & Remediation

| Issue | Grade Impact | Remediation |
|-------|--------------|-------------|
| p99 latency > 10s | F in latency | Add caching, optimize hot paths, scale horizontally |
| Error rate > 10% under load | F in concurrency | Add rate limiting, connection pooling, circuit breakers |
| Max payload < 100KB | F in payload | Increase server body parser limits |
| Missing JSON-RPC error codes | D/F in error format | Implement standard error codes (-32600 to -32700) |
| Connection leaks after timeout | F in timeout | Implement proper connection cleanup in server |
| Auth rejects valid credentials | F in auth | Check credential format, token expiration, scopes |

## Integration with Multi-Agent Systems

The doctor can be invoked as a subprocess tool from multi-agent systems:

```yaml
# agent.yaml
agent_id: "mcp-server-doctor"
type: "tool"
display_name: "MCP Server Doctor"
description: "Diagnostic and profiling tool for MCP servers"
skills:
  - transport-negotiation
  - tool-schema-validation
  - latency-profiling
  - auth-verification
  - payload-limits
  - error-compliance
  - timeout-analysis
  - concurrency-stress
endpoints:
  - protocol: "stdio"
    command: "doctor"
    args: ["diagnose"]
```

## Complementarity with mcp-contract-kit

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `mcp-contract-kit` | CI conformance testing | Pre-merge validation, registry compliance |
| `mcp-server-doctor` | Real-time diagnostics | Debugging, performance profiling, health monitoring |

Use `mcp-contract-kit` in CI to validate protocol compliance before deployment. Use `mcp-server-doctor` to debug issues in development and monitor health in production.
