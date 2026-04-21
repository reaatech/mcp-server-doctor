---
skill_id: "latency-profiling"
display_name: "Latency Profiling"
version: "1.0.0"
description: "Measures p50/p90/p99 latency per tool with warm/cold start analysis"
category: "diagnostic"
---

# Latency Profiling

## Capability

Executes comprehensive latency profiling across all MCP server tools. Runs multiple rounds of tool invocations to compute p50, p90, p99 latency metrics, separates warm-up from measurement rounds, and identifies cold start vs steady-state performance.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint>` — runs automatically |
| **What it tests** | Per-tool latency distribution across 20 measurement rounds (plus 3 warm-up) |
| **Output** | `CheckResult` with per-tool `p50`, `p90`, `p99`, `min`, `max`, `mean`, `samples` |
| **Grade impact** | Based on worst p99 across tools: A <1s, B <3s, C <5s, D <10s, F ≥10s |

## What It Measures

1. **Per-tool latency** — Up to 3 tools with empty or non-required-parameter schemas are profiled
2. **Warm-up rounds** — 3 initial calls to warm caches before measurement
3. **Measurement rounds** — 20 calls per tool for statistical significance
4. **Cold vs warm start** — First call latency compared to steady-state latency

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| Tool not found | Tool name does not exist | Use `tools/list` to get valid tool names |
| Timeout | Tool execution exceeds timeout | Increase `--timeout` or optimize tool handler |
| Inconsistent results | High variance in latency | Run more rounds or check for resource contention |
| No suitable tools | All tools require parameters | Add a no-arg tool for profiling |

## Security Considerations

**PII Handling:** No PII is collected. Tool arguments used during profiling are not stored or logged.

**Permissions:** Requires read access to tool definitions and execute permission on tools. No write operations are performed.

**Audit Logging:** Profiling requests are logged with tool name, round count, and aggregate metrics. Individual request data is not persisted.
