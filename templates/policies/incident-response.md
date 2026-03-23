# Security Incident Response Plan

**Organization:** {ORGANIZATION_NAME}
**Policy Owner:** {SECURITY_OFFICER}
**Effective Date:** {DATE}
**Last Reviewed:** {LAST_REVIEW_DATE}
**Version:** {VERSION}

## 1. Purpose

This plan establishes procedures for identifying, responding to, and recovering from security incidents involving electronic protected health information (ePHI) at {ORGANIZATION_NAME}, in compliance with HIPAA Security Rule 164.308(a)(6).

## 2. Scope

This plan covers all security incidents affecting systems, networks, or data under {ORGANIZATION_NAME}'s control, including those managed by business associates. A security incident is any attempted or successful unauthorized access, use, disclosure, modification, or destruction of ePHI, or interference with system operations.

## 3. Incident Classification

| Severity | Definition | Examples | Response Time |
|----------|-----------|----------|--------------|
| **Critical** | Confirmed breach of ePHI; active attacker; system-wide compromise | Ransomware; database exfiltration; stolen device with unencrypted ePHI | Immediate (within 1 hour) |
| **High** | Likely unauthorized access to ePHI; significant vulnerability exploited | Compromised admin credentials; unauthorized access to ePHI system; phishing with credential theft | Within 4 hours |
| **Medium** | Attempted unauthorized access; policy violation with ePHI exposure risk | Repeated failed logins; misconfigured access controls discovered; lost encrypted device | Within 24 hours |
| **Low** | Minor policy violation; no ePHI exposure | Unlocked workstation; failed phishing attempt (no click); software vulnerability disclosed | Within 72 hours |

## 4. Incident Response Team

| Role | Name | Contact | Responsibilities |
|------|------|---------|-----------------|
| Incident Commander | {SECURITY_OFFICER} | {SECURITY_OFFICER_CONTACT} | Overall coordination, decision authority |
| Technical Lead | {TECHNICAL_LEAD} | {TECHNICAL_LEAD_CONTACT} | Containment, forensics, system recovery |
| Privacy Officer | {PRIVACY_OFFICER} | {PRIVACY_OFFICER_CONTACT} | Breach determination, notification decisions |
| Legal Counsel | {LEGAL_COUNSEL} | {LEGAL_COUNSEL_CONTACT} | Legal obligations, regulatory notification |
| Communications Lead | {COMMUNICATIONS_LEAD} | {COMMUNICATIONS_LEAD_CONTACT} | Internal and external communications |
| Executive Sponsor | {EXECUTIVE_SPONSOR} | {EXECUTIVE_SPONSOR_CONTACT} | Resource authorization, board notification |

**On-call rotation:** {ON_CALL_SCHEDULE}
**Incident hotline:** {INCIDENT_HOTLINE}
**Incident email:** {INCIDENT_EMAIL}

## 5. Response Procedures

### 5.1 Detection and Reporting

- Any workforce member who suspects a security incident must report it immediately to {SECURITY_OFFICER} via {INCIDENT_REPORTING_METHOD}.
- Automated detection sources include: {SIEM_SOLUTION}, intrusion detection systems, audit log alerts, endpoint protection alerts.
- All reports must be logged in {INCIDENT_TRACKING_SYSTEM}.

### 5.2 Triage and Assessment

Within the response time defined by severity level:

1. Confirm whether an incident has occurred.
2. Classify the severity level.
3. Determine whether ePHI is involved and estimate the scope.
4. Activate the Incident Response Team for High and Critical incidents.
5. Document initial findings in {INCIDENT_TRACKING_SYSTEM}.

### 5.3 Containment

**Immediate containment (stop the bleeding):**
- Isolate affected systems from the network.
- Disable compromised user accounts.
- Block malicious IP addresses or domains.
- Preserve forensic evidence before making changes (disk images, memory dumps, log snapshots).

**Short-term containment:**
- Apply emergency patches or configuration changes.
- Implement additional monitoring on affected systems.
- Redirect traffic or services to unaffected systems if available.

### 5.4 Investigation and Forensics

- Determine the root cause, attack vector, and timeline.
- Identify all systems and data affected.
- Determine whether ePHI was accessed, acquired, used, or disclosed.
- Preserve chain of custody for all forensic evidence.
- Engage {FORENSICS_VENDOR} for Critical incidents if needed.

### 5.5 Breach Determination

The Privacy Officer must evaluate whether the incident constitutes a breach under HIPAA:

1. Was ePHI involved?
2. Was it unsecured (unencrypted)?
3. Was it acquired, accessed, used, or disclosed in a prohibited manner?
4. Does a low-probability-of-compromise exception apply? (Evaluate: nature/extent of PHI, who accessed it, whether PHI was actually viewed, extent of mitigation.)

Document the determination and rationale in writing.

### 5.6 Notification (If Breach Is Confirmed)

| Notification Target | Deadline | Method |
|---------------------|----------|--------|
| Affected individuals | Within 60 days of discovery | Written notice (first-class mail or email if consented) |
| HHS (< 500 individuals) | Within 60 days of calendar year end | HHS breach portal |
| HHS (>= 500 individuals) | Within 60 days of discovery | HHS breach portal |
| Media (>= 500 in a state) | Within 60 days of discovery | Press release to major media |
| State attorneys general | Per state law requirements | Per state requirements |

### 5.7 Recovery

- Restore affected systems from verified clean backups.
- Reset all credentials associated with compromised systems.
- Verify system integrity before returning to production.
- Increase monitoring for a minimum of {POST_INCIDENT_MONITORING_PERIOD} after recovery.

### 5.8 Post-Incident Review

Within 14 days of incident closure:

1. Conduct a post-incident review with the full Incident Response Team.
2. Document lessons learned, root cause, and timeline.
3. Identify policy, procedure, or technical control improvements.
4. Assign remediation tasks with owners and deadlines.
5. Update this plan if gaps were identified.
6. Brief {EXECUTIVE_SPONSOR} on findings and remediation plan.

## 6. Escalation Matrix

| Condition | Escalate To |
|-----------|------------|
| Any suspected ePHI exposure | {SECURITY_OFFICER} and {PRIVACY_OFFICER} |
| Critical severity confirmed | {EXECUTIVE_SPONSOR} and {LEGAL_COUNSEL} |
| Law enforcement involvement needed | {LEGAL_COUNSEL} |
| Business associate system involved | BA's designated contact + {SECURITY_OFFICER} |
| Breach affecting 500+ individuals | {EXECUTIVE_SPONSOR}, {LEGAL_COUNSEL}, and Board |

## 7. Testing

This incident response plan must be tested via tabletop exercise or simulation at least {IRP_TEST_FREQUENCY} (minimum annually). Test results and improvements must be documented.

## 8. Review Schedule

This plan must be reviewed annually, after every Critical or High severity incident, and after any tabletop exercise.

**Next Review Date:** {NEXT_REVIEW_DATE}

---

*Approved by:* {APPROVER_NAME}, {APPROVER_TITLE}
*Approval Date:* {APPROVAL_DATE}
