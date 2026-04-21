import { CheckResult, CheckCategory, Severity, LatencyMetrics } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now, measureTimeAsync, calculateStats } from '../../utils/index.js';
import { gradeLatency } from '../../grading/index.js';
import { logger } from '../../observability/logger.js';
import { recordCheck, recordLatency } from '../../observability/metrics.js';

const WARMUP_ROUNDS = 3;
const MEASUREMENT_ROUNDS = 20;

export class LatencyProfilingCheck {
  name = 'latency-profiling';
  category = CheckCategory.LATENCY;
  severity = Severity.CRITICAL;

  async validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const details: Record<string, unknown> = {};
    const toolLatencies: Array<{ toolName: string; latency: LatencyMetrics; samples: number[] }> =
      [];
    const allLatencies: number[] = [];

    try {
      const tools = await client.listTools();
      const testableTools = tools.filter((t) => {
        const schema = t.inputSchema as Record<string, unknown>;
        const props = (schema.properties as Record<string, unknown>) || {};
        const required = Array.isArray(schema.required) ? schema.required : [];
        return Object.keys(props).length === 0 || required.length === 0;
      });

      if (testableTools.length === 0) {
        details.warning = 'No tools with empty schemas found for latency testing';
        details.toolLatencies = [];
        details.overallLatency = { p50: 0, p90: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 };
        details.rawLatencies = [];
      } else {
        for (const tool of testableTools.slice(0, 3)) {
          const samples: number[] = [];

          for (let i = 0; i < WARMUP_ROUNDS + MEASUREMENT_ROUNDS; i++) {
            const { durationMs } = await measureTimeAsync(() => client.callTool(tool.name, {}));
            samples.push(durationMs);

            if (context.options.verbose) {
              logger.debug({ tool: tool.name, round: i, latency: durationMs }, 'Latency sample');
            }
          }

          const measurementSamples = samples.slice(WARMUP_ROUNDS);
          const stats = calculateStats(measurementSamples);
          toolLatencies.push({ toolName: tool.name, latency: stats, samples: measurementSamples });
          allLatencies.push(...measurementSamples);

          recordLatency(tool.name, stats.p99);
        }

        details.toolLatencies = toolLatencies.map((t) => ({
          toolName: t.toolName,
          latency: t.latency,
        }));
        details.rawLatencies = allLatencies;
      }

      const overallLatency = calculateStats(allLatencies);
      details.overallLatency = overallLatency;

      const worstP99 =
        toolLatencies.length > 0 ? Math.max(...toolLatencies.map((t) => t.latency.p99)) : 0;
      const grade = toolLatencies.length === 0 ? 'C' : gradeLatency(worstP99);

      recordCheck(this.name, grade, Math.round(performance.now() - startTime));

      return {
        name: this.name,
        category: this.category,
        grade,
        passed: grade !== 'F',
        severity: this.severity,
        message: `Latency p99: ${overallLatency.p99}ms across ${toolLatencies.length} tools`,
        details,
        metrics: { ...overallLatency, toolCount: toolLatencies.length },
        remediation:
          grade === 'F'
            ? 'Optimize tool handlers, add caching, or reduce computational complexity'
            : grade === 'D'
              ? 'Consider adding caching or optimizing hot paths'
              : 'Latency is within acceptable bounds',
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
        message: `Latency profiling failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { durationMs },
        remediation: 'Ensure tools are callable and the server is responsive',
        durationMs,
        timestamp: now(),
      };
    }
  }
}
