import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

const SKILLS_DIR = path.join(ROOT, 'skills');

// Find all SKILL.md.tmpl files
function findTemplates(): string[] {
  const templates: string[] = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const tmpl = path.join(SKILLS_DIR, entry.name, 'SKILL.md.tmpl');
    if (fs.existsSync(tmpl)) templates.push(tmpl);
  }
  return templates;
}

// Find all generated SKILL.md files
function findGenerated(): string[] {
  const generated: string[] = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const md = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (fs.existsSync(md)) generated.push(md);
  }
  return generated;
}

describe('Skill template validation', () => {
  const templates = findTemplates();

  test('all 10 skill templates exist', () => {
    expect(templates.length).toBe(10);
  });

  for (const tmpl of templates) {
    const name = path.relative(ROOT, tmpl);

    test(`${name} has valid frontmatter`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      expect(content.startsWith('---')).toBe(true);
      const fmEnd = content.indexOf('---', 3);
      expect(fmEnd).toBeGreaterThan(3);

      const frontmatter = content.slice(3, fmEnd);
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('version:');
      expect(frontmatter).toContain('description:');
      expect(frontmatter).toContain('allowed-tools:');
    });

    test(`${name} includes AskUserQuestion in allowed-tools`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      expect(content).toContain('AskUserQuestion');
    });

    test(`${name} has no unresolved placeholders (only known ones)`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      const placeholders = content.match(/\{\{(\w+)\}\}/g) || [];
      const known = ['PREAMBLE', 'COMPLIANCE_DASHBOARD', 'TOOL_DETECTION', 'PHI_PATTERNS', 'EVIDENCE_COLLECTION', 'AWS_CHECKS', 'GCP_CHECKS', 'AZURE_CHECKS', 'IAC_POLICY_ENGINE', 'DASHBOARD_UPDATES'];
      for (const ph of placeholders) {
        const name = ph.replace(/\{\{|\}\}/g, '');
        expect(known).toContain(name);
      }
    });
  }
});

describe('Generated SKILL.md files', () => {
  const generated = findGenerated();

  test('all 10 generated SKILL.md files exist', () => {
    expect(generated.length).toBe(10);
  });

  for (const md of generated) {
    const name = path.relative(ROOT, md);

    test(`${name} has AUTO-GENERATED header`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      expect(content).toContain('AUTO-GENERATED');
    });

    test(`${name} has no unresolved placeholders`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      const unresolved = content.match(/\{\{(\w+)\}\}/g);
      expect(unresolved).toBeNull();
    });

    test(`${name} contains DISCLAIMER`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      expect(content).toContain('NOT legal advice');
    });
  }
});

describe('Generated files are fresh', () => {
  test('gen-skill-docs --dry-run passes', async () => {
    const bunPath = Bun.which('bun') ?? process.argv[0];
    const proc = Bun.spawn([bunPath, 'run', 'scripts/gen-skill-docs.ts', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error(stderr);
    }
    expect(exitCode).toBe(0);
  });
});

describe('PHI patterns coverage', () => {
  test('gen-skill-docs resolves PHI_PATTERNS with all 19 checks', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    for (let i = 1; i <= 19; i++) {
      expect(scanMd).toContain(`CHECK ${i}:`);
    }
  });

  test('PHI patterns include RBAC check', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('RBAC');
    expect(scanMd).toContain('authorization');
  });

  test('PHI patterns include audit logging check', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('audit_log');
    expect(scanMd).toContain('Audit Logging');
  });

  test('PHI patterns include session timeout check', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('session.*timeout');
    expect(scanMd).toContain('Auto-Logoff');
  });

  test('PHI patterns include browser PHI check', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('localStorage');
    expect(scanMd).toContain('sessionStorage');
    expect(scanMd).toContain('cookie');
  });

  test('PHI patterns include least privilege check', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('Least Privilege');
    expect(scanMd).toContain('wildcard');
  });

  test('PHI patterns include database compliance checks', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('pgcrypto');
    expect(scanMd).toContain('log_statement');
    expect(scanMd).toContain('GRANT ALL');
    expect(scanMd).toContain('sslmode=disable');
    expect(scanMd).toContain('Database Sensitive Data');
    expect(scanMd).toContain('Database Audit Logging');
    expect(scanMd).toContain('Database Encryption');
    expect(scanMd).toContain('Database Access Control');
    expect(scanMd).toContain('Database Connection Security');
  });

  test('PHI patterns include push notification and email checks', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('pushNotification');
    expect(scanMd).toContain('sendMail');
    expect(scanMd).toContain('nodemailer');
    expect(scanMd).toContain('expo-notifications');
    expect(scanMd).toContain('Push Notifications');
  });

  test('PHI patterns include secrets scanning check', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('Secrets');
    expect(scanMd).toContain('.gitignore');
    expect(scanMd).toContain('API_KEY');
    expect(scanMd).toContain('PRIVATE_KEY');
    expect(scanMd).toContain('docker-compose');
  });

  test('session timeout check recommends 15-minute maximum', () => {
    const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');
    expect(scanMd).toContain('15 minutes maximum');
  });
});

