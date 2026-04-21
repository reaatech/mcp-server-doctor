---
skill_id: "auth-verification"
display_name: "Auth Verification"
version: "1.0.0"
description: "Validates authentication flows across API key, Bearer token, OAuth, and no-auth modes"
category: "diagnostic"
---

# Auth Verification

## Capability

Tests and validates the configured authentication mode for MCP servers. Verifies successful authentication with valid credentials and proper rejection of unauthenticated requests when auth is required.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint> --auth <mode>` |
| **What it tests** | Ping with configured credentials; ping without credentials (for HTTP/SSE) |
| **Output** | `CheckResult` with `authResults`, `requestedAuth`, `unauthenticatedRejected` |
| **Grade impact** | F if configured auth fails or unauthenticated requests are accepted when auth is required |

## CLI Usage

```bash
# No auth
doctor diagnose http://localhost:8080 --auth none

# API key
doctor diagnose http://localhost:8080 --auth api-key --api-key $KEY

# Bearer token
doctor diagnose http://localhost:8080 --auth bearer --bearer-token $TOKEN

# OAuth (client credentials as Basic auth)
doctor diagnose http://localhost:8080 --auth oauth --oauth-client-id $ID --oauth-client-secret $SECRET
```

## What It Measures

1. **Configured auth success** — Can the client authenticate with provided credentials?
2. **Unauthenticated rejection** — When auth is configured, does the server reject requests without credentials?
3. **Transport compatibility** — HTTP/SSE support header stripping; stdio skips this test

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| 401 Unauthorized | Invalid or missing credentials | Provide valid credentials for the auth mode |
| 403 Forbidden | Valid credentials but insufficient permissions | Check user roles and access policies |
| Missing auth header | Server requires auth but none provided | Specify `--auth` mode and credentials |
| Server accepts unauthenticated requests | Auth not enforced | Configure server-side auth middleware |

## Security Considerations

**PII Handling:** Credentials are never logged or stored. API keys and tokens are redacted from all output and observability data.

**Permissions:** Requires valid credentials for the target server. Test credentials should be scoped to read-only access.

**Audit Logging:** Authentication attempts are logged with success/failure status and auth mode, but credentials are always redacted. Failed attempts include the rejection reason (401 vs 403).
