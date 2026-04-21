import {
  DiagnosticReport,
  DiagnosticOptions,
  CheckResult,
  ToolLatencyMetrics,
} from '../types/domain.js';
import { MCPClient } from '../mcp-client/client.js';
import { DiagnosticContext } from '../types/domain.js';
import { TransportNegotiationCheck } from './checks/transport-negotiation.check.js';
import { ToolSchemaValidationCheck } from './checks/tool-schema-validation.check.js';
import { LatencyProfilingCheck } from './checks/latency-profiling.check.js';
import { AuthVerificationCheck } from './checks/auth-verification.check.js';
import { PayloadLimitsCheck } from './checks/payload-limits.check.js';
import { TimeoutBehaviorCheck } from './checks/timeout-behavior.check.js';
import { ErrorFormatCheck } from './checks/error-format.check.js';
import { ConcurrencyStressCheck } from './checks/concurrency-stress.check.js';
import { computeOverallGrade } from '../grading/grader.js';
import { generateUUID, now, calculateStats } from '../utils/index.js';
import { logger } from '../observability/logger.js';
import { recordCheck, recordGrade } from '../observability/metrics.js';
import { getProgramVersion } from '../version.js';

export class DiagnosticEngine {
  private checks = [
    new TransportNegotiationCheck(),
    new ToolSchemaValidationCheck(),
    new LatencyProfilingCheck(),
    new AuthVerificationCheck(),
    new PayloadLimitsCheck(),
    new TimeoutBehaviorCheck(),
    new ErrorFormatCheck(),
    new ConcurrencyStressCheck(),
  ];

  constructor(
    private client: MCPClient,
    private options: DiagnosticOptions,
    private endpoint: string,
  ) {}

  async run(): Promise<DiagnosticReport> {
    const startedAt = now();
    const startTime = performance.now();

    const context: DiagnosticContext = {
      endpoint: this.endpoint,
      options: this.options,
      requestId: generateUUID(),
      startTime: performance.now(),
    };

    const checkResults: CheckResult[] = [];
    const tools = await this.client.listTools();
    const serverInfo = this.client.getServerInfo?.() || {};

    for (const check of this.checks) {
      logger.info({ check: check.name }, 'Running check');
      const checkStartTime = performance.now();
      try {
        const result = await check.validate(this.client, context);
        checkResults.push(result);
        recordCheck(check.name, result.grade, result.durationMs);
        logger.info(
          { check: check.name, grade: result.grade, passed: result.passed },
          'Check complete',
        );
      } catch (error) {
        logger.error({ check: check.name, error }, 'Check failed');
        const durationMs = Math.round(performance.now() - checkStartTime);
        checkResults.push({
          name: check.name,
          category: check.category,
          grade: 'F',
          passed: false,
          severity: check.severity,
          message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
          details: { error: error instanceof Error ? error.message : String(error) },
          metrics: {},
          remediation: 'Check execution failed',
          durationMs,
          timestamp: now(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const latencyCheck = checkResults.find((c) => c.name === 'latency-profiling');
    const toolLatencies: ToolLatencyMetrics[] | undefined = Array.isArray(
      latencyCheck?.details?.toolLatencies,
    )
      ? (latencyCheck.details.toolLatencies as ToolLatencyMetrics[])
      : undefined;

    const rawLatencies: number[] | undefined = Array.isArray(latencyCheck?.details?.rawLatencies)
      ? (latencyCheck.details.rawLatencies as number[])
      : undefined;

    const allLatencies: number[] = rawLatencies || [];
    const overallLatency = calculateStats(allLatencies);

    const overallGrade = computeOverallGrade({
      checks: checkResults,
      latency: overallLatency,
    });

    recordGrade(overallGrade);

    const completedAt = now();
    const durationMs = Math.round(performance.now() - startTime);

    return {
      id: generateUUID(),
      endpoint: this.endpoint,
      startedAt,
      completedAt,
      durationMs,
      version: getProgramVersion(),
      transport: this.options.transport,
      authMode: this.options.auth,
      overallGrade,
      checks: checkResults,
      tools,
      latency: overallLatency,
      toolLatencies: toolLatencies || [],
      serverInfo,
    };
  }

  static createErrorReport(
    error: Error,
    endpoint: string,
    options: DiagnosticOptions,
    durationMs = 0,
  ): DiagnosticReport {
    const now_ = now();
    return {
      id: generateUUID(),
      endpoint,
      startedAt: now_,
      completedAt: now_,
      durationMs,
      version: getProgramVersion(),
      transport: options.transport,
      authMode: options.auth,
      overallGrade: 'F',
      checks: [],
      tools: [],
      latency: { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 },
      toolLatencies: [],
      error: error.message,
    };
  }
}
