# @reaatech/mcp-server-doctor-reporters

[![npm version](https://img.shields.io/npm/v/@reaatech/mcp-server-doctor-reporters.svg)](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-reporters)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/mcp-server-doctor/ci.yml?branch=main&label=CI)](https://github.com/reaatech/mcp-server-doctor/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Multi-format diagnostic report formatters for the `DiagnosticReport` object produced by the engine. Supports rich console output, machine-readable JSON, documentation-style markdown, and standalone HTML.

## Installation

```bash
npm install @reaatech/mcp-server-doctor-reporters
# or
pnpm add @reaatech/mcp-server-doctor-reporters
```

## Feature Overview

- **Console reporter** — color-coded terminal output with grade icons, check tables, and tool listings
- **JSON reporter** — full structured output as `JSON.stringify(report, null, 2)`
- **Markdown reporter** — documentation-style tables with emoji grades and formatted metrics
- **HTML reporter** — standalone HTML document with embedded CSS, responsive layout, and light/dark mode
- **Single dispatch function** — `formatReport(report, format)` returns the formatted string

## Quick Start

```typescript
import { formatReport } from "@reaatech/mcp-server-doctor-reporters";
import type { DiagnosticReport } from "@reaatech/mcp-server-doctor-core";

const report: DiagnosticReport = {
  id: "abc-123",
  endpoint: "http://localhost:8080",
  overallGrade: "A",
  // ...
};

// Console output
console.log(formatReport(report, "console"));

// Machine-readable JSON
const json = formatReport(report, "json");
await writeFile("report.json", json);

// Markdown for READMEs or PR comments
const md = formatReport(report, "markdown");

// Standalone HTML page
const html = formatReport(report, "html");
await writeFile("report.html", html);
```

## API Reference

### `formatReport(report: DiagnosticReport, format: Format): string`

The main entry point. Dispatches to the appropriate formatter.

```typescript
type Format = "console" | "json" | "markdown" | "html";
```

If an unrecognized format is passed, `formatReport` falls back to console output.

### Individual Formatters

Each formatter is also exported directly for granular use:

| Export | Description |
|--------|-------------|
| `formatConsoleReport(report)` | Color-coded terminal output using `chalk` |
| `formatJsonReport(report)` | `JSON.stringify(report, null, 2)` |
| `formatMarkdownReport(report)` | Markdown tables with emoji grades and metrics |
| `formatHtmlReport(report)` | Standalone HTML document with embedded CSS |

### Console Output Example

```
╔══════════════════════════════════════════╗
║     MCP Server Diagnostic Report        ║
╠══════════════════════════════════════════╣
║ Endpoint:  http://localhost:8080        ║
║ Transport: http  |  Auth: none          ║
║ Duration:  3.2s  |  Version: 1.0.0      ║
╚══════════════════════════════════════════╝

  Overall Grade: 🟢 A

── Checks ──

  ✅ transport-negotiation    A
  ✅ tool-schema-validation   A
  ✅ latency-profiling        B   p99: 2.4s
  ...
```

### Grade Color Mapping

| Grade | Console Color | Markdown Emoji | HTML Hex |
|-------|---------------|----------------|----------|
| A | Green | ✅ | `#22c55e` |
| B | Blue | 🟢 | `#3b82f6` |
| C | Yellow | 🟡 | `#eab308` |
| D | Red | 🔴 | `#ef4444` |
| F | Red | ❌ | `#dc2626` |

## Usage Patterns

### Write Report to File

```typescript
import { formatReport } from "@reaatech/mcp-server-doctor-reporters";
import { writeFile } from "node:fs/promises";

const report = await engine.run();
const output = formatReport(report, "json");
await writeFile("report.json", output);
```

### CI Integration

```typescript
const report = await engine.run();
const markdown = formatReport(report, "markdown");

// Post as PR comment or write to GitHub Actions step summary
await fs.writeFile("report.md", markdown);
```

### Programmatic Selection

```typescript
import {
  formatConsoleReport,
  formatJsonReport,
  formatMarkdownReport,
  formatHtmlReport,
} from "@reaatech/mcp-server-doctor-reporters";

const formatters = {
  console: formatConsoleReport,
  json: formatJsonReport,
  markdown: formatMarkdownReport,
  html: formatHtmlReport,
};

const output = formatters[userFormat](report);
```

## Related Packages

- [`@reaatech/mcp-server-doctor-core`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-core) — `DiagnosticReport` and `Grade` types
- [`@reaatech/mcp-server-doctor-engine`](https://www.npmjs.com/package/@reaatech/mcp-server-doctor-engine) — Diagnostic engine producing the report

## License

[MIT](https://github.com/reaatech/mcp-server-doctor/blob/main/LICENSE)