describe('Policy templates', () => {
  const policyDir = path.join(ROOT, 'templates', 'policies');
  const expectedPolicies = [
    'access-control.md',
    'audit-logging.md',
    'encryption.md',
    'incident-response.md',
    'risk-assessment.md',
    'workforce-security.md',
    'workforce-training.md',
    'contingency-plan.md',
    'baa-template.md',
  ];

  test('all 9 policy templates exist', () => {
    for (const policy of expectedPolicies) {
      expect(fs.existsSync(path.join(policyDir, policy))).toBe(true);
    }
  });

  for (const policy of expectedPolicies) {
    test(`${policy} has fillable placeholders`, () => {
      const content = fs.readFileSync(path.join(policyDir, policy), 'utf-8');
      // All policies should have at least one {PLACEHOLDER} token
      expect(content).toMatch(/\{[A-Z_]+\}/);
    });
  }
});

describe('AWS checks coverage', () => {
  const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');

  test('includes IAM password policy check', () => {
    expect(scanMd).toContain('get-account-password-policy');
  });

  test('includes VPC flow logs check', () => {
    expect(scanMd).toContain('describe-flow-logs');
  });

  test('includes KMS key rotation check', () => {
    expect(scanMd).toContain('get-key-rotation-status');
  });

  test('includes GuardDuty check', () => {
    expect(scanMd).toContain('list-detectors');
  });

  test('includes Security Hub check', () => {
    expect(scanMd).toContain('describe-hub');
  });

  test('includes EBS encryption check', () => {
    expect(scanMd).toContain('describe-volumes');
  });

  test('includes security groups check', () => {
    expect(scanMd).toContain('describe-security-groups');
  });

  test('includes load balancer TLS check', () => {
    expect(scanMd).toContain('describe-listeners');
  });

  test('includes Secrets Manager check', () => {
    expect(scanMd).toContain('list-secrets');
  });

  test('includes Lambda VPC check', () => {
    expect(scanMd).toContain('list-functions');
  });

  test('includes credential report check', () => {
    expect(scanMd).toContain('generate-credential-report');
  });

  test('includes Prowler coexistence logic', () => {
    expect(scanMd).toContain('Prowler coexistence');
  });

  test('includes HIPAA requirement summary table', () => {
    expect(scanMd).toContain('AWS HIPAA Requirement Summary');
  });

  // --- New deep checks (Phase 3) ---

  test('includes S3 access logging check', () => {
    expect(scanMd).toContain('get-bucket-logging');
  });

  test('includes RDS audit logging check', () => {
    expect(scanMd).toContain('EnabledCloudwatchLogsExports');
  });

  test('includes CloudFront TLS check', () => {
    expect(scanMd).toContain('list-distributions');
  });

  test('includes WAF check', () => {
    expect(scanMd).toContain('list-web-acls');
  });

  test('includes AWS Config check', () => {
    expect(scanMd).toContain('describe-config-rules');
  });

  test('includes Macie PHI discovery check', () => {
    expect(scanMd).toContain('get-macie-session');
  });

  test('includes Inspector findings check', () => {
    expect(scanMd).toContain('inspector2');
  });

  test('includes CloudTrail log validation check', () => {
    expect(scanMd).toContain('LogFileValidationEnabled');
  });

  test('includes Backup vault lock check', () => {
    expect(scanMd).toContain('list-backup-vaults');
  });

  test('includes ACM certificate expiry check', () => {
    expect(scanMd).toContain('list-certificates');
  });
});

