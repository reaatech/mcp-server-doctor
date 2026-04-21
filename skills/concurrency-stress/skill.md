---
skill_id: "concurrency-stress"
display_name: "Concurrency Stress"
version: "1.0.0"
description: "Tests server behavior under concurrent load with degradation analysis"
category: "diagnostic"
---

# Concurrency Stress

## Capability

Measures how well an MCP server handles concurrent tool calls. Tests at 5, 10, 25, and 50 parallel requests, measuring success rates, error rates, and latency degradation under load.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint> --concurrency 10` (default: 10) |
| **What it tests** | Success rate at concurrency levels [5, 10, 25, 50] |
| **Output** | `CheckResult` with `concurrencyResults`, `maxConcurrent`, `errorRate` |
| **Grade impact** | Based on max concurrent with ≥95% success: A 50+, B 25+, C 10+, D 5+, F <5 |

## CLI Usage

```bash
# Default concurrency level
doctor diagnose http://localhost:8080

# Custom concurrency level (used as upper bound)
doctor diagnose http://localhost:8080 --concurrency 50
```

## What It Measures

1. **Success rate per level** — Percentage of successful calls at 5, 10, 25, and 50 concurrent requests
2. **Max concurrency** — Highest level with ≥95% success rate
3. **Error rate** — Percentage of failed calls at the max concurrency level
4. **Latency degradation** — Average latency under load vs single-call latency

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| High error rate | Server overloaded | Reduce load or scale server horizontally |
| Timeout under load | Insufficient connection pooling | Increase pool size or add load balancing |
| No suitable tools | All tools require parameters | Add a no-arg tool for stress testing |

## Security Considerations

**PII Handling:** No PII is transmitted during stress tests.

**Permissions:** Requires execute permission on the target server's tools.

**Audit Logging:** Concurrency levels, success rates, and max concurrency are logged.
