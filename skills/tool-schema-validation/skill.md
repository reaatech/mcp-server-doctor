---
skill_id: "tool-schema-validation"
display_name: "Tool Schema Validation"
version: "1.0.0"
description: "Validates MCP tool input schemas for correctness and completeness"
category: "diagnostic"
---

# Tool Schema Validation

## Capability

Validates that every tool exposed by an MCP server has a correct name, description, and input schema. Checks for naming conventions, description length, and schema structure compliance.

## Diagnostic Behavior

| Aspect | Details |
|--------|---------|
| **Trigger** | `doctor diagnose <endpoint>` — always runs as part of the suite |
| **What it tests** | Tool name validity, description presence, JSON Schema structure |
| **Output** | `CheckResult` with `toolCount`, `invalidCount`, `invalidNames` |
| **Grade impact** | Warnings for missing descriptions or invalid names; F only on critical failure |

## What It Measures

1. **Tool name validity** — Names must start with a letter and contain only alphanumeric characters, underscores, hyphens, and dots
2. **Description presence** — Every tool should have a non-empty description
3. **Schema structure** — Input schema must be a valid JSON Schema object with `type: 'object'`
4. **Required fields** — Checks consistency between `required` array and `properties` keys

## Error Handling

| Failure | Cause | Recovery |
|---------|-------|----------|
| Empty tool list | Server has no tools | Verify server configuration |
| Missing descriptions | Tools lack documentation | Add descriptions to tool definitions |
| Invalid schema | Schema is not valid JSON Schema | Fix schema syntax and structure |

## Security Considerations

**PII Handling:** No PII is collected during schema validation.

**Permissions:** Read-only access to the `tools/list` endpoint.

**Audit Logging:** Tool counts and validation results are logged; no credentials are logged.