describe('GCP checks coverage', () => {
  const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');

  test('includes Cloud SQL check', () => {
    expect(scanMd).toContain('sql instances list');
  });

  test('includes firewall rules check', () => {
    expect(scanMd).toContain('firewall-rules list');
  });

  test('includes GKE cluster check', () => {
    expect(scanMd).toContain('container clusters list');
  });

  test('includes service account key audit', () => {
    expect(scanMd).toContain('service-accounts keys list');
  });

  test('includes KMS key check', () => {
    expect(scanMd).toContain('kms keys list');
  });

  test('includes Cloud Run check', () => {
    expect(scanMd).toContain('run services list');
  });

  test('includes Pub/Sub CMEK check', () => {
    expect(scanMd).toContain('pubsub topics list');
  });

  test('includes BigQuery check', () => {
    expect(scanMd).toContain('bq ls');
  });

  test('includes audit log config check', () => {
    expect(scanMd).toContain('auditConfigs');
  });

  test('includes GCP HIPAA requirement summary', () => {
    expect(scanMd).toContain('GCP HIPAA Requirement Summary');
  });

  // --- New deep checks (Phase 3) ---

  test('includes Cloud SQL backup check', () => {
    expect(scanMd).toContain('backupConfiguration');
  });

  test('includes Cloud SQL SSL enforcement', () => {
    expect(scanMd).toContain('requireSsl');
  });

  test('includes VPC Service Controls check', () => {
    expect(scanMd).toContain('access-context-manager perimeters list');
  });

  test('includes Cloud Armor check', () => {
    expect(scanMd).toContain('security-policies list');
  });

  test('includes DLP inspection check', () => {
    expect(scanMd).toContain('dlp job-triggers list');
  });

  test('includes logging sinks check', () => {
    expect(scanMd).toContain('logging sinks list');
  });

  test('includes Cloud Functions VPC check', () => {
    expect(scanMd).toContain('vpcConnector');
  });

  test('includes Binary Authorization check', () => {
    expect(scanMd).toContain('binauthz policy export');
  });

  test('includes Memorystore encryption check', () => {
    expect(scanMd).toContain('transitEncryptionMode');
  });

  test('includes Secret Manager rotation check', () => {
    expect(scanMd).toContain('secrets list');
  });
});

describe('Azure checks coverage', () => {
  const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');

  test('includes SQL TDE check', () => {
    expect(scanMd).toContain('sql db tde');
  });

  test('includes NSG rules check', () => {
    expect(scanMd).toContain('network nsg');
  });

  test('includes Key Vault check', () => {
    expect(scanMd).toContain('keyvault list');
  });

  test('includes diagnostic settings check', () => {
    expect(scanMd).toContain('diagnostic-settings');
  });

  test('includes IAM role assignment check', () => {
    expect(scanMd).toContain('role assignment list');
  });

  test('includes Defender check', () => {
    expect(scanMd).toContain('security assessment list');
  });

  test('includes storage account check', () => {
    expect(scanMd).toContain('storage account list');
  });

  test('includes Azure HIPAA requirement summary', () => {
    expect(scanMd).toContain('Azure HIPAA Requirement Summary');
  });

  // --- New deep checks (Phase 3) ---

  test('includes SQL auditing check', () => {
    expect(scanMd).toContain('audit-policy show');
  });

  test('includes App Gateway WAF check', () => {
    expect(scanMd).toContain('application-gateway waf-config show');
  });

  test('includes Cosmos DB check', () => {
    expect(scanMd).toContain('cosmosdb show');
  });

  test('includes disk encryption set check', () => {
    expect(scanMd).toContain('disk-encryption-set list');
  });

  test('includes Log Analytics workspace check', () => {
    expect(scanMd).toContain('log-analytics workspace list');
  });

  test('includes private endpoints check', () => {
    expect(scanMd).toContain('private-endpoint list');
  });

  test('includes backup policy check', () => {
    expect(scanMd).toContain('backup policy list');
  });

  test('includes Front Door TLS check', () => {
    expect(scanMd).toContain('afd endpoint list');
  });
});

