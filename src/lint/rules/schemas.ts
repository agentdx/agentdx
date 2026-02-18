import type { LintRule, LintIssue } from '../../core/types.js';

interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

function getProperties(
  tool: { inputSchema?: { properties?: Record<string, unknown> } },
): Record<string, SchemaProperty> {
  const props = tool.inputSchema?.properties;
  if (!props) return {};
  return props as Record<string, SchemaProperty>;
}

function getRequired(
  tool: { inputSchema?: { required?: string[] } },
): string[] {
  return tool.inputSchema?.required ?? [];
}

export const schemaExists: LintRule = {
  id: 'schema-exists',
  description: 'Tool has no input schema defined',
  severity: 'error',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (!tool.inputSchema) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: no input schema defined`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

export const schemaValid: LintRule = {
  id: 'schema-valid',
  description: "Schema doesn't conform to JSON Schema spec",
  severity: 'error',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (!tool.inputSchema) continue;
      if (tool.inputSchema.type !== 'object') {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: input schema type must be "object", got "${tool.inputSchema.type}"`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

export const schemaParamDesc: LintRule = {
  id: 'schema-param-desc',
  description: 'Parameters missing descriptions',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      for (const [name, prop] of Object.entries(props)) {
        if (!prop.description?.trim()) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${tool.name}: parameter "${name}" has no description`,
            tool: tool.name,
            param: name,
          });
        }
      }
    }
    return issues;
  },
};

export const schemaRequired: LintRule = {
  id: 'schema-required',
  description: 'Required params not marked in schema',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      const propNames = Object.keys(props);
      const required = getRequired(tool);
      if (propNames.length > 0 && required.length === 0) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: has ${propNames.length} parameter(s) but none marked as required`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

export const schemaEnumBool: LintRule = {
  id: 'schema-enum-bool',
  description: 'Boolean param might be clearer as an enum',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      for (const [name, prop] of Object.entries(props)) {
        if (prop.type === 'boolean') {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${tool.name}: "${name}" is boolean — consider an enum for clarity (e.g. "mode": "summary" | "full")`,
            tool: tool.name,
            param: name,
          });
        }
      }
    }
    return issues;
  },
};

export const schemaNoAny: LintRule = {
  id: 'schema-no-any',
  description: 'Untyped parameters — LLM has no guidance',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      for (const [name, prop] of Object.entries(props)) {
        if (!prop.type) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${tool.name}: parameter "${name}" has no type`,
            tool: tool.name,
            param: name,
          });
        }
      }
    }
    return issues;
  },
};

export const schemaDefaults: LintRule = {
  id: 'schema-defaults',
  description: 'Optional params without default values',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      const required = new Set(getRequired(tool));
      for (const [name, prop] of Object.entries(props)) {
        if (!required.has(name) && prop.default === undefined) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${tool.name}: optional parameter "${name}" has no default value`,
            tool: tool.name,
            param: name,
          });
        }
      }
    }
    return issues;
  },
};
