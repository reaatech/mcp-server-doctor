export { DiagnosticEngine } from './doctor/engine.js';
export { createDoctorClient } from './mcp-client/client.js';
export type { MCPClient } from './mcp-client/client.js';
export { formatReport } from './reporters/index.js';
export * from './types/index.js';
export * from './grading/index.js';
export * from './doctor/checks/index.js';
export * from './utils/index.js';
export { logger } from './observability/logger.js';
export {
  recordCheck,
  recordLatency,
  recordGrade,
  getMetricsSummary,
} from './observability/metrics.js';
export { getProgramVersion } from './version.js';
