import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCompareCommand } from '../../src/cli/commands/compare.command.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalExit = process.exit;
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

function createReport(
  overrides: {
    id?: string;
    endpoint?: string;
    overallGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
    latency?: {
      p50: number;
      p90: number;
      p99: number;
      min: number;
      max: number;
      mean: number;
      samples: number;
    };
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    checks?: Array<{
      name: string;
      category: string;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      passed: boolean;
      severity: string;
      message: string;
      details: Record<string, unknown>;
      metrics: Record<string, number>;
      remediation: string;
      durationMs: number;
      timestamp: string;
    }>;
  } = {},
): unknown {
  return {
    id: overrides.id || '550e8400-e29b-41d4-a716-446655440000',
    endpoint: overrides.endpoint || 'http://localhost:8080',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z',
    durationMs: 60000,
    version: '1.0.0',
    transport: 'http',
    authMode: 'none',
    overallGrade: overrides.overallGrade || 'B',
    checks: overrides.checks || [],
    tools: overrides.tools || [],
    latency: overrides.latency || {
      p50: 100,
      p90: 200,
      p99: 300,
      min: 50,
      max: 500,
      mean: 150,
      samples: 100,
    },
    toolLatencies: [],
    serverInfo: {},
  };
}

describe('runCompareCommand', () => {
  const tmpDir = join(tmpdir(), 'mcp-doctor-compare-test');

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    vi.clearAllMocks();
  });

  it('reports unchanged when grades are equal', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    writeFileSync(baseline, JSON.stringify(createReport({ overallGrade: 'B' })));
    writeFileSync(current, JSON.stringify(createReport({ overallGrade: 'B' })));

    await runCompareCommand(baseline, current, { format: 'json' });
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('reports improved when grade increases', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    writeFileSync(baseline, JSON.stringify(createReport({ overallGrade: 'C' })));
    writeFileSync(current, JSON.stringify(createReport({ overallGrade: 'B' })));

    await runCompareCommand(baseline, current, { format: 'json' });
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits with code 1 when grade regresses', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    writeFileSync(baseline, JSON.stringify(createReport({ overallGrade: 'B' })));
    writeFileSync(current, JSON.stringify(createReport({ overallGrade: 'C' })));

    await runCompareCommand(baseline, current, { format: 'json' });
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('warns when endpoints differ', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    writeFileSync(baseline, JSON.stringify(createReport({ endpoint: 'http://a.com' })));
    writeFileSync(current, JSON.stringify(createReport({ endpoint: 'http://b.com' })));

    await runCompareCommand(baseline, current, { format: 'json' });
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('computes latency change correctly', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    writeFileSync(
      baseline,
      JSON.stringify(
        createReport({
          latency: { p50: 100, p90: 200, p99: 300, min: 50, max: 500, mean: 150, samples: 100 },
        }),
      ),
    );
    writeFileSync(
      current,
      JSON.stringify(
        createReport({
          latency: { p50: 100, p90: 200, p99: 500, min: 50, max: 500, mean: 150, samples: 100 },
        }),
      ),
    );

    await runCompareCommand(baseline, current, { format: 'json' });
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => c[0])
      .join('');
    const report = JSON.parse(output);
    expect(report.comparison.latencyChange).toBe(200);
  });

  it('computes tool count change correctly', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    writeFileSync(
      baseline,
      JSON.stringify(createReport({ tools: [{ name: 'a', description: '', inputSchema: {} }] })),
    );
    writeFileSync(
      current,
      JSON.stringify(
        createReport({
          tools: [
            { name: 'a', description: '', inputSchema: {} },
            { name: 'b', description: '', inputSchema: {} },
          ],
        }),
      ),
    );

    await runCompareCommand(baseline, current, { format: 'json' });
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => c[0])
      .join('');
    const report = JSON.parse(output);
    expect(report.comparison.toolCountChange).toBe(1);
  });

  it('detects per-check grade changes', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    const baseCheck = {
      name: 'latency-profiling',
      category: 'latency',
      grade: 'B' as const,
      passed: true,
      severity: 'critical',
      message: 'ok',
      details: {},
      metrics: {},
      remediation: '',
      durationMs: 100,
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    const currCheck = { ...baseCheck, grade: 'C' as const };
    writeFileSync(baseline, JSON.stringify(createReport({ checks: [baseCheck] })));
    writeFileSync(current, JSON.stringify(createReport({ checks: [currCheck] })));

    await runCompareCommand(baseline, current, { format: 'json' });
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => c[0])
      .join('');
    const report = JSON.parse(output);
    expect(report.comparison.checkChanges).toHaveLength(1);
    expect(report.comparison.checkChanges[0]).toEqual({
      name: 'latency-profiling',
      gradeChange: 'regressed',
    });
  });

  it('marks new checks as improved', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    const newCheck = {
      name: 'new-check',
      category: 'latency',
      grade: 'A' as const,
      passed: true,
      severity: 'critical',
      message: 'ok',
      details: {},
      metrics: {},
      remediation: '',
      durationMs: 100,
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    writeFileSync(baseline, JSON.stringify(createReport({ checks: [] })));
    writeFileSync(current, JSON.stringify(createReport({ checks: [newCheck] })));

    await runCompareCommand(baseline, current, { format: 'json' });
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => c[0])
      .join('');
    const report = JSON.parse(output);
    expect(report.comparison.checkChanges[0]).toEqual({
      name: 'new-check',
      gradeChange: 'improved',
      note: 'new check',
    });
  });

  it('writes output to file when --output is provided', async () => {
    const baseline = join(tmpDir, 'baseline.json');
    const current = join(tmpDir, 'current.json');
    const outPath = join(tmpDir, 'out.json');
    writeFileSync(baseline, JSON.stringify(createReport()));
    writeFileSync(current, JSON.stringify(createReport()));

    await runCompareCommand(baseline, current, { format: 'json', output: outPath });
    expect(process.exit).not.toHaveBeenCalled();
  });
});
