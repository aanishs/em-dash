# Risk Assessment Policy and Procedure

**Organization:** {ORGANIZATION_NAME}
**Policy Owner:** {SECURITY_OFFICER}
**Effective Date:** {DATE}
**Last Reviewed:** {LAST_REVIEW_DATE}
**Version:** {VERSION}

## 1. Purpose

This policy establishes the process for conducting risk assessments of information systems containing electronic protected health information (ePHI) at {ORGANIZATION_NAME}, in compliance with HIPAA Security Rule 164.308(a)(1)(ii)(A). Risk assessment is the foundation of the HIPAA Security Rule — all other safeguards flow from understanding where risk exists.

## 2. Scope

This assessment covers all systems, applications, networks, facilities, and workforce activities that create, receive, maintain, or transmit ePHI, including those managed by business associates.

## 3. Assessment Schedule

| Assessment Type | Frequency | Performed By |
|----------------|-----------|-------------|
| Comprehensive risk assessment | Annually (minimum) | {SECURITY_OFFICER} with {RISK_ASSESSMENT_TEAM} |
| Targeted risk assessment | When significant changes occur | {SECURITY_OFFICER} |
| Business associate risk review | At onboarding and annually | {SECURITY_OFFICER} and {PRIVACY_OFFICER} |
| Vulnerability scanning | {VULNERABILITY_SCAN_FREQUENCY} (minimum quarterly) | {IT_SECURITY_TEAM} |
| Penetration testing | {PENTEST_FREQUENCY} (minimum annually) | {PENTEST_VENDOR} |

**Triggering events for targeted assessment:** New system deployment, major software update, security incident, organizational restructuring, new business associate relationship, regulatory changes.

## 4. Risk Assessment Methodology

### 4.1 Step 1 — Asset Inventory

Identify and document all assets involved in ePHI processing:

- Hardware (servers, workstations, mobile devices, network equipment)
- Software (applications, databases, operating systems, cloud services)
- Data flows (where ePHI is created, stored, transmitted, and destroyed)
- Physical locations (offices, data centers, remote work locations)
- Workforce roles with ePHI access

Maintain the inventory in {ASSET_INVENTORY_LOCATION}.

### 4.2 Step 2 — Threat Identification

Identify threats to each asset category:

| Threat Category | Examples |
|----------------|---------|
| Natural | Flood, fire, earthquake, power outage |
| Human — intentional | Hacking, phishing, insider theft, ransomware |
| Human — unintentional | Misconfiguration, accidental disclosure, lost device |
| Environmental | HVAC failure, water damage, hardware failure |
| Technical | Software bugs, system crashes, network failures |

### 4.3 Step 3 — Vulnerability Assessment

For each identified threat, assess vulnerabilities:

- Review current security controls and their effectiveness.
- Analyze results from vulnerability scans and penetration tests.
- Review audit logs and past incident reports.
- Evaluate workforce security awareness.
- Assess physical security controls.
- Review business associate safeguards.

### 4.4 Step 4 — Risk Analysis (Likelihood x Impact)

**Likelihood Scale:**

| Rating | Definition |
|--------|-----------|
| 1 — Rare | Unlikely to occur in the next year |
| 2 — Unlikely | Could occur but not expected |
| 3 — Possible | Reasonable chance of occurring |
| 4 — Likely | Expected to occur at least once |
| 5 — Almost Certain | Expected to occur multiple times |

**Impact Scale:**

| Rating | Definition |
|--------|-----------|
| 1 — Negligible | No ePHI exposure; minimal disruption |
| 2 — Minor | Limited ePHI exposure (< 10 records); short disruption |
| 3 — Moderate | Moderate ePHI exposure (10-500 records); significant disruption |
| 4 — Major | Large ePHI exposure (500+ records); extended disruption; regulatory scrutiny |
| 5 — Severe | Mass ePHI breach; existential business impact; federal investigation |

**Risk Score** = Likelihood x Impact (range: 1-25)

| Risk Level | Score Range | Required Action |
|-----------|------------|-----------------|
| **Critical** | 20-25 | Immediate remediation; executive notification |
| **High** | 12-19 | Remediation within 30 days |
| **Medium** | 6-11 | Remediation within 90 days |
| **Low** | 1-5 | Accept, monitor, or address during next cycle |

### 4.5 Step 5 — Risk Management Plan

For each identified risk, select one of the following strategies:

- **Mitigate:** Implement controls to reduce likelihood or impact.
- **Transfer:** Transfer risk via insurance or business associate agreement.
- **Accept:** Accept the risk with documented justification (requires {SECURITY_OFFICER} approval).
- **Avoid:** Eliminate the activity that creates the risk.

## 5. Risk Register

All identified risks must be recorded in the risk register maintained at {RISK_REGISTER_LOCATION}. Each entry must include:

| Field | Description |
|-------|------------|
| Risk ID | Unique identifier |
| Description | Clear description of the risk scenario |
| Asset(s) affected | Systems, data, or processes at risk |
| Threat source | Category and specific threat |
| Vulnerability | What weakness the threat exploits |
| Existing controls | Current safeguards in place |
| Likelihood | Rating 1-5 |
| Impact | Rating 1-5 |
| Risk score | Likelihood x Impact |
| Risk level | Critical / High / Medium / Low |
| Treatment strategy | Mitigate / Transfer / Accept / Avoid |
| Remediation plan | Specific actions to address the risk |
| Owner | Person responsible for remediation |
| Target date | Deadline for remediation |
| Status | Open / In Progress / Closed |

## 6. Documentation and Retention

- Risk assessment reports must be retained for a minimum of 6 years.
- Reports must be stored in {RISK_ASSESSMENT_STORAGE} with access restricted to {SECURITY_OFFICER}, {PRIVACY_OFFICER}, and authorized compliance staff.
- Each assessment must be signed off by {SECURITY_OFFICER} and {EXECUTIVE_SPONSOR}.

## 7. Review Schedule

This policy and the risk register must be reviewed annually. The risk register must be updated whenever new risks are identified or risk ratings change.

**Next Review Date:** {NEXT_REVIEW_DATE}

---

*Approved by:* {APPROVER_NAME}, {APPROVER_TITLE}
*Approval Date:* {APPROVAL_DATE}
