import { randomUUID } from 'node:crypto';

export function generateUUID(): string {
  return randomUUID();
}

export function generateId(): string {
  return randomUUID().slice(0, 8);
}

export function now(): string {
  return new Date().toISOString();
}

export function measureTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

export async function measureTimeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await sleep(baseDelayMs * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower]!;
  const weight = idx - lower;
  return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
}

export function calculateStats(values: number[]): {
  p50: number;
  p90: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  samples: number;
} {
  if (values.length === 0) {
    return { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    p50: Math.round(percentile(sorted, 50) * 100) / 100,
    p90: Math.round(percentile(sorted, 90) * 100) / 100,
    p99: Math.round(percentile(sorted, 99) * 100) / 100,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: Math.round((sum / values.length) * 100) / 100,
    samples: values.length,
  };
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function isValidURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isPrivateURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::') return true;
    // IPv4 loopback (127.0.0.0/8)
    if (hostname.startsWith('127.')) return true;
    // IPv6 loopback
    if (hostname === '::1' || hostname === '[::1]') return true;
    // RFC 1918 private ranges
    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('192.168.')) return true;
    if (hostname.startsWith('172.')) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1] || '', 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
      }
    }
    // Link-local (169.254.0.0/16)
    if (hostname.startsWith('169.254.')) return true;
    // IPv6 unique local addresses (fc00::/7) and link-local (fe80::/10)
    if (
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fd00:') ||
      hostname.startsWith('fe80:') ||
      hostname.startsWith('[fc00:') ||
      hostname.startsWith('[fd00:') ||
      hostname.startsWith('[fe80:')
    )
      return true;
    return false;
  } catch {
    return false;
  }
}
