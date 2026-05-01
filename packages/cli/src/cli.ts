#!/usr/bin/env node
import { programVersion } from '@reaatech/mcp-server-doctor-core';
import { Command } from 'commander';
import { runCompareCommand } from './cli/compare.command.js';
import { runDiagnoseCommand } from './cli/diagnose.command.js';
import { runWatchCommand } from './cli/watch.command.js';

const program = new Command();

program
  .name('doctor')
  .description('CLI diagnostic and profiling tool for MCP servers')
  .version(programVersion);

program
  .command('diagnose')
  .description('Run full diagnostic suite against an MCP endpoint')
  .argument('<endpoint>', 'MCP server endpoint (URL or stdio command)')
  .option('--transport <type>', 'Transport type: stdio, sse, http, auto', 'auto')
  .option('--auth <mode>', 'Auth mode: none, api-key, bearer, oauth', 'none')
  .option('--api-key <key>', 'API key for authentication (prefer MCP_API_KEY env var)')
  .option(
    '--bearer-token <token>',
    'Bearer token for authentication (prefer MCP_BEARER_TOKEN env var)',
  )
  .option('--oauth-client-id <id>', 'OAuth client ID (prefer MCP_OAUTH_CLIENT_ID env var)')
  .option(
    '--oauth-client-secret <secret>',
    'OAuth client secret (prefer MCP_OAUTH_CLIENT_SECRET env var)',
  )
  .option('--format <format>', 'Output format: console, json, markdown, html', 'console')
  .option('--output <path>', 'Write report to file')
  .option('--verbose', 'Show detailed output', false)
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('--concurrency <n>', 'Concurrency level for stress tests', '10')
  .action(runDiagnoseCommand);

program
  .command('compare')
  .description('Compare two diagnostic reports')
  .argument('<baseline>', 'Baseline report JSON file')
  .argument('<current>', 'Current report JSON file')
  .option('--format <format>', 'Output format: console, json, markdown, html', 'console')
  .option('--output <path>', 'Write report to file')
  .action(runCompareCommand);

program
  .command('watch')
  .description('Continuously monitor an MCP endpoint')
  .argument('<endpoint>', 'MCP server endpoint')
  .option('--interval <seconds>', 'Check interval in seconds', '60')
  .option('--alert-threshold <grade>', 'Alert on grade threshold', 'C')
  .option('--transport <type>', 'Transport type: stdio, sse, http, auto', 'auto')
  .option('--auth <mode>', 'Auth mode: none, api-key, bearer, oauth', 'none')
  .option('--api-key <key>', 'API key for authentication (prefer MCP_API_KEY env var)')
  .option(
    '--bearer-token <token>',
    'Bearer token for authentication (prefer MCP_BEARER_TOKEN env var)',
  )
  .option('--oauth-client-id <id>', 'OAuth client ID (prefer MCP_OAUTH_CLIENT_ID env var)')
  .option(
    '--oauth-client-secret <secret>',
    'OAuth client secret (prefer MCP_OAUTH_CLIENT_SECRET env var)',
  )
  .option('--format <format>', 'Output format: console, json, markdown, html', 'console')
  .option('--output <path>', 'Write report to file')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('--concurrency <n>', 'Concurrency level for stress tests', '10')
  .action(runWatchCommand);

program.parse(process.argv);
