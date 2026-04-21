---
skill_id: "payload-limits"
display_name: "Payload Limits"
version: "1.0.0"
description: "Binary search to find max request/response payload size boundaries"
category: "diagnostic"
---

# Payload Limits

## Capability

Determines the maximum payload size an MCP server can handle for requests. Uses binary search to efficiently find the boundary between accepted and rejected payloads.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint>` — runs automatically |
| **What it tests** | Max accepted payload via binary search between 1KB and 5MB |
| **Output** | `CheckResult` with `maxAccepted`, `minRejected`, `maxAcceptedFormatted` |
| **Grade impact** | A >5MB, B >1MB, C >500KB, D >100KB, F ≤100KB |

## What It Measures

1. **Max accepted payload** — Largest payload the server accepts, found via binary search
2. **Graceful degradation** — Does the server return an error for oversized payloads, or crash?
3. **Tool compatibility** — Requires a tool that accepts a large string parameter

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| Server crash | Server cannot handle large payloads | Increase server memory or payload limits |
| Timeout | Large payload processing takes too long | Increase `--timeout` or optimize data handling |
| Connection reset | Server drops connection on large payloads | Configure proper error responses |
| No suitable tool | No tool accepts large string parameters | Add a test tool with flexible input schema |

## Security Considerations

**PII Handling:** Test payloads consist of repeated characters (e.g., `'x'`) and contain no real data.

**Permissions:** Requires execute permission on tools. Large payload tests may consume server resources — use in staging environments.

**Audit Logging:** Payload size tests are logged with min/max boundaries and results. Actual payload content is never logged.
