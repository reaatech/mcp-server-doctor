import { writeFile } from 'node:fs/promises';
import { createDoctorClient } from '@reaatech/mcp-server-doctor-client';
import type { DiagnosticOptions, Grade } from '@reaatech/mcp-server-doctor-core';
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_TIMEOUT_MS,
  WATCH_MIN_INTERVAL_MS,
  gradeToNumber,
  sleep,
} from '@reaatech/mcp-server-doctor-core';
import { DiagnosticEngine } from '@reaatech/mcp-server-doctor-engine';
import { logger } from '@reaatech/mcp-server-doctor-observability';
import { formatReport } from '@reaatech/mcp-server-doctor-reporters';
import { resolveCredentials } from '../resolve-credentials.js';

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
  const intervalSec = Number.parseFloat(cmdOpts.interval);
  const rawIntervalMs = Number.isNaN(intervalSec) ? 60000 : intervalSec * 1000;
  const intervalMs = Math.max(rawIntervalMs, WATCH_MIN_INTERVAL_MS);
  if (rawIntervalMs < WATCH_MIN_INTERVAL_MS) {
    logger.warn(
      {
        requestedIntervalSec: intervalSec,
        minIntervalMs: WATCH_MIN_INTERVAL_MS,
      },
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

  const creds = resolveCredentials(cmdOpts);
  const timeout = Number.parseInt(cmdOpts.timeout, 10);
  const concurrency = Number.parseInt(cmdOpts.concurrency, 10);

  const options: DiagnosticOptions = {
    transport: cmdOpts.transport as 'stdio' | 'sse' | 'http' | 'auto',
    auth: cmdOpts.auth as 'none' | 'api-key' | 'bearer' | 'oauth',
    apiKey: creds.apiKey,
    bearerToken: creds.bearerToken,
    oauthClientId: creds.oauthClientId,
    oauthClientSecret: creds.oauthClientSecret,
    timeout: Number.isNaN(timeout) ? DEFAULT_TIMEOUT_MS : timeout,
    concurrency: Number.isNaN(concurrency) ? DEFAULT_CONCURRENCY : concurrency,
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
