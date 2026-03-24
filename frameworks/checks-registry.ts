/**
 * Checks registry — the canonical list of all compliance checks.
 *
 * Each check is a single verification (grep pattern, CLI command, Rego rule)
 * that can satisfy requirements across multiple frameworks. The framework
 * definitions reference checks by ID; the template engine uses this registry
 * to generate framework-specific SKILL.md content.
 *
 * To add a new check: add an entry here, then reference its ID in the
 * relevant framework definition's requirements[].check_ids array.
 */

export type CheckCategory =
  | 'access_control'
  | 'encryption'
  | 'audit'
  | 'transmission'
  | 'secrets'
  | 'compute'
  | 'data_protection'
  | 'sensitive_data'
  | 'authentication'
  | 'monitoring';

export type CheckType = 'rego' | 'cloud_cli' | 'code_grep' | 'tool_integration';
export type Provider = 'aws' | 'gcp' | 'azure' | 'code' | 'k8s';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface FrameworkMapping {
  /** Requirement IDs this check satisfies in the given framework */
  requirement_ids: string[];
  /** Override default severity for this framework (optional) */
  severity?: Severity;
}

export interface Check {
  /** Unique check identifier */
  id: string;
  /** Check category for grouping */
  category: CheckCategory;
  /** Human-readable description */
  description: string;
  /** How this check is executed */
  type: CheckType;
  /** Cloud provider (for cloud_cli checks) */
  provider?: Provider;
  /** CLI command to run (for cloud_cli checks) */
  command?: string;
  /** Grep/regex pattern (for code_grep checks) */
  pattern?: string;
  /** Default severity across all frameworks */
  severity_default: Severity;
  /** Per-framework requirement mappings */
  frameworks: Record<string, FrameworkMapping>;
}

// ─── Code-Level Checks (19 checks) ─────────────────────────────

