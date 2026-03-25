/**
 * Checks registry — execution catalog for all compliance checks.
 *
 * Each check defines HOW to verify something (grep pattern, CLI command, Rego rule).
 * WHAT to verify and which requirements each check satisfies is defined in
 * the NIST 800-53 catalog (nist/) + tool bindings (nist/tool-bindings.json).
 * This registry is the execution layer; NIST is the source of truth.
 *
 * To add a new check: add an entry here, then reference its ID in
 * nist/tool-bindings.json under the relevant 800-53 control.
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
  /** Default severity */
  severity_default: Severity;
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
  },
  {
    id: 'health-data-fields',
    category: 'sensitive_data',
    description: 'Health-specific data fields (diagnosis, medications, lab results, clinical notes)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'diagnosis|icd.?10|medication|prescription|lab.result|clinical.note',
    severity_default: 'INFO',
  },
  {
    id: 'sensitive-data-in-logs',
    category: 'audit',
    description: 'Sensitive data fields flowing into log output',
    type: 'code_grep',
    provider: 'code',
    pattern: 'console\\.log.*patient|logger\\..*ssn|log\\..*diagnosis',
    severity_default: 'CRITICAL',
  },
  {
    id: 'sensitive-data-in-browser',
    category: 'access_control',
    description: 'Sensitive data stored in localStorage, sessionStorage, cookies, or URL params',
    type: 'code_grep',
    provider: 'code',
    pattern: 'localStorage\\.set.*patient|sessionStorage.*ssn|cookie.*phi|\\?.*ssn=',
    severity_default: 'CRITICAL',
  },
  {
    id: 'rbac-existence',
    category: 'access_control',
    description: 'Role-based access control on sensitive data endpoints',
    type: 'code_grep',
    provider: 'code',
    pattern: 'role|permission|authorize|isAdmin|hasAccess|canView',
    severity_default: 'HIGH',
  },
  {
    id: 'audit-logging-code',
    category: 'audit',
    description: 'Audit trail recording who accessed what data and when',
    type: 'code_grep',
    provider: 'code',
    pattern: 'audit.*log|auditLog|audit_log|createAuditEntry',
    severity_default: 'HIGH',
  },
  {
    id: 'encryption-at-rest-code',
    category: 'encryption',
    description: 'Field-level encryption for sensitive data at rest',
    type: 'code_grep',
    provider: 'code',
    pattern: 'encrypt|AES|KMS|pgcrypto|crypto\\.create',
    severity_default: 'HIGH',
  },
  {
    id: 'session-timeout',
    category: 'authentication',
    description: 'Auto-logoff after period of inactivity',
    type: 'code_grep',
    provider: 'code',
    pattern: 'session.*timeout|maxAge|idle.*timeout|auto.*logoff|expiresIn',
    severity_default: 'MEDIUM',
  },
  {
    id: 'password-hashing',
    category: 'authentication',
    description: 'Password hashing with bcrypt/argon2/scrypt (not MD5/SHA1)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'bcrypt|argon2|scrypt|pbkdf2',
    severity_default: 'HIGH',
  },
  {
    id: 'sensitive-data-in-tests',
    category: 'sensitive_data',
    description: 'Real sensitive data patterns (SSN, MRN) in test fixtures',
    type: 'code_grep',
    provider: 'code',
    pattern: '\\d{3}-\\d{2}-\\d{4}|\\d{9}.*test|fixture.*ssn',
    severity_default: 'MEDIUM',
  },
  {
    id: 'sensitive-data-in-errors',
    category: 'access_control',
    description: 'Stack traces or error messages leaking sensitive data',
    type: 'code_grep',
    provider: 'code',
    pattern: 'err\\.message.*patient|stack.*ssn|throw.*diagnosis',
    severity_default: 'HIGH',
  },
  {
    id: 'iam-least-privilege-code',
    category: 'access_control',
    description: 'Least-privilege IAM — no wildcard actions or hardcoded credentials in code',
    type: 'code_grep',
    provider: 'code',
    pattern: '"Action":\\s*"\\*"|AKIA[A-Z0-9]{16}|hardcoded.*key|api.key.*=.*"',
    severity_default: 'CRITICAL',
  },
  {
    id: 'db-sensitive-columns',
    category: 'sensitive_data',
    description: 'Database columns containing sensitive data identifiers',
    type: 'code_grep',
    provider: 'code',
    pattern: 'column.*ssn|field.*diagnosis|schema.*patient_name',
    severity_default: 'INFO',
  },
  {
    id: 'db-audit-logging',
    category: 'audit',
    description: 'Database audit logging configuration (pgaudit, audit tables)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'pgaudit|audit_table|db.*audit|log_statement',
    severity_default: 'HIGH',
  },
  {
    id: 'db-encryption',
    category: 'encryption',
    description: 'Database encryption at rest (TDE, pgcrypto, column-level)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'tde|pgcrypto|encrypt.*column|storage_encrypted',
    severity_default: 'HIGH',
  },
  {
    id: 'db-access-grants',
    category: 'access_control',
    description: 'Database access control — no GRANT ALL or PUBLIC grants',
    type: 'code_grep',
    provider: 'code',
    pattern: 'GRANT ALL|GRANT.*PUBLIC|grant.*all.*privileges',
    severity_default: 'HIGH',
  },
  {
    id: 'db-connection-ssl',
    category: 'transmission',
    description: 'Database connections use SSL — sslmode=disable is a critical finding',
    type: 'code_grep',
    provider: 'code',
    pattern: 'sslmode=disable|ssl=false|sslmode.*=.*disable',
    severity_default: 'CRITICAL',
  },
  {
    id: 'sensitive-data-in-notifications',
    category: 'access_control',
    description: 'Sensitive data in push notifications or unencrypted email',
    type: 'code_grep',
    provider: 'code',
    pattern: 'push.*notification.*patient|sendEmail.*diagnosis|sms.*ssn',
    severity_default: 'HIGH',
  },
  {
    id: 'secrets-in-config',
    category: 'secrets',
    description: 'Passwords, API keys, or secrets in committed config files',
    type: 'code_grep',
    provider: 'code',
    pattern: 'password\\s*=|api_key\\s*=|secret\\s*=|AWS_SECRET',
    severity_default: 'CRITICAL',
  },
];

