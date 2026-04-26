import { DiagnosticReport, Grade } from '../types/domain.js';

const GRADE_EMOJI: Record<Grade, string> = {
  A: '✅',
  B: '🟢',
  C: '🟡',
  D: '🟠',
  F: '❌',
};

const MAX_TOOLS_DISPLAY = 10;

export function escapeMd(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\n/g, ' ');
}

export function formatMarkdownReport(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push('# MCP Server Diagnostic Report');
  lines.push('');
  lines.push(`**Endpoint:** \`${report.endpoint}\``);
  lines.push(`**Time:** ${report.completedAt}`);
  lines.push(`**Duration:** ${report.durationMs}ms`);
  lines.push(`**Transport:** ${report.transport} | **Auth:** ${report.authMode}`);
  lines.push('');
  lines.push(`## Overall Grade: ${GRADE_EMOJI[report.overallGrade]} ${report.overallGrade}`);
  lines.push('');

  lines.push('## Checks');
  lines.push('');
  lines.push('| Check | Grade | Status | Message |');
  lines.push('|-------|-------|--------|---------|');
  for (const check of report.checks) {
    const status = check.passed ? 'Pass' : 'Fail';
    lines.push(
      `| ${escapeMd(check.name)} | ${GRADE_EMOJI[check.grade]} ${check.grade} | ${status} | ${escapeMd(check.message)} |`,
    );
  }
  lines.push('');

  if (report.latency.samples > 0) {
    lines.push('## Latency');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| p50 | ${report.latency.p50}ms |`);
    lines.push(`| p90 | ${report.latency.p90}ms |`);
    lines.push(`| p99 | ${report.latency.p99}ms |`);
    lines.push(`| min | ${report.latency.min}ms |`);
    lines.push(`| max | ${report.latency.max}ms |`);
    lines.push(`| mean | ${report.latency.mean}ms |`);
    lines.push(`| samples | ${report.latency.samples} |`);
    lines.push('');
  }

  if (report.tools.length > 0) {
    lines.push(`## Tools (${report.tools.length})`);
    lines.push('');
    lines.push('| Name | Description |');
    lines.push('|------|-------------|');
    const displayTools = report.tools.slice(0, MAX_TOOLS_DISPLAY);
    for (const tool of displayTools) {
      lines.push(
        `| ${escapeMd(tool.name)} | ${escapeMd(tool.description || '(no description)')} |`,
      );
    }
    if (report.tools.length > MAX_TOOLS_DISPLAY) {
      lines.push(`| *... and ${report.tools.length - MAX_TOOLS_DISPLAY} more* | |`);
    }
    lines.push('');
  }

  const failedChecks = report.checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const check of failedChecks) {
      lines.push(`### ${check.name}`);
      lines.push('');
      lines.push(`**Message:** ${check.message}`);
      if (check.remediation) {
        lines.push(`**Remediation:** ${check.remediation}`);
      }
      lines.push('');
    }
  }

  if (report.error) {
    lines.push('## Error');
    lines.push('');
    lines.push('```');
    lines.push(report.error);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
