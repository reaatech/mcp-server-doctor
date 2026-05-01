import { z } from 'zod';
import { CheckCategory, Severity } from './domain.js';

export const CheckResultSchema = z.object({
  name: z.string(),
  category: z.nativeEnum(CheckCategory),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  passed: z.boolean(),
  severity: z.nativeEnum(Severity),
  message: z.string(),
  details: z.record(z.unknown()),
  metrics: z.record(z.number()),
  remediation: z.string(),
  durationMs: z.number(),
  timestamp: z.string(),
  error: z.string().optional(),
});

export const LatencyMetricsSchema = z.object({
  p50: z.number(),
  p90: z.number(),
  p99: z.number(),
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  samples: z.number(),
});

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
});

export const ToolLatencyMetricsSchema = z.object({
  toolName: z.string(),
  latency: LatencyMetricsSchema,
  warmStartLatency: z.number().optional(),
  coldStartLatency: z.number().optional(),
});

export const DiagnosticReportSchema = z.object({
  id: z.string().uuid(),
  endpoint: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  version: z.string(),
  transport: z.enum(['stdio', 'sse', 'http', 'auto']),
  authMode: z.enum(['none', 'api-key', 'bearer', 'oauth']),
  overallGrade: z.enum(['A', 'B', 'C', 'D', 'F']),
  checks: z.array(CheckResultSchema),
  tools: z.array(ToolDefinitionSchema),
  latency: LatencyMetricsSchema,
  toolLatencies: z.array(ToolLatencyMetricsSchema),
  serverInfo: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
      capabilities: z.record(z.unknown()).optional(),
    })
    .optional(),
  error: z.string().optional(),
  comparison: z
    .object({
      baselineId: z.string(),
      gradeChange: z.enum(['improved', 'regressed', 'unchanged']),
      latencyChange: z.number(),
      toolCountChange: z.number(),
      checkChanges: z.array(
        z.object({
          name: z.string(),
          gradeChange: z.enum(['improved', 'regressed', 'unchanged']),
          note: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

export const DiagnosticOptionsSchema = z.object({
  transport: z.enum(['stdio', 'sse', 'http', 'auto']),
  auth: z.enum(['none', 'api-key', 'bearer', 'oauth']),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  timeout: z.number().positive(),
  concurrency: z.number().int().positive(),
  verbose: z.boolean(),
});
