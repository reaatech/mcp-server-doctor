import { describe, it, expect } from 'vitest';
import {
  formatReport,
  formatConsoleReport,
  formatJsonReport,
  formatMarkdownReport,
  formatHtmlReport,
} from '../../src/reporters/index.js';
import { DiagnosticReport, CheckCategory, Severity } from '../../src/types/domain.js';

const createSampleReport = (overrides = {}): DiagnosticReport => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  endpoint: 'http://localhost:8080',
  startedAt: '2024-01-01T00:00:00.000Z',
  completedAt: '2024-01-01T00:01:00.000Z',
  durationMs: 60000,
  version: '1.0.0',
  transport: 'http',
  authMode: 'none',
  overallGrade: 'B',
  checks: [
    {
      name: 'transport-negotiation',
      category: CheckCategory.TRANSPORT,
      grade: 'A',
      passed: true,
      severity: Severity.CRITICAL,
      message: 'OK',
      details: {},
      metrics: {},
      remediation: 'OK',
      durationMs: 100,
      timestamp: '2024-01-01T00:00:00.000Z',
    },
  ],
  tools: [{ name: 'echo', description: 'Echo tool', inputSchema: { type: 'object' } }],
  latency: { p50: 100, p90: 200, p99: 300, min: 50, max: 500, mean: 150, samples: 100 },
  toolLatencies: [],
  ...overrides,
});

