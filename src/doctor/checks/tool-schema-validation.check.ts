import { CheckResult, CheckCategory, Severity } from '../../types/domain.js';
import { MCPClient } from '../../mcp-client/client.js';
import { DiagnosticContext } from '../../types/domain.js';
import { now } from '../../utils/index.js';
import { gradeCompliance } from '../../grading/index.js';
import { recordCheck } from '../../observability/metrics.js';

export class ToolSchemaValidationCheck {
  name = 'tool-schema-validation';
  category = CheckCategory.SCHEMA;
  severity = Severity.CRITICAL;

  async validate(client: MCPClient, _context: DiagnosticContext): Promise<CheckResult> {
    const startTime = performance.now();
    let passed = true;
    let warnings = 0;
    const details: Record<string, unknown> = {};
    const toolResults: Array<{ name: string; valid: boolean; issues: string[] }> = [];

    try {
      const tools = await client.listTools();
      details.toolCount = tools.length;

      if (tools.length === 0) {
        warnings++;
        details.warning = 'No tools found';
      }

      for (const tool of tools) {
        const issues: string[] = [];

        if (!tool.name || !/^[a-zA-Z][a-zA-Z0-9_\-.]*$/.test(tool.name)) {
          issues.push('Invalid tool name format');
        }

        if (!tool.description || tool.description.length < 5) {
          issues.push('Missing or too short description');
        }

        if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
          issues.push('Missing input schema');
        } else {
          const schema = tool.inputSchema as Record<string, unknown>;
          if (schema.type && schema.type !== 'object') {
            issues.push(`Unexpected schema type: ${schema.type}`);
          }
          // Schema without properties or $ref is valid (e.g., { type: 'object' } means any object)
          // Only flag if it has an unexpected type
          if (schema.type && schema.type !== 'object' && !schema.$ref) {
            // Allow primitive types as valid schemas
            const validTypes = [
              'string',
              'number',
              'integer',
              'boolean',
              'array',
              'object',
              'null',
            ];
            if (!validTypes.includes(schema.type as string)) {
              issues.push(`Unexpected schema type: ${schema.type}`);
            }
          }
        }

        toolResults.push({ name: tool.name, valid: issues.length === 0, issues });
        if (issues.length > 0) warnings += issues.length;
      }

      details.toolResults = toolResults;
      details.validCount = toolResults.filter((t) => t.valid).length;
      const invalidCount = toolResults.filter((t) => !t.valid).length;
      details.invalidCount = invalidCount;
    } catch (error) {
      passed = false;
      details.error = error instanceof Error ? error.message : String(error);
    }

    const durationMs = Math.round(performance.now() - startTime);
    const grade = passed ? gradeCompliance(true, warnings) : 'F';

    recordCheck(this.name, grade, durationMs);

    const invalid = details.invalidCount as number | undefined;
    return {
      name: this.name,
      category: this.category,
      grade,
      passed,
      severity: this.severity,
      message: passed
        ? `Validated ${details.toolCount} tool schemas (${invalid || 0} with issues)`
        : `Tool schema validation failed: ${details.error}`,
      details,
      metrics: { durationMs, warnings, toolCount: (details.toolCount as number) || 0 },
      remediation: passed
        ? (invalid || 0) > 0
          ? 'Review tools with schema issues for better LLM compatibility'
          : 'All tool schemas are valid'
        : 'Ensure the server properly exposes tool definitions via tools/list',
      durationMs,
      timestamp: now(),
    };
  }
}
