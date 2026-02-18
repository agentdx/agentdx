import type { LintRule, LintIssue } from '../../core/types.js';

type Convention = 'snake_case' | 'camelCase' | 'kebab-case' | 'single';

function detectConvention(name: string): Convention {
  if (name.includes('_')) return 'snake_case';
  if (name.includes('-')) return 'kebab-case';
  if (/[a-z][A-Z]/.test(name)) return 'camelCase';
  return 'single';
}

export const nameConvention: LintRule = {
  id: 'name-convention',
  description: 'Inconsistent naming convention across tools',
  severity: 'warn',
  check(tools) {
    if (tools.length < 2) return [];
    const conventions = tools.map((t) => ({
      name: t.name,
      convention: detectConvention(t.name),
    }));
    const multiWord = conventions.filter((c) => c.convention !== 'single');
    if (multiWord.length < 2) return [];

    const counts = new Map<Convention, number>();
    for (const c of multiWord) {
      counts.set(c.convention, (counts.get(c.convention) ?? 0) + 1);
    }
    if (counts.size <= 1) return [];

    // Find the dominant convention
    let dominant: Convention = 'snake_case';
    let maxCount = 0;
    for (const [conv, count] of counts) {
      if (count > maxCount) {
        dominant = conv;
        maxCount = count;
      }
    }

    const issues: LintIssue[] = [];
    for (const c of multiWord) {
      if (c.convention !== dominant) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${c.name}: uses ${c.convention} but most tools use ${dominant}`,
          tool: c.name,
        });
      }
    }
    return issues;
  },
};

const NAME_VERBS = new Set([
  'get',
  'set',
  'create',
  'update',
  'delete',
  'remove',
  'add',
  'find',
  'search',
  'list',
  'fetch',
  'send',
  'post',
  'put',
  'read',
  'write',
  'check',
  'validate',
  'verify',
  'parse',
  'convert',
  'generate',
  'run',
  'execute',
  'start',
  'stop',
  'open',
  'close',
  'connect',
  'enable',
  'disable',
  'upload',
  'download',
  'export',
  'import',
  'subscribe',
  'monitor',
  'track',
  'log',
  'sync',
  'refresh',
  'reset',
  'load',
  'save',
  'store',
  'submit',
  'cancel',
  'approve',
  'reject',
  'move',
  'copy',
  'rename',
  'test',
  'analyze',
  'inspect',
  'query',
  // Browser / UI / IO actions
  'edit',
  'browse',
  'view',
  'drop',
  'pick',
  'choose',
  'swap',
  'navigate',
  'capture',
  'perform',
  'hover',
  'select',
  'resize',
  'take',
  'press',
  'type',
  'fill',
  'wait',
  'reload',
  'evaluate',
  'toggle',
  'trigger',
  'simulate',
  'echo',
  'drag',
  'click',
  'scroll',
  'focus',
  'clear',
  'attach',
  'detach',
  'emit',
  'listen',
  'watch',
  'poll',
  'ping',
  'render',
  'format',
  'sort',
  'filter',
  'merge',
  'split',
  'encode',
  'decode',
  'encrypt',
  'decrypt',
  'compress',
  'count',
  'measure',
  'compare',
  'notify',
  'alert',
  'warn',
  'accept',
  'deny',
  'grant',
  'revoke',
  'assign',
  'release',
  'lock',
  'unlock',
  'publish',
  'index',
  'scan',
  'crawl',
  'schedule',
  'pause',
  'resume',
  'archive',
  'restore',
  'backup',
  'register',
  'unregister',
  'snapshot',
]);

function getTokens(name: string): string[] {
  // Split by _ or - or camelCase boundaries
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean);
}

export const nameVerbNoun: LintRule = {
  id: 'name-verb-noun',
  description: 'Tool name should follow verb_noun pattern',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const tokens = getTokens(tool.name);
      if (tokens.length < 2) continue;
      // Check if any token is a verb — allows prefix_verb patterns (e.g. browser_click)
      const hasVerb = tokens.some((t) => NAME_VERBS.has(t));
      if (!hasVerb) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: consider verb_noun naming (e.g. "get_${tokens.join('_')}")`,
          tool: tool.name,
        });
      }
    }
    return issues;
  },
};

export const nameUnique: LintRule = {
  id: 'name-unique',
  description: 'Duplicate tool names',
  severity: 'error',
  check(tools) {
    const issues: LintIssue[] = [];
    const seen = new Map<string, number>();
    for (const tool of tools) {
      const count = seen.get(tool.name) ?? 0;
      seen.set(tool.name, count + 1);
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${name}: duplicate tool name (appears ${count} times)`,
          tool: name,
        });
      }
    }
    return issues;
  },
};

export const namePrefix: LintRule = {
  id: 'name-prefix',
  description: 'Related tools should share a common prefix',
  severity: 'info',
  check(tools) {
    if (tools.length < 3) return [];
    const issues: LintIssue[] = [];

    // Group by last token (the "noun" part)
    const nounGroups = new Map<string, string[]>();
    for (const tool of tools) {
      const tokens = getTokens(tool.name);
      if (tokens.length < 2) continue;
      const noun = tokens[tokens.length - 1]!;
      const group = nounGroups.get(noun) ?? [];
      group.push(tool.name);
      nounGroups.set(noun, group);
    }

    // Check for groups with different prefixes
    for (const [noun, names] of nounGroups) {
      if (names.length >= 2) {
        const prefixes = new Set(names.map((n) => getTokens(n)[0]));
        if (prefixes.size > 1) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `Tools sharing "${noun}" could use consistent prefix grouping: ${names.join(', ')}`,
          });
        }
      }
    }

    return issues;
  },
};