describe('reporters', () => {
  describe('formatReport', () => {
    it('dispatches to console format', async () => {
      const report = createSampleReport();
      const output = await formatReport(report, 'console');
      expect(output).toContain('MCP Server Diagnostic Report');
    });

    it('dispatches to json format', async () => {
      const report = createSampleReport();
      const output = await formatReport(report, 'json');
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe(report.id);
    });

    it('dispatches to markdown format', async () => {
      const report = createSampleReport();
      const output = await formatReport(report, 'markdown');
      expect(output).toContain('# MCP Server Diagnostic Report');
    });

    it('dispatches to html format', async () => {
      const report = createSampleReport();
      const output = await formatReport(report, 'html');
      expect(output).toContain('<!DOCTYPE html>');
    });
  });

  describe('formatConsoleReport', () => {
    it('shows endpoint and metadata', () => {
      const report = createSampleReport();
      const output = formatConsoleReport(report);
      expect(output).toContain('http://localhost:8080');
      expect(output).toContain('Duration: 60000ms');
    });

    it('shows overall grade with icon', () => {
      const report = createSampleReport({ overallGrade: 'A' });
      const output = formatConsoleReport(report);
      expect(output).toContain('A');
    });

    it('shows latency metrics when available', () => {
      const report = createSampleReport();
      const output = formatConsoleReport(report);
      expect(output).toContain('p50:');
      expect(output).toContain('p99:');
    });

    it('omits latency section when no samples', () => {
      const report = createSampleReport({
        latency: { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 },
      });
      const output = formatConsoleReport(report);
      expect(output).not.toContain('── Latency ──');
    });

    it('shows tools list', () => {
      const report = createSampleReport();
      const output = formatConsoleReport(report);
      expect(output).toContain('Tools');
      expect(output).toContain('echo');
    });

    it('omits tools section when no tools', () => {
      const report = createSampleReport({ tools: [] });
      const output = formatConsoleReport(report);
      expect(output).not.toContain('── Tools');
    });

    it('shows tools truncation when more than 10', () => {
      const tools = Array.from({ length: 15 }, (_, i) => ({
        name: `tool-${i}`,
        description: `Tool ${i}`,
        inputSchema: {},
      }));
      const report = createSampleReport({ tools });
      const output = formatConsoleReport(report);
      expect(output).toContain('... and 5 more');
    });

    it('shows check warning when present', () => {
      const report = createSampleReport({
        checks: [
          {
            name: 'test',
            category: CheckCategory.TRANSPORT,
            grade: 'C',
            passed: true,
            severity: Severity.WARNING,
            message: 'Slow',
            details: { warning: 'High latency' },
            metrics: {},
            remediation: 'Optimize',
            durationMs: 0,
            timestamp: '',
          },
        ],
      });
      const output = formatConsoleReport(report);
      expect(output).toContain('High latency');
    });

    it('shows failures section when checks fail', () => {
      const report = createSampleReport({
        checks: [
          {
            name: 'test',
            category: CheckCategory.TRANSPORT,
            grade: 'F',
            passed: false,
            severity: Severity.CRITICAL,
            message: 'Failed',
            details: {},
            metrics: {},
            remediation: 'Fix it',
            durationMs: 0,
            timestamp: '',
          },
        ],
      });
      const output = formatConsoleReport(report);
      expect(output).toContain('Failures');
    });

    it('shows failures without remediation', () => {
      const report = createSampleReport({
        checks: [
          {
            name: 'test',
            category: CheckCategory.TRANSPORT,
            grade: 'F',
            passed: false,
            severity: Severity.CRITICAL,
            message: 'Failed',
            details: {},
            metrics: {},
            durationMs: 0,
            timestamp: '',
          },
        ],
      });
      const output = formatConsoleReport(report);
      expect(output).toContain('Failures');
      expect(output).not.toContain('→');
    });

    it('shows error section when report has error', () => {
      const report = createSampleReport({ error: 'Connection refused' });
      const output = formatConsoleReport(report);
      expect(output).toContain('Error');
      expect(output).toContain('Connection refused');
    });
  });

  describe('formatJsonReport', () => {
    it('produces valid JSON with all fields', () => {
      const report = createSampleReport();
      const output = formatJsonReport(report);
      const parsed = JSON.parse(output);
      expect(parsed.overallGrade).toBe('B');
      expect(parsed.transport).toBe('http');
      expect(parsed.authMode).toBe('none');
    });
  });

  describe('formatMarkdownReport', () => {
    it('includes check table', () => {
      const report = createSampleReport();
      const output = formatMarkdownReport(report);
      expect(output).toContain('| Check | Grade |');
    });

    it('includes latency table', () => {
      const report = createSampleReport();
      const output = formatMarkdownReport(report);
      expect(output).toContain('| p99 |');
    });

    it('omits latency section when no samples', () => {
      const report = createSampleReport({
        latency: { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 },
      });
      const output = formatMarkdownReport(report);
      expect(output).not.toContain('## Latency');
    });

    it('omits tools section when no tools', () => {
      const report = createSampleReport({ tools: [] });
      const output = formatMarkdownReport(report);
      expect(output).not.toContain('## Tools');
    });

    it('shows failures without remediation', () => {
      const report = createSampleReport({
        checks: [
          {
            name: 'test',
            category: CheckCategory.TRANSPORT,
            grade: 'F',
            passed: false,
            severity: Severity.CRITICAL,
            message: 'Failed',
            details: {},
            metrics: {},
            durationMs: 0,
            timestamp: '',
          },
        ],
      });
      const output = formatMarkdownReport(report);
      expect(output).toContain('## Failures');
      expect(output).not.toContain('Remediation');
    });

    it('shows error section when present', () => {
      const report = createSampleReport({ error: 'Connection refused' });
      const output = formatMarkdownReport(report);
      expect(output).toContain('## Error');
      expect(output).toContain('Connection refused');
    });
  });

  describe('formatHtmlReport', () => {
    it('escapes HTML in content', () => {
      const report = createSampleReport({
        tools: [{ name: '<script>alert("xss")</script>', description: 'Test', inputSchema: {} }],
      });
      const output = formatHtmlReport(report);
      expect(output).not.toContain('<script>');
    });

    it('includes inline CSS styles', () => {
      const report = createSampleReport();
      const output = formatHtmlReport(report);
      expect(output).toContain('<style>');
    });

    it('shows remediation for failed checks', () => {
      const report = createSampleReport({
        checks: [
          {
            name: 'test',
            category: CheckCategory.TRANSPORT,
            grade: 'F',
            passed: false,
            severity: Severity.CRITICAL,
            message: 'Failed',
            details: {},
            metrics: {},
            remediation: 'Fix it',
            durationMs: 0,
            timestamp: '',
          },
        ],
      });
      const output = formatHtmlReport(report);
      expect(output).toContain('Fix it');
    });

    it('omits latency section when no samples', () => {
      const report = createSampleReport({
        latency: { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 },
      });
      const output = formatHtmlReport(report);
      expect(output).not.toContain('Latency');
    });

    it('omits tools section when no tools', () => {
      const report = createSampleReport({ tools: [] });
      const output = formatHtmlReport(report);
      expect(output).not.toContain('Tools');
    });

    it('shows error section when present', () => {
      const report = createSampleReport({ error: 'Connection refused' });
      const output = formatHtmlReport(report);
      expect(output).toContain('Connection refused');
    });
  });
});