const CODE_CHECKS: Check[] = [
  {
    id: 'phi-identifiers',
    category: 'sensitive_data',
    description: 'Direct sensitive data identifiers in code (names, SSN, MRN, DOB, insurance IDs)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'patient.*name|ssn|social.security|medical.record|mrn|date.of.birth|dob|insurance.id',
    severity_default: 'INFO',
    frameworks: {
      hipaa: { requirement_ids: ['164.514'] },
      soc2: { requirement_ids: ['C1.1'] },
      gdpr: { requirement_ids: ['Art. 4(1)'] },
    },
  },
  {
    id: 'health-data-fields',
    category: 'sensitive_data',
    description: 'Health-specific data fields (diagnosis, medications, lab results, clinical notes)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'diagnosis|icd.?10|medication|prescription|lab.result|clinical.note',
    severity_default: 'INFO',
    frameworks: {
      hipaa: { requirement_ids: ['164.501'] },
    },
  },
  {
    id: 'sensitive-data-in-logs',
    category: 'audit',
    description: 'Sensitive data fields flowing into log output',
    type: 'code_grep',
    provider: 'code',
    pattern: 'console\\.log.*patient|logger\\..*ssn|log\\..*diagnosis',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC6.1', 'CC7.2'] },
      gdpr: { requirement_ids: ['Art. 32(1)(b)'] },
      pci_dss: { requirement_ids: ['3.4', '10.3'] },
    },
  },
  {
    id: 'sensitive-data-in-browser',
    category: 'access_control',
    description: 'Sensitive data stored in localStorage, sessionStorage, cookies, or URL params',
    type: 'code_grep',
    provider: 'code',
    pattern: 'localStorage\\.set.*patient|sessionStorage.*ssn|cookie.*phi|\\?.*ssn=',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      gdpr: { requirement_ids: ['Art. 32(1)(b)'] },
    },
  },
  {
    id: 'rbac-existence',
    category: 'access_control',
    description: 'Role-based access control on sensitive data endpoints',
    type: 'code_grep',
    provider: 'code',
    pattern: 'role|permission|authorize|isAdmin|hasAccess|canView',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1', 'CC6.3'] },
      gdpr: { requirement_ids: ['Art. 32(1)(b)'] },
      pci_dss: { requirement_ids: ['7.1', '7.2'] },
      iso27001: { requirement_ids: ['A.9.2.1'] },
    },
  },
  {
    id: 'audit-logging-code',
    category: 'audit',
    description: 'Audit trail recording who accessed what data and when',
    type: 'code_grep',
    provider: 'code',
    pattern: 'audit.*log|auditLog|audit_log|createAuditEntry',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.2', 'CC7.3'] },
      gdpr: { requirement_ids: ['Art. 30'] },
      pci_dss: { requirement_ids: ['10.1', '10.2'] },
      iso27001: { requirement_ids: ['A.12.4.1'] },
    },
  },
  {
    id: 'encryption-at-rest-code',
    category: 'encryption',
    description: 'Field-level encryption for sensitive data at rest',
    type: 'code_grep',
    provider: 'code',
    pattern: 'encrypt|AES|KMS|pgcrypto|crypto\\.create',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      gdpr: { requirement_ids: ['Art. 32(1)(a)'] },
      pci_dss: { requirement_ids: ['3.4', '3.5'] },
    },
  },
  {
    id: 'session-timeout',
    category: 'authentication',
    description: 'Auto-logoff after period of inactivity',
    type: 'code_grep',
    provider: 'code',
    pattern: 'session.*timeout|maxAge|idle.*timeout|auto.*logoff|expiresIn',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iii)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['8.2.8'] },
    },
  },
  {
    id: 'password-hashing',
    category: 'authentication',
    description: 'Password hashing with bcrypt/argon2/scrypt (not MD5/SHA1)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'bcrypt|argon2|scrypt|pbkdf2',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(d)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['8.3.2'] },
    },
  },
  {
    id: 'sensitive-data-in-tests',
    category: 'sensitive_data',
    description: 'Real sensitive data patterns (SSN, MRN) in test fixtures',
    type: 'code_grep',
    provider: 'code',
    pattern: '\\d{3}-\\d{2}-\\d{4}|\\d{9}.*test|fixture.*ssn',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.502'] },
      gdpr: { requirement_ids: ['Art. 32(1)(b)'] },
    },
  },
  {
    id: 'sensitive-data-in-errors',
    category: 'access_control',
    description: 'Stack traces or error messages leaking sensitive data',
    type: 'code_grep',
    provider: 'code',
    pattern: 'err\\.message.*patient|stack.*ssn|throw.*diagnosis',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      gdpr: { requirement_ids: ['Art. 32(1)(b)'] },
    },
  },
  {
    id: 'iam-least-privilege-code',
    category: 'access_control',
    description: 'Least-privilege IAM — no wildcard actions or hardcoded credentials in code',
    type: 'code_grep',
    provider: 'code',
    pattern: '"Action":\\s*"\\*"|AKIA[A-Z0-9]{16}|hardcoded.*key|api.key.*=.*"',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.308(a)(4)'] },
      soc2: { requirement_ids: ['CC6.1', 'CC6.3'] },
      pci_dss: { requirement_ids: ['2.2.7', '7.2.1'] },
      iso27001: { requirement_ids: ['A.9.2.3'] },
    },
  },
  {
    id: 'db-sensitive-columns',
    category: 'sensitive_data',
    description: 'Database columns containing sensitive data identifiers',
    type: 'code_grep',
    provider: 'code',
    pattern: 'column.*ssn|field.*diagnosis|schema.*patient_name',
    severity_default: 'INFO',
    frameworks: {
      hipaa: { requirement_ids: ['164.502'] },
      gdpr: { requirement_ids: ['Art. 30'] },
    },
  },
  {
    id: 'db-audit-logging',
    category: 'audit',
    description: 'Database audit logging configuration (pgaudit, audit tables)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'pgaudit|audit_table|db.*audit|log_statement',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.2'] },
      pci_dss: { requirement_ids: ['10.2'] },
    },
  },
  {
    id: 'db-encryption',
    category: 'encryption',
    description: 'Database encryption at rest (TDE, pgcrypto, column-level)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'tde|pgcrypto|encrypt.*column|storage_encrypted',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['3.4'] },
    },
  },
  {
    id: 'db-access-grants',
    category: 'access_control',
    description: 'Database access control — no GRANT ALL or PUBLIC grants',
    type: 'code_grep',
    provider: 'code',
    pattern: 'GRANT ALL|GRANT.*PUBLIC|grant.*all.*privileges',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['7.2.1'] },
    },
  },
  {
    id: 'db-connection-ssl',
    category: 'transmission',
    description: 'Database connections use SSL — sslmode=disable is a critical finding',
    type: 'code_grep',
    provider: 'code',
    pattern: 'sslmode=disable|ssl=false|sslmode.*=.*disable',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(e)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['4.2.1'] },
    },
  },
  {
    id: 'sensitive-data-in-notifications',
    category: 'access_control',
    description: 'Sensitive data in push notifications or unencrypted email',
    type: 'code_grep',
    provider: 'code',
    pattern: 'push.*notification.*patient|sendEmail.*diagnosis|sms.*ssn',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      gdpr: { requirement_ids: ['Art. 32(1)(b)'] },
    },
  },
  {
    id: 'secrets-in-config',
    category: 'secrets',
    description: 'Passwords, API keys, or secrets in committed config files',
    type: 'code_grep',
    provider: 'code',
    pattern: 'password\\s*=|api_key\\s*=|secret\\s*=|AWS_SECRET',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['2.2.7'] },
      iso27001: { requirement_ids: ['A.9.4.3'] },
    },
  },
];

