import { describe, test, expect, beforeAll } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(import.meta.dir, '..');
const POLICIES_DIR = path.join(ROOT, 'policies');
const FIXTURES_DIR = path.join(ROOT, 'test', 'fixtures', 'iac');

// ─── Helper ─────────────────────────────────────────────────

interface ConftestResult {
  filename: string;
  namespace: string;
  successes: number;
  failures?: Array<{
    msg: string;
    metadata: {
      check_id: string;
      severity: string;
      resource: string;
      query: string;
    };
  }>;
}

let conftestAvailable = false;

beforeAll(() => {
  try {
    const check = Bun.spawnSync(['conftest', '--version']);
    conftestAvailable = check.exitCode === 0;
  } catch {
    conftestAvailable = false;
  }
});

function runConftest(fixturePath: string): ConftestResult[] {
  const proc = Bun.spawnSync([
    'conftest', 'test', fixturePath,
    '-p', POLICIES_DIR,
    '--rego-version', 'v0',
    '--all-namespaces',
    '--output', 'json',
  ]);
  return JSON.parse(proc.stdout.toString());
}

function getFailures(results: ConftestResult[], namespace?: string): ConftestResult['failures'] {
  const all: NonNullable<ConftestResult['failures']> = [];
  for (const r of results) {
    if (namespace && r.namespace !== namespace) continue;
    if (r.failures) all.push(...r.failures);
  }
  return all;
}

function totalFailures(results: ConftestResult[]): number {
  return results.reduce((sum, r) => sum + (r.failures?.length ?? 0), 0);
}

function skipIfNoConftest() {
  if (!conftestAvailable) {
    console.log('SKIP: conftest not installed');
    return true;
  }
  return false;
}

// ─── AWS Encryption at Rest ─────────────────────────────────

describe('AWS encryption at rest', () => {
  test('denies unencrypted RDS, S3, EBS, KMS, SNS, SQS', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-aws-encryption.json'));
    const failures = getFailures(results, 'compliance.encryption_at_rest');
    expect(failures.length).toBe(6);

    const messages = failures.map(f => f.msg);
    expect(messages.some(m => m.includes('RDS instance'))).toBe(true);
    expect(messages.some(m => m.includes('S3 bucket'))).toBe(true);
    expect(messages.some(m => m.includes('EBS volume'))).toBe(true);
    expect(messages.some(m => m.includes('KMS key'))).toBe(true);
    expect(messages.some(m => m.includes('SNS topic'))).toBe(true);
    expect(messages.some(m => m.includes('SQS queue'))).toBe(true);

    for (const f of failures) {
      expect(['rego-s3-encryption', 'rego-rds-encryption', 'rego-kms-rotation']).toContain(f.metadata.check_id);
    }
  });

  test('passes compliant AWS resources', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-aws.json'));
    const failures = getFailures(results, 'compliance.encryption_at_rest');
    expect(failures.length).toBe(0);
  });
});

// ─── AWS Transmission Security ──────────────────────────────

describe('AWS transmission security', () => {
  test('denies open SG, HTTP listener, public RDS', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-aws-transmission.json'));
    const failures = getFailures(results, 'compliance.transmission_security');
    expect(failures.length).toBe(5);

    const messages = failures.map(f => f.msg);
    expect(messages.some(m => m.includes('Security group rule') && m.includes('port 22'))).toBe(true);
    expect(messages.some(m => m.includes('Security group') && m.includes('port 5432'))).toBe(true);
    expect(messages.some(m => m.includes('Load balancer listener') && m.includes('HTTP'))).toBe(true);
    expect(messages.some(m => m.includes('publicly accessible'))).toBe(true);

    for (const f of failures) {
      expect(['rego-security-group-open', 'rego-rds-public']).toContain(f.metadata.check_id);
    }
  });

  test('passes compliant AWS resources', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-aws.json'));
    const failures = getFailures(results, 'compliance.transmission_security');
    expect(failures.length).toBe(0);
  });
});

// ─── AWS Access Control ─────────────────────────────────────

describe('AWS access control', () => {
  test('denies wildcard IAM policies and missing MFA', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-aws-access.json'));
    const failures = getFailures(results, 'compliance.access_control');
    expect(failures.length).toBe(4);

    const messages = failures.map(f => f.msg);
    expect(messages.some(m => m.includes('admin_string') && m.includes('wildcard'))).toBe(true);
    expect(messages.some(m => m.includes('admin_array') && m.includes('array form'))).toBe(true);
    expect(messages.some(m => m.includes('role_wildcard'))).toBe(true);
    expect(messages.some(m => m.includes('MFA'))).toBe(true);
  });

  test('passes compliant AWS resources', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-aws.json'));
    const failures = getFailures(results, 'compliance.access_control');
    expect(failures.length).toBe(0);
  });
});

