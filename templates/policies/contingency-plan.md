# Contingency Plan

**Organization:** {ORGANIZATION_NAME}
**Policy Owner:** {SECURITY_OFFICER}
**Effective Date:** {DATE}
**Last Reviewed:** {LAST_REVIEW_DATE}
**Version:** {VERSION}

## 1. Purpose

This plan establishes procedures for data backup, disaster recovery, and emergency operations to ensure the availability of electronic protected health information (ePHI) at {ORGANIZATION_NAME}, in compliance with HIPAA Security Rule 164.308(a)(7).

## 2. Scope

This plan covers all information systems that create, receive, maintain, or transmit ePHI, including production databases, application servers, file storage, email systems, and supporting infrastructure.

## 3. Recovery Objectives

| System / Data | RPO (Max Data Loss) | RTO (Max Downtime) | Priority |
|--------------|--------------------|--------------------|----------|
| {PRIMARY_SYSTEM} (EHR/primary application) | {PRIMARY_RPO} | {PRIMARY_RTO} | Critical |
| {DATABASE_SYSTEM} | {DB_RPO} | {DB_RTO} | Critical |
| Email and communications | {EMAIL_RPO} | {EMAIL_RTO} | High |
| File storage / document management | {FILE_RPO} | {FILE_RTO} | High |
| Internal tools and support systems | {TOOLS_RPO} | {TOOLS_RTO} | Medium |

RPO = Recovery Point Objective (maximum acceptable data loss measured in time).
RTO = Recovery Time Objective (maximum acceptable downtime before restoration).

## 4. Data Backup Plan — 164.308(a)(7)(ii)(A)

### 4.1 Backup Schedule

| Data Category | Backup Type | Frequency | Retention |
|--------------|------------|-----------|-----------|
| Production databases | Full backup | {DB_FULL_BACKUP_FREQUENCY} (e.g., daily) | {DB_BACKUP_RETENTION} |
| Production databases | Incremental / WAL | Continuous or {DB_INCREMENTAL_FREQUENCY} | {DB_INCREMENTAL_RETENTION} |
| Application data and config | Full backup | {APP_BACKUP_FREQUENCY} | {APP_BACKUP_RETENTION} |
| System images / infrastructure-as-code | Snapshot | {SYSTEM_BACKUP_FREQUENCY} | {SYSTEM_BACKUP_RETENTION} |

### 4.2 Backup Requirements

- All backups containing ePHI must be encrypted using AES-256 before storage.
- Backups must be stored in a geographically separate location from production: {BACKUP_LOCATION}.
- Backup storage must be access-controlled; only {BACKUP_ADMINISTRATORS} may access backup media.
- Backup completion and integrity must be verified automatically; failures must alert {IT_SECURITY_TEAM}.
- Backup logs must be retained as part of audit logging requirements.

### 4.3 Backup Testing

- Restore tests must be performed {RESTORE_TEST_FREQUENCY} (minimum quarterly).
- Tests must verify data integrity, completeness, and the ability to meet RPO/RTO targets.
- Test results must be documented and retained for 6 years.

## 5. Disaster Recovery Plan — 164.308(a)(7)(ii)(B)

### 5.1 Disaster Scenarios

This plan addresses the following scenarios:

- **Infrastructure failure:** Server, storage, or network failure at {PRIMARY_DATA_CENTER}.
- **Cloud provider outage:** Extended outage of {CLOUD_PROVIDER}.
- **Cyberattack:** Ransomware, data destruction, or sustained denial-of-service attack.
- **Natural disaster:** Flood, fire, earthquake, or severe weather affecting facilities.
- **Facility loss:** Loss of physical access to {PRIMARY_OFFICE_LOCATION}.

### 5.2 Recovery Procedures

**For infrastructure / cloud failures:**

1. {IT_SECURITY_TEAM} assesses the scope and estimated duration of the outage.
2. If RTO will be exceeded, initiate failover to {DISASTER_RECOVERY_SITE}.
3. Restore services from most recent verified backups.
4. Verify data integrity and ePHI availability after restoration.
5. Notify workforce members and affected users of service status.

**For cyberattack (ransomware / data destruction):**

1. Activate the Incident Response Plan.
2. Isolate affected systems to prevent spread.
3. Assess backup integrity — confirm backups are not compromised.
4. Restore from the last verified clean backup.
5. Conduct forensic analysis before reconnecting restored systems.

**For facility loss:**

1. Activate remote work procedures.
2. Redirect services to {DISASTER_RECOVERY_SITE} if on-premises systems are affected.
3. Ensure workforce can access ePHI systems remotely via approved VPN.
4. Communicate alternative work locations and procedures.

### 5.3 Recovery Team

| Role | Responsible | Contact |
|------|-----------|---------|
| DR Coordinator | {SECURITY_OFFICER} | {SECURITY_OFFICER_CONTACT} |
| Infrastructure Lead | {INFRASTRUCTURE_LEAD} | {INFRASTRUCTURE_LEAD_CONTACT} |
| Application Lead | {APPLICATION_LEAD} | {APPLICATION_LEAD_CONTACT} |
| Communications Lead | {COMMUNICATIONS_LEAD} | {COMMUNICATIONS_LEAD_CONTACT} |

## 6. Emergency Mode Operations — 164.308(a)(7)(ii)(C)

When normal operations are disrupted and the full system cannot be restored immediately:

- Critical ePHI functions must continue using {EMERGENCY_MODE_PROCEDURES} (e.g., read-only access to backup copies, paper-based processes, alternative systems).
- Emergency mode access must follow the emergency access procedures in the Access Control Policy.
- All actions taken during emergency mode must be logged manually if automated logging is unavailable.
- Emergency mode must be formally declared and ended by {SECURITY_OFFICER}.

## 7. Testing Schedule

| Test Type | Frequency | Participants |
|----------|-----------|-------------|
| Backup restore validation | {RESTORE_TEST_FREQUENCY} (minimum quarterly) | {IT_SECURITY_TEAM} |
| Tabletop DR exercise | Annually | Recovery Team + {EXECUTIVE_SPONSOR} |
| Full DR failover test | {FULL_DR_TEST_FREQUENCY} (minimum annually) | Recovery Team |
| Emergency mode simulation | Annually | All affected workforce |

Test results, gaps identified, and remediation actions must be documented and retained for 6 years.

## 8. Plan Maintenance

This plan must be updated:

- Annually during the scheduled review.
- After any disaster recovery activation.
- After any significant infrastructure change.
- After any test that reveals deficiencies.

All updates must be approved by {SECURITY_OFFICER} and communicated to the Recovery Team.

**Next Review Date:** {NEXT_REVIEW_DATE}

---

*Approved by:* {APPROVER_NAME}, {APPROVER_TITLE}
*Approval Date:* {APPROVAL_DATE}
