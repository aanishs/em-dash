/**
 * Dashboard server API tests.
 *
 * Spawns the dashboard server on a random port with a temp project dir,
 * runs HTTP tests against API endpoints, and kills the server on cleanup.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

let port: number;
let baseUrl: string;
let tmpDir: string;
let serverProc: ReturnType<typeof Bun.spawn>;

async function run(bin: string, args: string[] = [], opts: { cwd?: string } = {}) {
  const proc = Bun.spawn([path.join(BIN, bin), ...args], {
    cwd: opts.cwd ?? ROOT,
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

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      await Bun.sleep(100);
    }
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-api-'));
  fs.mkdirSync(path.join(tmpDir, '.em-dash'), { recursive: true });

  // Init compliance DB
  await run('comply-db', ['init', '--framework', 'hipaa'], { cwd: tmpDir });

  // Seed a scan result so compliance queries return data
  await run('comply-db', [
    'update-scan', 'AC-2', 'PASS', 'emdash', 'rbac-existence', 'test',
    '--framework', 'hipaa',
  ], { cwd: tmpDir });

  // Start server
  port = 4000 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;
  serverProc = Bun.spawn([
    'bun', path.join(ROOT, 'scripts', 'dashboard-server.ts'),
    '--port', String(port),
    '--project-dir', tmpDir,
  ], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await waitForServer(baseUrl);
}, 15000);

afterAll(() => {
  try { serverProc?.kill(); } catch {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

// ─── Frameworks ─────────────────────────────────────────────

describe('GET /api/frameworks', () => {
  test('returns active and available arrays', async () => {
    const res = await fetch(`${baseUrl}/api/frameworks`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.available).toBeArray();
    expect(data.available.length).toBe(6);
    expect(data.active).toBeArray();
  });

  test('includes maturity metadata', async () => {
    const res = await fetch(`${baseUrl}/api/frameworks`);
    const data = await res.json() as any;
    expect(data.maturity).toBeDefined();
    expect(data.maturity.hipaa).toBeTruthy();
  });
});

// ─── Compliance ─────────────────────────────────────────────

describe('GET /api/compliance', () => {
  test('?view=summary returns controls and summary stats', async () => {
    const res = await fetch(`${baseUrl}/api/compliance?view=summary`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.controls).toBeArray();
    expect(data.controls.length).toBeGreaterThan(0);
    expect(data.summary).toBeDefined();
    expect(data.summary.total).toBeGreaterThan(0);
  });

  test('?view=control&id=AC-2 returns control detail', async () => {
    const res = await fetch(`${baseUrl}/api/compliance?view=control&id=AC-2`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.control).toBeDefined();
    expect(data.control.oscal_id).toBe('AC-2');
    expect(data.checks).toBeArray();
  });

  test('?view=control without id returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/compliance?view=control`);
    expect(res.status).toBe(400);
  });
});

// ─── Compliance Score ───────────────────────────────────────

describe('GET /api/compliance/score', () => {
  test('returns score with per-family breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/compliance/score`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(typeof data.score).toBe('number');
    expect(typeof data.total).toBe('number');
    expect(data.families).toBeDefined();
  });
});

// ─── Findings ───────────────────────────────────────────────

describe('GET /api/compliance/findings', () => {
  test('returns findings with filter metadata', async () => {
    const res = await fetch(`${baseUrl}/api/compliance/findings`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.findings).toBeArray();
    expect(data.filter).toBeDefined();
    expect(data.filter.result).toBe('FAIL');
  });

  test('respects ?limit= parameter', async () => {
    const res = await fetch(`${baseUrl}/api/compliance/findings?limit=1`);
    const data = await res.json() as any;
    expect(data.filter.limit).toBe(1);
  });
});

// ─── Evidence upload/download/delete ────────────────────────

describe('POST /api/upload + GET/DELETE /api/evidence/*', () => {
  const testContent = 'test evidence content';
  const testFilename = 'test-evidence.txt';

  test('uploads file with SHA-256 hash', async () => {
    const formData = new FormData();
    formData.append('file', new File([testContent], testFilename, { type: 'text/plain' }));
    formData.append('framework', 'hipaa');
    formData.append('requirement', 'AC-2');

    const res = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: formData });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
    expect(data.filename).toBe(testFilename);
    expect(data.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('serves uploaded file back', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${testFilename}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe(testContent);
  });

  test('rejects path traversal in evidence serving', async () => {
    // URL-encoded path traversal — the server checks filePath.startsWith(EVIDENCE_DIR)
    const res = await fetch(`${baseUrl}/api/evidence/..%2F..%2Fetc%2Fpasswd`);
    // Should be 403 (path traversal) or 404 (file not found) — not 200
    expect([403, 404, 500]).toContain(res.status);
  });

  test('deletes file and returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/evidence/${testFilename}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
  });
});

// ─── Export ─────────────────────────────────────────────────

describe('GET /api/export/csv', () => {
  test('returns CSV with content-disposition header', async () => {
    const res = await fetch(`${baseUrl}/api/export/csv`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('text/csv');
    const body = await res.text();
    expect(body).toContain('ID');
  });
});

describe('GET /api/export/report', () => {
  test('returns HTML report', async () => {
    const res = await fetch(`${baseUrl}/api/export/report`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('Compliance Report');
  });
});

// ─── Tools + Scan ───────────────────────────────────────────

describe('GET /api/tools', () => {
  test('returns array of tools', async () => {
    const res = await fetch(`${baseUrl}/api/tools`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.tools).toBeArray();
  });
});

describe('GET /api/scan/status', () => {
  test('returns scan status', async () => {
    const res = await fetch(`${baseUrl}/api/scan/status`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('idle');
  });
});

// ─── Drift ──────────────────────────────────────────────────

describe('GET /api/compliance/drift', () => {
  test('returns drift message when < 2 scans', async () => {
    const res = await fetch(`${baseUrl}/api/compliance/drift`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    // With only 1 scan result, should say need at least 2
    expect(data.message || data.drift).toBeDefined();
  });
});

// ─── Static files ───────────────────────────────────────────

describe('Static file serving', () => {
  test('serves index.html at root', async () => {
    const res = await fetch(baseUrl);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('text/html');
  });
});
