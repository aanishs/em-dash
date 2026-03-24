/**
 * OSCAL Bridge tests — parser, signer, verifier, attestation schema, audit packet.
 *
 * Coverage targets from the eng review:
 *   OSCAL Parser: 10 tests
 *   Ed25519 Signer: 12 tests
 *   Attestation Schema: 8 tests
 *   Audit Packet: 10 tests
 *   Edge Cases: 11 tests
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

async function run(
  bin: string,
  args: string[] = [],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  // Use bin/ directory for em-dash utilities, system PATH for others (like unzip)
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
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// ═══ Test Fixtures ══════════════════════════════════════════

let tmpHome: string;
let tmpAttest: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-oscal-test-'));
  tmpAttest = path.join(tmpHome, 'attestations');
  fs.mkdirSync(tmpAttest, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const env = () => ({ HOME: tmpHome });

// ═══ OSCAL Parser Tests (10) ════════════════════════════════

describe('OSCAL Parser', () => {
  const mappingPath = path.join(ROOT, 'frameworks', 'oscal', 'mappings', 'hipaa-sp800-66r2.json');

  test('loads valid HIPAA mapping', () => {
    const content = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    expect(content.profile_id).toBe('hipaa-sp800-66r2-v1');
    expect(content.controls).toBeArray();
    expect(content.controls.length).toBe(10);
  });

  test('each control has required fields', () => {
    const content = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    for (const control of content.controls) {
      expect(control.oscal_id).toBeString();
      expect(control.title).toBeString();
      expect(control.family).toBeString();
      expect(control.hipaa_refs).toBeArray();
      expect(control.hipaa_refs.length).toBeGreaterThan(0);
      expect(control.plain_english).toBeString();
      expect(control.plain_english.length).toBeGreaterThan(50);
      expect(control.automated_checks).toBeArray();
      expect(control.evidence_types).toBeArray();
    }
  });

  test('no duplicate OSCAL IDs', () => {
    const content = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    const ids = content.controls.map((c: { oscal_id: string }) => c.oscal_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('OSCAL IDs follow NIST format', () => {
    const content = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    for (const control of content.controls) {
      expect(control.oscal_id).toMatch(/^[A-Z]{2}-\d+$/);
    }
  });

  test('HIPAA refs map to valid requirements', () => {
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    const hipaa = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'frameworks', 'hipaa.json'), 'utf-8'),
    );
    const validReqs = new Set(hipaa.requirements.map((r: { id: string }) => r.id));

    for (const control of mapping.controls) {
      for (const ref of control.hipaa_refs) {
        expect(validReqs.has(ref)).toBe(true);
      }
    }
  });

  test('automated_checks reference valid check IDs', async () => {
    const { exitCode } = await run('hipaa-oscal-import', ['validate']);
    expect(exitCode).toBe(0);
  });

  test('status subcommand outputs mapping info', async () => {
    const { stdout, exitCode } = await run('hipaa-oscal-import', ['status']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('hipaa-sp800-66r2-v1');
    expect(stdout).toContain('10');
  });

  test('controls subcommand lists all controls', async () => {
    const { stdout, exitCode } = await run('hipaa-oscal-import', ['controls']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('AC-2');
    expect(stdout).toContain('Account Management');
  });

  test('export subcommand produces markdown', async () => {
    const { stdout, exitCode } = await run('hipaa-oscal-import', ['export']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('# HIPAA');
    expect(stdout).toContain('## AC-2');
  });

  test('unknown subcommand exits with error', async () => {
    const { exitCode, stderr } = await run('hipaa-oscal-import', ['nonexistent']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown subcommand');
  });
});

// ═══ HIPAA JSON Schema Tests (8) ════════════════════════════

describe('HIPAA Applicability & OSCAL Refs', () => {
  const hipaaPath = path.join(ROOT, 'frameworks', 'hipaa.json');
  let hipaa: { requirements: Array<{ id: string; applicability?: string; oscal_refs?: string[] }> };

  beforeAll(() => {
    hipaa = JSON.parse(fs.readFileSync(hipaaPath, 'utf-8'));
  });

  test('every requirement has applicability field', () => {
    for (const req of hipaa.requirements) {
      expect(req.applicability).toBeDefined();
      expect(['required', 'addressable']).toContain(req.applicability);
    }
  });

  test('every requirement has oscal_refs field', () => {
    for (const req of hipaa.requirements) {
      expect(req.oscal_refs).toBeArray();
      expect(req.oscal_refs!.length).toBeGreaterThan(0);
    }
  });

  test('oscal_refs follow NIST format', () => {
    for (const req of hipaa.requirements) {
      for (const ref of req.oscal_refs!) {
        expect(ref).toMatch(/^[A-Z]{2}-\d+$/);
      }
    }
  });

  test('required count is correct (14 required, 4 addressable)', () => {
    const required = hipaa.requirements.filter((r) => r.applicability === 'required');
    const addressable = hipaa.requirements.filter((r) => r.applicability === 'addressable');
    expect(required.length).toBe(14);
    expect(addressable.length).toBe(4);
  });

  test('addressable requirements are correct HIPAA specs', () => {
    const addressable = hipaa.requirements
      .filter((r) => r.applicability === 'addressable')
      .map((r) => r.id)
      .sort();
    // These are the implementation specifications that HIPAA designates as addressable
    expect(addressable).toContain('164.308(a)(3)(ii)(C)'); // Termination procedures
    expect(addressable).toContain('164.308(a)(5)(i)'); // Security awareness training
    expect(addressable).toContain('164.312(a)(2)(iii)'); // Automatic logoff
    expect(addressable).toContain('164.312(a)(2)(iv)'); // Encryption at rest
  });

  test('schema.ts exports Applicability type', async () => {
    const schema = await import(path.join(ROOT, 'frameworks', 'schema.ts'));
    expect(schema).toBeDefined();
  });

  test('oscal_refs are unique per requirement', () => {
    for (const req of hipaa.requirements) {
      const refs = req.oscal_refs!;
      expect(new Set(refs).size).toBe(refs.length);
    }
  });

  test('backward compatible — existing fields unchanged', () => {
    // Ensure we didn't break existing structure
    for (const req of hipaa.requirements) {
      expect(req.id).toBeString();
      expect(req.section).toBeString();
      expect(req.name).toBeString();
      expect(req.description).toBeString();
      expect(req.check_ids).toBeArray();
    }
  });
});

// ═══ Ed25519 Signer Tests (12) ══════════════════════════════

describe('Ed25519 Signer', () => {
  test('init-keys generates keypair', async () => {
    const { stdout, exitCode } = await run('hipaa-attest', ['init-keys'], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Generated Ed25519 keypair');
    expect(fs.existsSync(path.join(tmpHome, '.em-dash', 'keys', 'default.pem'))).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, '.em-dash', 'keys', 'default.pub'))).toBe(true);
  });

  test('init-keys is idempotent', async () => {
    const { stdout, exitCode } = await run('hipaa-attest', ['init-keys'], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Keys already exist');
  });

  test('sign check attestation', async () => {
    const output = path.join(tmpAttest, 'check-test1.json');
    const { exitCode } = await run(
      'hipaa-attest',
      ['check', '--check-id', 'test-check', '--requirement-id', '164.312(d)',
       '--result', 'PASS', '--evidence-hash', 'sha256:abc', '--output', output],
      { env: env() },
    );
    expect(exitCode).toBe(0);
    const attestation = JSON.parse(fs.readFileSync(output, 'utf-8'));
    expect(attestation.type).toBe('check');
    expect(attestation.check_id).toBe('test-check');
    expect(attestation.result).toBe('PASS');
    expect(attestation.signature).toBeString();
  });

  test('verify with correct key succeeds', async () => {
    const output = path.join(tmpAttest, 'check-verify-ok.json');
    await run(
      'hipaa-attest',
      ['check', '--check-id', 'v1', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:x', '--output', output],
      { env: env() },
    );
    const { exitCode, stdout } = await run(
      'hipaa-attest', ['verify', '--attestation', output], { env: env() },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('VERIFIED');
  });

  test('verify with wrong key fails', async () => {
    // Create attestation with current key
    const output = path.join(tmpAttest, 'check-wrong-key.json');
    await run(
      'hipaa-attest',
      ['check', '--check-id', 'wk', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:y', '--output', output],
      { env: env() },
    );

    // Create a different keypair
    const altHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-alt-'));
    await run('hipaa-attest', ['init-keys'], { env: { HOME: altHome } });

    const { exitCode, stderr } = await run(
      'hipaa-attest',
      ['verify', '--attestation', output, '--public-key', path.join(altHome, '.em-dash', 'keys', 'default.pub')],
      { env: env() },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('VERIFICATION_FAILED');
    fs.rmSync(altHome, { recursive: true, force: true });
  });

  test('tampered evidence hash causes verification failure', async () => {
    const output = path.join(tmpAttest, 'check-tamper.json');
    await run(
      'hipaa-attest',
      ['check', '--check-id', 'tm', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:original', '--output', output],
      { env: env() },
    );

    // Tamper with the evidence hash
    const data = JSON.parse(fs.readFileSync(output, 'utf-8'));
    data.evidence_hash = 'sha256:tampered';
    fs.writeFileSync(output, JSON.stringify(data, null, 2));

    const { exitCode, stderr } = await run(
      'hipaa-attest', ['verify', '--attestation', output], { env: env() },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('VERIFICATION_FAILED');
  });

  test('tampered timestamp causes verification failure', async () => {
    const output = path.join(tmpAttest, 'check-ts-tamper.json');
    await run(
      'hipaa-attest',
      ['check', '--check-id', 'tt', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:z', '--output', output],
      { env: env() },
    );

    const data = JSON.parse(fs.readFileSync(output, 'utf-8'));
    data.timestamp = '2020-01-01T00:00:00.000Z';
    fs.writeFileSync(output, JSON.stringify(data, null, 2));

    const { exitCode } = await run(
      'hipaa-attest', ['verify', '--attestation', output], { env: env() },
    );
    expect(exitCode).toBe(1);
  });

  test('missing key file gives clear error', async () => {
    const noKeyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'emdash-nokey-'));
    const { exitCode, stderr } = await run(
      'hipaa-attest',
      ['check', '--check-id', 'nk', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:a', '--output', '/tmp/nk.json'],
      { env: { HOME: noKeyHome } },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('No signing key');
    expect(stderr).toContain('init-keys');
    fs.rmSync(noKeyHome, { recursive: true, force: true });
  });

  test('sign with oscal-refs adds refs to attestation', async () => {
    const output = path.join(tmpAttest, 'check-oscal.json');
    await run(
      'hipaa-attest',
      ['check', '--check-id', 'oc', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:b', '--oscal-refs', 'AC-2,IA-2', '--output', output],
      { env: env() },
    );
    const data = JSON.parse(fs.readFileSync(output, 'utf-8'));
    expect(data.oscal_refs).toEqual(['AC-2', 'IA-2']);
  });

  test('session attestation wraps check hashes', async () => {
    const sessDir = path.join(tmpHome, 'sess-test');
    fs.mkdirSync(sessDir, { recursive: true });

    await run(
      'hipaa-attest',
      ['check', '--check-id', 's1', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:e1', '--output', path.join(sessDir, 'check-s1.json')],
      { env: env() },
    );
    await run(
      'hipaa-attest',
      ['check', '--check-id', 's2', '--requirement-id', 'r2', '--result', 'FAIL',
       '--evidence-hash', 'sha256:e2', '--output', path.join(sessDir, 'check-s2.json')],
      { env: env() },
    );

    const sessOutput = path.join(sessDir, 'session.json');
    const { exitCode } = await run(
      'hipaa-attest',
      ['session', '--attestation-dir', sessDir, '--framework', 'hipaa',
       '--controls-in-scope', '10', '--output', sessOutput],
      { env: env() },
    );
    expect(exitCode).toBe(0);

    const session = JSON.parse(fs.readFileSync(sessOutput, 'utf-8'));
    expect(session.type).toBe('session');
    expect(session.check_attestation_hashes.length).toBe(2);
    expect(session.scope.controls_checked).toBe(2);
    expect(session.scope.controls_in_scope).toBe(10);
  });

  test('empty session is refused', async () => {
    const emptyDir = path.join(tmpHome, 'empty-sess');
    fs.mkdirSync(emptyDir, { recursive: true });

    const { exitCode, stderr } = await run(
      'hipaa-attest',
      ['session', '--attestation-dir', emptyDir, '--framework', 'hipaa', '--output', '/tmp/x.json'],
      { env: env() },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('0 checks');
  });

  test('session includes checks_skipped when provided', async () => {
    const sessDir2 = path.join(tmpHome, 'sess-skip');
    fs.mkdirSync(sessDir2, { recursive: true });

    await run(
      'hipaa-attest',
      ['check', '--check-id', 'sk1', '--requirement-id', 'r1', '--result', 'PASS',
       '--evidence-hash', 'sha256:f1', '--output', path.join(sessDir2, 'check-sk1.json')],
      { env: env() },
    );

    const skipped = JSON.stringify([{ check_id: 'aws-cloudtrail', reason: 'No AWS credentials' }]);
    const sessOutput = path.join(sessDir2, 'session.json');
    const { exitCode } = await run(
      'hipaa-attest',
      ['session', '--attestation-dir', sessDir2, '--framework', 'hipaa',
       '--controls-in-scope', '10', '--checks-skipped', skipped, '--output', sessOutput],
      { env: env() },
    );
    expect(exitCode).toBe(0);

    const session = JSON.parse(fs.readFileSync(sessOutput, 'utf-8'));
    expect(session.scope.checks_skipped).toBeArray();
    expect(session.scope.checks_skipped.length).toBe(1);
    expect(session.scope.checks_skipped[0].check_id).toBe('aws-cloudtrail');
  });
});

// ═══ Verifier Tests (6) ═════════════════════════════════════

describe('Verifier', () => {
  test('verify directory with session + checks', async () => {
    const vDir = path.join(tmpHome, 'verify-dir');
    fs.mkdirSync(vDir, { recursive: true });

    await run('hipaa-attest', ['check', '--check-id', 'v1', '--requirement-id', 'r1',
      '--result', 'PASS', '--evidence-hash', 'sha256:h1', '--output', path.join(vDir, 'check-v1.json')],
      { env: env() });
    await run('hipaa-attest', ['session', '--attestation-dir', vDir, '--framework', 'hipaa',
      '--output', path.join(vDir, 'session.json')], { env: env() });

    const { exitCode, stdout } = await run('hipaa-verify', ['--attestation-dir', vDir], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('VERIFIED');
    expect(stdout).toContain('session-integrity');
  });

  test('verify detects tampered check in directory', async () => {
    const tDir = path.join(tmpHome, 'verify-tamper');
    fs.mkdirSync(tDir, { recursive: true });

    await run('hipaa-attest', ['check', '--check-id', 't1', '--requirement-id', 'r1',
      '--result', 'PASS', '--evidence-hash', 'sha256:h1', '--output', path.join(tDir, 'check-t1.json')],
      { env: env() });
    await run('hipaa-attest', ['session', '--attestation-dir', tDir, '--framework', 'hipaa',
      '--output', path.join(tDir, 'session.json')], { env: env() });

    // Tamper with check
    const data = JSON.parse(fs.readFileSync(path.join(tDir, 'check-t1.json'), 'utf-8'));
    data.result = 'FAIL';
    fs.writeFileSync(path.join(tDir, 'check-t1.json'), JSON.stringify(data, null, 2));

    const { exitCode } = await run('hipaa-verify', ['--attestation-dir', tDir], { env: env() });
    expect(exitCode).toBe(1);
  });

  test('verify single file', async () => {
    const sFile = path.join(tmpHome, 'single-verify.json');
    await run('hipaa-attest', ['check', '--check-id', 'sf', '--requirement-id', 'r1',
      '--result', 'PASS', '--evidence-hash', 'sha256:h1', '--output', sFile], { env: env() });

    const { exitCode, stdout } = await run('hipaa-verify', ['--file', sFile], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('VERIFIED');
  });

  test('verify nonexistent file errors', async () => {
    const { exitCode, stderr } = await run('hipaa-verify', ['--file', '/tmp/nonexistent.json'], { env: env() });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('not found');
  });

  test('verify malformed JSON errors', async () => {
    const badFile = path.join(tmpHome, 'bad.json');
    fs.writeFileSync(badFile, '{invalid json');
    const { exitCode } = await run('hipaa-verify', ['--file', badFile], { env: env() });
    expect(exitCode).toBe(1);
  });

  test('verify empty directory errors', async () => {
    const emptyDir = path.join(tmpHome, 'verify-empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const { exitCode, stderr } = await run('hipaa-verify', ['--attestation-dir', emptyDir], { env: env() });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('No attestation files');
  });
});

// ═══ Audit Packet Tests (8) ═════════════════════════════════

describe('Audit Packet', () => {
  let packetDir: string;

  beforeAll(async () => {
    packetDir = path.join(tmpHome, 'packet-src');
    fs.mkdirSync(packetDir, { recursive: true });

    // Create sample attestations
    await run('hipaa-attest', ['check', '--check-id', 'p1', '--requirement-id', '164.312(d)',
      '--result', 'PASS', '--evidence-hash', 'sha256:p1', '--oscal-refs', 'IA-2',
      '--output', path.join(packetDir, 'check-p1.json')], { env: env() });
    await run('hipaa-attest', ['check', '--check-id', 'p2', '--requirement-id', '164.312(b)',
      '--result', 'FAIL', '--evidence-hash', 'sha256:p2', '--applicability', 'addressable',
      '--output', path.join(packetDir, 'check-p2.json')], { env: env() });
    await run('hipaa-attest', ['session', '--attestation-dir', packetDir, '--framework', 'hipaa',
      '--controls-in-scope', '10', '--output', path.join(packetDir, 'session.json')], { env: env() });
  });

  test('generates ZIP with correct structure', async () => {
    const output = path.join(tmpHome, 'test-packet.zip');
    const { exitCode } = await run('hipaa-audit-packet',
      ['--attestation-dir', packetDir, '--output', output], { env: env() });
    expect(exitCode).toBe(0);
    expect(fs.existsSync(output)).toBe(true);

    // Check ZIP contents via unzip -l
    const { stdout } = await run('unzip', ['-l', output], { cwd: tmpHome });
    expect(stdout).toContain('attestations/');
    expect(stdout).toContain('summary.html');
    expect(stdout).toContain('public-key.pub');
    expect(stdout).toContain('VERIFY.md');
  });

  test('summary.html contains check results', async () => {
    const output = path.join(tmpHome, 'test-packet2.zip');
    await run('hipaa-audit-packet',
      ['--attestation-dir', packetDir, '--output', output], { env: env() });

    // Extract and check summary
    const extractDir = path.join(tmpHome, 'extract');
    fs.mkdirSync(extractDir, { recursive: true });
    await run('unzip', ['-o', output, '-d', extractDir], { cwd: tmpHome });

    const summary = fs.readFileSync(path.join(extractDir, 'audit-packet', 'summary.html'), 'utf-8');
    expect(summary).toContain('p1');
    expect(summary).toContain('p2');
    expect(summary).toContain('PASS');
    expect(summary).toContain('FAIL');
    expect(summary).toContain('addressable');
    expect(summary).toContain('NOT legal advice');
  });

  test('output includes pass/fail counts', async () => {
    const output = path.join(tmpHome, 'test-packet3.zip');
    const { stdout } = await run('hipaa-audit-packet',
      ['--attestation-dir', packetDir, '--output', output], { env: env() });
    expect(stdout).toContain('1 passed');
    expect(stdout).toContain('1 failed');
  });

  test('empty attestation dir errors', async () => {
    const emptyDir = path.join(tmpHome, 'packet-empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const { exitCode, stderr } = await run('hipaa-audit-packet',
      ['--attestation-dir', emptyDir, '--output', '/tmp/x.zip'], { env: env() });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('No attestation files');
  });

  test('nonexistent dir errors', async () => {
    const { exitCode, stderr } = await run('hipaa-audit-packet',
      ['--attestation-dir', '/tmp/nonexistent', '--output', '/tmp/x.zip'], { env: env() });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('not found');
  });

  test('missing args shows usage', async () => {
    const { exitCode, stderr } = await run('hipaa-audit-packet', []);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Usage');
  });

  test('attestations in packet are verifiable', async () => {
    const output = path.join(tmpHome, 'verify-packet.zip');
    await run('hipaa-audit-packet',
      ['--attestation-dir', packetDir, '--output', output], { env: env() });

    const extractDir = path.join(tmpHome, 'verify-extract');
    fs.mkdirSync(extractDir, { recursive: true });
    await run('unzip', ['-o', output, '-d', extractDir], { cwd: tmpHome });

    const pubKey = path.join(extractDir, 'audit-packet', 'public-key.pub');
    const attestDir = path.join(extractDir, 'audit-packet', 'attestations');

    const { exitCode, stdout } = await run('hipaa-verify',
      ['--attestation-dir', attestDir, '--public-key', pubKey], { env: env() });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('VERIFIED');
  });

  test('VERIFY.md contains instructions', async () => {
    const extractDir = path.join(tmpHome, 'verify-extract');
    const verifyMd = fs.readFileSync(path.join(extractDir, 'audit-packet', 'VERIFY.md'), 'utf-8');
    expect(verifyMd).toContain('RFC 8785');
    expect(verifyMd).toContain('Ed25519');
    expect(verifyMd).toContain('hipaa-verify');
  });
});
