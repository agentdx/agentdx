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
  'get',
  'gets',
  'set',
  'sets',
  'create',
  'creates',
  'update',
  'updates',
  'delete',
  'deletes',
  'remove',
  'removes',
  'add',
  'adds',
  'find',
  'finds',
  'search',
  'searches',
  'list',
  'lists',
  'fetch',
  'fetches',
  'send',
  'sends',
  'post',
  'posts',
  'put',
  'puts',
  'read',
  'reads',
  'write',
  'writes',
  'check',
  'checks',
  'validate',
  'validates',
  'verify',
  'verifies',
  'parse',
  'parses',
  'convert',
  'converts',
  'transform',
  'transforms',
  'generate',
  'generates',
  'calculate',
  'calculates',
  'compute',
  'computes',
  'run',
  'runs',
  'execute',
  'executes',
  'start',
  'starts',
  'stop',
  'stops',
  'open',
  'opens',
  'close',
  'closes',
  'connect',
  'connects',
  'enable',
  'enables',
  'disable',
  'disables',
  'upload',
  'uploads',
  'download',
  'downloads',
  'export',
  'exports',
  'import',
  'imports',
  'retrieve',
  'retrieves',
  'return',
  'returns',
  'query',
  'queries',
  'resolve',
  'resolves',
  'provide',
  'provides',
  'display',
  'displays',
  'show',
  'shows',
  'configure',
  'configures',
  'modify',
  'modifies',
  'extract',
  'extracts',
  'apply',
  'applies',
  'deploy',
  'deploys',
  'build',
  'builds',
  'install',
  'installs',
  'subscribe',
  'subscribes',
  'monitor',
  'monitors',
  'track',
  'tracks',
  'log',
  'logs',
  'initiate',
  'initiates',
  'terminate',
  'terminates',
  'sync',
  'syncs',
  'refresh',
  'refreshes',
  'reset',
  'resets',
  'load',
  'loads',
  'save',
  'saves',
  'store',
  'stores',
  'submit',
  'submits',
  'cancel',
  'cancels',
  'approve',
  'approves',
  'reject',
  'rejects',
  'move',
  'moves',
  'copy',
  'copies',
  'rename',
  'renames',
  'test',
  'tests',
  'analyze',
  'analyzes',
  'inspect',
  'inspects',
  // Navigation & browser actions
  'navigate',
  'navigates',
  'capture',
  'captures',
  'perform',
  'performs',
  'hover',
  'hovers',
  'select',
  'selects',
  'resize',
  'resizes',
  'take',
  'takes',
  'press',
  'presses',
  'type',
  'types',
  'fill',
  'fills',
  'wait',
  'waits',
  'reload',
  'reloads',
  'evaluate',
  'evaluates',
  'toggle',
  'toggles',
  'trigger',
  'triggers',
  'simulate',
  'simulates',
  'echo',
  'echoes',
  'drag',
  'drags',
  'click',
  'clicks',
  'scroll',
  'scrolls',
  'focus',
  'focuses',
  'submit',
  'submits',
  'clear',
  'clears',
  'attach',
  'attaches',
  'detach',
  'detaches',
  'emit',
  'emits',
  'listen',
  'listens',
  'watch',
  'watches',
  'poll',
  'polls',
  'ping',
  'pings',
  'render',
  'renders',
  'format',
  'formats',
  'sort',
  'sorts',
  'filter',
  'filters',
  'merge',
  'merges',
  'split',
  'splits',
  'encode',
  'encodes',
  'decode',
  'decodes',
  'encrypt',
  'encrypts',
  'decrypt',
  'decrypts',
  'compress',
  'compresses',
  'decompress',
  'decompresses',
  'count',
  'counts',
  'measure',
  'measures',
  'compare',
  'compares',
  'notify',
  'notifies',
  'alert',
  'alerts',
  'warn',
  'warns',
  'accept',
  'accepts',
  'deny',
  'denies',
  'grant',
  'grants',
  'revoke',
  'revokes',
  'assign',
  'assigns',
  'release',
  'releases',
  'lock',
  'locks',
  'unlock',
  'unlocks',
  'publish',
  'publishes',
  'index',
  'indexes',
  'scan',
  'scans',
  'crawl',
  'crawls',
  'schedule',
  'schedules',
  'pause',
  'pauses',
  'resume',
  'resumes',
  'archive',
  'archives',
  'restore',
  'restores',
  'backup',
  'backups',
  'register',
  'registers',
  'unregister',
  'unregisters',
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
      const firstWord = desc
        .split(/\s+/)[0]
        ?.toLowerCase()
        .replace(/[^a-z]/g, '');
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
  /\bhandles?\b/i,
  /\bprocesse?s?\b/i,
  /\bmanages?\b/i,
  /\bdoes\b/i,
  /\bperforms?\b/i,
  /\bworks?\s+with\b/i,
  /\bdeals?\s+with\b/i,
  /\btakes?\s+care\s+of\b/i,
  /\bmisc\b/i,
  /\bvarious\b/i,
  /\betc\.?\b/i,
  /\bstuff\b/i,
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
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
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
        const sim = jaccardSimilarity(wordSet(a.description!), wordSet(b.description!));
        if (sim > 0.8) {
          issues.push({
            rule: this.id,
            severity: this.severity,
            message: `${a.name}: description too similar to ${b.name} — LLM won't know which to pick`,
            tool: a.name,
            fix: `Differentiate the descriptions of "${a.name}" and "${b.name}" to clarify their distinct purposes`,
            docs: 'https://arxiv.org/abs/2602.14878',
          });
        }
      }
    }
    return issues;
  },
};