// ─── AWS Cloud Checks ──────────────────────────────────────────

const AWS_CHECKS: Check[] = [
  {
    id: 'aws-iam-password-policy',
    category: 'authentication',
    description: 'IAM account password policy configured with strong requirements',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws iam get-account-password-policy --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(d)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['8.3.6'] },
    },
  },
  {
    id: 'aws-iam-mfa',
    category: 'authentication',
    description: 'MFA enabled for all IAM users with console access',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws iam generate-credential-report && aws iam get-credential-report --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(d)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['8.4.2'] },
      iso27001: { requirement_ids: ['A.9.4.2'] },
    },
  },
  {
    id: 'aws-iam-wildcard',
    category: 'access_control',
    description: 'No IAM policies with Action:* and Resource:* (least privilege)',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws iam list-policies --scope Local --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)', '164.308(a)(4)'] },
      soc2: { requirement_ids: ['CC6.1', 'CC6.3'] },
      pci_dss: { requirement_ids: ['7.2.1'] },
      iso27001: { requirement_ids: ['A.9.2.3'] },
    },
  },
  {
    id: 'aws-cloudtrail',
    category: 'audit',
    description: 'CloudTrail enabled, multi-region, with log file validation and KMS encryption',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws cloudtrail describe-trails --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)', '164.308(a)(1)(ii)(D)'] },
      soc2: { requirement_ids: ['CC7.2', 'CC7.3'] },
      pci_dss: { requirement_ids: ['10.1', '10.2'] },
      iso27001: { requirement_ids: ['A.12.4.1'] },
    },
  },
  {
    id: 'aws-vpc-flow-logs',
    category: 'audit',
    description: 'VPC flow logs enabled on all VPCs',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws ec2 describe-flow-logs --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.2'] },
      pci_dss: { requirement_ids: ['10.6'] },
    },
  },
  {
    id: 'aws-cloudwatch-retention',
    category: 'audit',
    description: 'CloudWatch log groups have retention policy configured',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws logs describe-log-groups --query "logGroups[?!retentionInDays]" --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.2'] },
    },
  },
  {
    id: 'aws-s3-encryption',
    category: 'encryption',
    description: 'S3 buckets have server-side encryption (SSE-S3 or SSE-KMS)',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws s3api get-bucket-encryption --bucket BUCKET',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      gdpr: { requirement_ids: ['Art. 32(1)(a)'] },
      pci_dss: { requirement_ids: ['3.4.1'] },
    },
  },
  {
    id: 'aws-s3-versioning',
    category: 'data_protection',
    description: 'S3 buckets have versioning enabled for data integrity',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws s3api get-bucket-versioning --bucket BUCKET',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(c)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
    },
  },
  {
    id: 'aws-s3-public-access',
    category: 'access_control',
    description: 'S3 public access block configured at account and bucket level',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws s3api get-public-access-block --bucket BUCKET',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['1.3.1'] },
    },
  },
  {
    id: 'aws-rds-encryption',
    category: 'encryption',
    description: 'RDS instances have storage encryption enabled',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws rds describe-db-instances --query "DBInstances[*].{ID:DBInstanceIdentifier,Encrypted:StorageEncrypted}" --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['3.4'] },
    },
  },
  {
    id: 'aws-kms-rotation',
    category: 'encryption',
    description: 'KMS keys have automatic rotation enabled',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws kms get-key-rotation-status --key-id KEY_ID',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['3.6.4'] },
    },
  },
  {
    id: 'aws-security-groups',
    category: 'transmission',
    description: 'No security groups with 0.0.0.0/0 ingress on sensitive ports',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws ec2 describe-security-groups --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(e)(1)'] },
      soc2: { requirement_ids: ['CC6.1', 'CC6.6'] },
      pci_dss: { requirement_ids: ['1.3.1', '1.3.2'] },
    },
  },
  {
    id: 'aws-guardduty',
    category: 'monitoring',
    description: 'GuardDuty threat detection enabled',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws guardduty list-detectors --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.308(a)(1)(ii)(D)'] },
      soc2: { requirement_ids: ['CC7.2'] },
    },
  },
  {
    id: 'aws-security-hub',
    category: 'monitoring',
    description: 'Security Hub enabled for centralized findings',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws securityhub describe-hub --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.308(a)(1)(ii)(D)'] },
      soc2: { requirement_ids: ['CC7.2'] },
    },
  },
  {
    id: 'aws-secrets-manager-rotation',
    category: 'secrets',
    description: 'Secrets Manager secrets have automatic rotation configured',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws secretsmanager list-secrets --query "SecretList[*].{Name:Name,Rotation:RotationEnabled}" --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['8.6.3'] },
    },
  },
  {
    id: 'aws-lambda-vpc',
    category: 'compute',
    description: 'Lambda functions handling sensitive data run inside VPC',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws lambda list-functions --query "Functions[*].{Name:FunctionName,VPC:VpcConfig}" --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(e)(1)'] },
      soc2: { requirement_ids: ['CC6.6'] },
    },
  },
  {
    id: 'aws-lambda-kms',
    category: 'encryption',
    description: 'Lambda environment variables encrypted with KMS (not default key)',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws lambda list-functions --query "Functions[*].{Name:FunctionName,KMS:KMSKeyArn}" --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
    },
  },
  {
    id: 'aws-config-enabled',
    category: 'monitoring',
    description: 'AWS Config enabled for configuration change tracking',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws configservice describe-configuration-recorders --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.1'] },
    },
  },
  {
    id: 'aws-api-gateway-logging',
    category: 'audit',
    description: 'API Gateway access logging enabled',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws apigateway get-rest-apis --output json',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.2'] },
    },
  },
  {
    id: 'aws-dynamodb-encryption',
    category: 'encryption',
    description: 'DynamoDB tables use customer-managed KMS keys (not default)',
    type: 'cloud_cli',
    provider: 'aws',
    command: 'aws dynamodb list-tables --output json',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
    },
  },
];

