import { describe, it, expect } from 'vitest';
import { getProgramVersion } from '../../src/version.js';
import * as index from '../../src/index.js';

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
    it('exports DiagnosticEngine', () => {
      expect(index.DiagnosticEngine).toBeDefined();
    });

    it('exports createDoctorClient', () => {
      expect(index.createDoctorClient).toBeDefined();
    });

    it('exports formatReport', () => {
      expect(index.formatReport).toBeDefined();
    });

    it('exports grading functions', () => {
      expect(index.gradeLatency).toBeDefined();
      expect(index.gradeErrorRate).toBeDefined();
      expect(index.gradeConcurrency).toBeDefined();
      expect(index.gradePayload).toBeDefined();
    });

    it('exports utility functions', () => {
      expect(index.generateUUID).toBeDefined();
      expect(index.calculateStats).toBeDefined();
      expect(index.isPrivateURL).toBeDefined();
    });

    it('exports logger', () => {
      expect(index.logger).toBeDefined();
    });

    it('exports metrics functions', () => {
      expect(index.recordCheck).toBeDefined();
      expect(index.recordLatency).toBeDefined();
      expect(index.recordGrade).toBeDefined();
    });
  });
});
