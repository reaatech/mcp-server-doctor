# @reaatech/mcp-server-doctor-client

[![npm version](https://img.shields.io/npm/v/@reaatech/mcp-server-doctor-client.svg)](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/mcp-server-doctor/ci.yml?branch=main&label=CI)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

MCP transport client with auto-negotiation across stdio, SSE, and streamable HTTP transports. Handles the full MCP lifecycle — `initialize`, `tools/list`, `tools/call`, `ping`, and graceful disconnect — with credential injection and intelligent fallback.

## Installation

```bash
npm install @reaatech/mcp-server-doctor-client
# or
pnpm add @reaatech/mcp-server-doctor-client
```

## Feature Overview

- **Auto-negotiation** — detects transport type from endpoint format (URL → HTTP/SSE, command string → stdio)
- **Three transports** — `StdioTransport`, `SSETransport`, `StreamableHTTPTransport`
- **Credential injection** — API key, Bearer token, and OAuth credentials via headers (HTTP/SSE) or env vars (stdio)
- **Fallback** — HTTP → SSE auto-fallback on connection failure
- **Private network detection** — warns when connecting to localhost or private IP ranges
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { createDoctorClient } from "@reaatech/mcp-server-doctor-client";

// Connect to an MCP server over HTTP
const client = createDoctorClient("http://localhost:8080", {
  transport: "auto",
  auth: "none",
  timeout: 30000,
  concurrency: 10,
  verbose: false,
});

await client.connect();

// Discover tools
const tools = await client.listTools();
console.log(`Found ${tools.length} tools`);

// Call a tool
const result = await client.callTool("echo", { message: "hello" });

// Send a raw JSON-RPC request
await client.sendRequest("ping", {});

await client.disconnect();
```

## API Reference

### `createDoctorClient(endpoint: string, options: DiagnosticOptions): MCPClient`

Factory function that creates and returns an `MCPClient` instance.

### `MCPClient` (interface)

| Method | Description |
|--------|-------------|
| `connect()` | Connects to the MCP server, negotiates transport, calls `initialize` and `tools/list` |
| `disconnect()` | Disconnects from the server and cleans up resources |
| `sendRequest(method, params?)` | Sends a raw JSON-RPC 2.0 request and returns the result |
| `listTools()` | Returns the list of tools discovered during `connect()` |
| `callTool(name, args)` | Calls a tool by name with arguments (wraps `tools/call`) |
| `getSessionId()` | Returns the MCP session ID (`null` for non-HTTP transports) |
| `getServerInfo()` | Returns the server info object from the `initialize` response |

### Transport Negotiation

The `transport` option controls behavior:

| Value | Behavior |
|-------|----------|
| `"auto"` | URL → HTTP (with SSE fallback), non-URL → stdio |
| `"http"` | Force streamable HTTP transport |
| `"sse"` | Force SSE with automatic endpoint discovery |
| `"stdio"` | Spawn the endpoint as a child process; communicates via stdin/stdout |

### Auth Modes

| Mode | HTTP/SSE Behavior | Stdio Behavior |
|------|-------------------|----------------|
| `"none"` | No auth headers | No env vars |
| `"api-key"` | `X-Api-Key` header | `MCP_API_KEY` env var |
| `"bearer"` | `Authorization: Bearer ...` header | `MCP_BEARER_TOKEN` env var |
| `"oauth"` | `Authorization: Basic ...` (client credentials) | `MCP_OAUTH_CLIENT_ID` + `MCP_OAUTH_CLIENT_SECRET` env vars |

### Transports

All transports implement the same interface and can be used directly if you need finer control:

```typescript
import { StreamableHTTPTransport } from "@reaatech/mcp-server-doctor-client";

const transport = new StreamableHTTPTransport({
  url: "http://localhost:8080",
  timeout: 30000,
  headers: { "X-Api-Key": "secret" },
});
await transport.connect();
const result = await transport.sendRequest("ping", {});
await transport.disconnect();
```

| Transport | Use Case |
|-----------|----------|
| `StreamableHTTPTransport` | Stateless HTTP JSON-RPC with session ID tracking |
| `SSETransport` | SSE-based endpoint discovery + bidirectional RPC via POST |
| `StdioTransport` | Spawns a child process; communicates over stdin/stdout |

### TransportError

All transport errors are thrown as `TransportError` instances with optional JSON-RPC 2.0 fields:

```typescript
import { TransportError } from "@reaatech/mcp-server-doctor-client";

try {
  await transport.sendRequest("bad_method", {});
} catch (error) {
  if (error instanceof TransportError) {
    console.log(error.rpcCode);  // -32601
    console.log(error.rpcData);  // optional error data
  }
}
```

### Request Builders

Low-level JSON-RPC 2.0 request builders are also exported:

| Function | Description |
|----------|-------------|
| `buildInitializeRequest(id?)` | Build an `initialize` request object |
| `buildListToolsRequest(id?)` | Build a `tools/list` request object |
| `buildToolCallRequest(name, args, id?)` | Build a `tools/call` request object |
| `buildPingRequest(id?)` | Build a `ping` request object |

## Usage Patterns

### With Authentication

```typescript
const client = createDoctorClient("http://localhost:8080", {
  transport: "http",
  auth: "bearer",
  bearerToken: process.env.MCP_BEARER_TOKEN,
  timeout: 30000,
  concurrency: 10,
  verbose: false,
});
await client.connect();
```

### Stdio Transport

```typescript
const client = createDoctorClient("/usr/local/bin/mcp-server", {
  transport: "stdio",
  auth: "none",
  timeout: 30000,
  concurrency: 10,
  verbose: false,
});
await client.connect();
```

### Programmatic Transport Access

```typescript
import { StreamableHTTPTransport } from "@reaatech/mcp-server-doctor-client";

const http = new StreamableHTTPTransport({
  url: "http://localhost:8080",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
await http.connect();
const result = await http.sendRequest("ping", {});
console.log(http.getSessionId()); // "session-123"
await http.disconnect();
```

## Related Packages

- [`@reaatech/mcp-server-doctor-core`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-core) — Types, utilities, and constants
- [`@reaatech/mcp-server-doctor-observability`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-observability) — Logging and telemetry
- [`@reaatech/mcp-server-doctor-engine`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-engine) — Diagnostic engine

## License

[MIT](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
