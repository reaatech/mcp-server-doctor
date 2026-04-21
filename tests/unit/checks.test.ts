import { describe, it, expect } from 'vitest';
import { TransportNegotiationCheck } from '../../src/doctor/checks/transport-negotiation.check.js';
import { ToolSchemaValidationCheck } from '../../src/doctor/checks/tool-schema-validation.check.js';
import { CheckCategory, Severity } from '../../src/types/domain.js';
import { MockMCPClient } from '../helpers/mock-client.js';

describe('diagnostic checks', () => {
  describe('TransportNegotiationCheck', () => {
    it('has correct metadata', () => {
      const check = new TransportNegotiationCheck();
      expect(check.name).toBe('transport-negotiation');
      expect(check.category).toBe(CheckCategory.TRANSPORT);
      expect(check.severity).toBe(Severity.CRITICAL);
    });

    it('validates successfully with mock client', async () => {
      const check = new TransportNegotiationCheck();
      const client = new MockMCPClient();
      const context = {
        endpoint: 'http://localhost:8080',
        options: {
          transport: 'http' as const,
          auth: 'none' as const,
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        requestId: 'test-123',
        startTime: Date.now(),
      };

      const result = await check.validate(client, context);
      expect(result.passed).toBe(true);
      expect(result.grade).toBe('A');
      expect(result.name).toBe('transport-negotiation');
    });
  });

  describe('ToolSchemaValidationCheck', () => {
    it('has correct metadata', () => {
      const check = new ToolSchemaValidationCheck();
      expect(check.name).toBe('tool-schema-validation');
      expect(check.category).toBe(CheckCategory.SCHEMA);
    });

    it('validates tool schemas successfully', async () => {
      const check = new ToolSchemaValidationCheck();
      const client = new MockMCPClient();
      const context = {
        endpoint: 'http://localhost:8080',
        options: {
          transport: 'http' as const,
          auth: 'none' as const,
          timeout: 30000,
          concurrency: 10,
          verbose: false,
        },
        requestId: 'test-123',
        startTime: Date.now(),
      };

      const result = await check.validate(client, context);
      expect(result.passed).toBe(true);
      expect(result.details.toolCount).toBe(2);
    });
  });
});
