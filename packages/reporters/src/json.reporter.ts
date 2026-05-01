import type { DiagnosticReport } from '@reaatech/mcp-server-doctor-core';

export function formatJsonReport(report: DiagnosticReport): string {
  return JSON.stringify(report, null, 2);
}
