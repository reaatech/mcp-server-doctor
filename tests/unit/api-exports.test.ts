import { describe, it, expect } from 'vitest';
import { getProgramVersion } from '../../src/version.js';
import * as index from '../../src/index.js';

import {
  StdioTransport,
  SSETransport,
  StreamableHTTPTransport,
} from '../../src/mcp-client/transports/index.js';
import {
  buildInitializeRequest,
  buildListToolsRequest,
  buildToolCallRequest,
  buildPingRequest,
} from '../../src/mcp-client/request-builder.js';
import {
  runDiagnoseCommand,
  runCompareCommand,
  runWatchCommand,
} from '../../src/cli/commands/index.js';

describe('Library API and Exports', () => {
  describe('version module', () => {
    it('getProgramVersion returns valid semver', () => {
      const version = getProgramVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('index barrel exports', () => {
    it('exports all expected modules', () => {
      expect(index.DiagnosticEngine).toBeDefined();
      expect(index.createDoctorClient).toBeDefined();
      expect(index.formatReport).toBeDefined();
      expect(index.logger).toBeDefined();
      expect(index.recordCheck).toBeDefined();
      expect(index.recordLatency).toBeDefined();
      expect(index.recordGrade).toBeDefined();
      expect(index.gradeLatency).toBeDefined();
      expect(index.gradeErrorRate).toBeDefined();
      expect(index.gradeConcurrency).toBeDefined();
      expect(index.gradePayload).toBeDefined();
      expect(index.worstGrade).toBeDefined();
      expect(index.generateUUID).toBeDefined();
      expect(index.calculateStats).toBeDefined();
      expect(index.isPrivateURL).toBeDefined();
    });
  });

  describe('transport exports', () => {
    it('exports StdioTransport', () => {
      expect(StdioTransport).toBeDefined();
    });

    it('exports SSETransport', () => {
      expect(SSETransport).toBeDefined();
    });

    it('exports StreamableHTTPTransport', () => {
      expect(StreamableHTTPTransport).toBeDefined();
    });
  });

  describe('request builder', () => {
    it('builds initialize request', () => {
      const req = buildInitializeRequest();
      expect(req.method).toBe('initialize');
      expect(req.id).toBe(1);
      expect(req.params).toBeDefined();
    });

    it('builds list tools request', () => {
      const req = buildListToolsRequest(5);
      expect(req.method).toBe('tools/list');
      expect(req.id).toBe(5);
    });

    it('builds tool call request', () => {
      const req = buildToolCallRequest('echo', { message: 'hello' }, 10);
      expect(req.method).toBe('tools/call');
      expect(req.id).toBe(10);
      expect(req.params).toEqual({ name: 'echo', arguments: { message: 'hello' } });
    });

    it('builds ping request', () => {
      const req = buildPingRequest(99);
      expect(req.method).toBe('ping');
      expect(req.id).toBe(99);
    });
  });

  describe('command exports', () => {
    it('exports runDiagnoseCommand', () => {
      expect(runDiagnoseCommand).toBeDefined();
      expect(typeof runDiagnoseCommand).toBe('function');
    });

    it('exports runCompareCommand', () => {
      expect(runCompareCommand).toBeDefined();
      expect(typeof runCompareCommand).toBe('function');
    });

    it('exports runWatchCommand', () => {
      expect(runWatchCommand).toBeDefined();
      expect(typeof runWatchCommand).toBe('function');
    });
  });
});
