# Changelog

## Unreleased

### Added

- Shared `src/constants.ts` module centralizing the MCP protocol version, default timeouts, payload bounds, concurrency levels, and watch-interval floor
- `sanitizeUrl` utility that strips userinfo from URLs before logging
- `resolveCredentials` helper that reads `MCP_API_KEY`, `MCP_BEARER_TOKEN`, `MCP_OAUTH_CLIENT_ID`, and `MCP_OAUTH_CLIENT_SECRET` when CLI flags are unset, and warns when secrets are passed on the command line
- Per-call timeout race in the concurrency-stress check so hung requests cannot block `Promise.allSettled`
- Per-round error capture in the latency-profiling check, including a `<tool>_failedRounds` detail for partial failures
- Vitest v8 coverage with text/lcov reporters and minimum thresholds (60% lines/statements, 50% branches/functions)
- CI: Node 23 added to the Linux matrix, a parallel macOS job on Node 22, and `npm run build`, `npm run test:coverage`, and `npm audit --audit-level=high` steps

### Changed

- Console reporter now surfaces all warning detail fields (`sessionIdWarning`, `pingWarning`, `serverInfoWarning`, generic `warning`) instead of only the generic one
- HTML and Markdown reporters cap tool listings at 10 entries with an "... and N more" row
- `--api-key`, `--bearer-token`, and `--oauth-*` help text now points users at the env-var alternatives
- TypeScript: `noUnusedLocals` and `noUnusedParameters` enabled
- Minimum supported Node version raised to 22 (badge and README)
- Auth-verification check logs non-critical disconnect and setup failures rather than swallowing them
- Tool-schema-validation check uses a single shared list of valid schema types and tightens the tool-name regex to require at least two characters
- Published npm tarball drops `AGENTS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and `skills/`, and now includes `CHANGELOG.md`

### Fixed

- `getProgramVersion` resolves `package.json` via `fileURLToPath` + `readFileSync` (probing both dev and published layouts) so it works when the CLI is bundled or loaded from paths where `createRequire` cannot resolve

## 1.0.0 (2026-04-26)

Initial public release.

### Features

- **8 diagnostic checks**: Transport negotiation, tool schema validation, latency profiling, auth verification, payload limits, timeout behavior, error format compliance, and concurrency stress testing
- **4 output formats**: Console (with colors), JSON, Markdown, HTML
- **3 transport protocols**: Streamable HTTP, SSE, stdio with auto-negotiation
- **Graded reports**: A-F letter grades with quantitative benchmarks
- **3 CLI commands**: `diagnose`, `compare`, `watch`
- **Library API**: Programmatic usage as a Node.js module
- **Observability**: Structured logging (pino) and OpenTelemetry metrics/tracing
- **Auth support**: API key, Bearer token, OAuth client credentials, and no-auth modes
- **Security**: Credential redaction in logs, private network detection, read-only testing
- **Credential support**: Environment variables (`MCP_API_KEY`, `MCP_BEARER_TOKEN`, `MCP_OAUTH_CLIENT_ID`, `MCP_OAUTH_CLIENT_SECRET`) as safer alternatives to CLI flags