// ─── Rego Policy Checks ────────────────────────────────────────

const REGO_CHECKS: Check[] = [
  {
    id: 'rego-iam-wildcard',
    category: 'access_control',
    description: 'Terraform IAM policies must not use Action:* and Resource:*',
    type: 'rego',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['7.2.1'] },
      iso27001: { requirement_ids: ['A.9.2.3'] },
    },
  },
  {
    id: 'rego-mfa-required',
    category: 'authentication',
    description: 'IAM users must have MFA enabled',
    type: 'rego',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(d)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['8.4.2'] },
    },
  },
  {
    id: 'rego-cloudtrail-enabled',
    category: 'audit',
    description: 'CloudTrail must be enabled with multi-region and log validation',
    type: 'rego',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(b)'] },
      soc2: { requirement_ids: ['CC7.2'] },
      pci_dss: { requirement_ids: ['10.1'] },
    },
  },
  {
    id: 'rego-s3-encryption',
    category: 'encryption',
    description: 'S3 buckets must have server-side encryption configured',
    type: 'rego',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['3.4.1'] },
    },
  },
  {
    id: 'rego-rds-encryption',
    category: 'encryption',
    description: 'RDS instances must have storage_encrypted = true',
    type: 'rego',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['3.4'] },
    },
  },
  {
    id: 'rego-security-group-open',
    category: 'transmission',
    description: 'Security groups must not allow 0.0.0.0/0 ingress on all ports',
    type: 'rego',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(e)(1)'] },
      soc2: { requirement_ids: ['CC6.6'] },
      pci_dss: { requirement_ids: ['1.3.1'] },
    },
  },
  {
    id: 'rego-rds-public',
    category: 'access_control',
    description: 'RDS instances must not be publicly accessible',
    type: 'rego',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['1.3.1'] },
    },
  },
  {
    id: 'rego-no-hardcoded-secrets',
    category: 'secrets',
    description: 'No hardcoded credentials or API keys in Terraform',
    type: 'rego',
    severity_default: 'CRITICAL',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['2.2.7'] },
    },
  },
  {
    id: 'rego-kms-rotation',
    category: 'encryption',
    description: 'KMS keys must have automatic rotation enabled',
    type: 'rego',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(2)(iv)'] },
      soc2: { requirement_ids: ['CC6.1'] },
      pci_dss: { requirement_ids: ['3.6.4'] },
    },
  },
  {
    id: 'rego-k8s-rbac-wildcard',
    category: 'access_control',
    description: 'K8s RBAC must not use wildcard verbs or resources',
    type: 'rego',
    provider: 'k8s',
    severity_default: 'HIGH',
    frameworks: {
      hipaa: { requirement_ids: ['164.308(a)(4)'] },
      soc2: { requirement_ids: ['CC6.1'] },
    },
  },
  {
    id: 'rego-k8s-non-root',
    category: 'compute',
    description: 'K8s containers must run as non-root',
    type: 'rego',
    provider: 'k8s',
    severity_default: 'MEDIUM',
    frameworks: {
      hipaa: { requirement_ids: ['164.312(a)(1)'] },
      soc2: { requirement_ids: ['CC6.1'] },
    },
  },
];

