import { CheckResult, CheckCategory, Severity } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now, measureTimeAsync } from '../../utils/index.js';
import { gradeCompliance } from '../../grading/index.js';
import { logger } from '../../observability/logger.js';
import { recordCheck } from '../../observability/metrics.js';

export class TransportNegotiationCheck {
  name = 'transport-negotiation';
  category = CheckCategory.TRANSPORT;
  severity = Severity.CRITICAL;

  async validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    let passed = true;
    let warnings = 0;
    const details: Record<string, unknown> = {};

    try {
      const sessionInfo = {
        sessionId: client.getSessionId(),
        transportType: context.options.transport,
        endpoint: context.endpoint,
      };

      const isStdio =
        context.options.transport === 'stdio' ||
        (context.options.transport === 'auto' && !context.endpoint.startsWith('http'));
      if (!sessionInfo.sessionId && !isStdio) {
        warnings++;
        details.sessionIdWarning = 'No session ID established';
      }

      const pingResult = await measureTimeAsync(() => client.sendRequest('ping', {}));
      details.pingLatencyMs = pingResult.durationMs;

      if (pingResult.durationMs > 5000) {
        warnings++;
        details.pingWarning = 'Ping took > 5s';
      }

      const serverInfo = client.getServerInfo?.() || {};
      details.serverInfo = serverInfo;

      if (!serverInfo.serverInfo && !serverInfo.capabilities) {
        warnings++;
        details.serverInfoWarning = 'Server info missing or incomplete';
      }
    } catch (error) {
      passed = false;
      details.error = error instanceof Error ? error.message : String(error);
      logger.error({ error }, 'Transport negotiation failed');
    }

    const durationMs = Math.round(performance.now() - startTime);
    const grade = passed ? gradeCompliance(true, warnings) : 'F';

    recordCheck(this.name, grade, durationMs);

    return {
      name: this.name,
      category: this.category,
      grade,
      passed,
      severity: this.severity,
      message: passed
        ? `Transport negotiation successful via ${context.options.transport}`
        : `Transport negotiation failed: ${details.error}`,
      details,
      metrics: { durationMs, warnings },
      remediation: passed
        ? 'Transport is healthy'
        : 'Verify endpoint URL, network connectivity, and server status',
      durationMs,
      timestamp: now(),
    };
  }
}
