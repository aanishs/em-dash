/**
 * Diff-based test selection for E2E and LLM-judge evals.
 *
 * Each test declares which source files it depends on ("touchfiles").
 * The test runner checks `git diff` and only runs tests whose
 * dependencies were modified. Override with EVALS_ALL=1 to run everything.
 */

import { spawnSync } from 'child_process';

// --- Glob matching ---

/**
 * Match a file path against a glob pattern.
 * Supports:
 *   ** — match any number of path segments
 *   *  — match within a single segment (no /)
 */
export function matchGlob(file: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(file);
}

// --- Touchfile maps ---

/**
 * E2E test touchfiles — keyed by testName.
 * Each test lists the file patterns that, if changed, require the test to run.
 */
export const E2E_TOUCHFILES: Record<string, string[]> = {
  'hipaa-scan-basic':     ['skills/hipaa-scan/**', 'scripts/gen-skill-docs.ts', 'policies/**'],
  'hipaa-assess-basic':   ['skills/hipaa-assess/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-remediate':      ['skills/hipaa-remediate/**', 'policies/**', 'templates/**'],
  'hipaa-report':         ['skills/hipaa-report/**'],
  'hipaa-router':         ['skills/hipaa/**'],
  'hipaa-monitor':        ['skills/hipaa-monitor/**'],
  'hipaa-breach':         ['skills/hipaa-breach/**'],
};

/**
 * LLM-judge test touchfiles — keyed by test description string.
 */
export const LLM_JUDGE_TOUCHFILES: Record<string, string[]> = {
  'hipaa-scan report quality':     ['skills/hipaa-scan/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-assess interview flow':   ['skills/hipaa-assess/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-remediate fix quality':   ['skills/hipaa-remediate/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-report completeness':     ['skills/hipaa-report/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-monitor drift detection': ['skills/hipaa-monitor/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-breach response flow':    ['skills/hipaa-breach/**', 'scripts/gen-skill-docs.ts'],
  'hipaa-router dispatch':         ['skills/hipaa/**', 'scripts/gen-skill-docs.ts'],
};

/**
 * Changes to any of these files trigger ALL tests (both E2E and LLM-judge).
 */
export const GLOBAL_TOUCHFILES = [
  'test/helpers/session-runner.ts',
  'test/helpers/eval-store.ts',
  'test/helpers/llm-judge.ts',
  'scripts/gen-skill-docs.ts',
  'test/helpers/touchfiles.ts',
];

// --- Base branch detection ---

/**
 * Detect the base branch by trying refs in order.
 * Returns the first valid ref, or null if none found.
 */
export function detectBaseBranch(cwd: string): string | null {
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    const result = spawnSync('git', ['rev-parse', '--verify', ref], {
      cwd, stdio: 'pipe', timeout: 3000,
    });
    if (result.status === 0) return ref;
  }
  return null;
}

/**
 * Get list of files changed between base branch and HEAD.
 */
export function getChangedFiles(baseBranch: string, cwd: string): string[] {
  const result = spawnSync('git', ['diff', '--name-only', `${baseBranch}...HEAD`], {
    cwd, stdio: 'pipe', timeout: 5000,
  });
  if (result.status !== 0) return [];
  return result.stdout.toString().trim().split('\n').filter(Boolean);
}

// --- Test selection ---

/**
 * Select tests to run based on changed files.
 *
 * Algorithm:
 * 1. If any changed file matches a global touchfile → run ALL tests
 * 2. Otherwise, for each test, check if any changed file matches its patterns
 * 3. Return selected + skipped lists with reason
 */
export function selectTests(
  changedFiles: string[],
  touchfiles: Record<string, string[]>,
  globalTouchfiles: string[] = GLOBAL_TOUCHFILES,
): { selected: string[]; skipped: string[]; reason: string } {
  const allTestNames = Object.keys(touchfiles);

  // Global touchfile hit → run all
  for (const file of changedFiles) {
    if (globalTouchfiles.some(g => matchGlob(file, g))) {
      return { selected: allTestNames, skipped: [], reason: `global: ${file}` };
    }
  }

  // Per-test matching
  const selected: string[] = [];
  const skipped: string[] = [];
  for (const [testName, patterns] of Object.entries(touchfiles)) {
    const hit = changedFiles.some(f => patterns.some(p => matchGlob(f, p)));
    (hit ? selected : skipped).push(testName);
  }

  return { selected, skipped, reason: 'diff' };
}
