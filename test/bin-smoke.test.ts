import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

/** Run a bin utility and return { stdout, stderr, exitCode } */
async function run(
  bin: string,
  args: string[] = [],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  const proc = Bun.spawn([path.join(BIN, bin), ...args], {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// hipaa-slug tests skipped until repo has a git remote (set -e fails on `git remote get-url origin`)

describe('Bin smoke: hipaa-tool-detect', () => {
  test('outputs KEY=value lines for all categories', async () => {
    const { stdout, exitCode } = await run('hipaa-tool-detect');
    expect(exitCode).toBe(0);

    const lines = stdout.split('\n');
    // Every line must be KEY=value format (keys may contain digits, e.g. K8S)
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z0-9_]+=\w+$/);
    }
  });

  test('includes expected key prefixes', async () => {
    const { stdout } = await run('hipaa-tool-detect');
    const prefixes = ['CLOUD_', 'TOOL_', 'CONTAINER_', 'IAC_', 'DB_', 'UTIL_'];
    for (const prefix of prefixes) {
      expect(stdout).toMatch(new RegExp(`^${prefix}\\w+=`, 'm'));
    }
  });
});

describe('Bin smoke: hipaa-review-log', () => {
  let tmpHome: string;

  beforeAll(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('write + read round-trips a review entry', async () => {
    const slug = 'test-project';
    const { stdout: writeOut, exitCode: writeCode } = await run(
      'hipaa-review-log',
      ['write', slug, 'hipaa-scan', 'pass', '0'],
      { env: { HOME: tmpHome } },
    );
    expect(writeCode).toBe(0);
    expect(writeOut).toContain('Logged:');

    const { stdout: readOut, exitCode: readCode } = await run(
      'hipaa-review-log',
      ['read', slug],
      { env: { HOME: tmpHome } },
    );
    expect(readCode).toBe(0);
    const entry = JSON.parse(readOut);
    expect(entry.skill).toBe('hipaa-scan');
    expect(entry.status).toBe('pass');
    expect(entry.findings).toBe(0);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('dashboard renders table with header', async () => {
    const slug = 'test-project';
    const { stdout, exitCode } = await run(
      'hipaa-review-log',
      ['dashboard', slug],
      { env: { HOME: tmpHome } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('HIPAA COMPLIANCE DASHBOARD');
    expect(stdout).toContain('hipaa-scan');
  });

  test('exits 1 with no subcommand', async () => {
    const { exitCode, stderr } = await run('hipaa-review-log', [], { env: { HOME: tmpHome } });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Usage:');
  });
});

describe('Bin smoke: hipaa-evidence-hash', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-hash-'));
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'world');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('hashes a single file', async () => {
    const { stdout, exitCode } = await run('hipaa-evidence-hash', [
      path.join(tmpDir, 'a.txt'),
    ]);
    expect(exitCode).toBe(0);
    // SHA-256 hex is 64 chars
    expect(stdout).toMatch(/[a-f0-9]{64}/);
  });

  test('hashes a directory and creates manifest', async () => {
    const { stdout, exitCode } = await run('hipaa-evidence-hash', [tmpDir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Manifest written');
    expect(stdout).toMatch(/\d+ files hashed/);

    const manifest = path.join(tmpDir, 'evidence-manifest.sha256');
    expect(fs.existsSync(manifest)).toBe(true);
    const content = fs.readFileSync(manifest, 'utf-8');
    expect(content).toContain('a.txt');
    expect(content).toContain('b.txt');
  });

  test('exits 1 for nonexistent target', async () => {
    const { exitCode, stderr } = await run('hipaa-evidence-hash', ['/nonexistent/path']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('not found');
  });
});

describe('Bin smoke: hipaa-config', () => {
  let tmpHome: string;

  beforeAll(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-cfg-'));
  });

  afterAll(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('set + get round-trips a value', async () => {
    const { exitCode: setCode } = await run(
      'hipaa-config',
      ['set', 'org_name', 'TestCorp'],
      { env: { HOME: tmpHome } },
    );
    expect(setCode).toBe(0);

    const { stdout, exitCode: getCode } = await run(
      'hipaa-config',
      ['get', 'org_name'],
      { env: { HOME: tmpHome } },
    );
    expect(getCode).toBe(0);
    expect(stdout).toBe('TestCorp');
  });

  test('get returns empty for unknown key', async () => {
    const { stdout, exitCode } = await run(
      'hipaa-config',
      ['get', 'nonexistent_key'],
      { env: { HOME: tmpHome } },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('exits 1 with no subcommand', async () => {
    const { exitCode, stderr } = await run('hipaa-config', [], { env: { HOME: tmpHome } });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Usage:');
  });
});