const PURPOSE_PATTERNS = [
  /\b(retriev|fetch|get|return|creat|updat|delet|remov|search|list|find|send|generat|comput|calculat|convert|transform|validat|check|verif|pars|extract|resolv|configur|monitor|subscrib|deploy|build|install|navigat|captur|click|hover|select|clos|resiz|press|type|fill|upload|wait|reload|evaluat|drag|toggl|trigger|simulat|echo|scroll|render|format|submit|clear|encod|decod|encrypt|decrypt|compress|decompress|scan|crawl|publish|index|schedul|paus|resum|archiv|restor|backup|register)/i,
];

export const descStatesPurpose: LintRule = {
  id: 'description-states-purpose',
  description: 'Tool description must clearly state what the tool does',
  severity: 'warn',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (!desc) continue;
      // A description that states purpose should contain an action/outcome
      const hasPurpose = PURPOSE_PATTERNS.some((p) => p.test(desc));
      if (!hasPurpose && desc.length < 50) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: description doesn't clearly state what the tool does`,
          tool: tool.name,
          fix: `Rewrite to clearly state the action: "Retrieves...", "Creates...", "Searches..."`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};

const USAGE_KEYWORDS = [
  /\buse\s+(this|when|to|for)\b/i,
  /\bcall\s+(this|when|to)\b/i,
  /\binvoke\b/i,
  /\bwhen\b/i,
  /\bfor\s+(getting|creating|updating|deleting|searching|listing)\b/i,
  /\buseful\s+for\b/i,
  /\bto\s+(get|create|update|delete|search|list|find|fetch)\b/i,
];

export const descIncludesUsageGuidance: LintRule = {
  id: 'description-includes-usage-guidance',
  description: 'Description should explain when or how to use the tool',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (!desc || desc.length < 30) continue;
      const hasGuidance = USAGE_KEYWORDS.some((p) => p.test(desc));
      if (!hasGuidance) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: description lacks usage guidance — explain when to use this tool`,
          tool: tool.name,
          fix: `Add context like "Use this to..." or "Call when..." to help the LLM choose the right tool`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};

const LIMITATION_KEYWORDS = [
  /\bmax(imum)?\b/i,
  /\blimit(ed|s)?\b/i,
  /\brate.?limit\b/i,
  /\bonly\b/i,
  /\bcannot\b/i,
  /\bcan't\b/i,
  /\bwon't\b/i,
  /\bdoes\s+not\b/i,
  /\bup\s+to\b/i,
  /\bat\s+most\b/i,
  /\brequires?\b/i,
  /\bmust\b/i,
  /\bnote:?\b/i,
  /\bcaveat\b/i,
  /\bwarning\b/i,
  /\brestrict/i,
];

export const descStatesLimitations: LintRule = {
  id: 'description-states-limitations',
  description: 'Description should mention constraints or limitations',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (!desc || desc.length < 40) continue;
      const hasLimitations = LIMITATION_KEYWORDS.some((p) => p.test(desc));
      if (!hasLimitations) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: description doesn't mention any constraints or limitations`,
          tool: tool.name,
          fix: `Document limits like max results, rate limits, required permissions, or data restrictions`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};

export const descHasExamples: LintRule = {
  id: 'description-has-examples',
  description: 'Complex tools should include example inputs',
  severity: 'info',
  check(tools) {
    const issues: LintIssue[] = [];
    for (const tool of tools) {
      const desc = tool.description?.trim();
      if (!desc) continue;
      const props = tool.inputSchema?.properties;
      const paramCount = props ? Object.keys(props).length : 0;
      // Only flag tools with 3+ params as "complex enough to need examples"
      if (paramCount < 3) continue;
      const hasExample = /\b(e\.?g\.?|example|for\s+instance|such\s+as|like\s+")/i.test(desc);
      // Also check param descriptions for examples
      const paramDescs = props
        ? Object.values(props).map((p) => (p as { description?: string }).description ?? '')
        : [];
      const paramHasExample = paramDescs.some((d) =>
        /\b(e\.?g\.?|example|for\s+instance)/i.test(d),
      );
      if (!hasExample && !paramHasExample) {
        issues.push({
          rule: this.id,
          severity: this.severity,
          message: `${tool.name}: complex tool (${paramCount} params) lacks examples in description`,
          tool: tool.name,
          fix: `Add example inputs like 'e.g. {"query": "weather in NYC"}' to help the LLM understand usage`,
          docs: 'https://arxiv.org/abs/2602.14878',
        });
      }
    }
    return issues;
  },
};
