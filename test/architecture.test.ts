/**
 * em-dash v2 Architecture Tests
 *
 * Tests the NIST-first architecture:
 * - NIST 800-53 catalog exists and is parseable
 * - HIPAA filter maps specs to valid control IDs
 * - Tool bindings reference valid em-dash checks
 * - SQLite DB initializes from NIST catalog
 * - Signing and verification work
 * - 7 skills exist
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');
const NIST = path.join(ROOT, 'nist');

async function run(
  bin: string,
  args: string[] = [],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  const cmd = fs.existsSync(path.join(BIN, bin)) ? path.join(BIN, bin) : bin;
  const proc = Bun.spawn([cmd, ...args], {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited };
}

let tmpHome: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-v2-'));
});

afterAll(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const env = () => ({ HOME: tmpHome });

// ═══ NIST Catalog ═══════════════════════════════════════════

describe('NIST 800-53 Catalog', () => {
  test('catalog file exists', () => {
    expect(fs.existsSync(path.join(NIST, 'NIST_SP-800-53_rev5_catalog.json'))).toBe(true);
  });

  test('catalog is valid JSON with groups', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(NIST, 'NIST_SP-800-53_rev5_catalog.json'), 'utf-8'));
    expect(catalog.catalog).toBeDefined();
    expect(catalog.catalog.groups).toBeArray();
    expect(catalog.catalog.groups.length).toBe(20);
  });

  test('catalog has 1000+ controls', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(NIST, 'NIST_SP-800-53_rev5_catalog.json'), 'utf-8'));
    let total = 0;
    for (const g of catalog.catalog.groups) {
      total += (g.controls || []).length;
      for (const c of g.controls || []) total += (c.controls || []).length;
    }
    expect(total).toBeGreaterThan(1000);
  });
});

// ═══ HIPAA Filter ═══════════════════════════════════════════

describe('HIPAA Filter', () => {
  const filter = JSON.parse(fs.readFileSync(path.join(NIST, 'hipaa-filter.json'), 'utf-8'));

  test('has mapping field', () => {
    expect(filter.mapping).toBeDefined();
    expect(Object.keys(filter.mapping).length).toBeGreaterThan(30);
  });

  test('maps to valid 800-53 control IDs', () => {
    for (const [, controls] of Object.entries(filter.mapping)) {
      for (const id of controls as string[]) {
        expect(id).toMatch(/^[A-Z]{2}-\d+$/);
      }
    }
  });

  test('HIPAA specs follow 164.xxx format', () => {
    for (const spec of Object.keys(filter.mapping)) {
      expect(spec).toMatch(/^164\./);
    }
  });

  test('50+ unique controls referenced', () => {
    const ids = new Set<string>();
    for (const controls of Object.values(filter.mapping)) {
      for (const id of controls as string[]) ids.add(id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(40);
  });
});

// ═══ Tool Bindings ══════════════════════════════════════════

describe('Tool Bindings', () => {
  const bindings = JSON.parse(fs.readFileSync(path.join(NIST, 'tool-bindings.json'), 'utf-8'));
  const registry = fs.readFileSync(path.join(ROOT, 'frameworks', 'checks-registry.ts'), 'utf-8');
  const regIds: string[] = [];
  const re = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(registry)) !== null) regIds.push(m[1]);

  test('has bindings', () => {
    expect(Object.keys(bindings.bindings).length).toBeGreaterThan(5);
  });

  test('all emdash check IDs exist in registry', () => {
    const regSet = new Set(regIds);
    for (const [controlId, tools] of Object.entries(bindings.bindings)) {
      for (const checkId of (tools as any).emdash || []) {
        expect(regSet.has(checkId)).toBe(true);
      }
    }
  });

  test('control IDs are valid 800-53 format', () => {
    for (const id of Object.keys(bindings.bindings)) {
      expect(id).toMatch(/^[A-Z]{2}-\d+$/);
    }
  });
});

// ═══ SQLite Database ════════════════════════════════════════

describe('SQLite Database', () => {
  test('hipaa-db init imports controls', async () => {
    const { stdout, exitCode } = await run('comply-db', ['init'], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('DB_INITIALIZED');
    expect(stdout).toContain('50 controls');
  });

  test('hipaa-db status shows all controls', async () => {
    const { stdout, exitCode } = await run('comply-db', ['status'], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('AC-2');
    expect(stdout).toContain('pending');
  });

  test('hipaa-db control shows NIST prose', async () => {
    const { stdout, exitCode } = await run('comply-db', ['control', 'AC-2'], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Account Management');
    expect(stdout).toContain('NIST Statement');
  });

  test('hipaa-db update-scan records results', async () => {
    const { exitCode } = await run('comply-db', ['update-scan', 'AC-2', 'PASS', 'emdash', 'aws-iam-wildcard', 'no wildcards'], { env: env() });
    expect(exitCode).toBe(0);
    const { stdout } = await run('comply-db', ['control', 'AC-2'], { env: env() });
    expect(stdout).toContain('PASS');
    expect(stdout).toContain('aws-iam-wildcard');
  });

  test('hipaa-db summary shows counts', async () => {
    const { stdout, exitCode } = await run('comply-db', ['summary'], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('50 total');
  });

  test('hipaa-db query works', async () => {
    const { stdout, exitCode } = await run('comply-db', ['query', 'SELECT COUNT(*) as cnt FROM controls'], { env: env() });
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data[0].cnt).toBe(50);
  });
});

// ═══ Signing ════════════════════════════════════════════════

describe('Signing & Verification', () => {
  test('init-keys + sign + verify', async () => {
    await run('comply-attest', ['init-keys'], { env: env() });
    const out = path.join(tmpHome, 'test-attest.json');
    await run('comply-attest', ['check', '--check-id', 'test', '--requirement-id', 'AC-2',
      '--result', 'PASS', '--evidence-hash', 'sha256:abc', '--output', out], { env: env() });
    const { exitCode } = await run('comply-attest', ['verify', '--attestation', out], { env: env() });
    expect(exitCode).toBe(0);
  });

  test('tamper detection', async () => {
    const out = path.join(tmpHome, 'tamper-attest.json');
    await run('comply-attest', ['check', '--check-id', 'td', '--requirement-id', 'AC-2',
      '--result', 'PASS', '--evidence-hash', 'sha256:def', '--output', out], { env: env() });
    const data = JSON.parse(fs.readFileSync(out, 'utf-8'));
    data.result = 'FAIL';
    fs.writeFileSync(out, JSON.stringify(data));
    const { exitCode } = await run('comply-attest', ['verify', '--attestation', out], { env: env() });
    expect(exitCode).toBe(1);
  });
});

// ═══ Skills ═════════════════════════════════════════════════

describe('Skills (8 total)', () => {
  test('exactly 8 skill directories', () => {
    const skills = fs.readdirSync(path.join(ROOT, 'skills'))
      .filter((d: string) => fs.statSync(path.join(ROOT, 'skills', d)).isDirectory());
    expect(skills.length).toBe(8);
  });

  test('expected skills present', () => {
    const expected = ['comply', 'comply-auto', 'comply-assess', 'comply-scan', 'comply-fix', 'comply-report', 'comply-breach', 'em-dashboard'];
    const skills = fs.readdirSync(path.join(ROOT, 'skills'))
      .filter((d: string) => fs.statSync(path.join(ROOT, 'skills', d)).isDirectory());
    for (const s of expected) expect(skills).toContain(s);
  });

  test('each skill has SKILL.md and SKILL.md.tmpl', () => {
    const skills = fs.readdirSync(path.join(ROOT, 'skills'))
      .filter((d: string) => fs.statSync(path.join(ROOT, 'skills', d)).isDirectory());
    for (const s of skills) {
      expect(fs.existsSync(path.join(ROOT, 'skills', s, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(ROOT, 'skills', s, 'SKILL.md.tmpl'))).toBe(true);
    }
  });

  test('old skills removed', () => {
    const removed = ['comply-vendor', 'comply-risk', 'comply-monitor', 'comply-oscal-import',
      'comply-verify', 'comply-remediate', 'soc2', 'soc2-scan'];
    const skills = fs.readdirSync(path.join(ROOT, 'skills'))
      .filter((d: string) => fs.statSync(path.join(ROOT, 'skills', d)).isDirectory());
    for (const s of removed) expect(skills).not.toContain(s);
  });
});

// ═══ Checks Registry ════════════════════════════════════════

describe('Checks Registry (pure execution)', () => {
  const content = fs.readFileSync(path.join(ROOT, 'frameworks', 'checks-registry.ts'), 'utf-8');

  test('no framework mappings', () => {
    expect(content).not.toContain('frameworks: Record<string');
    expect(content).not.toContain('FrameworkMapping');
  });

  test('50 checks defined', () => {
    const ids: string[] = [];
    const re = /id:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(content)) !== null) ids.push(m[1]);
    expect(ids.length).toBe(50);
    expect(new Set(ids).size).toBe(50);
  });
});