// ─── AWS Cloud Checks (19 checks) ──────────────────────────────

const AWS_CHECKS: Check[] = [
  { id: 'aws-iam-password-policy', category: 'authentication', description: 'IAM account password policy configured with strong requirements', type: 'cloud_cli', provider: 'aws', command: 'aws iam get-account-password-policy --output json', severity_default: 'HIGH' },
  { id: 'aws-iam-mfa', category: 'authentication', description: 'MFA enabled for all IAM users with console access', type: 'cloud_cli', provider: 'aws', command: 'aws iam generate-credential-report && aws iam get-credential-report --output json', severity_default: 'HIGH' },
  { id: 'aws-iam-wildcard', category: 'access_control', description: 'No IAM policies with Action:* and Resource:* (least privilege)', type: 'cloud_cli', provider: 'aws', command: 'aws iam list-policies --scope Local --output json', severity_default: 'HIGH' },
  { id: 'aws-cloudtrail', category: 'audit', description: 'CloudTrail enabled, multi-region, with log file validation and KMS encryption', type: 'cloud_cli', provider: 'aws', command: 'aws cloudtrail describe-trails --output json', severity_default: 'HIGH' },
  { id: 'aws-vpc-flow-logs', category: 'audit', description: 'VPC flow logs enabled on all VPCs', type: 'cloud_cli', provider: 'aws', command: 'aws ec2 describe-flow-logs --output json', severity_default: 'HIGH' },
  { id: 'aws-cloudwatch-retention', category: 'audit', description: 'CloudWatch log groups have retention policy configured', type: 'cloud_cli', provider: 'aws', command: 'aws logs describe-log-groups --query "logGroups[?!retentionInDays]" --output json', severity_default: 'MEDIUM' },
  { id: 'aws-s3-encryption', category: 'encryption', description: 'S3 buckets have server-side encryption (SSE-S3 or SSE-KMS)', type: 'cloud_cli', provider: 'aws', command: 'aws s3api get-bucket-encryption --bucket BUCKET', severity_default: 'HIGH' },
  { id: 'aws-s3-versioning', category: 'data_protection', description: 'S3 buckets have versioning enabled for data integrity', type: 'cloud_cli', provider: 'aws', command: 'aws s3api get-bucket-versioning --bucket BUCKET', severity_default: 'MEDIUM' },
  { id: 'aws-s3-public-access', category: 'access_control', description: 'S3 public access block configured at account and bucket level', type: 'cloud_cli', provider: 'aws', command: 'aws s3api get-public-access-block --bucket BUCKET', severity_default: 'HIGH' },
  { id: 'aws-rds-encryption', category: 'encryption', description: 'RDS instances have storage encryption enabled', type: 'cloud_cli', provider: 'aws', command: 'aws rds describe-db-instances --query "DBInstances[*].{ID:DBInstanceIdentifier,Encrypted:StorageEncrypted}" --output json', severity_default: 'HIGH' },
  { id: 'aws-kms-rotation', category: 'encryption', description: 'KMS keys have automatic rotation enabled', type: 'cloud_cli', provider: 'aws', command: 'aws kms get-key-rotation-status --key-id KEY_ID', severity_default: 'MEDIUM' },
  { id: 'aws-security-groups', category: 'transmission', description: 'No security groups with 0.0.0.0/0 ingress on sensitive ports', type: 'cloud_cli', provider: 'aws', command: 'aws ec2 describe-security-groups --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" --output json', severity_default: 'HIGH' },
  { id: 'aws-guardduty', category: 'monitoring', description: 'GuardDuty threat detection enabled', type: 'cloud_cli', provider: 'aws', command: 'aws guardduty list-detectors --output json', severity_default: 'HIGH' },
  { id: 'aws-security-hub', category: 'monitoring', description: 'Security Hub enabled for centralized findings', type: 'cloud_cli', provider: 'aws', command: 'aws securityhub describe-hub --output json', severity_default: 'MEDIUM' },
  { id: 'aws-secrets-manager-rotation', category: 'secrets', description: 'Secrets Manager secrets have automatic rotation configured', type: 'cloud_cli', provider: 'aws', command: 'aws secretsmanager list-secrets --query "SecretList[*].{Name:Name,Rotation:RotationEnabled}" --output json', severity_default: 'MEDIUM' },
  { id: 'aws-lambda-vpc', category: 'compute', description: 'Lambda functions handling sensitive data run inside VPC', type: 'cloud_cli', provider: 'aws', command: 'aws lambda list-functions --query "Functions[*].{Name:FunctionName,VPC:VpcConfig}" --output json', severity_default: 'MEDIUM' },
  { id: 'aws-lambda-kms', category: 'encryption', description: 'Lambda environment variables encrypted with KMS (not default key)', type: 'cloud_cli', provider: 'aws', command: 'aws lambda list-functions --query "Functions[*].{Name:FunctionName,KMS:KMSKeyArn}" --output json', severity_default: 'MEDIUM' },
  { id: 'aws-config-enabled', category: 'monitoring', description: 'AWS Config enabled for configuration change tracking', type: 'cloud_cli', provider: 'aws', command: 'aws configservice describe-configuration-recorders --output json', severity_default: 'MEDIUM' },
  { id: 'aws-api-gateway-logging', category: 'audit', description: 'API Gateway access logging enabled', type: 'cloud_cli', provider: 'aws', command: 'aws apigateway get-rest-apis --output json', severity_default: 'HIGH' },
  { id: 'aws-dynamodb-encryption', category: 'encryption', description: 'DynamoDB tables use customer-managed KMS keys (not default)', type: 'cloud_cli', provider: 'aws', command: 'aws dynamodb list-tables --output json', severity_default: 'MEDIUM' },
];

