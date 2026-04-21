import { CheckResult, CheckCategory, Severity } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now } from '../../utils/index.js';
import { gradePayload } from '../../grading/index.js';
import { recordCheck } from '../../observability/metrics.js';

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;
const MIN_PAYLOAD_SIZE = 1024;

export class PayloadLimitsCheck {
  name = 'payload-limits';
  category = CheckCategory.PAYLOAD;
  severity = Severity.WARNING;

  async validate(client: MCPClient, _context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const details: Record<string, unknown> = {};

    try {
      const tools = await client.listTools();
      const testableTool = tools.find((t) => {
        const schema = t.inputSchema as Record<string, unknown>;
        const props = (schema.properties as Record<string, unknown>) || {};
        // Prefer tools with a string property that can accept large payloads
        const hasStringProp = Object.values(props).some((p) => {
          const prop = p as Record<string, unknown>;
          return prop.type === 'string';
        });
        return hasStringProp || Object.keys(props).length === 0;
      });

      if (!testableTool) {
        details.warning = 'No tools with empty schemas found for payload testing';
        details.maxPayloadBytes = 0;
        const grade = 'C';
        recordCheck(this.name, grade, Math.round(performance.now() - startTime));

        return {
          name: this.name,
          category: this.category,
          grade,
          passed: true,
          severity: this.severity,
          message: 'Could not test payload limits (no suitable tools)',
          details,
          metrics: { durationMs: Math.round(performance.now() - startTime) },
          remediation: 'Add a tool with optional string parameters for payload testing',
          durationMs: Math.round(performance.now() - startTime),
          timestamp: now(),
        };
      }

      let maxAccepted = MIN_PAYLOAD_SIZE;
      let minRejected = MAX_PAYLOAD_SIZE;

      let low = MIN_PAYLOAD_SIZE;
      let high = MAX_PAYLOAD_SIZE;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const largeArg = 'x'.repeat(mid);

        try {
          const schema = testableTool.inputSchema as Record<string, unknown>;
          const props = (schema.properties as Record<string, unknown>) || {};
          const stringProp = Object.entries(props).find(
            ([, p]) => (p as Record<string, unknown>).type === 'string',
          )?.[0];
          const args = stringProp ? { [stringProp]: largeArg } : {};
          await client.callTool(testableTool.name, args);
          maxAccepted = mid;
          low = mid + 1;
        } catch {
          minRejected = mid;
          high = mid - 1;
        }
      }

      details.maxPayloadBytes = maxAccepted;
      details.minRejectedBytes = minRejected;
      details.testedTool = testableTool.name;

      const grade = gradePayload(maxAccepted);

      recordCheck(this.name, grade, Math.round(performance.now() - startTime));

      return {
        name: this.name,
        category: this.category,
        grade,
        passed: grade !== 'F',
        severity: this.severity,
        message: `Max payload: ${formatBytes(maxAccepted)} (min rejected: ${formatBytes(minRejected)})`,
        details,
        metrics: { maxPayloadBytes: maxAccepted, minRejectedBytes: minRejected },
        remediation:
          grade === 'F'
            ? 'Increase server payload limits or implement chunked payload support'
            : 'Payload limits are acceptable',
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
        message: `Payload limits check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { durationMs },
        remediation: 'Ensure the server is accessible and tools are callable',
        durationMs,
        timestamp: now(),
      };
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
