---
skill_id: "error-compliance"
display_name: "Error Compliance"
version: "1.0.0"
description: "Validates JSON-RPC 2.0 error response format compliance"
category: "diagnostic"
---

# Error Compliance

## Capability

Validates that error responses from the MCP server conform to the JSON-RPC 2.0 specification. Checks for proper error code ranges, message format, and optional data field structure.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint>` — runs automatically |
| **What it tests** | Error format for unknown methods and unknown tools |
| **Output** | `CheckResult` with `methodErrorValid`, `toolErrorValid`, `methodError`, `toolError` |
| **Grade impact** | Warnings for malformed errors; F if server crashes on error injection |

## What It Measures

1. **Method error format** — Calling a nonexistent method should return JSON-RPC error with `code`, `message`
2. **Tool error format** — Calling a nonexistent tool should return JSON-RPC error with `code`, `message`
3. **Standard codes** — Validates use of standard JSON-RPC error codes (-32601, -32602, etc.)

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| Missing error code | Server returns error without code | Update server to include JSON-RPC error codes |
| Invalid error code | Code outside valid ranges | Use standard JSON-RPC error codes (-32768 to -32000) |
| Missing message | Error without message string | Add descriptive error messages |

## Security Considerations

**PII Handling:** Error messages are checked for accidental PII leakage. Any PII found in error responses is flagged.

**Permissions:** No special permissions required. Triggers errors intentionally to test error handling.

**Audit Logging:** Error validation requests and results are logged. Error messages are included in logs but sensitive data is redacted.
