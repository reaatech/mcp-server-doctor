import { describe, expect, it } from 'vitest';

describe('MCP Client Transport Selection', () => {
  it('stdio transport is selected for stdio option', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('/usr/bin/node', {
      transport: 'stdio',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    expect(client).toBeDefined();
    expect(typeof client.connect).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.getSessionId).toBe('function');
    expect(typeof client.getServerInfo).toBe('function');
    expect(client.getSessionId()).toBeNull();
  });

  it('http transport is selected for http option', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('http://localhost:8080', {
      transport: 'http',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    expect(client).toBeDefined();
  });

  it('sse transport is selected for sse option', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('http://localhost:8080', {
      transport: 'sse',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    expect(client).toBeDefined();
  });

  it('auto transport selects stdio for non-URL', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('/usr/bin/node', {
      transport: 'auto',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    expect(client).toBeDefined();
  });

  it('auto transport selects http for URL', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('http://localhost:8080', {
      transport: 'auto',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    expect(client).toBeDefined();
  });

  it('http transport throws for non-URL endpoint', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('not-a-url', {
      transport: 'http',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    await expect(client.connect()).rejects.toThrow('HTTP transport requires a URL endpoint');
  });

  it('sse transport throws for non-URL endpoint', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('not-a-url', {
      transport: 'sse',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    await expect(client.connect()).rejects.toThrow('SSE transport requires a URL endpoint');
  });

  it('client throws when sending request without connection', async () => {
    const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
    const client = createDoctorClient('http://localhost:8080', {
      transport: 'auto',
      auth: 'none',
      timeout: 5000,
      concurrency: 10,
      verbose: false,
    });
    await expect(client.sendRequest('ping', {})).rejects.toThrow('Not connected');
  });
});
