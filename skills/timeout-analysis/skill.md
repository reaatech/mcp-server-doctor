---
skill_id: "timeout-analysis"
display_name: "Timeout Analysis"
version: "1.0.0"
description: "Validates timeout behavior and connection cleanup under various timeout scenarios"
category: "diagnostic"
---

# Timeout Analysis

## Capability

Tests MCP server behavior under timeout conditions. Validates that the server properly handles request timeouts, cleans up connections after timeouts, returns appropriate error responses, and maintains stability after timeout events.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint>` — runs automatically |
| **What it tests** | Short timeout handling, connection cleanup, post-timeout stability |
| **Output** | `CheckResult` with `shortTimeoutTriggered`, `disconnectAfterTimeout`, `postTimeoutPing` |
| **Grade impact** | F if connection leaks after timeout or server becomes unresponsive |

## What It Measures

1. **Baseline health** — Normal ping succeeds before timeout testing
2. **Short timeout handling** — A temporary client with 1ms timeout should trigger a timeout error
3. **Connection cleanup** — Can the temporary client disconnect cleanly after timeout?
4. **Post-timeout stability** — The original client remains healthy after the timeout test

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| Connection leak | Server doesn't clean up after timeout | Report as critical — server will exhaust resources |
| No timeout response | Server hangs instead of timing out | Configure server-side timeout limits |
| Cascading failures | Timeout causes other requests to fail | Add circuit breaker or rate limiting |
| Slow recovery | Server slow to recover after timeout | Check for resource cleanup issues |

## Security Considerations

**PII Handling:** No PII is collected during timeout testing.

**Permissions:** Requires execute permission on tools. Timeout tests may temporarily degrade server performance.

**Audit Logging:** Timeout tests are logged with timeout value and result. Connection health is recorded for leak detection.