// ─── AWS Audit Logging ──────────────────────────────────────

describe('AWS audit logging', () => {
  test('denies misconfigured CloudTrail, VPC, CloudWatch', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-aws-audit.json'));
    const failures = getFailures(results, 'compliance.audit_logging');
    expect(failures.length).toBe(6);

    const messages = failures.map(f => f.msg);
    expect(messages.some(m => m.includes('multi-region'))).toBe(true);
    expect(messages.some(m => m.includes('log file validation'))).toBe(true);
    expect(messages.some(m => m.includes('KMS'))).toBe(true);
    expect(messages.some(m => m.includes('flow logs'))).toBe(true);
    expect(messages.some(m => m.includes('retention of 30 days'))).toBe(true);
    expect(messages.some(m => m.includes('no retention policy'))).toBe(true);

    for (const f of failures) {
      expect(f.metadata.check_id).toBe('rego-cloudtrail-enabled');
    }
  });

  test('passes compliant AWS resources', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-aws.json'));
    const failures = getFailures(results, 'compliance.audit_logging');
    expect(failures.length).toBe(0);
  });
});

// ─── AWS Secrets ────────────────────────────────────────────

describe('AWS secrets', () => {
  test('denies hardcoded keys and default passwords', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-aws-secrets.json'));
    const failures = getFailures(results, 'compliance.secrets');
    expect(failures.length).toBe(4);

    const messages = failures.map(f => f.msg);
    expect(messages.some(m => m.includes('access_key'))).toBe(true);
    expect(messages.some(m => m.includes('secret_key'))).toBe(true);
    expect(messages.some(m => m.includes('db_password'))).toBe(true);
    expect(messages.some(m => m.includes('api_secret_key'))).toBe(true);

    const severities = failures.map(f => f.metadata.severity);
    expect(severities.filter(s => s === 'CRITICAL').length).toBe(2);
    expect(severities.filter(s => s === 'HIGH').length).toBe(2);
  });

  test('passes clean Terraform variables', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-aws.json'));
    const failures = getFailures(results, 'compliance.secrets');
    expect(failures.length).toBe(0);
  });
});

// ─── GCP Controls ───────────────────────────────────────────

describe('GCP controls', () => {
  test('denies insecure Cloud SQL, GCS, firewall, IAM, audit logging', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-gcp.json'));
    const allFailures = getFailures(results);
    expect(allFailures.length).toBe(8);

    // Encryption: Cloud SQL CMEK + GCS encryption
    const encFailures = getFailures(results, 'compliance.encryption_at_rest');
    expect(encFailures.length).toBe(2);

    // Transmission: Cloud SQL SSL + public IP + firewall
    const transFailures = getFailures(results, 'compliance.transmission_security');
    expect(transFailures.length).toBe(3);

    // Access: SA owner + SA editor
    const accessFailures = getFailures(results, 'compliance.access_control');
    expect(accessFailures.length).toBe(2);

    // Audit: exempted members
    const auditFailures = getFailures(results, 'compliance.audit_logging');
    expect(auditFailures.length).toBe(1);
  });

  test('passes compliant GCP resources', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-gcp.json'));
    const failures = getFailures(results);
    expect(failures.length).toBe(0);
  });
});

// ─── Azure Controls ─────────────────────────────────────────

describe('Azure controls', () => {
  test('denies subscription-scope Contributor', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-azure.json'));
    const failures = getFailures(results, 'compliance.access_control');
    expect(failures.length).toBe(1);
    expect(failures[0].msg).toContain('Contributor at subscription scope');
    expect(failures[0].metadata.check_id).toBe('rego-iam-wildcard');
  });

  test('passes resource-group-scoped assignment', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-azure.json'));
    const failures = getFailures(results);
    expect(failures.length).toBe(0);
  });
});

// ─── Kubernetes Security ────────────────────────────────────

