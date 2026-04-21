import { CheckResult, CheckCategory, Severity } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now } from '../../utils/index.js';
import { gradeCompliance } from '../../grading/index.js';
import { recordCheck } from '../../observability/metrics.js';

export class AuthVerificationCheck {
  name = 'auth-verification';
  category = CheckCategory.AUTH;
  severity = Severity.CRITICAL;

  async validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const details: Record<string, unknown> = {};
    const authResults: Array<{ mode: string; success: boolean; error?: string }> = [];
    let warnings = 0;

    const requestedAuth = context.options.auth;

    try {
      // Test the configured auth mode
      try {
        await client.sendRequest('ping', {});
        authResults.push({ mode: requestedAuth, success: true });
      } catch (error) {
        authResults.push({
          mode: requestedAuth,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        warnings++;
      }

      // If auth is configured, verify that unauthenticated requests are rejected
      if (requestedAuth !== 'none') {
        try {
          // Attempt a request that should fail without auth by stripping credentials.
          // We can only do this for transports that expose headers (HTTP/SSE).
          const strippedClient = await this.tryNoAuthRequest(context);
          if (strippedClient) {
            try {
              await strippedClient.sendRequest('ping', {});
              // Server incorrectly accepted an unauthenticated request — this is a failure
              authResults.push({
                mode: 'none',
                success: false,
                error: 'Server accepted unauthenticated request',
              });
              warnings++;
              details.unauthenticatedAccepted = true;
            } catch (error) {
              // Server correctly rejected the unauthenticated request — this is expected
              authResults.push({
                mode: 'none',
                success: true,
                error: error instanceof Error ? error.message : String(error),
              });
              details.unauthenticatedRejected = true;
            } finally {
              await strippedClient.disconnect().catch(() => {});
            }
          } else {
            details.note =
              'Auth rejection test not supported for stdio transport; manual verification recommended';
          }
        } catch {
          // Ignore
        }
      }

      details.authResults = authResults;
      details.requestedAuth = requestedAuth;

      const allPassed = authResults.every((r) => r.success);
      const grade = allPassed ? gradeCompliance(true, warnings) : 'F';

      recordCheck(this.name, grade, Math.round(performance.now() - startTime));

      return {
        name: this.name,
        category: this.category,
        grade,
        passed: allPassed,
        severity: this.severity,
        message: allPassed
          ? `Auth verification passed for mode: ${requestedAuth}`
          : `Auth verification failed for mode: ${requestedAuth}`,
        details,
        metrics: { durationMs: Math.round(performance.now() - startTime), warnings },
        remediation: allPassed
          ? 'Authentication is working correctly'
          : 'Verify credentials, check server auth configuration, ensure tokens are not expired',
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
        message: `Auth verification failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { durationMs },
        remediation: 'Check network connectivity and server status',
        durationMs,
        timestamp: now(),
      };
    }
  }

  private async tryNoAuthRequest(context: DiagnosticContext): Promise<MCPClient | null> {
    // Only HTTP and SSE transports support header-based auth stripping
    if (context.options.transport === 'stdio') {
      return null;
    }

    const { createDoctorClient } = await import('../../mcp-client/client.js');
    const noAuthOptions = {
      ...context.options,
      auth: 'none' as const,
      apiKey: undefined,
      bearerToken: undefined,
      oauthClientId: undefined,
      oauthClientSecret: undefined,
    };
    const client = createDoctorClient(context.endpoint, noAuthOptions);
    await client.connect();
    return client;
  }
}
