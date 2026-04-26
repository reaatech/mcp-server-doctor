import { DiagnosticReport, Grade } from '../types/domain.js';
import chalk from 'chalk';

const GRADE_COLORS: Record<Grade, (s: string) => string> = {
  A: chalk.green,
  B: chalk.blue,
  C: chalk.yellow,
  D: chalk.yellowBright,
  F: chalk.red,
};

const GRADE_ICONS: Record<Grade, string> = {
  A: '✅',
  B: '🟢',
  C: '🟡',
  D: '🟠',
  F: '❌',
};

const WARNING_KEYS = ['warning', 'sessionIdWarning', 'pingWarning', 'serverInfoWarning'];

export function formatConsoleReport(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.underline('MCP Server Diagnostic Report'));
  lines.push('');
  lines.push(chalk.dim(`Endpoint: ${report.endpoint}`));
  lines.push(chalk.dim(`Time: ${report.completedAt}`));
  lines.push(chalk.dim(`Duration: ${report.durationMs}ms`));
  lines.push(chalk.dim(`Transport: ${report.transport} | Auth: ${report.authMode}`));
  lines.push('');

  lines.push(
    chalk.bold(
      `Overall Grade: ${GRADE_ICONS[report.overallGrade]} ${GRADE_COLORS[report.overallGrade](report.overallGrade)}`,
    ),
  );
  lines.push('');

  lines.push(chalk.bold('── Checks ──'));
  for (const check of report.checks) {
    const icon = GRADE_ICONS[check.grade];
    const grade = GRADE_COLORS[check.grade](check.grade);
    const name = chalk.bold(check.name);
    const message = chalk.dim(check.message);
    lines.push(`  ${icon} ${grade} ${name} — ${message}`);

    if (!check.passed || Object.keys(check.details).length > 0) {
      for (const key of WARNING_KEYS) {
        if (check.details[key]) {
          lines.push(chalk.yellow(`     ⚠️  ${String(check.details[key])}`));
        }
      }
    }
  }
  lines.push('');

  if (report.latency.samples > 0) {
    lines.push(chalk.bold('── Latency ──'));
    lines.push(
      `  p50: ${chalk.cyan(report.latency.p50 + 'ms')}  p90: ${chalk.cyan(report.latency.p90 + 'ms')}  p99: ${chalk.cyan(report.latency.p99 + 'ms')}`,
    );
    lines.push(
      `  min: ${chalk.gray(report.latency.min + 'ms')}  max: ${chalk.gray(report.latency.max + 'ms')}  mean: ${chalk.gray(report.latency.mean + 'ms')}`,
    );
    lines.push(`  samples: ${chalk.dim(report.latency.samples)}`);
    lines.push('');
  }

  if (report.tools.length > 0) {
    lines.push(chalk.bold(`── Tools (${report.tools.length}) ──`));
    for (const tool of report.tools.slice(0, 10)) {
      lines.push(
        `  • ${chalk.white(tool.name)} — ${chalk.dim(tool.description || '(no description)')}`,
      );
    }
    if (report.tools.length > 10) {
      lines.push(chalk.dim(`  ... and ${report.tools.length - 10} more`));
    }
    lines.push('');
  }

  const failedChecks = report.checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    lines.push(chalk.bold.red('── Failures ──'));
    for (const check of failedChecks) {
      lines.push(chalk.red(`  ✗ ${check.name}: ${check.message}`));
      if (check.remediation) {
        lines.push(chalk.yellow(`    → ${check.remediation}`));
      }
    }
    lines.push('');
  }

  if (report.error) {
    lines.push(chalk.bold.red('── Error ──'));
    lines.push(chalk.red(`  ${report.error}`));
    lines.push('');
  }

  return lines.join('\n');
}
