import type { DiagnosticReport } from '@reaatech/mcp-server-doctor-core';
import { formatConsoleReport } from './console.reporter.js';
import { formatHtmlReport } from './html.reporter.js';
import { formatJsonReport } from './json.reporter.js';
import { formatMarkdownReport } from './markdown.reporter.js';

export function formatReport(
  report: DiagnosticReport,
  format: 'console' | 'json' | 'markdown' | 'html',
): string {
  switch (format) {
    case 'console':
      return formatConsoleReport(report);
    case 'json':
      return formatJsonReport(report);
    case 'markdown':
      return formatMarkdownReport(report);
    case 'html':
      return formatHtmlReport(report);
    default:
      return formatConsoleReport(report);
  }
}

export { formatConsoleReport } from './console.reporter.js';
export { formatJsonReport } from './json.reporter.js';
export { formatMarkdownReport } from './markdown.reporter.js';
export { formatHtmlReport } from './html.reporter.js';
