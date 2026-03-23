# Access Control Policy

**Organization:** {ORGANIZATION_NAME}
**Policy Owner:** {SECURITY_OFFICER}
**Effective Date:** {DATE}
**Last Reviewed:** {LAST_REVIEW_DATE}
**Version:** {VERSION}

## 1. Purpose

This policy establishes access control requirements for all information systems that create, receive, maintain, or transmit electronic protected health information (ePHI) at {ORGANIZATION_NAME}, in compliance with HIPAA Security Rule 164.312(a)(1).

## 2. Scope

This policy applies to all workforce members, contractors, and business associates who access {ORGANIZATION_NAME} information systems containing ePHI. It covers all production systems, databases, applications, and network infrastructure.

## 3. Policy

### 3.1 Unique User Identification — 164.312(a)(2)(i)

- Every user must be assigned a unique identifier (user ID) before accessing systems containing ePHI.
- Shared, group, or generic accounts are prohibited for systems containing ePHI.
- User IDs must not be reassigned to other individuals.
- Service accounts must be documented in the {SERVICE_ACCOUNT_REGISTRY} and reviewed quarterly.

### 3.2 Role-Based Access Control (RBAC)

- Access to ePHI must be granted based on the minimum necessary principle.
- Access roles are defined as:
  - **Admin:** Full system access — limited to {SECURITY_OFFICER} and designated IT staff.
  - **Clinical:** Read/write access to patient records required for treatment.
  - **Billing:** Access limited to billing-related PHI fields.
  - **Read-Only:** View access for audit, compliance, or support functions.
  - **No Access:** Default for all new accounts until role assignment.
- Role assignments must be approved by the employee's manager and {SECURITY_OFFICER}.
- Access reviews must be conducted {ACCESS_REVIEW_FREQUENCY} (minimum quarterly).

### 3.3 Emergency Access Procedure — 164.312(a)(2)(ii)

- Emergency access ("break-the-glass") is permitted when normal access procedures are insufficient during a crisis affecting patient safety or system availability.
- Emergency access must be:
  1. Authorized by {SECURITY_OFFICER} or designated on-call authority.
  2. Logged with the reason, time, user, and systems accessed.
  3. Reviewed within 24 hours by {SECURITY_OFFICER}.
  4. Revoked immediately after the emergency concludes.
- Emergency access credentials are stored in {EMERGENCY_ACCESS_LOCATION}.

### 3.4 Automatic Logoff — 164.312(a)(2)(iii)

- All workstations and applications accessing ePHI must automatically lock after {LOGOFF_TIMEOUT_MINUTES} minutes of inactivity (maximum 15 minutes).
- Users must manually lock screens when leaving workstations unattended.
- Remote sessions must terminate after {SESSION_TIMEOUT_MINUTES} minutes of inactivity.

### 3.5 Encryption and Decryption — 164.312(a)(2)(iv)

- ePHI at rest must be encrypted using AES-256 or equivalent.
- Encryption keys must be managed per the Encryption Policy.
- Decryption capabilities must be limited to authorized roles.

### 3.6 Authentication

- All users must authenticate using multi-factor authentication (MFA) to access systems containing ePHI.
- Passwords must meet the following requirements: minimum {PASSWORD_MIN_LENGTH} characters (minimum 12), including uppercase, lowercase, number, and special character.
- Passwords must be changed every {PASSWORD_ROTATION_DAYS} days (maximum 90 days).
- Account lockout after {MAX_LOGIN_ATTEMPTS} failed attempts (maximum 5).

## 4. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| {SECURITY_OFFICER} | Enforce policy, conduct access reviews, approve access requests |
| IT Administration | Implement technical controls, manage user accounts |
| Department Managers | Approve access requests for their teams, report terminations |
| All Workforce Members | Protect credentials, report unauthorized access, lock workstations |

## 5. Enforcement

Violations of this policy may result in disciplinary action up to and including termination of employment or contract, and may be reported to relevant authorities. Violations must be documented per the Workforce Security and Sanctions Policy.

## 6. Review Schedule

This policy must be reviewed and updated:

- Annually, or
- After any security incident involving access controls, or
- When significant changes occur to systems or regulations.

**Next Review Date:** {NEXT_REVIEW_DATE}

---

*Approved by:* {APPROVER_NAME}, {APPROVER_TITLE}
*Approval Date:* {APPROVAL_DATE}
