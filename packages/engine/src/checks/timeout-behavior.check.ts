import type { MCPClient } from '@reaatech/mcp-server-doctor-client';
import type { CheckResult, DiagnosticContext } from '@reaatech/mcp-server-doctor-core';
import { CheckCategory, Severity, gradeCompliance, now } from '@reaatech/mcp-server-doctor-core';
import { recordCheck } from '@reaatech/mcp-server-doctor-observability';

export class TimeoutBehaviorCheck {
  name = 'timeout-behavior';
  category = CheckCategory.TIMEOUT;
  severity = Severity.CRITICAL;

  async validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const details: Record<string, unknown> = {};
    let warnings = 0;
    let passed = true;

    try {
      // 1. Baseline: normal ping should succeed
      await client.sendRequest('ping', {});
      details.baselinePing = true;

      // 2. Test short timeout behavior using a temporary client with an aggressive timeout
      const shortTimeoutMs = 1;
      let timeoutOccurred = false;
      let cleanupOk = false;
      let tempClientConnected = false;

      try {
        const { createDoctorClient } = await import('@reaatech/mcp-server-doctor-client');
        const tempClient = createDoctorClient(context.endpoint, {
          ...context.options,
          timeout: shortTimeoutMs,
        });
        await tempClient.connect();
        tempClientConnected = true;
        try {
          await tempClient.sendRequest('ping', {});
          // If this succeeds, the server is unexpectedly fast — not a failure, just note it
          details.shortTimeoutUnexpectedSuccess = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.toLowerCase().includes('timeout') ||
            msg.toLowerCase().includes('abort') ||
            msg.toLowerCase().includes('aborted')
          ) {
            timeoutOccurred = true;
            details.shortTimeoutTriggered = true;
          } else {
            details.shortTimeoutError = msg;
            warnings++;
          }
        }
        // 3. Verify connection cleanup after timeout: disconnect should not hang
        await tempClient.disconnect();
        cleanupOk = true;
        details.disconnectAfterTimeout = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        details.tempClientError = msg;
        // Only count as a warning if we couldn't even connect; failure to clean up after
        // a successful connection is more serious
        if (!tempClientConnected) {
          warnings++;
        }
      }

      if (!timeoutOccurred && !details.shortTimeoutUnexpectedSuccess) {
        warnings++;
        details.timeoutTestNote = 'Could not verify timeout behavior';
      }

      // Only fail if we connected, triggered a timeout, and then failed to clean up
      if (tempClientConnected && !cleanupOk) {
        passed = false;
        details.connectionLeakWarning = 'Connection may not clean up properly after timeout';
      }

      // 4. Verify original client is still healthy after timeout test
      await client.sendRequest('ping', {});
      details.postTimeoutPing = true;

      const grade = gradeCompliance(passed, warnings);
      recordCheck(this.name, grade, Math.round(performance.now() - startTime));

      return {
        name: this.name,
        category: this.category,
        grade,
        passed,
        severity: this.severity,
        message: passed
          ? 'Timeout behavior check passed — server handles timeouts and cleans up connections'
          : 'Timeout behavior issues detected',
        details,
        metrics: { durationMs: Math.round(performance.now() - startTime), warnings },
        remediation: passed
          ? 'Timeout handling and connection cleanup are working correctly'
          : 'Review server timeout configuration and connection cleanup logic',
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
        message: `Timeout behavior check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { durationMs },
        remediation: 'Check server timeout configuration and network stability',
        durationMs,
        timestamp: now(),
      };
    }
  }
}
