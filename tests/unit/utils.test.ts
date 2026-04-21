import { describe, it, expect } from 'vitest';
import {
  generateUUID,
  generateId,
  now,
  measureTime,
  measureTimeAsync,
  sleep,
  retry,
  percentile,
  calculateStats,
  truncate,
  isValidURL,
  isPrivateURL,
} from '../../src/utils/index.js';

describe('utils', () => {
  describe('generateUUID', () => {
    it('generates valid UUID format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('generates unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('generateId', () => {
    it('generates 8-char ID', () => {
      const id = generateId();
      expect(id).toHaveLength(8);
    });
  });

  describe('now', () => {
    it('returns ISO timestamp', () => {
      const timestamp = now();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('measureTime', () => {
    it('measures synchronous execution time', () => {
      const { result, durationMs } = measureTime(() => 42);
      expect(result).toBe(42);
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('measureTimeAsync', () => {
    it('measures async execution time', async () => {
      const { result, durationMs } = await measureTimeAsync(() => Promise.resolve(42));
      expect(result).toBe(42);
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sleep', () => {
    it('waits for specified duration', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('retry', () => {
    it('returns result on first success', async () => {
      const result = await retry(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('retries on failure then succeeds', async () => {
      let attempts = 0;
      const result = await retry(() => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error('fail'));
        return Promise.resolve('success');
      }, 3);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('throws after max retries', async () => {
      await expect(retry(() => Promise.reject(new Error('always fail')), 2)).rejects.toThrow(
        'always fail',
      );
    });
  });

  describe('percentile', () => {
    it('returns 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });

    it('returns single value for single element', () => {
      expect(percentile([100], 50)).toBe(100);
    });

    it('returns correct median', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('returns correct p90', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(sorted, 90)).toBe(9.1);
    });
  });

  describe('calculateStats', () => {
    it('returns zeros for empty array', () => {
      const stats = calculateStats([]);
      expect(stats.samples).toBe(0);
      expect(stats.p50).toBe(0);
    });

    it('calculates correct stats for single value', () => {
      const stats = calculateStats([100]);
      expect(stats.p50).toBe(100);
      expect(stats.mean).toBe(100);
      expect(stats.samples).toBe(1);
    });

    it('calculates correct stats for multiple values', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = calculateStats(values);
      expect(stats.p50).toBe(55);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(55);
      expect(stats.samples).toBe(10);
    });
  });

  describe('truncate', () => {
    it('does not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates long strings with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('handles exact length strings', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });
  });

  describe('isValidURL', () => {
    it('returns true for valid HTTP URL', () => {
      expect(isValidURL('http://example.com')).toBe(true);
    });

    it('returns true for valid HTTPS URL', () => {
      expect(isValidURL('https://example.com/path?query=1')).toBe(true);
    });

    it('returns true for localhost', () => {
      expect(isValidURL('http://localhost:8080')).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(isValidURL('not-a-url')).toBe(false);
      expect(isValidURL('')).toBe(false);
    });
  });

  describe('isPrivateURL', () => {
    it('returns true for localhost and IPv6 loopback', () => {
      expect(isPrivateURL('http://localhost:8080')).toBe(true);
      expect(isPrivateURL('http://127.0.0.1:8080')).toBe(true);
      expect(isPrivateURL('http://[::1]:8080')).toBe(true);
    });

    it('returns true for 10.x.x.x range', () => {
      expect(isPrivateURL('http://10.0.0.1')).toBe(true);
      expect(isPrivateURL('http://10.255.255.255')).toBe(true);
    });

    it('returns true for 192.168.x.x range', () => {
      expect(isPrivateURL('http://192.168.1.1')).toBe(true);
      expect(isPrivateURL('http://192.168.255.255')).toBe(true);
    });

    it('returns true for 172.16-31.x.x range', () => {
      expect(isPrivateURL('http://172.16.0.1')).toBe(true);
      expect(isPrivateURL('http://172.31.255.255')).toBe(true);
    });

    it('returns false for 172.0-15.x.x range', () => {
      expect(isPrivateURL('http://172.15.0.1')).toBe(false);
      expect(isPrivateURL('http://172.0.0.1')).toBe(false);
    });

    it('returns false for 172.32-255.x.x range', () => {
      expect(isPrivateURL('http://172.32.0.1')).toBe(false);
      expect(isPrivateURL('http://172.100.0.1')).toBe(false);
    });

    it('returns false for public URLs', () => {
      expect(isPrivateURL('https://example.com')).toBe(false);
      expect(isPrivateURL('https://1.2.3.4')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isPrivateURL('not-a-url')).toBe(false);
    });
  });
});
