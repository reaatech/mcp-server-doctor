import { DiagnosticEngine } from '../../doctor/engine.js';
import { formatReport } from '../../reporters/index.js';
import { createDoctorClient } from '../../mcp-client/client.js';
import { logger } from '../../observability/logger.js';
import { DiagnosticOptions, Grade } from '../../types/domain.js';
import { sleep } from '../../utils/index.js';
import { gradeToNumber } from '../../grading/index.js';
import { writeFile } from 'node:fs/promises';

export interface WatchCommandOptions {
  interval: string;
  alertThreshold: string;
  transport: string;
  auth: string;
  apiKey?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  format: string;
  output?: string;
  timeout: string;
  concurrency: string;
}

const VALID_GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F'];

let running = true;

process.on('SIGINT', () => {
  running = false;
});
process.on('SIGTERM', () => {
  running = false;
});

export async function runWatchCommand(
  endpoint: string,
  cmdOpts: WatchCommandOptions,
  signal?: AbortSignal,
): Promise<void> {
  const minIntervalMs = parseInt(process.env.DOCTOR_WATCH_MIN_INTERVAL_MS || '10000', 10);
  const intervalSec = parseFloat(cmdOpts.interval);
  const rawIntervalMs = isNaN(intervalSec) ? 60000 : intervalSec * 1000;
  const intervalMs = Math.max(rawIntervalMs, minIntervalMs);
  if (rawIntervalMs < minIntervalMs) {
    logger.warn(
      { requestedIntervalSec: intervalSec, minIntervalMs },
      'Watch interval clamped to minimum',
    );
  }
  const alertThreshold = cmdOpts.alertThreshold.toUpperCase() as Grade;
  const thresholdIndex = VALID_GRADES.includes(alertThreshold)
    ? gradeToNumber(alertThreshold)
    : gradeToNumber('C');

  if (!VALID_GRADES.includes(alertThreshold)) {
    logger.warn({ threshold: cmdOpts.alertThreshold }, 'Invalid alert threshold, defaulting to C');
  }

  const timeout = parseInt(cmdOpts.timeout, 10);
  const concurrency = parseInt(cmdOpts.concurrency, 10);

  const options: DiagnosticOptions = {
    transport: cmdOpts.transport as 'stdio' | 'sse' | 'http' | 'auto',
    auth: cmdOpts.auth as 'none' | 'api-key' | 'bearer' | 'oauth',
    apiKey: cmdOpts.apiKey,
    bearerToken: cmdOpts.bearerToken,
    oauthClientId: cmdOpts.oauthClientId,
    oauthClientSecret: cmdOpts.oauthClientSecret,
    timeout: isNaN(timeout) ? 30000 : timeout,
    concurrency: isNaN(concurrency) ? 10 : concurrency,
    verbose: false,
  };

  logger.info({ endpoint, intervalMs: intervalMs / 1000, alertThreshold }, 'Starting watch mode');

  while (running && !signal?.aborted) {
    const client = createDoctorClient(endpoint, options);
    const engine = new DiagnosticEngine(client, options, endpoint);

    try {
      await client.connect();
      const report = await engine.run();
      const output = formatReport(
        report,
        cmdOpts.format as 'console' | 'json' | 'markdown' | 'html',
      );
      if (cmdOpts.output) {
        await writeFile(cmdOpts.output, output);
      } else {
        process.stdout.write(output);
        process.stdout.write('\n');
      }

      const gradeIndex = gradeToNumber(report.overallGrade);
      if (gradeIndex < thresholdIndex) {
        logger.warn({ grade: report.overallGrade }, 'Alert: grade below threshold');
        process.stdout.write(
          `⚠️  ALERT: Grade ${report.overallGrade} is below threshold ${alertThreshold}\n`,
        );
      }
    } catch (error) {
      logger.error({ error }, 'Watch cycle failed');
      process.stdout.write(
        `❌ Watch cycle failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    } finally {
      await client.disconnect().catch(() => {});
    }

    if (running && !signal?.aborted) {
      await sleep(intervalMs);
    }
  }

  logger.info({}, 'Watch mode stopped');
}
