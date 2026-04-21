import { DiagnosticReport, Grade } from '../types/domain.js';

const GRADE_COLORS: Record<Grade, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

export function formatHtmlReport(report: DiagnosticReport): string {
  const checksHtml = report.checks
    .map(
      (c) => `
      <div class="check ${c.passed ? 'pass' : 'fail'}">
        <span class="grade" style="background:${GRADE_COLORS[c.grade]}">${c.grade}</span>
        <span class="name">${c.name}</span>
        <span class="message">${escapeHtml(c.message)}</span>
        ${!c.passed ? `<span class="remediation">→ ${escapeHtml(c.remediation)}</span>` : ''}
      </div>`,
    )
    .join('\n');

  const latencyHtml =
    report.latency.samples > 0
      ? `
      <div class="section">
        <h3>Latency</h3>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>p50</td><td>${report.latency.p50}ms</td></tr>
          <tr><td>p90</td><td>${report.latency.p90}ms</td></tr>
          <tr><td>p99</td><td>${report.latency.p99}ms</td></tr>
          <tr><td>min</td><td>${report.latency.min}ms</td></tr>
          <tr><td>max</td><td>${report.latency.max}ms</td></tr>
          <tr><td>mean</td><td>${report.latency.mean}ms</td></tr>
          <tr><td>samples</td><td>${report.latency.samples}</td></tr>
        </table>
      </div>`
      : '';

  const toolsHtml =
    report.tools.length > 0
      ? `
      <div class="section">
        <h3>Tools (${report.tools.length})</h3>
        <table>
          <tr><th>Name</th><th>Description</th></tr>
          ${report.tools
            .map(
              (t) =>
                `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.description || '')}</td></tr>`,
            )
            .join('\n')}
        </table>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCP Server Diagnostic Report</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; line-height: 1.6; }
    h1 { margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .overall { font-size: 48px; font-weight: bold; margin: 20px 0; }
    .section { margin: 24px 0; }
    .section h3 { margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .check { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eee; }
    .check.fail { background: #fef2f2; padding: 8px; border-radius: 4px; }
    .grade { display: inline-block; width: 36px; height: 36px; line-height: 36px; text-align: center; border-radius: 6px; color: white; font-weight: bold; font-size: 18px; }
    .name { font-weight: 600; min-width: 200px; }
    .message { color: #555; flex: 1; }
    .remediation { color: #d97706; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #555; }
    .error { background: #fef2f2; border: 1px solid #ef4444; padding: 16px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>MCP Server Diagnostic Report</h1>
  <div class="meta">
    <strong>Endpoint:</strong> ${escapeHtml(report.endpoint)}<br>
    <strong>Time:</strong> ${escapeHtml(report.completedAt)}<br>
    <strong>Duration:</strong> ${report.durationMs}ms<br>
    <strong>Transport:</strong> ${escapeHtml(report.transport)} | <strong>Auth:</strong> ${escapeHtml(report.authMode)}
  </div>

  <div class="overall" style="color:${GRADE_COLORS[report.overallGrade]}">
    Overall Grade: ${report.overallGrade}
  </div>

  <div class="section">
    <h3>Checks</h3>
    ${checksHtml}
  </div>

  ${latencyHtml}
  ${toolsHtml}

  ${report.error ? `<div class="error"><strong>Error:</strong> ${escapeHtml(report.error)}</div>` : ''}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
