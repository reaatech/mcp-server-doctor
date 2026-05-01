import {
  gradeCompliance,
  gradeConcurrency,
  gradeErrorRate,
  gradeLatency,
  gradePayload,
  gradeToNumber,
  numberToGrade,
  worstGrade,
} from '@reaatech/mcp-server-doctor-core';
import { describe, expect, it } from 'vitest';

describe('grading benchmarks', () => {
  describe('gradeLatency', () => {
    it('grades A for p99 < 1s', () => {
      expect(gradeLatency(500)).toBe('A');
      expect(gradeLatency(1000)).toBe('A');
    });

    it('grades B for p99 1s-3s', () => {
      expect(gradeLatency(1500)).toBe('B');
      expect(gradeLatency(3000)).toBe('B');
    });

    it('grades C for p99 3s-5s', () => {
      expect(gradeLatency(4000)).toBe('C');
    });

    it('grades D for p99 5s-10s', () => {
      expect(gradeLatency(7000)).toBe('D');
    });

    it('grades F for p99 > 10s', () => {
      expect(gradeLatency(15000)).toBe('F');
    });
  });

  describe('gradeErrorRate', () => {
    it('grades A for 0% error rate', () => {
      expect(gradeErrorRate(0)).toBe('A');
    });

    it('grades B for < 1% error rate', () => {
      expect(gradeErrorRate(0.005)).toBe('B');
    });

    it('grades F for > 10% error rate', () => {
      expect(gradeErrorRate(0.15)).toBe('F');
    });
  });

  describe('gradeConcurrency', () => {
    it('grades A for 50+ concurrent', () => {
      expect(gradeConcurrency(100)).toBe('A');
    });

    it('grades B for 25-49 concurrent', () => {
      expect(gradeConcurrency(30)).toBe('B');
    });

    it('grades F for < 5 concurrent', () => {
      expect(gradeConcurrency(2)).toBe('F');
    });
  });

  describe('gradePayload', () => {
    it('grades A for > 5MB', () => {
      expect(gradePayload(10 * 1024 * 1024)).toBe('A');
    });

    it('grades C for 500KB-1MB', () => {
      expect(gradePayload(750 * 1024)).toBe('C');
    });

    it('grades F for < 100KB', () => {
      expect(gradePayload(50 * 1024)).toBe('F');
    });
  });

  describe('gradeCompliance', () => {
    it('grades A for no warnings', () => {
      expect(gradeCompliance(true, 0)).toBe('A');
    });

    it('grades B for 1-2 warnings', () => {
      expect(gradeCompliance(true, 2)).toBe('B');
    });

    it('grades F for failed check', () => {
      expect(gradeCompliance(false, 0)).toBe('F');
    });
  });

  describe('worstGrade', () => {
    it('returns worst grade from list', () => {
      expect(worstGrade('A', 'B', 'C')).toBe('C');
      expect(worstGrade('A', 'A', 'A')).toBe('A');
      expect(worstGrade('F', 'A', 'B')).toBe('F');
    });
  });

  describe('gradeToNumber / numberToGrade', () => {
    it('converts grades to numbers', () => {
      expect(gradeToNumber('A')).toBe(4);
      expect(gradeToNumber('F')).toBe(0);
    });

    it('converts numbers to grades', () => {
      expect(numberToGrade(4)).toBe('A');
      expect(numberToGrade(1)).toBe('D');
      expect(numberToGrade(0)).toBe('F');
    });
  });
});
