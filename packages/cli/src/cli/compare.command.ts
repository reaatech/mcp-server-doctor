import { readFile, writeFile } from 'node:fs/promises';
import type { DiagnosticReport } from '@reaatech/mcp-server-doctor-core';
import { DiagnosticReportSchema, gradeToNumber } from '@reaatech/mcp-server-doctor-core';
import { logger } from '@reaatech/mcp-server-doctor-observability';
import { formatReport } from '@reaatech/mcp-server-doctor-reporters';

export interface CompareCommandOptions {
  format: string;
  output?: string;
}

async function readAndParseReport(path: string): Promise<DiagnosticReport> {
  let data: string;
  try {
    data = await readFile(path, 'utf-8');
  } catch (error) {
    logger.error({ error, path }, 'Failed to read report');
    process.stderr.write(
      `Error reading report: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(3);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (error) {
    logger.error({ error }, 'Failed to parse JSON');
    process.stderr.write(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(3);
  }

  const result = DiagnosticReportSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ errors: result.error }, 'Report validation failed');
    process.stderr.write('Report failed schema validation\n');
    process.exit(3);
  }

  return result.data;
}

export async function runCompareCommand(
  baselinePath: string,
  currentPath: string,
  cmdOpts: CompareCommandOptions,
): Promise<void> {
  logger.info({ baselinePath, currentPath }, 'Comparing reports');

  const baselineReport = await readAndParseReport(baselinePath);
  // Defensive: in test environments process.exit may be mocked and not actually exit
  if (!baselineReport) return;

  const currentReport = await readAndParseReport(currentPath);
  if (!currentReport) return;

  if (baselineReport.endpoint !== currentReport.endpoint) {
    logger.warn(
      { baselineEndpoint: baselineReport.endpoint, currentEndpoint: currentReport.endpoint },
      'Endpoints differ',
    );
  }

  const baselineGradeNum = gradeToNumber(baselineReport.overallGrade);
  const currentGradeNum = gradeToNumber(currentReport.overallGrade);
  const gradeChange =
    currentGradeNum > baselineGradeNum
      ? ('improved' as const)
      : currentGradeNum < baselineGradeNum
        ? ('regressed' as const)
        : ('unchanged' as const);

  const checkByName = new Map(baselineReport.checks.map((c) => [c.name, c]));
  const checkChanges = currentReport.checks.map((check) => {
    const baselineCheck = checkByName.get(check.name);
    if (!baselineCheck) {
      const newGradeNum = gradeToNumber(check.grade);
      const isImproved = newGradeNum >= gradeToNumber('C');
      return {
        name: check.name,
        gradeChange: isImproved ? ('improved' as const) : ('regressed' as const),
        note: 'new check',
      };
    }
    const baselineNum = gradeToNumber(baselineCheck.grade);
    const currentNum = gradeToNumber(check.grade);
    const change =
      currentNum > baselineNum
        ? ('improved' as const)
        : currentNum < baselineNum
          ? ('regressed' as const)
          : ('unchanged' as const);
    return { name: check.name, gradeChange: change };
  });

  const comparison = {
    ...currentReport,
    comparison: {
      baselineId: baselineReport.id,
      gradeChange,
      latencyChange: currentReport.latency.p99 - baselineReport.latency.p99,
      toolCountChange: currentReport.tools.length - baselineReport.tools.length,
      checkChanges,
    },
  };

  const output = formatReport(
    comparison,
    cmdOpts.format as 'console' | 'json' | 'markdown' | 'html',
  );
  if (cmdOpts.output) {
    await writeFile(cmdOpts.output, output);
  } else {
    process.stdout.write(output);
  }

  if (gradeChange === 'regressed') {
    process.exit(1);
  }
}
