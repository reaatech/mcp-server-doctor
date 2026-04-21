import { DiagnosticEngine } from '../../doctor/engine.js';
import { formatReport } from '../../reporters/index.js';
import { createDoctorClient } from '../../mcp-client/client.js';
import { logger } from '../../observability/logger.js';
import { DiagnosticOptions, DiagnosticReport } from '../../types/domain.js';

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
    } else if (report.overallGrade === 'D') {
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
