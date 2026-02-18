import type { LintRule, LintIssue, ToolDefinition } from '../../core/types.js';

export const descExists: LintRule = {
  id: 'desc-exists',
  description: 'Tool has no description at all',
  severity: 'error',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      if (!tool.description?.trim()) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: no description defined`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

export const descMinLength: LintRule = {
  id: 'desc-min-length',
  description: 'Description too short for an LLM to understand',
  severity: 'warn',
  check(tools) {
    const minLen = 20;
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (desc && desc.length < minLen) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: description is ${desc.length} chars — too vague`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

export const descMaxLength: LintRule = {
  id: 'desc-max-length',
  description: 'Description too long, wastes context window',
  severity: 'warn',
  check(tools) {
    const maxLen = 200;
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (desc && desc.length > maxLen) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: description is ${desc.length} chars — consider shortening`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

const ACTION_VERBS = new Set([
  'get', 'gets', 'set', 'sets', 'create', 'creates', 'update', 'updates',
  'delete', 'deletes', 'remove', 'removes', 'add', 'adds', 'find', 'finds',
  'search', 'searches', 'list', 'lists', 'fetch', 'fetches', 'send', 'sends',
  'post', 'posts', 'put', 'puts', 'read', 'reads', 'write', 'writes',
  'check', 'checks', 'validate', 'validates', 'verify', 'verifies',
  'parse', 'parses', 'convert', 'converts', 'transform', 'transforms',
  'generate', 'generates', 'calculate', 'calculates', 'compute', 'computes',
  'run', 'runs', 'execute', 'executes', 'start', 'starts', 'stop', 'stops',
  'open', 'opens', 'close', 'closes', 'connect', 'connects',
  'enable', 'enables', 'disable', 'disables', 'upload', 'uploads',
  'download', 'downloads', 'export', 'exports', 'import', 'imports',
  'retrieve', 'retrieves', 'return', 'returns', 'query', 'queries',
  'resolve', 'resolves', 'provide', 'provides', 'display', 'displays',
  'show', 'shows', 'configure', 'configures', 'modify', 'modifies',
  'extract', 'extracts', 'apply', 'applies', 'deploy', 'deploys',
  'build', 'builds', 'install', 'installs', 'subscribe', 'subscribes',
  'monitor', 'monitors', 'track', 'tracks', 'log', 'logs',
  'initiate', 'initiates', 'terminate', 'terminates', 'sync', 'syncs',
  'refresh', 'refreshes', 'reset', 'resets', 'load', 'loads',
  'save', 'saves', 'store', 'stores', 'submit', 'submits',
  'cancel', 'cancels', 'approve', 'approves', 'reject', 'rejects',
  'move', 'moves', 'copy', 'copies', 'rename', 'renames',
  'test', 'tests', 'analyze', 'analyzes', 'inspect', 'inspects',
]);

export const descActionVerb: LintRule = {
  id: 'desc-action-verb',
  description: 'Description should start with a verb',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (!desc) continue;
      const firstWord = desc.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (firstWord && !ACTION_VERBS.has(firstWord)) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: description should start with a verb (e.g. "Retrieves…", "Creates…")`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

const VAGUE_PATTERNS = [
  /\bhandles?\b/i, /\bprocesse?s?\b/i, /\bmanages?\b/i,
  /\bdoes\b/i, /\bperforms?\b/i, /\bworks?\s+with\b/i,
  /\bdeals?\s+with\b/i, /\btakes?\s+care\s+of\b/i,
  /\bmisc\b/i, /\bvarious\b/i, /\betc\.?\b/i, /\bstuff\b/i,
];

export const descClarity: LintRule = {
  id: 'desc-clarity',
  description: 'Flags common vague terms in descriptions',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (!desc) continue;
      for (const pattern of VAGUE_PATTERNS) {
        const match = desc.match(pattern);
        if (match) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${tool.name}: vague term "${match[0]}" — be more specific about what this tool does`,
            tool: tool.name,
          });
          break;
        }
      }
    }
    return issues;
  },
};

function wordSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/\W+/).filter((w) => w.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const descUnique: LintRule = {
  id: 'desc-unique',
  description: 'Two tools with nearly identical descriptions',
  severity: 'warn',
  check(tools: ToolDefinition[]) {
    const issues: LintIssue[] = [];
    const described = tools.filter((t) => t.description?.trim());
    for (let i = 0; i < described.length; i++) {
      for (let j = i + 1; j < described.length; j++) {
        const a = described[i]!;
        const b = described[j]!;
        const sim = jaccardSimilarity(
          wordSet(a.description!),
          wordSet(b.description!),
        );
        if (sim > 0.8) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${a.name}: description too similar to ${b.name} — LLM won't know which to pick`,
            tool: a.name,
          });
        }
      }
    }
    return issues;
  },
};
