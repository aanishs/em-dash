# Audit Logging Policy

**Organization:** {ORGANIZATION_NAME}
**Policy Owner:** {SECURITY_OFFICER}
**Effective Date:** {DATE}
**Last Reviewed:** {LAST_REVIEW_DATE}
**Version:** {VERSION}

## 1. Purpose

This policy defines requirements for audit logging of information systems containing electronic protected health information (ePHI) at {ORGANIZATION_NAME}, in compliance with HIPAA Security Rule 164.312(b). Audit logs provide the evidence trail necessary to detect unauthorized access, investigate incidents, and demonstrate compliance.

## 2. Scope

This policy applies to all information systems, applications, databases, network devices, and cloud services that create, receive, maintain, or transmit ePHI.

## 3. Events That Must Be Logged

### 3.1 Required Audit Events

The following events must be captured for all systems containing ePHI:

- **Authentication events:** Successful and failed login attempts, logoffs, MFA challenges.
- **Authorization events:** Access grants, denials, privilege escalations, role changes.
- **Data access:** Creation, reading, modification, and deletion of ePHI records.
- **System events:** Startup, shutdown, configuration changes, software installations.
- **Administrative actions:** User account creation/modification/deletion, policy changes, backup and restore operations.
- **Network events:** Firewall rule changes, VPN connections, remote access sessions.
- **Security events:** Malware detections, intrusion alerts, vulnerability scan results.
- **Export/transmission:** ePHI exports, email transmissions, file transfers, print jobs.

### 3.2 Log Entry Format

Each log entry must include at minimum:

- Timestamp (UTC, synchronized via NTP to {NTP_SERVER})
- User ID or system account
- Source IP address and hostname
- Event type and description
- Success or failure indication
- Resource or record accessed (without logging the ePHI content itself)

## 4. Log Storage and Retention

### 4.1 Retention Requirements

- **Audit logs:** Minimum {LOG_RETENTION_YEARS} years (HIPAA requires 6 years for policies and documentation; {ORGANIZATION_NAME} retains operational logs for a minimum of {LOG_RETENTION_YEARS} years).
- **Security incident logs:** 6 years from incident closure.
- **Access logs for terminated users:** 6 years from termination date.

### 4.2 Storage Requirements

- Logs must be stored in {LOG_STORAGE_LOCATION}.
- Log storage must be separate from the systems being monitored.
- Logs must be encrypted at rest using AES-256.
- Logs must be backed up to {LOG_BACKUP_LOCATION} with the same retention schedule.

## 5. Tamper-Proof Requirements

- Logs must be written to append-only storage or a centralized log management system where modification is restricted.
- Write access to log storage is limited to the logging service account only.
- No workforce member, including administrators, may modify or delete audit logs.
- Integrity verification (checksums or cryptographic hashing) must be applied to log files.
- Any log tampering attempt must trigger an alert to {SECURITY_OFFICER}.

## 6. Access Controls on Logs

- Read access to audit logs is restricted to: {SECURITY_OFFICER}, designated compliance staff, and authorized auditors.
- Log access must itself be logged (meta-logging).
- Bulk log exports require written approval from {SECURITY_OFFICER}.

## 7. Monitoring and Review

### 7.1 Automated Monitoring

- Real-time alerting must be configured for:
  - Multiple failed login attempts (threshold: {FAILED_LOGIN_ALERT_THRESHOLD})
  - Access outside normal business hours to critical ePHI systems
  - Bulk data access or export exceeding {BULK_ACCESS_THRESHOLD} records
  - Administrative privilege escalation
  - Log service failures or gaps

### 7.2 Manual Review Schedule

| Review Type | Frequency | Performed By |
|-------------|-----------|-------------|
| Critical system access logs | Daily | {IT_SECURITY_TEAM} |
| Failed authentication reports | Weekly | {IT_SECURITY_TEAM} |
| Administrative action review | Monthly | {SECURITY_OFFICER} |
| Full audit log review | Quarterly | {SECURITY_OFFICER} and {COMPLIANCE_OFFICER} |
| Log infrastructure health check | Monthly | {IT_SECURITY_TEAM} |

### 7.3 Review Documentation

Each log review must be documented with:

- Reviewer name and date
- Time period reviewed
- Anomalies identified and actions taken
- Sign-off confirming review completion

Review records must be retained for 6 years.

## 8. Enforcement

Failure to maintain audit logging, tampering with logs, or obstructing log review is a serious policy violation subject to disciplinary action up to and including termination and legal referral.

## 9. Review Schedule

This policy must be reviewed annually or after any security incident that reveals logging gaps.

**Next Review Date:** {NEXT_REVIEW_DATE}

---

*Approved by:* {APPROVER_NAME}, {APPROVER_TITLE}
*Approval Date:* {APPROVAL_DATE}