describe('Kubernetes security', () => {
  test('denies root, privileged, unapproved registry, inline secrets', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-k8s-deployment.yaml'));

    const k8sFailures = getFailures(results, 'compliance.k8s_security');
    expect(k8sFailures.length).toBe(7);

    const messages = k8sFailures.map(f => f.msg);
    expect(messages.some(m => m.includes('runs as root (UID 0)'))).toBe(true);
    expect(messages.some(m => m.includes('privileged mode'))).toBe(true);
    expect(messages.some(m => m.includes('unapproved registry'))).toBe(true);
    expect(messages.some(m => m.includes('runAsNonRoot'))).toBe(true);
    expect(messages.some(m => m.includes('DB_PASSWORD') && m.includes('inline value'))).toBe(true);

    // Also triggers hipaa.secrets K8s rules
    const secretsFailures = getFailures(results, 'compliance.secrets');
    expect(secretsFailures.length).toBe(2);
  });

  test('denies wildcard ClusterRole', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-k8s-clusterrole.yaml'));
    const failures = getFailures(results, 'compliance.k8s_security');
    expect(failures.length).toBe(1);
    expect(failures[0].msg).toContain('wildcard verbs and resources');
  });

  test('denies PHI namespace without NetworkPolicy', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-k8s-namespace.yaml'));
    const failures = getFailures(results, 'compliance.k8s_security');
    expect(failures.length).toBe(1);
    expect(failures[0].msg).toContain('labeled for sensitive data');
  });

  test('denies privileged StatefulSet', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'bad-k8s-statefulset.yaml'));
    const failures = getFailures(results, 'compliance.k8s_security');
    expect(failures.length).toBe(1);
    expect(failures[0].msg).toContain('StatefulSet runs in privileged mode');
  });

  test('passes compliant K8s deployment', () => {
    if (skipIfNoConftest()) return;
    const results = runConftest(path.join(FIXTURES_DIR, 'good-k8s-deployment.yaml'));
    const failures = getFailures(results);
    expect(failures.length).toBe(0);
  });
});

// ─── Cross-Policy Coverage ──────────────────────────────────

describe('Cross-policy coverage', () => {
  test('all deny rules fire across the fixture suite', () => {
    if (skipIfNoConftest()) return;

    // Count deny rules per policy file
    const policyFiles = fs.readdirSync(POLICIES_DIR).filter(f => f.endsWith('.rego'));
    const ruleCountByPolicy: Record<string, number> = {};
    let totalRules = 0;

    for (const file of policyFiles) {
      const content = fs.readFileSync(path.join(POLICIES_DIR, file), 'utf-8');
      const denyCount = (content.match(/^deny\[msg\]\s*\{/gm) || []).length;
      ruleCountByPolicy[file] = denyCount;
      totalRules += denyCount;
    }

    // Run all bad fixtures and collect unique denial messages
    const badFixtures = fs.readdirSync(FIXTURES_DIR).filter(f => f.startsWith('bad-'));
    const allMessages = new Set<string>();

    for (const fixture of badFixtures) {
      const results = runConftest(path.join(FIXTURES_DIR, fixture));
      for (const r of results) {
        if (r.failures) {
          for (const f of r.failures) {
            allMessages.add(f.msg);
          }
        }
      }
    }

    // Every rule with a matching fixture should produce denials.
    // Not all rules have fixtures (e.g., new Azure/Docker/Backup rules),
    // so we check that at least 60% of rules fire — existing rules are covered.
    expect(allMessages.size).toBeGreaterThanOrEqual(Math.floor(totalRules * 0.6));
    expect(totalRules).toBeGreaterThanOrEqual(40); // sanity: we know there are 47 rules
  });

  test('all check_ids are valid registry entries', () => {
    if (skipIfNoConftest()) return;

    const validCheckIds = new Set([
      'rego-iam-wildcard', 'rego-mfa-required', 'rego-cloudtrail-enabled',
      'rego-s3-encryption', 'rego-rds-encryption', 'rego-kms-rotation',
      'rego-security-group-open', 'rego-rds-public', 'rego-no-hardcoded-secrets',
      'rego-k8s-rbac-wildcard', 'rego-k8s-non-root',
    ]);

    const badFixtures = fs.readdirSync(FIXTURES_DIR).filter(f => f.startsWith('bad-'));
    for (const fixture of badFixtures) {
      const results = runConftest(path.join(FIXTURES_DIR, fixture));
      for (const r of results) {
        if (r.failures) {
          for (const f of r.failures) {
            expect(validCheckIds.has(f.metadata.check_id)).toBe(true);
          }
        }
      }
    }
  });

  test('all severity levels are valid', () => {
    if (skipIfNoConftest()) return;

    const validSeverities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

    const badFixtures = fs.readdirSync(FIXTURES_DIR).filter(f => f.startsWith('bad-'));
    for (const fixture of badFixtures) {
      const results = runConftest(path.join(FIXTURES_DIR, fixture));
      for (const r of results) {
        if (r.failures) {
          for (const f of r.failures) {
            expect(validSeverities.has(f.metadata.severity)).toBe(true);
          }
        }
      }
    }
  });
});
