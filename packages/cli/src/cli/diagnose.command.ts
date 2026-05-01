import { createDoctorClient } from '@reaatech/mcp-server-doctor-client';
import type { DiagnosticOptions, DiagnosticReport } from '@reaatech/mcp-server-doctor-core';
import { DEFAULT_CONCURRENCY, DEFAULT_TIMEOUT_MS } from '@reaatech/mcp-server-doctor-core';
import { DiagnosticEngine } from '@reaatech/mcp-server-doctor-engine';
import { logger } from '@reaatech/mcp-server-doctor-observability';
import { formatReport } from '@reaatech/mcp-server-doctor-reporters';
import { resolveCredentials } from '../resolve-credentials.js';

export interface DiagnoseCommandOptions {
  transport: string;
  auth: string;
  apiKey?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  format: string;
  output?: string;
  verbose: boolean;
  timeout: string;
  concurrency: string;
}

import { writeFile } from 'node:fs/promises';

async function writeOutput(
  report: DiagnosticReport,
  format: 'console' | 'json' | 'markdown' | 'html',
  outputPath?: string,
): Promise<string> {
  const output = formatReport(report, format);
  if (outputPath) {
    await writeFile(outputPath, output);
  } else {
    process.stdout.write(output);
  }
  return output;
}

export async function runDiagnoseCommand(
  endpoint: string,
  cmdOpts: DiagnoseCommandOptions,
): Promise<void> {
  const startTime = Date.now();
  logger.info({ endpoint, transport: cmdOpts.transport, auth: cmdOpts.auth }, 'Starting diagnosis');

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
    verbose: cmdOpts.verbose,
  };

  const client = createDoctorClient(endpoint, options);
  const engine = new DiagnosticEngine(client, options, endpoint);

  try {
    await client.connect();
    const report = await engine.run();
    await writeOutput(
      report,
      cmdOpts.format as 'console' | 'json' | 'markdown' | 'html',
      cmdOpts.output,
    );

    if (report.overallGrade === 'F') {
      process.exitCode = 1;
      return;
    }
    if (report.overallGrade === 'D') {
      process.exitCode = 2;
      return;
    }
  } catch (error) {
    logger.error({ error }, 'Diagnosis failed');
    const err = error instanceof Error ? error : new Error(String(error));
    const errorReport = DiagnosticEngine.createErrorReport(
      err,
      endpoint,
      options,
      Date.now() - startTime,
    );
    await writeOutput(
      errorReport,
      cmdOpts.format as 'console' | 'json' | 'markdown' | 'html',
      cmdOpts.output,
    );
    process.exitCode = 3;
    return;
  } finally {
    await client.disconnect().catch(() => {});
  }
}
