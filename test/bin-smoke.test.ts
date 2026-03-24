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

describe('Bin smoke: hipaa-slug', () => {
  let tmpDir: string;

  beforeAll(() => {
    // Create a git repo with no remote to test basename fallback
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-slug-'));
    Bun.spawnSync(['git', 'init'], { cwd: tmpDir });
    Bun.spawnSync(['git', 'commit', '--allow-empty', '-m', 'init'], {
      cwd: tmpDir,
      env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@test.com' },
    });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('falls back to directory name when no git remote', async () => {
    const { stdout, exitCode } = await run('hipaa-slug', [], { cwd: tmpDir });
    expect(exitCode).toBe(0);
    const dirName = path.basename(tmpDir);
    expect(stdout).toContain(`SLUG=${dirName}`);
    expect(stdout).toContain('BRANCH=');
  });

  test('produces org-repo slug when remote exists', async () => {
    const tmpWithRemote = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-slug-remote-'));
    Bun.spawnSync(['git', 'init'], { cwd: tmpWithRemote });
    Bun.spawnSync(['git', 'commit', '--allow-empty', '-m', 'init'], {
      cwd: tmpWithRemote,
      env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@test.com' },
    });
    Bun.spawnSync(['git', 'remote', 'add', 'origin', 'https://github.com/acme/my-repo.git'], { cwd: tmpWithRemote });

    const { stdout, exitCode } = await run('hipaa-slug', [], { cwd: tmpWithRemote });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('SLUG=acme-my-repo');

    fs.rmSync(tmpWithRemote, { recursive: true, force: true });
  });
});

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

  test('exits 1 for empty directory', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-hash-empty-'));
    const { exitCode, stderr } = await run('hipaa-evidence-hash', [emptyDir]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('No files found');
    // Manifest should not exist
    expect(fs.existsSync(path.join(emptyDir, 'evidence-manifest.sha256'))).toBe(false);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  test('handles filenames with spaces', async () => {
    const spaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-hash-space-'));
    fs.writeFileSync(path.join(spaceDir, 'my file.txt'), 'content with spaces');
    fs.writeFileSync(path.join(spaceDir, 'normal.txt'), 'normal');
    const { stdout, exitCode } = await run('hipaa-evidence-hash', [spaceDir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('2 files hashed');
    const manifest = fs.readFileSync(path.join(spaceDir, 'evidence-manifest.sha256'), 'utf-8');
    expect(manifest).toContain('my file.txt');
    expect(manifest).toContain('normal.txt');
    fs.rmSync(spaceDir, { recursive: true, force: true });
  });
});

describe('Bin smoke: hipaa-dashboard-update', () => {
  let tmpDir: string;
  const dashDir = () => path.join(tmpDir, '.em-dash');
  const dashFile = () => path.join(dashDir(), 'dashboard.json');

  const baseDashboard = () => ({
    version: 2,
    project: { name: 'test', slug: 'test', frameworks: ['hipaa'] },
    frameworks: {
      hipaa: {
        status: 'in-progress',
        skills: { scan: { status: 'done', timestamp: '2026-01-01T00:00:00Z', findings: 0, summary: '' } },
        checklist: [
          { id: '164.312(a)(1)', section: 'Technical', text: 'Access Control', status: 'pending', evidence: [], notes: '', custom: false },
        ],
        findings: [],
        evidence_gaps: [],
      },
    },
    evidence: { files: [] },
    vendors: [],
    risk_register: [],
  });

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-dash-'));
    fs.mkdirSync(dashDir());
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('checklist note deduplication — same note twice produces one entry', async () => {
    fs.writeFileSync(dashFile(), JSON.stringify(baseDashboard(), null, 2));

    await run('hipaa-dashboard-update', ['checklist', '164.312(a)(1)', 'complete', 'RBAC verified'], { cwd: tmpDir });
    await run('hipaa-dashboard-update', ['checklist', '164.312(a)(1)', 'complete', 'RBAC verified'], { cwd: tmpDir });

    const d = JSON.parse(fs.readFileSync(dashFile(), 'utf-8'));
    const item = d.frameworks.hipaa.checklist[0];
    expect(item.notes).toBe('RBAC verified');
    expect(item.notes.split('RBAC verified').length - 1).toBe(1);
  });

  test('checklist appends different notes with semicolon', async () => {
    fs.writeFileSync(dashFile(), JSON.stringify(baseDashboard(), null, 2));

    await run('hipaa-dashboard-update', ['checklist', '164.312(a)(1)', 'complete', 'RBAC verified'], { cwd: tmpDir });
    await run('hipaa-dashboard-update', ['checklist', '164.312(a)(1)', 'complete', 'MFA enforced'], { cwd: tmpDir });

    const d = JSON.parse(fs.readFileSync(dashFile(), 'utf-8'));
    const item = d.frameworks.hipaa.checklist[0];
    expect(item.notes).toBe('RBAC verified; MFA enforced');
  });

  test('finding add updates skill finding count', async () => {
    fs.writeFileSync(dashFile(), JSON.stringify(baseDashboard(), null, 2));

    await run('hipaa-dashboard-update', ['finding', 'add', '--title', 'No VPC flow logs', '--severity', 'high', '--requirement', '164.312(b)', '--source', 'scan'], { cwd: tmpDir });
    await run('hipaa-dashboard-update', ['finding', 'add', '--title', 'No GuardDuty', '--severity', 'high', '--requirement', '164.312(b)', '--source', 'scan'], { cwd: tmpDir });

    const d = JSON.parse(fs.readFileSync(dashFile(), 'utf-8'));
    expect(d.frameworks.hipaa.findings.length).toBe(2);
    expect(d.frameworks.hipaa.skills.scan.findings).toBe(2);
  });

  test('finding resolve decrements skill finding count', async () => {
    fs.writeFileSync(dashFile(), JSON.stringify(baseDashboard(), null, 2));

    await run('hipaa-dashboard-update', ['finding', 'add', '--title', 'No VPC flow logs', '--severity', 'high', '--requirement', '164.312(b)', '--source', 'scan'], { cwd: tmpDir });
    await run('hipaa-dashboard-update', ['finding', 'add', '--title', 'No GuardDuty', '--severity', 'high', '--requirement', '164.312(b)', '--source', 'scan'], { cwd: tmpDir });
    await run('hipaa-dashboard-update', ['finding', 'resolve', '--title', 'No VPC flow logs'], { cwd: tmpDir });

    const d = JSON.parse(fs.readFileSync(dashFile(), 'utf-8'));
    expect(d.frameworks.hipaa.skills.scan.findings).toBe(1);
  });

  test('sync subcommand reconciles stale counts', async () => {
    const db = baseDashboard();
    db.frameworks.hipaa.skills.scan.findings = 99; // intentionally stale
    db.frameworks.hipaa.findings = [
      { id: 'F-1', title: 'Bug A', severity: 'high', status: 'open', source: 'scan', requirement: '', discovered_at: '', resolved_at: null },
      { id: 'F-2', title: 'Bug B', severity: 'medium', status: 'resolved', source: 'scan', requirement: '', discovered_at: '', resolved_at: '' },
    ];
    fs.writeFileSync(dashFile(), JSON.stringify(db, null, 2));

    const { stdout, exitCode } = await run('hipaa-dashboard-update', ['sync'], { cwd: tmpDir });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Synced: 1 open findings');

    const d = JSON.parse(fs.readFileSync(dashFile(), 'utf-8'));
    expect(d.frameworks.hipaa.skills.scan.findings).toBe(1);
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
