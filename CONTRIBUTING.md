# CONTRIBUTING.md — mcp-server-doctor

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- npm or pnpm

### Setup

```bash
git clone https://github.com/reaatech/mcp-server-doctor.git
cd mcp-server-doctor
npm install
npm run build
```

### Development Workflow

```bash
# Run in dev mode (build + run CLI)
npm run dev -- diagnose http://localhost:8080

# Run tests
npm test

# Watch mode
npm run test:watch

# Lint
npm run lint

# Format
npm run format

# Type check
npm run typecheck
```

## Project Structure

```
src/
├── cli.ts                          # CLI entry point
├── index.ts                        # Public library API
├── version.ts                      # Version from package.json
├── cli/
│   └── commands/                   # diagnose, compare, watch
├── doctor/
│   ├── engine.ts                   # DiagnosticEngine orchestrator
│   └── checks/                     # 8 diagnostic checks
├── mcp-client/
│   ├── client.ts                   # DoctorMCPClient
│   └── transports/                 # stdio, sse, streamable-http
├── reporters/                      # console, json, markdown, html
├── grading/                        # benchmarks, grader
├── types/                          # domain types, zod schemas
├── observability/                  # logger, tracing, metrics
└── utils/                          # utilities
```

## Adding a New Check

1. Create `src/doctor/checks/my-check.check.ts`:

```typescript
import { CheckResult, CheckCategory, Severity } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now, measureTimeAsync } from '../../utils/index.js';
import { gradeCompliance } from '../../grading/index.js';
import { recordCheck } from '../../observability/metrics.js';
import { logger } from '../../observability/logger.js';

export class MyCheck {
  name = 'my-check';
  category = CheckCategory.TRANSPORT; // or SCHEMA, LATENCY, AUTH, PAYLOAD, TIMEOUT, ERROR_FORMAT, CONCURRENCY
  severity = Severity.WARNING;

  async validate(client: MCPClient, context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    let passed = true;
    let warnings = 0;
    const details: Record<string, unknown> = {};

    try {
      // ... implement check logic ...
      // Example:
      const result = await client.sendRequest('ping', {});
      details.pingResult = result;
    } catch (error) {
      passed = false;
      details.error = error instanceof Error ? error.message : String(error);
      logger.error({ error }, 'My check failed');
    }

    const durationMs = Math.round(performance.now() - startTime);
    const grade = passed ? gradeCompliance(true, warnings) : 'F';
    recordCheck(this.name, grade, durationMs);

    return {
      name: this.name,
      category: this.category,
      grade,
      passed,
      severity: this.severity,
      message: passed ? 'Check passed' : `Check failed: ${details.error}`,
      details,
      metrics: { durationMs, warnings },
      remediation: passed ? 'All good' : 'Fix the issue',
      durationMs,
      timestamp: now(),
    };
  }
}
```

2. Register in `src/doctor/engine.ts`:

```typescript
import { MyCheck } from './checks/my-check.check.js';

private checks = [
  new TransportNegotiationCheck(),
  // ... other checks ...
  new MyCheck(),
];
```

3. Add tests in `tests/unit/checks.test.ts`:

```typescript
import { MyCheck } from '../../src/doctor/checks/my-check.check.js';
import { MockMCPClient } from '../helpers/mock-client.js';

describe('MyCheck', () => {
  it('has correct metadata', () => {
    const check = new MyCheck();
    expect(check.name).toBe('my-check');
    expect(check.category).toBe(CheckCategory.TRANSPORT);
  });

  it('validates successfully', async () => {
    const check = new MyCheck();
    const client = new MockMCPClient();
    const context = { /* ... */ };
    const result = await check.validate(client as any, context);
    expect(result.passed).toBe(true);
  });
});
```

## Adding a New Schema

1. Define Zod schema in `src/types/schemas.ts`:

```typescript
export const MySchema = z.object({
  field: z.string(),
  count: z.number().int().positive(),
});
```

2. Export from `src/types/index.ts`:

```typescript
export * from './schemas.js';
```

3. Add tests in `tests/unit/schemas.test.ts`.

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Test Structure

- `tests/unit/` — Unit tests for individual modules
- `tests/integration/` — Integration tests (client + server)
- `tests/helpers/` — Mock client, mock server
- `tests/fixtures/` — Test data

## Code Style

- **TypeScript:** Strict mode, no `any` unless absolutely necessary
- **Formatting:** Prettier (no custom config, uses defaults)
- **Linting:** ESLint v9 flat config
- **Imports:** Use `.js` extension for ESM imports
- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/classes

## Pull Request Process

1. Create a feature branch from `main`
2. Make changes and add tests
3. Ensure all checks pass: `npm run lint && npm run typecheck && npm test`
4. Update documentation if needed
5. Submit PR with a clear description

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add payload limits check`
- `fix: handle SSE transport edge case`
- `docs: update README with auth examples`
- `refactor: extract transport negotiation logic`
- `test: add unit tests for grading`

## Reporting Issues

- Use the [GitHub issue tracker](https://github.com/reaatech/mcp-server-doctor/issues)
- Include: Node.js version, OS, MCP server details, steps to reproduce
- Attach relevant logs (with credentials redacted)

## Security

- Never commit credentials or secrets
- Redact sensitive data in logs and error messages
- Report security vulnerabilities privately to the maintainers