describe('IaC policy engine coverage', () => {
  const scanMd = fs.readFileSync(path.join(SKILLS_DIR, 'hipaa-scan', 'SKILL.md'), 'utf-8');

  test('mentions Checkov integration', () => {
    expect(scanMd).toContain('checkov');
    expect(scanMd).toContain('TOOL_CHECKOV');
  });

  test('mentions Conftest integration', () => {
    expect(scanMd).toContain('conftest');
    expect(scanMd).toContain('TOOL_CONFTEST');
  });

  test('references bundled Rego policies', () => {
    expect(scanMd).toContain('policies/');
    expect(scanMd).toContain('hipaa-encryption-at-rest.rego');
    expect(scanMd).toContain('hipaa-k8s-security.rego');
  });

  test('includes IaC detection for all formats', () => {
    expect(scanMd).toContain('*.tf');
    expect(scanMd).toContain('AWSTemplateFormatVersion');
    expect(scanMd).toContain('cdk.json');
    expect(scanMd).toContain('AWS::Serverless');
    expect(scanMd).toContain('Chart.yaml');
  });

  test('includes CDK/SAM handling', () => {
    expect(scanMd).toContain('cdk synth');
    expect(scanMd).toContain('SAM templates');
  });

  test('includes fallback when no tools available', () => {
    expect(scanMd).toContain('pip install checkov');
    expect(scanMd).toContain('brew install conftest');
  });
});

describe('Rego policy files', () => {
  const policyDir = path.join(ROOT, 'policies');
  const expectedPolicies = [
    'hipaa-encryption-at-rest.rego',
    'hipaa-transmission-security.rego',
    'hipaa-access-control.rego',
    'hipaa-audit-logging.rego',
    'hipaa-k8s-security.rego',
    'hipaa-secrets.rego',
  ];

  test('all 6 Rego policy files exist', () => {
    for (const policy of expectedPolicies) {
      expect(fs.existsSync(path.join(policyDir, policy))).toBe(true);
    }
  });

  for (const policy of expectedPolicies) {
    test(`${policy} has package hipaa.* declaration`, () => {
      const content = fs.readFileSync(path.join(policyDir, policy), 'utf-8');
      expect(content).toMatch(/^package hipaa\.\w+/m);
    });

    test(`${policy} has at least one deny rule`, () => {
      const content = fs.readFileSync(path.join(policyDir, policy), 'utf-8');
      expect(content).toContain('deny[msg]');
    });

    test(`${policy} includes hipaa_ref in deny messages`, () => {
      const content = fs.readFileSync(path.join(policyDir, policy), 'utf-8');
      expect(content).toContain('hipaa_ref');
    });

    test(`${policy} includes severity in deny messages`, () => {
      const content = fs.readFileSync(path.join(policyDir, policy), 'utf-8');
      expect(content).toContain('"severity"');
    });
  }
});

describe('Compliance frontmatter', () => {
  const templates = findTemplates();

  for (const tmpl of templates) {
    const name = path.relative(ROOT, tmpl);

    test(`${name} has hipaa_sections field`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      expect(content).toContain('hipaa_sections:');
    });

    test(`${name} has risk_level field`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      expect(content).toMatch(/risk_level:\s*(high|medium|low)/);
    });

    test(`${name} has requires_prior field`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      expect(content).toContain('requires_prior:');
    });
  }
});