// ─── Rego Policy Checks (11 checks) ────────────────────────────

const REGO_CHECKS: Check[] = [
  { id: 'rego-iam-wildcard', category: 'access_control', description: 'Terraform IAM policies must not use Action:* and Resource:*', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-mfa-required', category: 'authentication', description: 'IAM users must have MFA enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-cloudtrail-enabled', category: 'audit', description: 'CloudTrail must be enabled with multi-region and log validation', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-s3-encryption', category: 'encryption', description: 'S3 buckets must have server-side encryption configured', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-rds-encryption', category: 'encryption', description: 'RDS instances must have storage_encrypted = true', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-security-group-open', category: 'transmission', description: 'Security groups must not allow 0.0.0.0/0 ingress on all ports', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-rds-public', category: 'access_control', description: 'RDS instances must not be publicly accessible', type: 'rego', severity_default: 'CRITICAL' },
  { id: 'rego-no-hardcoded-secrets', category: 'secrets', description: 'No hardcoded credentials or API keys in Terraform', type: 'rego', severity_default: 'CRITICAL' },
  { id: 'rego-kms-rotation', category: 'encryption', description: 'KMS keys must have automatic rotation enabled', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-k8s-rbac-wildcard', category: 'access_control', description: 'K8s RBAC must not use wildcard verbs or resources', type: 'rego', provider: 'k8s', severity_default: 'HIGH' },
  { id: 'rego-k8s-non-root', category: 'compute', description: 'K8s containers must run as non-root', type: 'rego', provider: 'k8s', severity_default: 'MEDIUM' },
];

// ─── Export ─────────────────────────────────────────────────────

export const CHECKS: Check[] = [...CODE_CHECKS, ...AWS_CHECKS, ...REGO_CHECKS];

/** Get a check by ID */
export function getCheck(id: string): Check | undefined {
  return CHECKS.find((c) => c.id === id);
}

/** Get all checks by type */
export function getChecksByType(type: CheckType): Check[] {
  return CHECKS.filter((c) => c.type === type);
}

/** Get all checks by provider */
export function getChecksByProvider(provider: Provider): Check[] {
  return CHECKS.filter((c) => c.provider === provider);
}

/** Get all check IDs */
export function getAllCheckIds(): string[] {
  return CHECKS.map((c) => c.id);
}
