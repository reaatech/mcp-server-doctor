export const MCP_PROTOCOL_VERSION = '2024-11-05';

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_CONCURRENCY = 10;

export const WARMUP_ROUNDS = 3;
export const MEASUREMENT_ROUNDS = 20;
export const MAX_TOOLS_TO_PROFILE = 3;

export const MIN_PAYLOAD_BYTES = 1024;
export const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

export const CONCURRENCY_LEVELS = [5, 10, 25, 50];

export const PING_TIMEOUT_THRESHOLD_MS = 5000;

export const DISCONNECT_TIMEOUT_MS = 5000;

export const WATCH_MIN_INTERVAL_MS = Number.parseInt(
  process.env.DOCTOR_WATCH_MIN_INTERVAL_MS || '10000',
  10,
);
