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
  | 'monitoring'
  | 'policy_doc';

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

// ─── Rego Policy Checks (68 unique checks) ─────────────────────

const REGO_CHECKS: Check[] = [
  // ── Kept unique (no rename needed) ──
  { id: 'rego-mfa-required', category: 'authentication', description: 'IAM users must have MFA enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-rds-public', category: 'access_control', description: 'RDS instances must not be publicly accessible', type: 'rego', severity_default: 'CRITICAL' },
  { id: 'rego-k8s-rbac-wildcard', category: 'access_control', description: 'K8s RBAC must not use wildcard verbs or resources', type: 'rego', provider: 'k8s', severity_default: 'HIGH' },

  // ── encryption-at-rest.rego (was rego-s3-encryption / rego-rds-encryption / rego-kms-rotation) ──
  { id: 'rego-aws-rds-encryption', category: 'encryption', description: 'RDS instances must have storage_encrypted = true', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-s3-encryption', category: 'encryption', description: 'S3 buckets must have server-side encryption configured', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-ebs-encryption', category: 'encryption', description: 'EBS volumes must be encrypted', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-kms-rotation', category: 'encryption', description: 'KMS keys must have automatic rotation enabled', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-sns-encryption', category: 'encryption', description: 'SNS topics must use KMS encryption', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-gcp-cloudsql-encryption', category: 'encryption', description: 'Cloud SQL instances must use customer-managed encryption key', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-gcp-gcs-encryption', category: 'encryption', description: 'GCS buckets must have customer-managed encryption', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-sqs-encryption', category: 'encryption', description: 'SQS queues must use KMS encryption', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-azure-storage-https', category: 'encryption', description: 'Azure storage accounts must enforce HTTPS-only traffic', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-azure-disk-encryption', category: 'encryption', description: 'Azure managed disks must be encrypted with customer-managed key', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-azure-keyvault-softdelete', category: 'encryption', description: 'Azure Key Vault must have soft delete retention >= 7 days', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-gcp-bigquery-encryption', category: 'encryption', description: 'BigQuery datasets must use customer-managed encryption', type: 'rego', severity_default: 'MEDIUM' },

  // ── backup-dr.rego (was rego-rds-encryption / rego-s3-encryption) ──
  { id: 'rego-aws-rds-backup', category: 'data_protection', description: 'RDS instances must have automated backups enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-rds-backup-retention', category: 'data_protection', description: 'RDS backup retention must be >= 7 days', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-s3-versioning', category: 'data_protection', description: 'S3 buckets must have versioning enabled for data recovery', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-dynamodb-backup', category: 'data_protection', description: 'DynamoDB tables must have point-in-time recovery enabled', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-efs-backup', category: 'data_protection', description: 'EFS file systems must have lifecycle/backup policy configured', type: 'rego', severity_default: 'LOW' },
  { id: 'rego-gcp-cloudsql-backup', category: 'data_protection', description: 'Cloud SQL instances must have automated backups enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-azure-sql-backup', category: 'data_protection', description: 'Azure SQL databases must have long-term retention policy', type: 'rego', severity_default: 'MEDIUM' },

  // ── transmission-security.rego (was rego-security-group-open) ──
  { id: 'rego-aws-sg-rule-open', category: 'transmission', description: 'Security group rules must not allow 0.0.0.0/0 on sensitive ports', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-sg-open', category: 'transmission', description: 'Security groups must not allow 0.0.0.0/0 ingress on sensitive port ranges', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-lb-https', category: 'transmission', description: 'ALB/NLB listeners must use HTTPS or TLS protocol', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-rds-sg-open', category: 'transmission', description: 'RDS instances must have parameter group enforcing SSL', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-gcp-sql-authorized-networks', category: 'transmission', description: 'Cloud SQL instances must require SSL for connections', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-gcp-sql-public-ip', category: 'transmission', description: 'Cloud SQL instances must not have public IPv4 enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-gcp-firewall-open', category: 'transmission', description: 'GCP firewall rules must not allow 0.0.0.0/0 on sensitive ports', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-azure-nsg-open', category: 'transmission', description: 'Azure NSG rules must not allow inbound * on sensitive ports', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-azure-appservice-https', category: 'transmission', description: 'Azure App Service must enforce HTTPS-only', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-gcp-cloudrun-public', category: 'transmission', description: 'Cloud Run must not allow unauthenticated (allUsers) invocations', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-docker-expose-all', category: 'transmission', description: 'Dockerfiles must not expose sensitive ports directly', type: 'rego', severity_default: 'MEDIUM' },

  // ── audit-logging.rego (was rego-cloudtrail-enabled) ──
  { id: 'rego-aws-cloudtrail-multiregion', category: 'audit', description: 'CloudTrail must be configured as multi-region', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-cloudtrail-logvalidation', category: 'audit', description: 'CloudTrail must have log file validation enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-cloudtrail-encryption', category: 'audit', description: 'CloudTrail must be encrypted with KMS', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-vpc-flowlogs', category: 'audit', description: 'VPCs must have flow logs enabled', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-cloudwatch-retention', category: 'audit', description: 'CloudWatch log groups must have retention >= 365 days', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-aws-cloudwatch-no-retention', category: 'audit', description: 'CloudWatch log groups must have a retention policy set', type: 'rego', severity_default: 'LOW' },
  { id: 'rego-gcp-audit-logging', category: 'audit', description: 'GCP audit configs must not exempt members from DATA_READ logging', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-azure-monitor-logprofile', category: 'audit', description: 'Azure log profiles must have retention policy configured', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-azure-monitor-diagnostic', category: 'audit', description: 'Azure diagnostic settings must have retention enabled', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-gcp-logging-sink', category: 'audit', description: 'GCP log sinks must have a filter targeting audit-relevant log types', type: 'rego', severity_default: 'LOW' },

  // ── access-control.rego (was rego-iam-wildcard) ──
  { id: 'rego-aws-iam-wildcard-action', category: 'access_control', description: 'IAM policies must not grant wildcard Action and Resource (string form)', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-iam-wildcard-resource', category: 'access_control', description: 'IAM policies must not grant wildcard Action and Resource (array form)', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-aws-iam-admin-policy', category: 'access_control', description: 'IAM role inline policies must not use wildcard actions', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-gcp-iam-primitive-role', category: 'access_control', description: 'GCP service accounts must not have roles/owner', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-gcp-iam-alluser-binding', category: 'access_control', description: 'GCP service accounts must not have roles/editor — use granular roles', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-azure-role-subscription-scope', category: 'access_control', description: 'Azure Contributor must not be assigned at subscription scope', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-azure-role-wildcard-scope', category: 'access_control', description: 'Azure Owner must not be assigned at subscription scope', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-gcp-sa-key-rotation', category: 'access_control', description: 'GCP service account keys should not exist — use workload identity', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-gcp-iam-allauthenticated', category: 'access_control', description: 'GCP IAM bindings must not grant access to allUsers or allAuthenticatedUsers', type: 'rego', severity_default: 'CRITICAL' },
  { id: 'rego-azure-role-wildcard-actions', category: 'access_control', description: 'Azure custom role definitions must not use wildcard actions', type: 'rego', severity_default: 'HIGH' },

  // ── secrets.rego (was rego-no-hardcoded-secrets) ──
  { id: 'rego-aws-provider-hardcoded-key', category: 'secrets', description: 'AWS provider must not have hardcoded access_key', type: 'rego', severity_default: 'CRITICAL' },
  { id: 'rego-aws-provider-hardcoded-secret', category: 'secrets', description: 'AWS provider must not have hardcoded secret_key', type: 'rego', severity_default: 'CRITICAL' },
  { id: 'rego-tf-sensitive-default', category: 'secrets', description: 'Terraform password variables must not have default values', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-tf-secret-var-default', category: 'secrets', description: 'Terraform secret/key/token variables must not have default values', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-k8s-secret-in-env', category: 'secrets', description: 'K8s env vars with secret names must use secretKeyRef, not inline values', type: 'rego', severity_default: 'HIGH' },

  // ── container-security.rego (was rego-k8s-non-root / rego-no-hardcoded-secrets / rego-security-group-open) ──
  { id: 'rego-docker-nonroot-user', category: 'compute', description: 'Dockerfiles must not set USER root', type: 'rego', severity_default: 'HIGH' },
  { id: 'rego-docker-latest-tag', category: 'compute', description: 'Dockerfiles must not use :latest tag — pin to specific version', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-docker-add-url', category: 'compute', description: 'Dockerfiles must not use ADD with remote URLs — use COPY + curl', type: 'rego', severity_default: 'MEDIUM' },
  { id: 'rego-compose-readonly', category: 'compute', description: 'Docker Compose services must not run in privileged mode', type: 'rego', severity_default: 'CRITICAL' },

  // ── k8s-security.rego (was rego-k8s-non-root / rego-no-hardcoded-secrets) ──
  { id: 'rego-k8s-deploy-nonroot', category: 'compute', description: 'Deployment containers must not run as root (UID 0)', type: 'rego', provider: 'k8s', severity_default: 'HIGH' },
  { id: 'rego-k8s-deploy-seccontext', category: 'compute', description: 'Deployment containers must set runAsNonRoot in securityContext', type: 'rego', provider: 'k8s', severity_default: 'MEDIUM' },
  { id: 'rego-k8s-deploy-nonprivileged', category: 'compute', description: 'Deployment containers must not run in privileged mode', type: 'rego', provider: 'k8s', severity_default: 'CRITICAL' },
  { id: 'rego-k8s-namespace-netpolicy', category: 'compute', description: 'Namespaces labeled for sensitive data must have NetworkPolicy', type: 'rego', provider: 'k8s', severity_default: 'HIGH' },
  { id: 'rego-k8s-deploy-approved-registry', category: 'compute', description: 'Deployment containers must use images from approved registries', type: 'rego', provider: 'k8s', severity_default: 'MEDIUM' },
  { id: 'rego-k8s-deploy-secret-env', category: 'secrets', description: 'Deployment env vars with secret names must use secretKeyRef', type: 'rego', provider: 'k8s', severity_default: 'HIGH' },
  { id: 'rego-k8s-statefulset-nonroot', category: 'compute', description: 'StatefulSet containers must not run in privileged mode', type: 'rego', provider: 'k8s', severity_default: 'CRITICAL' },
];

// ─── Tool Integration Checks (8 external tools) ─────────────────
//
// External scanning tools that the orchestrator (bin/comply-orchestrate)
// can invoke. Each entry defines the tool name, detection command,
// and scan command. The orchestrator reads these entries to discover
// which tools are available and how to run them.
//
// Finding-to-control mapping is in nist/tool-bindings.json (reverse lookup).

const TOOL_INTEGRATION_CHECKS: Check[] = [
  {
    id: 'tool-prowler',
    category: 'monitoring',
    description: 'Prowler — AWS security assessment (CIS, HIPAA, PCI-DSS)',
    type: 'tool_integration',
    provider: 'aws',
    command: 'prowler --compliance hipaa --output-modes json --output-directory /tmp/prowler-out',
    severity_default: 'HIGH',
  },
  {
    id: 'tool-checkov',
    category: 'monitoring',
    description: 'Checkov — IaC security scanning (Terraform, CloudFormation, K8s)',
    type: 'tool_integration',
    command: 'checkov -d . --framework terraform --output json --quiet',
    severity_default: 'HIGH',
  },
  {
    id: 'tool-kics',
    category: 'monitoring',
    description: 'KICS — IaC security scanner (2400+ queries, Rego-based)',
    type: 'tool_integration',
    command: 'kics scan -p . --type terraform,kubernetes,docker,cloudformation -o /tmp/kics-out --report-formats json',
    severity_default: 'HIGH',
  },
  {
    id: 'tool-trivy',
    category: 'monitoring',
    description: 'Trivy — container, IaC, and secret scanning',
    type: 'tool_integration',
    command: 'trivy fs . --format json --scanners vuln,misconfig,secret',
    severity_default: 'HIGH',
  },
  {
    id: 'tool-semgrep',
    category: 'monitoring',
    description: 'Semgrep — SAST code security scanning',
    type: 'tool_integration',
    provider: 'code',
    command: 'semgrep --config auto --json --quiet',
    severity_default: 'MEDIUM',
  },
  {
    id: 'tool-kube-bench',
    category: 'monitoring',
    description: 'kube-bench — CIS Kubernetes benchmark scanning',
    type: 'tool_integration',
    provider: 'k8s',
    command: 'kube-bench run --json',
    severity_default: 'HIGH',
  },
  {
    id: 'tool-scoutsuite',
    category: 'monitoring',
    description: 'ScoutSuite — multi-cloud security auditing (AWS/GCP/Azure)',
    type: 'tool_integration',
    command: 'python3 -m ScoutSuite --provider aws --report-dir /tmp/scoutsuite-out --result-format json --no-browser',
    severity_default: 'HIGH',
  },
  {
    id: 'tool-lynis',
    category: 'monitoring',
    description: 'Lynis — system security auditing (Linux/macOS)',
    type: 'tool_integration',
    command: 'lynis audit system --quick --cronjob --report-file /tmp/lynis-report.dat',
    severity_default: 'MEDIUM',
  },
];

// ─── Policy Document Checks (10 checks) ────────────────────────
//
// Partial automation for interview-only controls. These check for the
// EXISTENCE of policy documents in the project (not in templates/).
// Finding a doc does NOT auto-pass the control — it records evidence
// and moves the control to 'partial'. The interview still verifies content.
//
// IMPORTANT: Patterns must NOT match files in templates/policies/ directory.
// The skill running these checks should search project root, docs/, policies/
// (the Rego dir), and any markdown files — excluding templates/.

const POLICY_DOC_CHECKS: Check[] = [
  {
    id: 'policy-doc-incident-response',
    category: 'policy_doc',
    description: 'Incident response plan exists in project (not just template)',
    type: 'code_grep',
    provider: 'code',
    pattern: 'incident.response.plan|incident.response.procedure|security.incident',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-security-policy',
    category: 'policy_doc',
    description: 'Information security policy document exists in project',
    type: 'code_grep',
    provider: 'code',
    pattern: 'information.security.policy|security.policy.statement|hipaa.security.policy',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-access-control',
    category: 'policy_doc',
    description: 'Access control policy document exists in project',
    type: 'code_grep',
    provider: 'code',
    pattern: 'access.control.policy|authorization.policy|least.privilege.policy',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-contingency-plan',
    category: 'policy_doc',
    description: 'Business continuity/disaster recovery plan exists in project',
    type: 'code_grep',
    provider: 'code',
    pattern: 'contingency.plan|disaster.recovery|business.continuity|bcp.plan|dr.plan',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-risk-assessment',
    category: 'policy_doc',
    description: 'Risk assessment document exists in project',
    type: 'code_grep',
    provider: 'code',
    pattern: 'risk.assessment|risk.analysis|threat.assessment|vulnerability.assessment',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-training-records',
    category: 'policy_doc',
    description: 'Security awareness training records or program exists',
    type: 'code_grep',
    provider: 'code',
    pattern: 'training.record|security.awareness|training.completion|training.program',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-media-protection',
    category: 'policy_doc',
    description: 'Media protection/data disposal policy exists in project',
    type: 'code_grep',
    provider: 'code',
    pattern: 'media.protection|data.disposal|media.sanitization|device.disposal',
    severity_default: 'MEDIUM',
  },
  {
    id: 'policy-doc-contingency-test',
    category: 'policy_doc',
    description: 'DR/contingency plan test evidence exists',
    type: 'code_grep',
    provider: 'code',
    pattern: 'contingency.test|dr.test|disaster.recovery.test|failover.test|backup.test',
    severity_default: 'LOW',
  },
  {
    id: 'policy-doc-assessment-report',
    category: 'policy_doc',
    description: 'Prior security assessment or audit report exists',
    type: 'code_grep',
    provider: 'code',
    pattern: 'security.assessment|audit.report|compliance.report|pentest.report|vulnerability.scan',
    severity_default: 'LOW',
  },
  {
    id: 'policy-doc-monitoring-config',
    category: 'policy_doc',
    description: 'Continuous monitoring configuration or policy exists',
    type: 'code_grep',
    provider: 'code',
    pattern: 'continuous.monitoring|monitoring.policy|siem.config|log.monitoring|alert.config',
    severity_default: 'LOW',
  },
];

// ─── Export ─────────────────────────────────────────────────────

export const CHECKS: Check[] = [...CODE_CHECKS, ...AWS_CHECKS, ...REGO_CHECKS, ...TOOL_INTEGRATION_CHECKS, ...POLICY_DOC_CHECKS];

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
