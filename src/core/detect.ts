import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Transport } from './types.js';

const ENTRY_CANDIDATES = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'];

/**
 * Auto-detect the server entry point.
 *
 * Resolution order:
 *   1. Explicit entry from config (if provided)
 *   2. package.json `bin` (first value) or `main`
 *   3. Common file paths: src/index.ts, src/index.js, index.ts, index.js
 *
 * Returns the relative path from `dir`, or undefined if nothing found.
 */
export function detectEntry(dir = process.cwd(), configEntry?: string): string | undefined {
  // 1. Config entry
  if (configEntry && existsSync(resolve(dir, configEntry))) {
    return configEntry;
  }

  // 2. package.json bin or main
  const pkgPath = resolve(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
        bin?: string | Record<string, string>;
        main?: string;
      };

      const binEntry =
        typeof pkg.bin === 'string' ? pkg.bin : pkg.bin ? Object.values(pkg.bin)[0] : undefined;

      const candidate = binEntry ?? pkg.main;
      if (candidate && existsSync(resolve(dir, candidate))) {
        return candidate;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 3. Common file paths
  for (const candidate of ENTRY_CANDIDATES) {
    if (existsSync(resolve(dir, candidate))) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Auto-detect the transport by scanning the entry file for known imports.
 *
 * Looks for:
 *   - `StdioServerTransport` → stdio
 *   - `SSEServerTransport`   → sse
 *
 * Falls back to 'stdio' if detection fails.
 */
export function detectTransport(
  dir = process.cwd(),
  entry?: string,
  configTransport?: Transport,
): Transport {
  if (configTransport) return configTransport;
  if (!entry) return 'stdio';

  const filePath = resolve(dir, entry);
  if (!existsSync(filePath)) return 'stdio';

  try {
    const source = readFileSync(filePath, 'utf-8');
    if (source.includes('SSEServerTransport')) return 'sse';
  } catch {
    // Ignore read errors
  }

  return 'stdio';
}
