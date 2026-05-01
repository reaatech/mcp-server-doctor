import { getProgramVersion } from '@reaatech/mcp-server-doctor-core';
import * as core from '@reaatech/mcp-server-doctor-core';
import { describe, expect, it } from 'vitest';

describe('Version and Index', () => {
  describe('getProgramVersion', () => {
    it('returns a valid semver version', () => {
      const version = getProgramVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('returns cached version on subsequent calls', () => {
      const v1 = getProgramVersion();
      const v2 = getProgramVersion();
      expect(v1).toBe(v2);
    });
  });

  describe('index exports', () => {
    it('exports grading functions', () => {
      expect(core.gradeLatency).toBeDefined();
      expect(core.gradeErrorRate).toBeDefined();
      expect(core.gradeConcurrency).toBeDefined();
      expect(core.gradePayload).toBeDefined();
    });

    it('exports utility functions', () => {
      expect(core.generateUUID).toBeDefined();
      expect(core.calculateStats).toBeDefined();
      expect(core.isPrivateURL).toBeDefined();
    });
  });
});