describe('Preamble composed sections', () => {
  const generated = findGenerated();

  for (const md of generated) {
    const name = path.relative(ROOT, md);

    test(`${name} contains Update Check section`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      expect(content).toContain('## Update Check');
      expect(content).toContain('UPGRADE_AVAILABLE');
    });

    test(`${name} contains Compliance Completeness Principle`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      expect(content).toContain('## Compliance Completeness Principle');
      expect(content).toContain('shortcuts create audit gaps');
    });

    test(`${name} contains Contributor Mode section`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      expect(content).toContain('## Contributor Mode');
      expect(content).toContain('contributor mode');
    });
  }
});

describe('Update check bin utility', () => {
  const binPath = path.join(ROOT, 'bin', 'emdash-update-check');

  test('emdash-update-check exists and is executable', () => {
    expect(fs.existsSync(binPath)).toBe(true);
    const stat = fs.statSync(binPath);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  test('emdash-update-check has shebang', () => {
    const content = fs.readFileSync(binPath, 'utf-8');
    expect(content.startsWith('#!/')).toBe(true);
  });
});

describe('Bin utilities', () => {
  const binDir = path.join(ROOT, 'bin');
  const expectedBins = ['hipaa-slug', 'hipaa-config', 'hipaa-tool-detect', 'hipaa-evidence-hash', 'hipaa-review-log'];

  for (const bin of expectedBins) {
    test(`${bin} exists and is executable`, () => {
      const binPath = path.join(binDir, bin);
      expect(fs.existsSync(binPath)).toBe(true);
      const stat = fs.statSync(binPath);
      expect(stat.mode & 0o111).toBeGreaterThan(0); // executable
    });

    test(`${bin} has shebang`, () => {
      const content = fs.readFileSync(path.join(binDir, bin), 'utf-8');
      expect(content.startsWith('#!/')).toBe(true);
    });
  }
});

describe('Bin path hygiene', () => {
  const templates = findTemplates();
  const generated = findGenerated();
  const BIN_TOOLS = ['hipaa-slug', 'hipaa-config', 'hipaa-tool-detect', 'hipaa-evidence-hash', 'hipaa-review-log'];

  for (const tmpl of templates) {
    const name = path.basename(path.dirname(tmpl)) + '/SKILL.md.tmpl';

    test(`${name} has no hardcoded bin paths outside _EMDASH_BIN assignments`, () => {
      const content = fs.readFileSync(tmpl, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('_EMDASH_BIN=')) continue;
        for (const tool of BIN_TOOLS) {
          if (line.includes(`~/.claude/skills/em-dash/bin/${tool}`)) {
            throw new Error(`${name}:${i + 1} has hardcoded bin path: ${line.trim()}`);
          }
        }
      }
    });
  }

  for (const md of generated) {
    const name = path.basename(path.dirname(md)) + '/SKILL.md';

    test(`${name} has no hardcoded bin paths outside _EMDASH_BIN assignments`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('_EMDASH_BIN=')) continue;
        for (const tool of BIN_TOOLS) {
          if (line.includes(`~/.claude/skills/em-dash/bin/${tool}`)) {
            throw new Error(`${name}:${i + 1} has hardcoded bin path: ${line.trim()}`);
          }
        }
      }
    });

    test(`${name} has no quoted tildes in _EMDASH_BIN/_EMDASH_POLICIES assignments`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.includes('_EMDASH_BIN=') || line.includes('_EMDASH_POLICIES=')) &&
            line.includes('"~/.claude/')) {
          throw new Error(
            `${name}:${i + 1} has quoted tilde (~ won't expand inside double quotes): ${line.trim()}`
          );
        }
      }
    });

    test(`${name} uses $_EMDASH_BIN for all bin tool invocations`, () => {
      const content = fs.readFileSync(md, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('_EMDASH_BIN=') || line.includes('_EMDASH_POLICIES=')) continue;
        for (const tool of BIN_TOOLS) {
          const rawPathPattern = new RegExp(`[~.]?\\.claude/skills/em-dash/bin/${tool}`);
          if (rawPathPattern.test(line)) {
            throw new Error(
              `${name}:${i + 1} invokes ${tool} with raw path instead of $_EMDASH_BIN: ${line.trim()}`
            );
          }
        }
      }
    });
  }
});
