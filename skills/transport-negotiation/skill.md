---
skill_id: "transport-negotiation"
display_name: "Transport Negotiation"
version: "1.0.0"
description: "Auto-detects and validates MCP transport protocols (stdio, SSE, StreamableHTTP)"
category: "diagnostic"
---

# Transport Negotiation

## Capability

Validates that an MCP server correctly negotiates and handles supported transport protocols. The doctor tests handshake correctness, protocol compliance, and fallback behavior across stdio, SSE, and StreamableHTTP transports.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint>` with `--transport auto` or explicit transport |
| **What it tests** | Connection establishment, initialize handshake, ping latency, session ID assignment |
| **Output** | `CheckResult` with `transport` details, `sessionId`, `pingLatencyMs` |
| **Grade impact** | F if connection or handshake fails |

## CLI Usage

```bash
# Auto-detect transport
doctor diagnose http://localhost:8080

# Force specific transport
doctor diagnose http://localhost:8080 --transport sse
doctor diagnose ./server-binary --transport stdio
```

## What It Measures

1. **Connection success** — Can the client connect via the chosen transport?
2. **Initialize handshake** — Does the server respond correctly to `initialize` with protocol version and capabilities?
3. **Ping latency** — Round-trip time for a `ping` request after connection
4. **Session management** — For HTTP: is `mcp-session-id` header returned and accepted?
5. **Auto-negotiation fallback** — If HTTP fails, does the doctor fall back to SSE?

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| Connection refused | Server not running | Start the server or check endpoint URL |
| Timeout | Network latency or server overload | Increase `--timeout` or check server load |
| Protocol mismatch | Server uses unsupported transport | Try a different `--transport` type |
| Handshake failed | Protocol version mismatch | Check server MCP protocol version |

## Security Considerations

**PII Handling:** No personally identifiable information is collected or transmitted during transport negotiation.

**Permissions:** Requires network access to the target MCP server endpoint. For stdio transport, requires execute permission on the server binary.

**Audit Logging:** All transport negotiation attempts are logged with endpoint, transport type, success/failure status, and latency. Session IDs are recorded but credentials are redacted.
