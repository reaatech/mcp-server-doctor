import { CheckResult, CheckCategory, Severity } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now, calculateStats } from '../../utils/index.js';
import { gradeConcurrency, gradeErrorRate, worstGrade } from '../../grading/index.js';
import { recordCheck } from '../../observability/metrics.js';

export class ConcurrencyStressCheck {
  name = 'concurrency-stress';
  category = CheckCategory.CONCURRENCY;
  severity = Severity.WARNING;

  async validate(client: MCPClient, _context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    const details: Record<string, unknown> = {};

    try {
      const tools = await client.listTools();
      const testableTool = tools.find((t) => {
        const schema = t.inputSchema as Record<string, unknown>;
        const props = (schema.properties as Record<string, unknown>) || {};
        const required = Array.isArray(schema.required) ? schema.required : [];
        return Object.keys(props).length === 0 || required.length === 0;
      });

      if (!testableTool) {
        details.warning = 'No tools with empty schemas found for concurrency testing';
        recordCheck(this.name, 'C', Math.round(performance.now() - startTime));

        return {
          name: this.name,
          category: this.category,
          grade: 'C',
          passed: true,
          severity: this.severity,
          message: 'Could not test concurrency (no suitable tools)',
          details,
          metrics: { durationMs: Math.round(performance.now() - startTime) },
          remediation: 'Add a tool with no required parameters for concurrency testing',
          durationMs: Math.round(performance.now() - startTime),
          timestamp: now(),
        };
      }

      const concurrencyLevels = [5, 10, 25, 50];
      const results: Array<{
        level: number;
        successRate: number;
        avgLatency: number;
        errorRate: number;
      }> = [];

      for (const level of concurrencyLevels) {
        const promises: Promise<unknown>[] = [];
        const latencies: number[] = [];
        let successes = 0;
        let errors = 0;

        for (let i = 0; i < level; i++) {
          const start = performance.now();
          const promise = client.callTool(testableTool.name, {}).then(
            () => {
              successes++;
              latencies.push(performance.now() - start);
            },
            () => {
              errors++;
              latencies.push(performance.now() - start);
            },
          );
          promises.push(promise);
        }

        await Promise.allSettled(promises);

        const stats = calculateStats(latencies);
        const successRate = successes / level;
        const errorRate = errors / level;

        results.push({
          level,
          successRate,
          avgLatency: stats.mean,
          errorRate,
        });
      }

      details.concurrencyResults = results;

      const maxConcurrent = results.filter((r) => r.successRate >= 0.95).at(-1)?.level || 0;
      const maxErrorRate = Math.max(...results.map((r) => r.errorRate));

      const concurrencyGrade = gradeConcurrency(maxConcurrent);
      const errorGrade = gradeErrorRate(maxErrorRate);

      const grade = worstGrade(concurrencyGrade, errorGrade);

      recordCheck(this.name, grade, Math.round(performance.now() - startTime));

      return {
        name: this.name,
        category: this.category,
        grade,
        passed: grade !== 'F',
        severity: this.severity,
        message: `Max concurrent requests: ${maxConcurrent} (error rate: ${(maxErrorRate * 100).toFixed(1)}%)`,
        details,
        metrics: {
          maxConcurrency: maxConcurrent,
          maxErrorRate,
          durationMs: Math.round(performance.now() - startTime),
        },
        remediation:
          grade === 'F'
            ? 'Server cannot handle concurrent requests — add connection pooling, rate limiting, or horizontal scaling'
            : grade === 'D'
              ? 'Consider adding connection pooling or increasing server capacity'
              : 'Concurrency handling is acceptable',
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
        message: `Concurrency stress check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { durationMs },
        remediation: 'Ensure the server is accessible and tools are callable',
        durationMs,
        timestamp: now(),
      };
    }
  }
}
