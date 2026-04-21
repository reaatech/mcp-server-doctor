export enum CheckCategory {
  TRANSPORT = 'transport',
  SCHEMA = 'schema',
  LATENCY = 'latency',
  AUTH = 'auth',
  PAYLOAD = 'payload',
  TIMEOUT = 'timeout',
  ERROR_FORMAT = 'error_format',
  CONCURRENCY = 'concurrency',
}

export enum Severity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export type TransportType = 'stdio' | 'sse' | 'http' | 'auto';
export type AuthMode = 'none' | 'api-key' | 'bearer' | 'oauth';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CheckResult {
  name: string;
  category: CheckCategory;
  grade: Grade;
  passed: boolean;
  severity: Severity;
  message: string;
  details: Record<string, unknown>;
  metrics: Record<string, number>;
  remediation: string;
  durationMs: number;
  timestamp: string;
  error?: string;
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  samples: number;
}

export interface ToolLatencyMetrics {
  toolName: string;
  latency: LatencyMetrics;
  warmStartLatency?: number;
  coldStartLatency?: number;
}

export interface DiagnosticReport {
  id: string;
  endpoint: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  version: string;
  transport: TransportType;
  authMode: AuthMode;
  overallGrade: Grade;
  checks: CheckResult[];
  tools: ToolDefinition[];
  latency: LatencyMetrics;
  toolLatencies: ToolLatencyMetrics[];
  serverInfo?: {
    name?: string;
    version?: string;
    capabilities?: Record<string, unknown>;
  };
  error?: string;
  comparison?: {
    baselineId: string;
    gradeChange: 'improved' | 'regressed' | 'unchanged';
    latencyChange: number;
    toolCountChange: number;
    checkChanges: Array<{ name: string; gradeChange: 'improved' | 'regressed' | 'unchanged' }>;
  };
}

export interface DiagnosticOptions {
  transport: TransportType;
  auth: AuthMode;
  apiKey?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  timeout: number;
  concurrency: number;
  verbose: boolean;
}

export interface DiagnosticContext {
  endpoint: string;
  options: DiagnosticOptions;
  requestId: string;
  startTime: number;
}
