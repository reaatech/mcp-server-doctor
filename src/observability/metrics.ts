import { MeterProvider, PeriodicExportingMetricReader, type PushMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import type { Meter, MeterProvider as MeterProviderType } from '@opentelemetry/api';

let meterProvider: MeterProviderType | undefined;
let meter: Meter | undefined;

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  meterProvider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter() as unknown as PushMetricExporter,
        exportIntervalMillis: 60000,
      }),
    ],
  });
  meter = meterProvider.getMeter('mcp-server-doctor');
}

const checkCounter = meter?.createCounter('doctor_checks_total', {
  description: 'Total number of diagnostic checks executed',
});

const checkDuration = meter?.createHistogram('doctor_check_duration_ms', {
  description: 'Duration of diagnostic checks in milliseconds',
});

const latencyHistogram = meter?.createHistogram('doctor_latency_ms', {
  description: 'Latency measurements in milliseconds',
});

const gradeGauge = meter?.createGauge('doctor_grade', {
  description: 'Overall grade as numeric (A=4, B=3, C=2, D=1, F=0)',
});

const GRADE_MAP: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function recordCheck(name: string, grade: string, durationMs: number): void {
  checkCounter?.add(1, { check: name, grade });
  checkDuration?.record(durationMs, { check: name });
}

export function recordLatency(toolName: string, latencyMs: number): void {
  latencyHistogram?.record(latencyMs, { tool: toolName });
}

export function recordGrade(grade: string): void {
  gradeGauge?.record(GRADE_MAP[grade] || 0, { grade });
}

export function getMetricsSummary(): Record<string, unknown> {
  return {
    meterProvider: !!meterProvider,
  };
}
