import { DiagnosticReport } from '../types/domain.js';

export function formatJsonReport(report: DiagnosticReport): string {
  return JSON.stringify(report, null, 2);
}
