import type { MCPClient } from '@reaatech/mcp-server-doctor-client';
import { TransportError } from '@reaatech/mcp-server-doctor-client';
import type { CheckResult, DiagnosticContext } from '@reaatech/mcp-server-doctor-core';
import { CheckCategory, Severity, gradeCompliance, now } from '@reaatech/mcp-server-doctor-core';
import { recordCheck } from '@reaatech/mcp-server-doctor-observability';

interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export class ErrorFormatCheck {
  name = 'error-format';
  category = CheckCategory.ERROR_FORMAT;
  severity = Severity.WARNING;

  async validate(client: MCPClient, _context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const details: Record<string, unknown> = {};
    let warnings = 0;
    let passed = true;

    try {
      const errorSamples: Array<{
        method: string;
        response: unknown;
        valid: boolean;
        issues: string[];
      }> = [];

      try {
        const result = await client.sendRequest('nonexistent_method_xyz', {});
        errorSamples.push({
          method: 'nonexistent_method_xyz',
          response: result,
          valid: false,
          issues: ['Expected error but got success'],
        });
        warnings++;
      } catch (error) {
        const errorData = extractError(error);
        const issues = validateErrorFormat(errorData);
        errorSamples.push({
          method: 'nonexistent_method_xyz',
          response: errorData,
          valid: issues.length === 0,
          issues,
        });
        if (issues.length > 0) warnings += issues.length;
      }

      try {
        const result = await client.callTool('nonexistent_tool_xyz', {});
        errorSamples.push({
          method: 'tools/call (invalid tool)',
          response: result,
          valid: false,
          issues: ['Expected error but got success'],
        });
        warnings++;
        passed = false;
      } catch (error) {
        const errorData = extractError(error);
        const issues = validateErrorFormat(errorData);
        errorSamples.push({
          method: 'tools/call (invalid tool)',
          response: errorData,
          valid: issues.length === 0,
          issues,
        });
        if (issues.length > 0) {
          warnings += issues.length;
          passed = false;
        }
      }

      details.errorSamples = errorSamples;
      details.totalSamples = errorSamples.length;
      details.validSamples = errorSamples.filter((s) => s.valid).length;

      const grade = gradeCompliance(passed, warnings);
      recordCheck(this.name, grade, Math.round(performance.now() - startTime));

      return {
        name: this.name,
        category: this.category,
        grade,
        passed,
        severity: this.severity,
        message: `Error format validation: ${details.validSamples}/${details.totalSamples} compliant`,
        details,
        metrics: { durationMs: Math.round(performance.now() - startTime), warnings },
        remediation:
          warnings > 0
            ? 'Ensure all error responses follow JSON-RPC 2.0 spec with code, message, and optional data fields'
            : 'Error format is fully compliant',
        durationMs: Math.round(performance.now() - startTime),
        timestamp: now(),
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      recordCheck(this.name, 'F', durationMs);

      return {
        name: this.name,
        category: this.category,
        grade: 'F',
        passed: false,
        severity: this.severity,
        message: `Error format check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { durationMs },
        remediation: 'Ensure the server is accessible',
        durationMs,
        timestamp: now(),
      };
    }
  }
}

function extractError(error: unknown): JSONRPCError | null {
  if (error instanceof TransportError) {
    if (typeof error.rpcCode === 'number') {
      return { code: error.rpcCode, message: error.message, data: error.rpcData };
    }
  }
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        ('code' in parsed || 'message' in parsed)
      ) {
        return parsed as JSONRPCError;
      }
    } catch {
      // Not JSON — fall through to default
    }
    return { code: -1, message: error.message };
  }
  return error as JSONRPCError | null;
}

function validateErrorFormat(error: JSONRPCError | null): string[] {
  const issues: string[] = [];
  if (!error) {
    issues.push('No error data available');
    return issues;
  }
  if (typeof error.code !== 'number') {
    issues.push('Missing or invalid error code');
  } else {
    // JSON-RPC 2.0 reserves -32768 to -32000 for pre-defined errors.
    // Application-defined errors may use codes outside this range.
    // We only flag codes that are clearly non-standard (non-negative).
    if (error.code >= 0) {
      issues.push(`Error code ${error.code} should be negative per JSON-RPC 2.0 convention`);
    }
  }
  if (typeof error.message !== 'string') {
    issues.push('Missing or invalid error message');
  }
  return issues;
}
