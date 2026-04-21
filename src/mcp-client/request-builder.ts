import { getProgramVersion } from '../version.js';

// Request builder utilities for MCP JSON-RPC messages.
// These helpers centralize request construction for consistency.

export function buildInitializeRequest(id?: number): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: id ?? 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'mcp-server-doctor',
        version: getProgramVersion(),
      },
    },
  };
}

export function buildListToolsRequest(id?: number): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: id ?? 2,
    method: 'tools/list',
    params: {},
  };
}

export function buildToolCallRequest(
  name: string,
  arguments_: Record<string, unknown>,
  id?: number,
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: id ?? 3,
    method: 'tools/call',
    params: {
      name,
      arguments: arguments_,
    },
  };
}

export function buildPingRequest(id?: number): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: id ?? 999,
    method: 'ping',
    params: {},
  };
}
