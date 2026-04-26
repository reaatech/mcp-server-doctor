import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion: string | undefined;

function resolvePackageJson(): Record<string, unknown> {
  const filePath = fileURLToPath(import.meta.url);
  const dir = dirname(filePath);

  const candidates = [resolve(dir, '../../package.json'), resolve(dir, '../../../package.json')];

  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf-8')) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  return {};
}

export function getProgramVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = resolvePackageJson();
    cachedVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

export const programVersion = getProgramVersion();
