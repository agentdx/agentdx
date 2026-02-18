import type { LintRule, LintIssue } from '../../core/types.js';

interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

function getProperties(tool: {
  inputSchema?: { properties?: Record<string, unknown> };
}): Record<string, SchemaProperty> {
  const props = tool.inputSchema?.properties;
  if (!props) return {};
  return props as Record<string, SchemaProperty>;
}

function getRequired(tool: { inputSchema?: { required?: string[] } }): string[] {
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

export const paramEnumDocumented: LintRule = {
  id: 'param-enum-documented',
  description: 'Enum parameters should document what each value means',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      for (const [name, prop] of Object.entries(props)) {
        if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
          const desc = prop.description ?? '';
          // Check if the description mentions the enum values
          const mentionedValues = prop.enum.filter((v) =>
            desc.toLowerCase().includes(String(v).toLowerCase()),
          );
          if (mentionedValues.length < prop.enum.length / 2) {
            issues.push({
              rule: this.id,
              severity: this.severity,
              message: `${tool.name}: parameter "${name}" has enum values [${prop.enum.map(String).join(', ')}] but doesn't document what they mean`,
              tool: tool.name,
              param: name,
              fix: `Add descriptions for each enum value in the parameter description, e.g. '"celsius" = metric, "fahrenheit" = imperial'`,
              docs: 'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/',
            });
          }
        }
      }
    }
    return issues;
  },
};

export const paramDefaultDocumented: LintRule = {
  id: 'param-default-documented',
  description: 'Parameters with defaults should state the default value',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      for (const [name, prop] of Object.entries(props)) {
        if (prop.default !== undefined) {
          const desc = prop.description ?? '';
          const defaultStr = String(prop.default);
          if (!desc.toLowerCase().includes(defaultStr.toLowerCase()) && !desc.includes('default')) {
            issues.push({
              rule: this.id,
              severity: this.severity,
              message: `${tool.name}: parameter "${name}" has default ${JSON.stringify(prop.default)} but description doesn't mention it`,
              tool: tool.name,
              param: name,
              fix: `Add "Defaults to ${defaultStr}" to the parameter description`,
              docs: 'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/',
            });
          }
        }
      }
    }
    return issues;
  },
};

function measureDepth(schema: unknown, current = 0): number {
  if (!schema || typeof schema !== 'object') return current;
  const obj = schema as Record<string, unknown>;
  let maxDepth = current;

  if (obj.properties && typeof obj.properties === 'object') {
    for (const value of Object.values(obj.properties as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const child = value as Record<string, unknown>;
        if (child.type === 'object' || child.properties) {
          maxDepth = Math.max(maxDepth, measureDepth(child, current + 1));
        } else if (child.type === 'array' && child.items && typeof child.items === 'object') {
          const items = child.items as Record<string, unknown>;
          if (items.type === 'object' || items.properties) {
            maxDepth = Math.max(maxDepth, measureDepth(items, current + 1));
          }
        }
      }
    }
  }
  return maxDepth;
}

export const schemaNotTooDeep: LintRule = {
  id: 'schema-not-too-deep',
  description: 'Input schema nesting should not exceed depth 3',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (!tool.inputSchema) continue;
      const depth = measureDepth(tool.inputSchema);
      if (depth > 3) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: schema nesting depth is ${depth} — LLM performance drops 47% with deep nesting`,
          tool: tool.name,
          fix: `Flatten the schema by using separate tools or simplifying nested objects`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};

export const schemaNoExcessiveParams: LintRule = {
  id: 'schema-no-excessive-params',
  description: 'Too many parameters overwhelms agents',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const props = getProperties(tool);
      const paramCount = Object.keys(props).length;
      if (paramCount > 10) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: has ${paramCount} parameters — agents struggle with large parameter spaces`,
          tool: tool.name,
          fix: `Split into multiple focused tools or group related parameters into objects`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};
