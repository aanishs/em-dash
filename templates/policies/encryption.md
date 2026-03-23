# Encryption Policy

**Organization:** {ORGANIZATION_NAME}
**Policy Owner:** {SECURITY_OFFICER}
**Effective Date:** {DATE}
**Last Reviewed:** {LAST_REVIEW_DATE}
**Version:** {VERSION}

## 1. Purpose

This policy establishes encryption requirements for protecting electronic protected health information (ePHI) at rest and in transit at {ORGANIZATION_NAME}, in compliance with HIPAA Security Rule 164.312(a)(2)(iv) (encryption at rest) and 164.312(e)(1) (transmission security).

## 2. Scope

This policy applies to all ePHI stored on, processed by, or transmitted through {ORGANIZATION_NAME} systems, including servers, databases, workstations, mobile devices, removable media, cloud services, email, and APIs.

## 3. Encryption Standards

### 3.1 Encryption at Rest — 164.312(a)(2)(iv)

All ePHI at rest must be encrypted using the following minimum standards:

| Storage Type | Encryption Standard | Implementation |
|-------------|-------------------|----------------|
| Databases | AES-256 | {DATABASE_ENCRYPTION_METHOD} (e.g., TDE, column-level) |
| File systems / volumes | AES-256 | Full-disk encryption on all servers and workstations |
| Cloud storage (S3, GCS, etc.) | AES-256 | Server-side encryption enabled by default |
| Backups | AES-256 | All backups encrypted before writing to storage |
| Mobile devices | AES-256 | Device-level encryption required; managed via {MDM_SOLUTION} |
| Removable media | AES-256 | Encrypted containers required; unencrypted USB storage prohibited |
| Email attachments containing ePHI | AES-256 | Must use {SECURE_EMAIL_SOLUTION} or encrypted archive |

### 3.2 Encryption in Transit — 164.312(e)(1)

All ePHI transmitted over networks must be protected using:

| Transmission Type | Minimum Standard |
|------------------|-----------------|
| Web traffic (HTTPS) | TLS 1.2 or higher; TLS 1.0 and 1.1 are prohibited |
| API communications | TLS 1.2 or higher with certificate validation |
| Email (server-to-server) | TLS 1.2 or higher (opportunistic TLS with mandatory enforcement for known ePHI recipients) |
| VPN connections | IPsec or WireGuard with AES-256 |
| Database connections | TLS 1.2 or higher; unencrypted database connections prohibited |
| File transfers (SFTP/SCP) | SSH v2 with AES-256 |
| Internal service-to-service | mTLS required in production environments |

### 3.3 Prohibited Algorithms

The following are prohibited for protecting ePHI: DES, 3DES, RC4, MD5, SHA-1 (for signing), SSL 2.0/3.0, TLS 1.0/1.1.

## 4. Key Management

### 4.1 Key Generation

- Encryption keys must be generated using cryptographically secure random number generators.
- Key length must be a minimum of 256 bits for symmetric keys, 2048 bits for RSA, or 256 bits for ECC.

### 4.2 Key Storage

- Encryption keys must never be stored alongside the data they protect.
- Keys must be stored in {KEY_MANAGEMENT_SOLUTION} (e.g., AWS KMS, HashiCorp Vault, Azure Key Vault).
- Access to key management systems is restricted to {KEY_CUSTODIANS}.
- Key material must never appear in source code, configuration files, logs, or version control.

### 4.3 Key Rotation

- Symmetric encryption keys must be rotated every {KEY_ROTATION_PERIOD} (maximum 12 months).
- TLS certificates must be renewed before expiration; automated renewal is required where possible.
- Key rotation must not cause data unavailability; re-encryption must be planned and tested.

### 4.4 Key Revocation and Destruction

- Compromised keys must be revoked immediately and replaced.
- Retired keys must be securely destroyed using {KEY_DESTRUCTION_METHOD} and the destruction must be documented.
- Key destruction records must be retained for 6 years.

## 5. Backup Encryption

- All backup data containing ePHI must be encrypted before transmission and at rest.
- Backup encryption keys must be stored separately from backup media.
- Recovery procedures must be tested {BACKUP_TEST_FREQUENCY} to confirm encrypted backups can be restored.

## 6. Exceptions

Any system that cannot meet these encryption requirements must have:

1. A documented risk assessment explaining the limitation.
2. Compensating controls approved by {SECURITY_OFFICER}.
3. A remediation timeline to achieve compliance.
4. Annual re-evaluation of the exception.

All exceptions must be recorded in {EXCEPTION_REGISTER}.

## 7. Enforcement

Failure to encrypt ePHI as required by this policy is a serious violation subject to disciplinary action. Unencrypted ePHI discovered on any system must be reported to {SECURITY_OFFICER} immediately as a potential security incident.

## 8. Review Schedule

This policy must be reviewed annually, when encryption standards are updated by NIST, or after any incident involving encryption failure.

**Next Review Date:** {NEXT_REVIEW_DATE}

---

*Approved by:* {APPROVER_NAME}, {APPROVER_TITLE}
*Approval Date:* {APPROVAL_DATE}