// ─── Export all checks ──────────────────────────────────────────

export const CHECKS: Check[] = [...CODE_CHECKS, ...AWS_CHECKS, ...REGO_CHECKS];

/** Get all checks that apply to a specific framework */
export function getChecksForFramework(frameworkId: string): Check[] {
  return CHECKS.filter((c) => c.frameworks[frameworkId]);
}

/** Get all checks for a specific provider and framework */
export function getChecksForProvider(frameworkId: string, provider: Provider): Check[] {
  return CHECKS.filter((c) => c.frameworks[frameworkId] && c.provider === provider);
}

/** Get the requirement IDs a check satisfies for a given framework */
export function getRequirementIds(checkId: string, frameworkId: string): string[] {
  const check = CHECKS.find((c) => c.id === checkId);
  if (!check) return [];
  return check.frameworks[frameworkId]?.requirement_ids ?? [];
}

/** Validate that all check_ids referenced in a framework definition exist */
export function validateFrameworkChecks(
  frameworkId: string,
  checkIds: string[],
): { valid: string[]; missing: string[] } {
  const registryIds = new Set(CHECKS.filter((c) => c.frameworks[frameworkId]).map((c) => c.id));
  const valid = checkIds.filter((id) => registryIds.has(id));
  const missing = checkIds.filter((id) => !registryIds.has(id));
  return { valid, missing };
}
