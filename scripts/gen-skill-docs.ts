#!/usr/bin/env bun
/**
 * Generate SKILL.md files from .tmpl templates.
 *
 * Pipeline:
 *   read .tmpl → find {{PLACEHOLDERS}} → resolve from source → format → write .md
 *
 * Supports --dry-run: generate to memory, exit 1 if different from committed file.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkDefinition } from '../frameworks/schema';

const ROOT = path.resolve(import.meta.dir, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Framework Loading ──────────────────────────────────────

function loadFrameworkForSkill(skillName: string): FrameworkDefinition | null {
  // Extract framework ID from skill name (e.g., "hipaa-scan" → "hipaa", "soc2-assess" → "soc2")
  const match = skillName.match(/^([a-z0-9]+)-(?:assess|scan|remediate|report|monitor|breach|vendor|risk)$/);
  const frameworkId = match ? match[1] : (skillName === 'hipaa' || skillName === 'soc2' ? skillName : null);
  if (!frameworkId) return null;

  const defPath = path.join(ROOT, 'frameworks', `${frameworkId}.json`);
  if (!fs.existsSync(defPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(defPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Placeholder Resolvers ──────────────────────────────────

interface TemplateContext {
  skillName: string;
  tmplPath: string;
  binDir: string;
  localBinDir: string;
  policyDir: string;
  localPolicyDir: string;
  framework: FrameworkDefinition | null;
}

// ─── Composed Preamble Sections ─────────────────────────────

function generatePreambleBash(ctx: TemplateContext): string {
  return `## Preamble (run first)

\`\`\`bash
mkdir -p ~/.em-dash/sessions
touch ~/.em-dash/sessions/"$PPID"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
# Detect bin directory (global install or project-level install)
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})
source <("$_EMDASH_BIN"/comply-slug 2>/dev/null || true)
echo "SLUG: \${SLUG:-unknown}"
mkdir -p ~/.em-dash/projects/"\${SLUG:-unknown}"
_TOOLS=$("$_EMDASH_BIN"/comply-orchestrate detect 2>/dev/null || true)
echo "$_TOOLS"
# Check for updates
"$_EMDASH_BIN"/../bin/emdash-update-check 2>/dev/null || true
\`\`\`

Note: each bash block runs in a separate shell. To use bin utilities in later blocks, re-detect the path:
\`\`\`bash
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})
\`\`\``;
}

function generateUpdateCheck(_ctx: TemplateContext): string {
  return `## Update Check

If the preamble printed \`UPGRADE_AVAILABLE <current> <latest>\`, inform the user:

> A newer version of em-dash is available (current → latest).
> Run \`cd ~/.claude/skills/em-dash && git pull && bun run build\` to upgrade.

If \`JUST_UPGRADED\` was printed, note it and continue. Otherwise, skip this section silently.`;
}

function generateDisclaimerSection(ctx: TemplateContext): string {
  if (ctx.framework?.disclaimer) {
    return `## DISCLAIMER — Not Legal Advice

> **IMPORTANT:** ${ctx.framework.disclaimer}`;
  }
  return `## DISCLAIMER — Not Legal Advice

> **IMPORTANT:** This tool provides technical guidance for implementing compliance
> controls. It is NOT legal advice and does not constitute certification. Compliance
> is a legal determination that depends on your specific circumstances. Always
> consult qualified legal counsel and consider engaging a certified auditor for
> formal compliance verification. This tool helps you implement and verify technical
> safeguards — it does not certify compliance.`;
}

function generateAskUserFormat(ctx: TemplateContext): string {
  const fwName = ctx.framework?.name ?? 'compliance';
  return `## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current compliance phase (e.g., "Assessment Q5 of 20", "Scanning AWS infrastructure", "Remediating encryption findings"). (1-2 sentences)
2. **Simplify:** Explain the compliance requirement in plain English. No ${fwName} regulation numbers in the question itself — reference them in a note below.
3. **Recommend:** \`RECOMMENDATION: Choose [X] because [one-line reason]\`
4. **Options:** Lettered options: \`A) ... B) ... C) ...\`

When an option involves effort, show both scales: \`(human: ~X / CC: ~Y)\``;
}

function generateComplianceCompleteness(): string {
  return `## Compliance Completeness Principle

**In compliance, shortcuts create audit gaps.**

A partial HIPAA scan is worse than no scan — it creates false confidence. An incomplete
remediation plan gives auditors the impression you knew about gaps and chose to ignore them.
Every skipped check is a finding your auditor will catch.

When estimating effort, always consider both scales:

| Task | Human team | CC+em-dash | Compression |
|------|-----------|-----------|-------------|
| Full codebase PHI scan | 2 days | 5 min | ~50x |
| Cloud infrastructure audit | 1 week | 15 min | ~50x |
| Policy document generation | 3 days | 10 min | ~40x |
| Remediation + evidence | 2 weeks | 1 hour | ~30x |
| Gap assessment interview | 4 hours | 20 min | ~12x |

**Rule:** If the complete implementation costs minutes more than the shortcut, do the
complete thing. Every time. Compliance is not the place for "good enough."`;
}

function generateContributorMode(): string {
  return `## Contributor Mode

If this skill is running from a development checkout (symlink at \`.claude/skills/em-dash\`
pointing to a working directory), you are in **contributor mode**. Be aware that:
- Template changes + \`bun run gen:skill-docs\` immediately affect all em-dash invocations
- Run \`bun test\` before committing to verify skill integrity
- Breaking changes to .tmpl files can break concurrent sessions`;
}

function generateCompletionStatus(): string {
  return `## Completion Status Protocol

When the skill completes, report one of:
- **DONE** — All phases completed successfully. Compliance status reported.
- **DONE_WITH_CONCERNS** — Completed, but critical findings remain unaddressed.
- **BLOCKED** — Cannot proceed without additional information or access.
- **NEEDS_CONTEXT** — Insufficient information to assess. Ask the user to provide more.`;
}

function generateEvidenceSection(ctx: TemplateContext): string {
  return `## Evidence Collection

When collecting evidence, always:
1. Write raw tool output to \`~/.em-dash/projects/$SLUG/evidence/{phase}-{datetime}/\`
2. Hash evidence files: \`_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir}) && "$_EMDASH_BIN"/hipaa-evidence-hash <evidence-directory>\`
3. Never store actual PHI — only configuration states, scan results, and metadata`;
}

function generateReviewLogging(ctx: TemplateContext): string {
  return `## Review Logging

After completing a skill, log the outcome:
\`\`\`bash
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})
"$_EMDASH_BIN"/comply-db write "$SLUG" "${ctx.skillName}" "<STATUS>" <FINDINGS_COUNT>
\`\`\``;
}

function generateDashboardSync(ctx: TemplateContext): string {
  const skillKey = ctx.skillName.replace(/^hipaa-/, '');

  return `## Dashboard Sync

After logging the review, if \`.em-dash/dashboard.json\` exists in the project root, update the skill status:

\`\`\`bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="${skillKey}"
  _STATUS_VAL="<STATUS>"
  _FINDINGS_VAL=<FINDINGS_COUNT>
  _SUMMARY="<ONE_LINE_SUMMARY>"
  _TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  bun -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('.em-dash/dashboard.json', 'utf-8'));
    if (!d.frameworks) d.frameworks = {};
    if (!d.frameworks.hipaa) d.frameworks.hipaa = { status: 'in-progress', skills: {}, checklist: [], evidence_gaps: [] };
    d.frameworks.hipaa.skills['$_SKILL_KEY'] = {
      status: '$_STATUS_VAL'.toLowerCase(),
      timestamp: '$_TIMESTAMP',
      findings: $_FINDINGS_VAL,
      summary: '$_SUMMARY'
    };
    d.frameworks.hipaa.last_updated = '$_TIMESTAMP';
    fs.writeFileSync('.em-dash/dashboard.json', JSON.stringify(d, null, 2) + '\\\\n');
  " 2>/dev/null || true
fi
\`\`\`

**Checklist updates** are handled inline by each skill as it discovers findings — not here. Use \`hipaa-dashboard-update\` to update individual checklist items based on actual results:

\`\`\`bash
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})
# Mark a checklist item as complete with a note:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.312(a)(1)" complete "RBAC found in src/auth.ts"
# Mark as pending with an evidence gap:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.312(b)" pending --gap "No audit logging found"
# Add evidence file to an item:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.314(a)(1)" complete --evidence "baa-aws.pdf"
\`\`\``;
}

// ─── Composed Preamble ──────────────────────────────────────

function generatePreamble(ctx: TemplateContext): string {
  return [
    generatePreambleBash(ctx),
    generateUpdateCheck(ctx),
    generateDisclaimerSection(ctx),
    generateAskUserFormat(ctx),
    generateComplianceCompleteness(),
    generateContributorMode(),
    generateCompletionStatus(),
    generateEvidenceSection(ctx),
    generateReviewLogging(ctx),
    generateDashboardSync(ctx),
  ].join('\n\n');
}

function generateComplianceDashboard(ctx: TemplateContext): string {
  return `## Compliance Dashboard

Display the current compliance status by running:
\`\`\`bash
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})
"$_EMDASH_BIN"/comply-db dashboard "$SLUG"
\`\`\`

If no prior reviews exist, show:
\`\`\`
No prior compliance work found for this project.
Recommended: Start with /hipaa-assess for an organizational assessment.
\`\`\``;
}

function generateToolDetection(ctx: TemplateContext): string {
  return `## Tool Detection

Run tool detection to understand what's available:
\`\`\`bash
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})
"$_EMDASH_BIN"/comply-orchestrate detect
\`\`\`

**Interpret the results:**
- If \`CLOUD_AWS=true\` and \`TOOL_PROWLER=true\`: Full automated AWS HIPAA scanning available (83 checks)
- If \`CLOUD_AWS=true\` but \`TOOL_PROWLER=false\`: Offer to install Prowler or fall back to AWS CLI spot checks
- If \`TOOL_LYNIS=true\`: System-level security auditing available
- If \`TOOL_TRIVY=true\`: Container and code vulnerability scanning available
- If no scanning tools: Fall back to guided manual assessment with CLI commands

**Tier assignment:**
- **Tier 1 (fully automated):** Prowler + at least one of Lynis/Trivy
- **Tier 2 (partial):** Any scanning tool available
- **Tier 3 (guided manual):** No scanning tools — provide CLI commands for user to run`;
}

function generatePhiPatterns(ctx: TemplateContext): string {
  const dataType = ctx.framework?.terminology?.sensitive_data ?? 'Protected Health Information (PHI)';
  return `## Sensitive Data Detection Patterns

Scan the codebase for potential ${dataType} exposure using these patterns. Exclude \`node_modules/\`, \`vendor/\`, \`.git/\`, and test fixture directories with obviously mock data.

---

### CHECK 1: Direct PHI Identifiers (18 HIPAA Safe Harbor identifiers)

\`\`\`bash
# Names in healthcare context
grep -rn "patient_name\\|patientName\\|patient\\.name" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --include="*.rb" --exclude-dir=node_modules --exclude-dir=vendor .

# SSN patterns — both field names and literal patterns
grep -rn "ssn\\|social_security\\|socialSecurity" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules .
grep -rn "[0-9]\\{3\\}-[0-9]\\{2\\}-[0-9]\\{4\\}" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .

# Medical Record Numbers
grep -rn "medical_record\\|mrn\\|MRN\\|medicalRecord" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules .

# Date of Birth
grep -rn "date_of_birth\\|dateOfBirth\\|dob\\|DOB" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules .

# Insurance/health plan IDs
grep -rn "insurance_id\\|insuranceId\\|health_plan\\|healthPlan\\|member_id\\|memberId" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .
\`\`\`

### CHECK 2: Health Data Fields

\`\`\`bash
# Diagnosis codes (ICD-10, ICD-9)
grep -rn "ICD.10\\|ICD.9\\|icd_code\\|diagnosis_code\\|diagnosis" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .

# Procedure codes (CPT, HCPCS)
grep -rn "CPT\\|HCPCS\\|cpt_code\\|procedure_code" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .

# Medications and prescriptions
grep -rn "medication\\|prescription\\|rx_\\|drug_name\\|drugName" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .

# Lab results and clinical data
grep -rn "lab_result\\|labResult\\|test_result\\|clinical_note\\|clinicalNote\\|soap_note" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .
\`\`\`

### CHECK 3: PHI in Logs (CRITICAL — most common HIPAA violation in code)

\`\`\`bash
# PHI in console.log, console.warn, console.error, console.debug
grep -rn "console\\.\\(log\\|warn\\|error\\|debug\\|info\\).*\\(patient\\|ssn\\|mrn\\|diagnosis\\|dob\\|medical\\|health\\|insurance\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .

# PHI in server-side logging (winston, bunyan, pino, log4j, Python logging)
grep -rn "\\(logger\\|log\\|logging\\)\\.\\(info\\|warn\\|error\\|debug\\).*\\(patient\\|ssn\\|mrn\\|phi\\|medical\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.java" --include="*.go" --exclude-dir=node_modules .

# PHI in print/println/fmt.Print (Python, Go, Java)
grep -rn "\\(print\\|println\\|fmt\\.Print\\|System\\.out\\).*\\(patient\\|ssn\\|mrn\\|diagnosis\\)" --include="*.py" --include="*.go" --include="*.java" --exclude-dir=node_modules .

# Structured logging with PHI fields
grep -rn "\\(log\\|logger\\).*\\({.*patient\\|{.*ssn\\|{.*mrn\\|{.*diagnosis\\)" --include="*.ts" --include="*.js" --include="*.go" --exclude-dir=node_modules .
\`\`\`

### CHECK 4: PHI in Browser / Frontend (CRITICAL)

\`\`\`bash
# PHI in localStorage, sessionStorage, or cookies
grep -rn "localStorage\\.\\(setItem\\|getItem\\).*\\(patient\\|ssn\\|mrn\\|health\\|medical\\|phi\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .
grep -rn "sessionStorage\\.\\(setItem\\|getItem\\).*\\(patient\\|ssn\\|mrn\\|health\\|medical\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .
grep -rn "document\\.cookie.*\\(patient\\|ssn\\|mrn\\|health\\|medical\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .

# PHI in window/global state (React devtools can expose this)
grep -rn "window\\.\\(patient\\|health\\|medical\\|phi\\)\\|globalThis\\.\\(patient\\|health\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .

# PHI in URL parameters or hash (visible in browser history, server logs, referrer headers)
grep -rn "\\(searchParams\\|URLSearchParams\\|query\\[\\|req\\.query\\|req\\.params\\).*\\(patient\\|ssn\\|mrn\\|diagnosis\\|dob\\)" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .
grep -rn "window\\.location.*\\(patient\\|ssn\\|mrn\\)" --include="*.ts" --include="*.js" --include="*.tsx" --exclude-dir=node_modules .

# PHI in HTML title, meta tags, or page source
grep -rn "\\(document\\.title\\|<title>\\|<meta.*content\\).*\\(patient\\|medical\\|health\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.html" --exclude-dir=node_modules .

# PHI in error boundaries or error messages exposed to users
grep -rn "\\(ErrorBoundary\\|error\\.message\\|err\\.message\\|catch.*\\(e\\|err\\|error\\)\\).*\\(patient\\|ssn\\|mrn\\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .
\`\`\`

### CHECK 5: RBAC and Authorization (must exist for PHI access)

\`\`\`bash
# Look for RBAC / role-based access control implementation
grep -rln "\\(role\\|permission\\|authorize\\|authorization\\|isAdmin\\|isAuthorized\\|hasPermission\\|hasRole\\|canAccess\\|checkAccess\\|requireRole\\|guard\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --exclude-dir=node_modules . | head -20

# Look for middleware/guards protecting routes
grep -rn "\\(middleware\\|guard\\|interceptor\\|decorator\\|@Roles\\|@Permissions\\|@Authorize\\|@RequiresAuth\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.java" --exclude-dir=node_modules . | head -20

# Check if PHI endpoints have authorization — find routes with patient/health/medical and check for auth middleware
grep -rn "\\(router\\|app\\)\\.\\(get\\|post\\|put\\|delete\\|patch\\).*\\(patient\\|health\\|medical\\|phi\\|record\\)" --include="*.ts" --include="*.js" --exclude-dir=node_modules .
\`\`\`

**Interpretation:** If no RBAC patterns are found AND the project handles PHI, this is a CRITICAL finding (violates 164.312(a)(1) Access Control). If routes serving PHI don't have auth middleware, that's CRITICAL. Document which PHI routes lack authorization.

### CHECK 6: Audit Logging of PHI Access (must exist)

\`\`\`bash
# Check for audit logging implementation
grep -rln "\\(audit_log\\|auditLog\\|audit\\.log\\|AuditLog\\|AuditTrail\\|audit_trail\\|accessLog\\|access_log\\|PHIAccess\\|phi_access\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --exclude-dir=node_modules . | head -20

# Check for audit middleware/decorator patterns
grep -rn "\\(@Audit\\|@AuditLog\\|@Track\\|auditMiddleware\\|logAccess\\|trackAccess\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.java" --exclude-dir=node_modules . | head -10

# Check for database audit triggers
grep -rn "\\(CREATE TRIGGER.*audit\\|audit.*trigger\\|pg_audit\\|pgaudit\\)" --include="*.sql" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . | head -10
\`\`\`

**Interpretation:** If the project handles PHI but has NO audit logging of PHI access, this is a CRITICAL finding (violates 164.312(b) Audit Controls). HIPAA requires recording who accessed what PHI, when, and what they did with it. The audit log itself must NOT contain the PHI data — only the access event metadata (user, timestamp, resource ID, action).

### CHECK 7: Encryption of PHI at Rest (field-level)

\`\`\`bash
# Check for encryption libraries/functions used around PHI
grep -rn "\\(encrypt\\|decrypt\\|cipher\\|AES\\|aes-256\\|crypto\\.\\|bcrypt\\|argon2\\|scrypt\\|createCipher\\|createDecipher\\|KMS\\|kms\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --exclude-dir=node_modules . | head -20

# Check for encrypted database columns or field-level encryption
grep -rn "\\(encrypted\\|EncryptedField\\|encrypt_column\\|pgcrypto\\|column_encryption\\|encrypted_type\\|attr_encrypted\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.java" --exclude-dir=node_modules . | head -10

# Check database schemas for PHI fields — are they encrypted?
grep -rn "\\(CREATE TABLE\\|model\\|schema\\|Schema\\).*\\(patient\\|medical\\|health\\|ssn\\|mrn\\|diagnosis\\)" --include="*.sql" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --exclude-dir=node_modules . | head -10
\`\`\`

**Interpretation:** If PHI fields exist in the database schema without encryption (no encrypted column type, no pgcrypto, no application-level encryption), flag as HIGH. If encryption functions exist but are not applied to PHI fields specifically, flag as MEDIUM.

### CHECK 8: Session Management and Auto-Logoff

\`\`\`bash
# Check for session timeout configuration (HIPAA requires automatic logoff)
grep -rn "\\(session.*timeout\\|sessionTimeout\\|maxAge\\|expires\\|idle.*timeout\\|inactivity.*timeout\\|auto.*logoff\\|autoLogoff\\|SESSION_TIMEOUT\\|TOKEN_EXPIRY\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.env*" --include="*.yml" --include="*.yaml" --exclude-dir=node_modules . | head -10

# Check JWT/token expiration
grep -rn "\\(expiresIn\\|exp:\\|token.*expir\\|jwt.*expir\\|refreshToken\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules . | head -10
\`\`\`

**Interpretation:** HIPAA 164.312(a)(2)(iii) requires automatic logoff after a period of inactivity. Per industry best practice (TrueVault, NIST), session timeout for PHI systems should be **15 minutes maximum**. If timeout > 15 minutes, flag as MEDIUM. If no timeout configured, flag as HIGH.

### CHECK 9: Password Hashing (not plaintext)

\`\`\`bash
# Check for proper password hashing (bcrypt, argon2, scrypt, PBKDF2)
grep -rn "\\(bcrypt\\|argon2\\|scrypt\\|pbkdf2\\|hashPassword\\|hash_password\\|password_hash\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --include="*.rb" --exclude-dir=node_modules . | head -10

# Check for INSECURE password handling (MD5, SHA1 without salt, plaintext)
grep -rn "\\(md5.*password\\|sha1.*password\\|password.*md5\\|password.*sha1\\|plaintext.*password\\|password.*plain\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules . | head -10
\`\`\`

**Interpretation:** If passwords are hashed with bcrypt/argon2/scrypt — PASS. If MD5 or SHA1 (without salt) is used — CRITICAL. If no password hashing is found at all, check if the app uses an auth provider (OAuth/SSO) which handles this externally.

### CHECK 10: PHI in Test Fixtures / Seed Data

\`\`\`bash
# Check for real-looking PHI in test files and fixtures
grep -rn "\\(555-\\|123-45-6789\\|Jane Doe\\|John Smith\\|test.*ssn\\|seed.*patient\\|fixture.*medical\\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.json" --include="*.csv" --include="*.sql" test/ tests/ spec/ fixtures/ seed/ 2>/dev/null | head -20

# Check for real SSN patterns in non-production code
grep -rn "[0-9]\\{3\\}-[0-9]\\{2\\}-[0-9]\\{4\\}" test/ tests/ spec/ fixtures/ seed/ 2>/dev/null | head -10
\`\`\`

**Interpretation:** Test data should use obviously fake data. Real SSN patterns in test fixtures are a MEDIUM finding. Verify that test/dev environments never use copies of production PHI.

### CHECK 11: PHI in Error Messages and Stack Traces

\`\`\`bash
# Error responses that might leak PHI
grep -rn "\\(res\\.json.*error\\|res\\.send.*error\\|res\\.status.*error\\|HttpException\\|raise.*Error\\).*\\(patient\\|ssn\\|mrn\\|medical\\)" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . | head -10

# Check if stack traces are sent to client in production
grep -rn "\\(stack.*trace\\|err\\.stack\\|error\\.stack\\|traceback\\)" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . | head -10

# Check for global error handlers that might expose PHI
grep -rn "\\(app\\.use.*err\\|process\\.on.*uncaught\\|window\\.onerror\\|addEventListener.*error\\)" --include="*.ts" --include="*.js" --include="*.tsx" --exclude-dir=node_modules . | head -10
\`\`\`

**Interpretation:** If error responses include PHI data or full stack traces in production, this is a HIGH finding. Error messages should be generic to the user; detailed errors should go only to secure logs.

### CHECK 12: Least Privilege — IAM and Permissions

\`\`\`bash
# Check for overly permissive IAM policies (wildcard permissions)
grep -rn '"\\*"' --include="*.json" --include="*.tf" --include="*.yaml" --include="*.yml" --exclude-dir=node_modules . | grep -i "\\(action\\|resource\\|Effect.*Allow\\)" | head -10

# Check Terraform/IaC for wildcard permissions
grep -rn "\\(actions.*=.*\\[\"\\*\"\\]\\|resources.*=.*\\[\"\\*\"\\]\\|policy.*\\*\\)" --include="*.tf" --exclude-dir=node_modules . | head -10

# Check for hardcoded admin/root credentials
grep -rn "\\(admin.*password\\|root.*password\\|master.*password\\|ADMIN_PASS\\|ROOT_PASS\\|DB_PASSWORD.*=\\)" --include="*.env*" --include="*.ts" --include="*.js" --include="*.py" --include="*.yml" --include="*.yaml" --exclude-dir=node_modules . | head -10
\`\`\`

**Interpretation:** IAM policies with \`"Action": "*"\` or \`"Resource": "*"\` violate least privilege (164.312(a)(1) and 164.308(a)(4)). Hardcoded credentials are CRITICAL. Flag wildcard IAM as HIGH.

### CHECK 13: Database Sensitive Data Columns

\`\`\`bash
# Detect schema definitions with PHI column names
grep -rn "CREATE TABLE\\|model\\|Schema\\|define(" --include="*.sql" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules --exclude-dir=vendor . | \\
  grep -i "patient\\|ssn\\|social_security\\|diagnosis\\|medical_record\\|insurance\\|dob\\|date_of_birth"
\`\`\`

**Interpretation:** Columns storing PHI must be documented in a data inventory and protected with encryption, access controls, and audit logging. If PHI columns exist without corresponding encryption (CHECK 7) or access controls (CHECK 5), flag as HIGH.

### CHECK 14: Database Audit Logging Configuration

\`\`\`bash
# PostgreSQL — check if log_statement or pgaudit is configured
grep -rn "log_statement\\|pgaudit\\|pg_audit" --include="*.conf" --include="*.yml" --include="*.yaml" --include="*.tf" --include="*.env*" --exclude-dir=node_modules .

# MySQL — check for audit_log plugin or general_log
grep -rn "audit_log\\|general_log\\|slow_query_log" --include="*.cnf" --include="*.conf" --include="*.yml" --include="*.tf" --exclude-dir=node_modules .

# MSSQL/Oracle — check for server audit configuration
grep -rn "server_audit\\|sys\\.server_audits\\|DBMS_AUDIT" --include="*.sql" --include="*.tf" --include="*.yml" --exclude-dir=node_modules .
\`\`\`

**Interpretation:** HIPAA 164.312(b) requires audit controls on systems containing PHI. If the project uses a database but has no database-level audit logging configured, flag as HIGH. Database audit logs should capture: who accessed what data, when, and what operation was performed (SELECT, INSERT, UPDATE, DELETE).

### CHECK 15: Database Encryption Configuration

\`\`\`bash
# Check for database encryption extensions and settings
grep -rn "pgcrypto\\|sslmode=require\\|sslmode=verify\\|have_ssl\\|ENCRYPTION\\|encrypt_column\\|TDE\\|transparent_data_encryption" --include="*.sql" --include="*.conf" --include="*.yml" --include="*.tf" --include="*.env*" --exclude-dir=node_modules .
\`\`\`

**Interpretation:** Databases storing PHI must encrypt data at rest (164.312(a)(2)(iv)). If no encryption configuration is found (no pgcrypto, no TDE, no KMS integration), flag as HIGH. Cloud-managed databases (RDS, Cloud SQL) may have encryption enabled by default — verify with the cloud scan in Phase 2.

### CHECK 16: Database Access Control (overly permissive)

\`\`\`bash
# Check for overly permissive grants in SQL and IaC
grep -rn "GRANT ALL\\|GRANT.*TO.*PUBLIC\\|GRANT.*\\*\\.\\*" --include="*.sql" --include="*.tf" --include="*.yml" --exclude-dir=node_modules .

# Check for shared database credentials across environments
grep -rn "DB_PASSWORD\\|DATABASE_URL\\|POSTGRES_PASSWORD\\|MYSQL_ROOT_PASSWORD" --include="*.env*" --include="*.yml" --include="*.yaml" --exclude-dir=node_modules .
\`\`\`

**Interpretation:** GRANT ALL or PUBLIC grants violate least privilege (164.312(a)(1)). If the same database credentials appear in multiple environment files, flag as HIGH — production and development should use separate credentials. Root/admin database passwords in config files are CRITICAL.

### CHECK 17: Database Connection Security

\`\`\`bash
# Check for insecure database connection settings
grep -rn "sslmode=disable\\|ssl=false\\|SSL_MODE.*disable\\|requireSSL.*false" --include="*.ts" --include="*.js" --include="*.py" --include="*.env*" --include="*.yml" --exclude-dir=node_modules .
\`\`\`

**Interpretation:** Database connections carrying PHI must be encrypted in transit (164.312(e)(1)). If \`sslmode=disable\` or \`ssl=false\` is found, flag as CRITICAL — PHI is being transmitted unencrypted between the application and database. Even in private networks, SSL should be enforced for defense-in-depth.

### CHECK 18: PHI in Push Notifications & Email

\`\`\`bash
# Push notification payloads with potential PHI
grep -rn "notification\\.\\(title\\|body\\|data\\)\\|messaging\\.send\\|pushNotification\\|expo-notifications" --include="*.ts" --include="*.js" --include="*.tsx" --exclude-dir=node_modules . | \\
  grep -i "patient\\|medical\\|health\\|diagnosis\\|ssn"

# Email body/subject with potential PHI
grep -rn "sendMail\\|sendEmail\\|ses\\.send\\|sgMail\\|transporter\\.send\\|nodemailer" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . | \\
  grep -i "patient\\|medical\\|health\\|diagnosis\\|ssn\\|phi"
\`\`\`

**Interpretation:** Push notifications can display PHI on lock screens — a breach visible to anyone who picks up the phone. Emails are usually not HIPAA-compliant unless encrypted (TLS alone is insufficient; end-to-end encryption or a secure portal is needed). If push notification payloads contain PHI fields, flag as CRITICAL. If email sends contain PHI without encryption, flag as HIGH.

### CHECK 19: Secrets & Credentials in Config Files

\`\`\`bash
# Database passwords and API keys in committed config files
grep -rn "PASSWORD\\|SECRET\\|API_KEY\\|PRIVATE_KEY\\|ACCESS_KEY" --include="*.env" --include="*.env.*" --include="docker-compose*" --include="*.yml" --include="*.yaml" --exclude-dir=node_modules . | \\
  grep -v "node_modules\\|\\.example\\|PLACEHOLDER\\|changeme\\|<"

# Check if .env is in .gitignore
grep -q "\\.env" .gitignore 2>/dev/null && echo "GOOD: .env in .gitignore" || echo "CRITICAL: .env NOT in .gitignore"
\`\`\`

**Interpretation:** Secrets committed to version control are a CRITICAL finding. Anyone with repo access can extract database passwords and API keys. Check: (1) Are .env files gitignored? (2) Do docker-compose files contain real passwords vs. environment variable references? (3) Are any \`.env.production\` or \`.env.local\` files committed? If .env is NOT in .gitignore, flag as CRITICAL. If real passwords appear in committed config files, flag as CRITICAL.

---

### Classification Guide

For each finding, classify severity:
- **CRITICAL**: PHI in log output, browser storage, URL parameters, error responses to users, plaintext passwords, missing auth on PHI endpoints, hardcoded credentials, missing BAA, sslmode=disable on database connections, secrets committed to version control, PHI in push notification payloads, .env not in .gitignore
- **HIGH**: No RBAC implementation, no audit logging, no session timeout, no encryption at rest for PHI fields, wildcard IAM permissions, PHI in stack traces, no database audit logging, GRANT ALL/PUBLIC database permissions, PHI in unencrypted email, shared database credentials across environments
- **MEDIUM**: PHI field names without clear encryption, weak password hashing, PHI in test fixtures, missing field-level encryption when DB-level encryption exists, session timeout > 15 minutes, PHI columns without documented data inventory
- **LOW**: Generic health field names that may not contain actual PHI, opportunities for additional hardening`;
}

function generateEvidenceCollection(ctx: TemplateContext): string {
  return `## Evidence Collection Protocol

For each finding that is remediated, collect evidence:

\`\`\`bash
_EVIDENCE_DIR=~/.em-dash/projects/$SLUG/evidence/\${_PHASE:-general}-$(date +%Y%m%d-%H%M%S)
mkdir -p "$_EVIDENCE_DIR"
\`\`\`

**Evidence types by source:**
- **Infrastructure scans:** Save raw JSON output from Prowler/Lynis/Trivy
- **Code fixes:** Save git diff of the remediation commit
- **Policy documents:** Save the generated policy document
- **Configuration checks:** Save CLI output showing compliant state
- **Manual verification:** Note the user's confirmation of physical/admin controls

**After collecting evidence, hash for integrity:**
\`\`\`bash
_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir}) && "$_EMDASH_BIN"/hipaa-evidence-hash "$_EVIDENCE_DIR"
\`\`\`

**Evidence index:** Append to master index:
\`\`\`bash
echo '{"evidence_id":"EVD-'$(date +%s)'","phase":"'\${_PHASE}'","path":"'$_EVIDENCE_DIR'","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.em-dash/projects/$SLUG/evidence/evidence-index.jsonl
\`\`\``;
}

function generateAwsChecks(_ctx: TemplateContext): string {
  return `#### 2A.1: IAM & Access Control (164.312(a)(1), 164.312(d))

\`\`\`bash
# Password policy — length, complexity, rotation
aws iam get-account-password-policy --output json 2>&1
\`\`\`

\`\`\`bash
# MFA coverage — list all users and check for MFA devices
aws iam list-users --query 'Users[*].UserName' --output text 2>&1
\`\`\`

For each user found, check MFA:

\`\`\`bash
aws iam list-mfa-devices --user-name <username> --output json 2>&1
\`\`\`

\`\`\`bash
# Credential report — unused keys, key age >90 days
aws iam generate-credential-report 2>&1
aws iam get-credential-report --query 'Content' --output text 2>&1 | base64 -d
\`\`\`

Parse the credential report CSV. Flag: users with \`password_enabled=true\` but \`mfa_active=false\`, access keys older than 90 days, keys not used in 90+ days.

\`\`\`bash
# Account summary — overall IAM posture
aws iam get-account-summary --query 'SummaryMap.{AccountMFAEnabled:AccountMFAEnabled,MFADevices:MFADevicesInUse,Users:Users}' --output json 2>&1
\`\`\`

#### 2A.2: Audit Controls (164.312(b))

\`\`\`bash
# CloudTrail — multi-region, log validation, KMS encryption
aws cloudtrail describe-trails --query 'trailList[*].{Name:Name,IsMultiRegion:IsMultiRegionTrail,LogValidation:LogFileValidationEnabled,KmsKeyId:KmsKeyId,S3Bucket:S3BucketName}' --output json 2>&1
\`\`\`

For each trail found, verify it is actively logging:

\`\`\`bash
aws cloudtrail get-trail-status --name <trail-name> --query '{IsLogging:IsLogging,LatestDeliveryTime:LatestDeliveryTime}' --output json 2>&1
\`\`\`

\`\`\`bash
# VPC flow logs — should exist for all VPCs
aws ec2 describe-flow-logs --query 'FlowLogs[*].{FlowLogId:FlowLogId,ResourceId:ResourceId,Status:FlowLogStatus,LogDestination:LogDestinationType}' --output json 2>&1
\`\`\`

Cross-reference with all VPCs:

\`\`\`bash
aws ec2 describe-vpcs --query 'Vpcs[*].{VpcId:VpcId,IsDefault:IsDefault}' --output json 2>&1
\`\`\`

Any VPC without a flow log is a finding (164.312(b)).

\`\`\`bash
# CloudWatch log retention — should be >= 365 days for HIPAA
aws logs describe-log-groups --query 'logGroups[*].{Name:logGroupName,RetentionDays:retentionInDays}' --output json 2>&1
\`\`\`

Flag any log group with retention < 365 days or no retention set (though no retention means infinite, which is acceptable).

#### 2A.3: Encryption at Rest (164.312(a)(2)(iv))

For each S3 bucket:

\`\`\`bash
aws s3api list-buckets --query 'Buckets[*].Name' --output text 2>&1
\`\`\`

\`\`\`bash
aws s3api get-bucket-encryption --bucket <bucket-name> 2>&1
\`\`\`

\`\`\`bash
aws s3api get-bucket-versioning --bucket <bucket-name> 2>&1
\`\`\`

\`\`\`bash
aws s3api get-public-access-block --bucket <bucket-name> 2>&1
\`\`\`

\`\`\`bash
# RDS — encryption, backups, IAM auth, Multi-AZ, logging, public access
aws rds describe-db-instances --query 'DBInstances[*].{ID:DBInstanceIdentifier,Engine:Engine,Encrypted:StorageEncrypted,BackupRetention:BackupRetentionPeriod,IAMAuth:IAMDatabaseAuthenticationEnabled,MultiAZ:MultiAZ,CloudwatchLogs:EnabledCloudwatchLogsExports,Public:PubliclyAccessible}' --output json 2>&1
\`\`\`

Flag: \`StorageEncrypted=false\`, \`BackupRetentionPeriod < 7\`, \`PubliclyAccessible=true\`, no CloudWatch log exports.

\`\`\`bash
# KMS key rotation — list keys and check rotation status
aws kms list-keys --query 'Keys[*].KeyId' --output text 2>&1
\`\`\`

For each key:

\`\`\`bash
aws kms describe-key --key-id <key-id> --query 'KeyMetadata.{KeyId:KeyId,Description:Description,KeyState:KeyState,KeyManager:KeyManager}' --output json 2>&1
\`\`\`

\`\`\`bash
aws kms get-key-rotation-status --key-id <key-id> 2>&1
\`\`\`

Only check customer-managed keys (KeyManager=CUSTOMER). Flag rotation not enabled.

\`\`\`bash
# SNS topics — check for KMS encryption
aws sns list-topics --query 'Topics[*].TopicArn' --output text 2>&1
\`\`\`

For each topic:

\`\`\`bash
aws sns get-topic-attributes --topic-arn <topic-arn> --query 'Attributes.KmsMasterKeyId' --output text 2>&1
\`\`\`

\`\`\`bash
# SQS queues — check for KMS encryption
aws sqs list-queues --output json 2>&1
\`\`\`

For each queue:

\`\`\`bash
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names KmsMasterKeyId --output json 2>&1
\`\`\`

\`\`\`bash
# EBS volumes — find unencrypted volumes
aws ec2 describe-volumes --filters Name=encrypted,Values=false --query 'Volumes[*].{VolumeId:VolumeId,Size:Size,State:State,AvailabilityZone:AvailabilityZone}' --output json 2>&1
\`\`\`

Any unencrypted EBS volume is a finding.

#### 2A.4: Transmission Security (164.312(e)(1))

\`\`\`bash
# Security groups — find rules allowing 0.0.0.0/0 on sensitive ports
aws ec2 describe-security-groups --query 'SecurityGroups[*].{GroupId:GroupId,GroupName:GroupName,VpcId:VpcId,IngressRules:IpPermissions}' --output json 2>&1
\`\`\`

Filter results for ingress rules with \`0.0.0.0/0\` on ports 22 (SSH), 3306 (MySQL), 5432 (PostgreSQL), 27017 (MongoDB), 1433 (MSSQL). These are CRITICAL if found.

\`\`\`bash
# Load balancers — check for HTTPS listeners and TLS policy
aws elbv2 describe-load-balancers --query 'LoadBalancers[*].{ARN:LoadBalancerArn,Name:LoadBalancerName,Scheme:Scheme,Type:Type}' --output json 2>&1
\`\`\`

For each load balancer:

\`\`\`bash
aws elbv2 describe-listeners --load-balancer-arn <lb-arn> --query 'Listeners[*].{Port:Port,Protocol:Protocol,SslPolicy:SslPolicy}' --output json 2>&1
\`\`\`

Flag: listeners using HTTP instead of HTTPS, outdated TLS policies (anything before TLSv1.2).

RDS \`PubliclyAccessible=true\` from 2A.3 is also a transmission security finding.

#### 2A.5: Threat Detection (164.308(a)(1)(ii)(D))

\`\`\`bash
# GuardDuty — check if enabled
aws guardduty list-detectors --output json 2>&1
\`\`\`

If detectors exist, check status:

\`\`\`bash
aws guardduty get-detector --detector-id <detector-id> --query '{Status:Status,FindingPublishingFrequency:FindingPublishingFrequency}' --output json 2>&1
\`\`\`

\`\`\`bash
# Security Hub — check if enabled
aws securityhub describe-hub 2>&1
\`\`\`

If GuardDuty is not enabled, flag as HIGH. If Security Hub is not enabled, flag as MEDIUM.

#### 2A.6: Secrets Management (164.312(a)(1))

\`\`\`bash
# Secrets Manager — check rotation configuration
aws secretsmanager list-secrets --query 'SecretList[*].{Name:Name,RotationEnabled:RotationEnabled,RotationRules:RotationRules,LastRotatedDate:LastRotatedDate}' --output json 2>&1
\`\`\`

Flag secrets without rotation enabled. Flag secrets not rotated in >90 days.

#### 2A.7: Compute Security (164.312(a)(1))

\`\`\`bash
# Lambda functions — check VPC config and KMS encryption
aws lambda list-functions --query 'Functions[*].{Name:FunctionName,Runtime:Runtime,VpcConfig:VpcConfig,KmsKeyArn:KMSKeyArn}' --output json 2>&1
\`\`\`

Flag: Lambda functions without VPC configuration (not in a VPC), Lambda functions without KMS key for environment variable encryption.

---

#### 2A.8: Data Protection & Backup (164.308(a)(7), 164.312(a)(2)(iv))

\`\`\`bash
# S3 access logging — detect who accessed PHI buckets
aws s3api get-bucket-logging --bucket <bucket-name> 2>&1
\`\`\`

\`\`\`bash
# S3 versioning — protect against accidental deletion of PHI
aws s3api get-bucket-versioning --bucket <bucket-name> 2>&1
\`\`\`

\`\`\`bash
# RDS automated backups and audit logging
aws rds describe-db-instances --query 'DBInstances[*].{ID:DBInstanceIdentifier,BackupRetention:BackupRetentionPeriod,CloudwatchLogs:EnabledCloudwatchLogsExports,StorageEncrypted:StorageEncrypted}' --output json 2>&1
\`\`\`

Flag: \`BackupRetentionPeriod < 7\` (HIGH), empty \`EnabledCloudwatchLogsExports\` (HIGH — no audit trail for database access).

\`\`\`bash
# AWS Backup vault lock — immutable backups for compliance
aws backup list-backup-vaults --query 'BackupVaultList[*].{Name:BackupVaultName,Locked:Locked}' --output json 2>&1
\`\`\`

Flag vaults without \`Locked=true\` — backup immutability prevents tampering (164.308(a)(7)).

\`\`\`bash
# ACM certificate expiry — TLS certificates nearing expiration
aws acm list-certificates --query 'CertificateSummaryList[*].{Domain:DomainName,Status:Status,NotAfter:NotAfter}' --output json 2>&1
\`\`\`

Flag certificates expiring within 30 days — expired TLS breaks transmission security.

#### 2A.9: Advanced Monitoring (164.312(b), 164.308(a)(8))

\`\`\`bash
# CloudTrail multi-region and log file validation
aws cloudtrail describe-trails --query 'trailList[*].{Name:Name,IsMultiRegion:IsMultiRegionTrail,LogValidation:LogFileValidationEnabled}' --output json 2>&1
\`\`\`

Flag: \`IsMultiRegionTrail=false\` (HIGH — blind spots in non-primary regions), \`LogFileValidationEnabled=false\` (HIGH — logs could be tampered).

\`\`\`bash
# CloudFront TLS — check viewer certificate and minimum protocol version
aws cloudfront list-distributions --query 'DistributionList.Items[*].{Id:Id,Domain:DomainName,ViewerCert:ViewerCertificate.MinimumProtocolVersion,HttpsOnly:ViewerCertificate.SSLSupportMethod}' --output json 2>&1
\`\`\`

Flag distributions allowing TLSv1.0 or TLSv1.1 — require TLSv1.2 minimum.

\`\`\`bash
# WAF — check for web ACL protection on public-facing resources
aws wafv2 list-web-acls --scope REGIONAL --query 'WebACLs[*].{Name:Name,ARN:ARN}' --output json 2>&1
\`\`\`

If no WAF ACLs exist and the project has public-facing load balancers or API Gateways, flag as MEDIUM.

\`\`\`bash
# AWS Config — check if configuration recording is enabled
aws configservice describe-configuration-recorders --query 'ConfigurationRecorders[*].{Name:name,RecordingGroup:recordingGroup}' --output json 2>&1
aws configservice describe-config-rules --query 'ConfigRules[*].{Name:ConfigRuleName,State:ConfigRuleState}' --output json 2>&1
\`\`\`

Flag: no configuration recorder (HIGH), or rules in NON_COMPLIANT state (review individually).

\`\`\`bash
# Amazon Macie — PHI auto-discovery in S3
aws macie2 get-macie-session 2>&1
\`\`\`

If Macie is not enabled and S3 buckets exist, flag as MEDIUM — Macie can auto-detect PHI in S3.

\`\`\`bash
# Amazon Inspector — vulnerability assessment
aws inspector2 list-findings --filter-criteria '{"findingSeverity":[{"comparison":"EQUALS","value":"CRITICAL"}]}' --query 'findings[*].{Title:title,Severity:severity,Resource:resources[0].id}' --output json 2>&1
\`\`\`

Flag any CRITICAL Inspector findings — vulnerabilities in compute resources handling PHI.

\`\`\`bash
# SNS topic encryption — check for KMS
aws sns list-topics --query 'Topics[*].TopicArn' --output text 2>&1
\`\`\`

For each topic: \`aws sns get-topic-attributes --topic-arn <arn> --query 'Attributes.KmsMasterKeyId'\`. Flag unencrypted topics carrying PHI notifications.

\`\`\`bash
# SQS queue encryption
aws sqs list-queues --output json 2>&1
\`\`\`

For each queue: \`aws sqs get-queue-attributes --queue-url <url> --attribute-names KmsMasterKeyId\`. Flag queues without KMS encryption.

---

**Prowler coexistence:** If \`TOOL_PROWLER=true\`, Prowler already covers most of these checks. Run Prowler first (in the main 2A section above), then run only these supplemental checks that Prowler covers lightly or not at all: GuardDuty detailed status, Security Hub, Lambda VPC configuration, credential report age analysis, per-bucket versioning and public access block, SNS/SQS KMS encryption.

If \`TOOL_PROWLER=false\`, run ALL checks above as the primary scan.

**AWS HIPAA Requirement Summary:**

| Check | HIPAA Requirement | Commands |
|-------|------------------|----------|
| Password policy | 164.312(d) | get-account-password-policy |
| MFA coverage | 164.312(d) | list-users, list-mfa-devices |
| Credential report | 164.312(a)(1) | generate-credential-report, get-credential-report |
| CloudTrail | 164.312(b) | describe-trails, get-trail-status |
| VPC flow logs | 164.312(b) | describe-flow-logs, describe-vpcs |
| CloudWatch retention | 164.312(b) | describe-log-groups |
| S3 encryption | 164.312(a)(2)(iv) | get-bucket-encryption, get-bucket-versioning, get-public-access-block |
| RDS encryption | 164.312(a)(2)(iv) | describe-db-instances |
| KMS rotation | 164.312(a)(2)(iv) | list-keys, get-key-rotation-status |
| SNS/SQS encryption | 164.312(a)(2)(iv) | get-topic-attributes, get-queue-attributes |
| EBS encryption | 164.312(a)(2)(iv) | describe-volumes |
| Security groups | 164.312(e)(1) | describe-security-groups |
| Load balancer TLS | 164.312(e)(1) | describe-load-balancers, describe-listeners |
| GuardDuty | 164.308(a)(1)(ii)(D) | list-detectors, get-detector |
| Security Hub | 164.308(a)(1)(ii)(D) | describe-hub |
| Secrets rotation | 164.312(a)(1) | list-secrets |
| Lambda VPC/KMS | 164.312(a)(1) | list-functions |
| S3 access logging | 164.312(b) | get-bucket-logging |
| S3 versioning | 164.312(c)(2) | get-bucket-versioning |
| RDS audit logging | 164.312(b) | describe-db-instances (CloudwatchLogs) |
| Backup vault lock | 164.308(a)(7) | list-backup-vaults |
| ACM cert expiry | 164.312(e)(1) | list-certificates |
| CloudTrail validation | 164.312(b) | describe-trails (LogValidation) |
| CloudFront TLS | 164.312(e)(1) | list-distributions |
| WAF protection | 164.312(e)(1) | list-web-acls |
| AWS Config | 164.312(b) | describe-config-rules |
| Macie PHI discovery | 164.312(a)(1) | get-macie-session |
| Inspector findings | 164.308(a)(8) | list-findings |
| SNS encryption | 164.312(a)(2)(iv) | get-topic-attributes |
| SQS encryption | 164.312(a)(2)(iv) | get-queue-attributes |`;
}

function generateGcpChecks(_ctx: TemplateContext): string {
  return `#### 2B.1: Cloud SQL (164.312(a)(2)(iv), 164.312(e)(1))

\`\`\`bash
# Cloud SQL instances — SSL, backups, flags, public IP
gcloud sql instances list --format='json(name,settings.ipConfiguration.requireSsl,settings.ipConfiguration.ipv4Enabled,settings.backupConfiguration.enabled,settings.databaseFlags,state)' 2>&1
\`\`\`

For each instance, check encryption and authorized networks:

\`\`\`bash
gcloud sql instances describe <instance-name> --format='json(settings.ipConfiguration.authorizedNetworks,settings.dataDiskEncryptionKey,connectionName)' 2>&1
\`\`\`

Flag: \`requireSsl=false\` (CRITICAL), \`ipv4Enabled=true\` (HIGH — use private IP), no backup configuration (HIGH), no CMEK (\`dataDiskEncryptionKey\` missing — MEDIUM), overly broad authorized networks (HIGH).

#### 2B.2: IAM & Service Accounts (164.312(a)(1))

\`\`\`bash
# Project IAM policy — check for overly permissive bindings
gcloud projects get-iam-policy $(gcloud config get-value project) --flatten="bindings[].members" --format='table(bindings.role,bindings.members)' 2>&1
\`\`\`

Flag: service accounts with \`roles/owner\` or \`roles/editor\` (HIGH — use granular roles), allUsers or allAuthenticatedUsers bindings (CRITICAL).

\`\`\`bash
# Service account key audit — user-managed keys older than 90 days
gcloud iam service-accounts list --format='value(email)' 2>&1
\`\`\`

For each service account:

\`\`\`bash
gcloud iam service-accounts keys list --iam-account=<sa-email> --managed-by=user --format='json(name,validAfterTime,validBeforeTime)' 2>&1
\`\`\`

Flag user-managed keys older than 90 days. Recommend workload identity or short-lived credentials.

#### 2B.3: KMS (164.312(a)(2)(iv))

\`\`\`bash
# KMS keyrings and keys — check rotation period
gcloud kms keyrings list --location=global --format='value(name)' 2>&1
\`\`\`

For each keyring:

\`\`\`bash
gcloud kms keys list --keyring=<keyring-name> --location=global --format='json(name,purpose,rotationPeriod,nextRotationTime)' 2>&1
\`\`\`

Flag keys without rotation configured or rotation period > 365 days.

#### 2B.4: VPC & Firewalls (164.312(e)(1))

\`\`\`bash
# Firewall rules — find overly permissive rules
gcloud compute firewall-rules list --format='json(name,direction,sourceRanges,allowed,targetTags,disabled)' 2>&1
\`\`\`

Flag: rules with \`sourceRanges\` containing \`0.0.0.0/0\` on sensitive ports (22, 3306, 5432, 27017, 1433). These are HIGH findings.

\`\`\`bash
# VPC subnets — check for flow logs
gcloud compute networks subnets list --format='json(name,network,logConfig)' 2>&1
\`\`\`

Flag subnets without \`logConfig\` enabled — VPC flow logs are required for audit controls (164.312(b)).

#### 2B.5: GKE (164.312(a)(1))

\`\`\`bash
# GKE clusters — workload identity, network policy, shielded nodes, private cluster
gcloud container clusters list --format='json(name,workloadIdentityConfig,networkPolicy,shieldedNodes,privateClusterConfig,nodePools[].config.shieldedInstanceConfig)' 2>&1
\`\`\`

Flag: no workload identity (HIGH — pods can access node service account), no network policy (HIGH), shielded nodes disabled (MEDIUM), not a private cluster (HIGH — nodes have public IPs).

#### 2B.6: Cloud Run / Functions (164.312(e)(1))

\`\`\`bash
# Cloud Run services — ingress and VPC connector
gcloud run services list --format='json(metadata.name,spec.template.metadata.annotations)' 2>&1
\`\`\`

Flag: services with ingress set to \`all\` instead of \`internal\` or \`internal-and-cloud-load-balancing\` (MEDIUM). Services without a VPC connector may not be able to reach private resources (note, not always a finding).

#### 2B.7: Audit Logs (164.312(b))

\`\`\`bash
# Audit log configuration — check for data access logs
gcloud projects get-iam-policy $(gcloud config get-value project) --format='json(auditConfigs)' 2>&1
\`\`\`

Flag: missing \`DATA_READ\` or \`DATA_WRITE\` audit log types (HIGH). All data access to PHI systems must be logged. Exempted members in audit configs should be reviewed.

#### 2B.8: BigQuery (164.312(a)(2)(iv))

\`\`\`bash
# BigQuery datasets — encryption and access controls
bq ls --format=json 2>&1
\`\`\`

For each dataset:

\`\`\`bash
bq show --format=json <dataset-id> 2>&1
\`\`\`

Check \`defaultEncryptionConfiguration\` for CMEK. Review \`access\` entries for overly broad permissions (allAuthenticatedUsers, allUsers).

#### 2B.9: Pub/Sub (164.312(a)(2)(iv))

\`\`\`bash
# Pub/Sub topics — check for KMS encryption
gcloud pubsub topics list --format='json(name,kmsKeyName)' 2>&1
\`\`\`

Flag topics without \`kmsKeyName\` — messages containing PHI should be encrypted with CMEK.

#### 2B.10: Cloud SQL Backups & SSL (164.308(a)(7), 164.312(e)(1))

\`\`\`bash
# Cloud SQL backup configuration
gcloud sql instances list --format='json(name,settings.backupConfiguration.enabled,settings.backupConfiguration.pointInTimeRecoveryEnabled,settings.backupConfiguration.transactionLogRetentionDays)' 2>&1
\`\`\`

Flag: backups disabled (CRITICAL), point-in-time recovery disabled (HIGH), transaction log retention < 7 days (MEDIUM).

\`\`\`bash
# Cloud SQL SSL enforcement
gcloud sql instances list --format='json(name,settings.ipConfiguration.requireSsl)' 2>&1
\`\`\`

Flag \`requireSsl=false\` — database connections must be encrypted for PHI.

#### 2B.11: VPC Service Controls & Network (164.312(a)(1), 164.312(e)(1))

\`\`\`bash
# VPC Service Controls — perimeter protection for PHI services
gcloud access-context-manager perimeters list --format='json(name,status.resources,status.restrictedServices)' 2>&1
\`\`\`

If no service perimeters exist and the project handles PHI, flag as MEDIUM — VPC SC prevents data exfiltration.

\`\`\`bash
# Cloud Armor security policies — DDoS and WAF protection
gcloud compute security-policies list --format='json(name,rules[].description)' 2>&1
\`\`\`

#### 2B.12: Data Discovery & Secret Management (164.312(a)(1))

\`\`\`bash
# DLP inspection — check if PHI scanning is configured
gcloud dlp job-triggers list --format='json(name,status,inspectJob.storageConfig)' 2>&1
\`\`\`

\`\`\`bash
# Logging sinks — ensure audit logs are exported to secure storage
gcloud logging sinks list --format='json(name,destination,filter)' 2>&1
\`\`\`

Flag: no logging sinks (HIGH — audit logs may only exist for default retention).

\`\`\`bash
# Cloud Functions VPC connector — functions accessing PHI should be in VPC
gcloud functions list --format='json(name,vpcConnector,ingressSettings)' 2>&1
\`\`\`

Flag functions without \`vpcConnector\` that access PHI databases.

\`\`\`bash
# Binary Authorization — container image verification
gcloud container binauthz policy export 2>&1
\`\`\`

#### 2B.13: Cache & Secret Encryption (164.312(a)(2)(iv))

\`\`\`bash
# Memorystore (Redis) transit encryption
gcloud redis instances list --format='json(name,transitEncryptionMode,authEnabled)' 2>&1
\`\`\`

Flag \`transitEncryptionMode=DISABLED\` — cache traffic with PHI must be encrypted.

\`\`\`bash
# Secret Manager rotation — check for automatic rotation
gcloud secrets list --format='json(name,rotation.rotationPeriod,rotation.nextRotationTime)' 2>&1
\`\`\`

Flag secrets without rotation configured.

---

**GCP HIPAA Requirement Summary:**

| Check | HIPAA Requirement | Commands |
|-------|------------------|----------|
| Cloud SQL SSL/encryption | 164.312(a)(2)(iv), 164.312(e)(1) | sql instances list, sql instances describe |
| IAM role audit | 164.312(a)(1) | projects get-iam-policy |
| Service account keys | 164.312(a)(1) | service-accounts keys list |
| KMS rotation | 164.312(a)(2)(iv) | kms keys list |
| Firewall rules | 164.312(e)(1) | compute firewall-rules list |
| VPC flow logs | 164.312(b) | compute networks subnets list |
| GKE security | 164.312(a)(1) | container clusters list |
| Cloud Run ingress | 164.312(e)(1) | run services list |
| Audit logs | 164.312(b) | projects get-iam-policy (auditConfigs) |
| BigQuery encryption | 164.312(a)(2)(iv) | bq show |
| Pub/Sub CMEK | 164.312(a)(2)(iv) | pubsub topics list |
| Cloud SQL backups | 164.308(a)(7) | sql instances list (backupConfiguration) |
| Cloud SQL SSL | 164.312(e)(1) | sql instances list (requireSsl) |
| VPC Service Controls | 164.312(a)(1) | access-context-manager perimeters list |
| Cloud Armor | 164.312(e)(1) | compute security-policies list |
| DLP inspection | 164.312(a)(1) | dlp job-triggers list |
| Logging sinks | 164.312(b) | logging sinks list |
| Functions VPC | 164.312(e)(1) | functions list (vpcConnector) |
| Binary Authorization | 164.312(a)(1) | container binauthz policy export |
| Memorystore encryption | 164.312(e)(1) | redis instances list (transitEncryptionMode) |
| Secret rotation | 164.312(a)(2)(iv) | secrets list (rotation) |`;
}

function generateAzureChecks(_ctx: TemplateContext): string {
  return `#### 2C.1: Storage (164.312(a)(2)(iv))

\`\`\`bash
# Storage accounts — encryption, HTTPS-only, minimum TLS version
az storage account list --query '[].{Name:name,Encryption:encryption.services,HttpsOnly:enableHttpsTrafficOnly,MinTls:minimumTlsVersion,Kind:kind}' -o json 2>&1
\`\`\`

Flag: \`enableHttpsTrafficOnly=false\` (CRITICAL), \`minimumTlsVersion\` below \`TLS1_2\` (HIGH).

#### 2C.2: SQL (164.312(a)(2)(iv), 164.312(b))

\`\`\`bash
# SQL servers — list all
az sql server list --query '[].{Name:name,ResourceGroup:resourceGroup,State:state}' -o json 2>&1
\`\`\`

For each SQL server, check audit policy:

\`\`\`bash
az sql server audit-policy show --resource-group <rg> --server <server-name> -o json 2>&1
\`\`\`

\`\`\`bash
# SQL databases — check TDE (Transparent Data Encryption)
az sql db list --resource-group <rg> --server <server-name> --query '[].{Name:name,Status:status}' -o json 2>&1
\`\`\`

For each database:

\`\`\`bash
az sql db tde show --resource-group <rg> --server <server-name> --database <db-name> -o json 2>&1
\`\`\`

Flag: TDE not enabled (HIGH), audit policy not configured (HIGH).

#### 2C.3: Key Vault (164.312(a)(2)(iv))

\`\`\`bash
# Key Vaults — soft delete, purge protection
az keyvault list --query '[].{Name:name,SoftDelete:properties.enableSoftDelete,PurgeProtection:properties.enablePurgeProtection}' -o json 2>&1
\`\`\`

Flag: \`enableSoftDelete=false\` (HIGH — deleted secrets are permanently lost), \`enablePurgeProtection=false\` (MEDIUM — secrets can be permanently purged before retention period).

#### 2C.4: Networking (164.312(e)(1))

\`\`\`bash
# Network Security Groups — list all
az network nsg list --query '[].{Name:name,ResourceGroup:resourceGroup}' -o json 2>&1
\`\`\`

For each NSG:

\`\`\`bash
az network nsg rule list --resource-group <rg> --nsg-name <nsg-name> --query '[].{Name:name,Priority:priority,Direction:direction,Access:access,Protocol:protocol,SourceAddress:sourceAddressPrefix,DestPort:destinationPortRange}' -o json 2>&1
\`\`\`

Flag: rules with \`sourceAddressPrefix=*\` or \`0.0.0.0/0\` allowing access on sensitive ports (22, 3306, 5432, 27017, 1433) — HIGH.

#### 2C.5: Monitoring (164.312(b))

\`\`\`bash
# Diagnostic settings — check if logging is configured
az monitor diagnostic-settings list --resource <resource-id> -o json 2>&1
\`\`\`

\`\`\`bash
# Activity log alerts — check for security-relevant alerts
az monitor activity-log alert list -o json 2>&1
\`\`\`

Flag: no diagnostic settings on critical resources (HIGH), no activity log alerts for security events (MEDIUM).

#### 2C.6: IAM (164.312(a)(1))

\`\`\`bash
# Role assignments — check scope of Owner/Contributor roles
az role assignment list --query '[?roleDefinitionName==\`Owner\` || roleDefinitionName==\`Contributor\`].{Principal:principalName,Role:roleDefinitionName,Scope:scope}' -o json 2>&1
\`\`\`

Flag: Owner or Contributor at subscription scope (HIGH — scope down to resource group level), service principals with Owner role (HIGH).

#### 2C.7: Defender (164.308(a)(1))

\`\`\`bash
# Microsoft Defender for Cloud — security assessments
az security assessment list --query '[?status.code==\`Unhealthy\`].{Name:displayName,Status:status.code,Severity:metadata.severity,Description:metadata.description}' -o json 2>&1
\`\`\`

Review unhealthy assessments for HIPAA-relevant findings. Focus on data protection, network, and identity categories.

#### 2C.8: SQL Auditing & Advanced Monitoring (164.312(b))

\`\`\`bash
# SQL server auditing — verify audit policy is enabled
az sql server audit-policy show --resource-group <rg> --server <server-name> -o json 2>&1
\`\`\`

Flag: audit policy not configured or \`state=Disabled\` (HIGH — no database access audit trail).

\`\`\`bash
# Log Analytics workspace — central log aggregation
az monitor log-analytics workspace list --query '[].{Name:name,RetentionDays:retentionInDays,Sku:sku.name}' -o json 2>&1
\`\`\`

Flag: no Log Analytics workspace (HIGH), retention < 365 days (MEDIUM).

\`\`\`bash
# Activity log alerts — security event monitoring
az monitor activity-log alert list --query '[].{Name:name,Enabled:enabled,Condition:condition}' -o json 2>&1
\`\`\`

#### 2C.9: Network & Application Security (164.312(e)(1))

\`\`\`bash
# Application Gateway WAF — web application firewall
az network application-gateway waf-config show --gateway-name <gw-name> --resource-group <rg> -o json 2>&1
\`\`\`

Flag: WAF disabled on gateways fronting PHI applications (HIGH).

\`\`\`bash
# Private endpoints — ensure PHI services use private networking
az network private-endpoint list --query '[].{Name:name,Subnet:subnet.id,Connections:privateLinkServiceConnections[].privateLinkServiceId}' -o json 2>&1
\`\`\`

If SQL, Storage, or Cosmos DB resources exist without private endpoints, flag as MEDIUM.

\`\`\`bash
# Front Door TLS — check minimum TLS version on CDN endpoints
az afd endpoint list --profile-name <profile> --resource-group <rg> --query '[].{Name:name,EnabledState:enabledState}' -o json 2>&1
\`\`\`

#### 2C.10: Data Protection & Backup (164.312(a)(2)(iv), 164.308(a)(7))

\`\`\`bash
# Cosmos DB encryption and failover
az cosmosdb show --name <account-name> --resource-group <rg> --query '{EnableAutomaticFailover:enableAutomaticFailover,KeyVaultKeyUri:keyVaultKeyUri,BackupPolicy:backupPolicy}' -o json 2>&1
\`\`\`

Flag: no CMEK (\`keyVaultKeyUri\` empty — MEDIUM), automatic failover disabled (MEDIUM).

\`\`\`bash
# Disk encryption sets — managed disk encryption
az disk-encryption-set list --query '[].{Name:name,EncryptionType:encryptionType,KeyVault:activeKey.sourceVault.id}' -o json 2>&1
\`\`\`

\`\`\`bash
# Backup policies — verify backup protection for PHI data
az backup policy list --vault-name <vault> --resource-group <rg> --query '[].{Name:name,RetentionDuration:retentionPolicy.dailySchedule.retentionDuration}' -o json 2>&1
\`\`\`

Flag: no backup policies (HIGH), retention < 30 days (MEDIUM).

---

**Azure HIPAA Requirement Summary:**

| Check | HIPAA Requirement | Commands |
|-------|------------------|----------|
| Storage encryption/TLS | 164.312(a)(2)(iv), 164.312(e)(1) | storage account list |
| SQL audit logging | 164.312(b) | sql server audit-policy show |
| SQL TDE | 164.312(a)(2)(iv) | sql db tde show |
| Key Vault | 164.312(a)(2)(iv) | keyvault list |
| NSG rules | 164.312(e)(1) | network nsg rule list |
| Diagnostic settings | 164.312(b) | monitor diagnostic-settings list |
| Activity alerts | 164.312(b) | monitor activity-log alert list |
| IAM scope | 164.312(a)(1) | role assignment list |
| Defender | 164.308(a)(1) | security assessment list |
| SQL auditing | 164.312(b) | sql server audit-policy show |
| Log Analytics | 164.312(b) | monitor log-analytics workspace list |
| App Gateway WAF | 164.312(e)(1) | network application-gateway waf-config show |
| Private endpoints | 164.312(e)(1) | network private-endpoint list |
| Front Door TLS | 164.312(e)(1) | afd endpoint list |
| Cosmos DB encryption | 164.312(a)(2)(iv) | cosmosdb show |
| Disk encryption | 164.312(a)(2)(iv) | disk-encryption-set list |
| Backup policies | 164.308(a)(7) | backup policy list |`;
}

function generateIacPolicyEngine(ctx: TemplateContext): string {
  return `**IaC Detection (expanded):**

Detect all Infrastructure-as-Code formats present in the project:

\`\`\`bash
# Terraform
ls *.tf **/*.tf 2>/dev/null | head -5

# CloudFormation — YAML/JSON with AWSTemplateFormatVersion
grep -rl "AWSTemplateFormatVersion" --include="*.yml" --include="*.yaml" --include="*.json" . 2>/dev/null | grep -v node_modules | head -5

# CDK
ls cdk.json 2>/dev/null

# SAM — template.yaml with Transform: AWS::Serverless
grep -rl "Transform.*AWS::Serverless" --include="*.yml" --include="*.yaml" . 2>/dev/null | grep -v node_modules | head -5

# Kubernetes manifests
grep -rl "kind: Deployment\\|kind: Service\\|kind: Pod\\|kind: StatefulSet" --include="*.yml" --include="*.yaml" . 2>/dev/null | grep -v node_modules | head -10

# Helm charts
ls **/Chart.yaml Chart.yaml 2>/dev/null
\`\`\`

Note which IaC formats were detected. This determines which scanners to run.

**CDK/SAM handling:**
- If CDK detected (\`cdk.json\` exists): CDK is TypeScript/Python code, not scannable IaC. You MUST synthesize it to CloudFormation first:
\`\`\`bash
npx cdk synth --quiet --output /tmp/cdk-synth-$(date +%Y%m%d) 2>&1 | tail -5
\`\`\`
Then run Checkov and Conftest against the synthesized templates in that output directory, not the raw CDK source.
- If SAM detected: SAM templates are CloudFormation supersets — scan them directly with CloudFormation scanners.

---

**Checkov integration (if \`TOOL_CHECKOV=true\`):**

Checkov has 1000+ built-in rules with a HIPAA compliance framework. Run it against all detected IaC:

\`\`\`bash
checkov --framework terraform,cloudformation,kubernetes,helm \\
  --check HIPAA --output json --compact --quiet 2>&1
\`\`\`

Parse the JSON output. For each finding:
1. Map the Checkov check ID to the HIPAA requirement
2. Extract: resource name, file path, check description, severity
3. Group findings by HIPAA requirement section

If Checkov finds no IaC files, it will report 0 checks — this is fine, note "No IaC files detected for Checkov."

---

**Conftest integration (if \`TOOL_CONFTEST=true\` and policies exist):**

Conftest runs custom Rego policies against configuration files. em-dash ships 6 compliance Rego policies in its \`policies/\` directory:

- \`encryption-at-rest.rego\` — RDS, S3, EBS, KMS, GCP SQL/Storage encryption rules
- \`transmission-security.rego\` — Security groups, load balancers, SSL, firewall rules
- \`access-control.rego\` — IAM wildcards, MFA, GCP/Azure role scoping
- \`audit-logging.rego\` — CloudTrail, VPC flow logs, CloudWatch retention, GCP audit configs
- \`k8s-security.rego\` — Pod security, privileged containers, network policies, image registries
- \`secrets.rego\` — Hardcoded credentials in Terraform, K8s inline secrets

Run Conftest against detected IaC files:

\`\`\`bash
_EMDASH_POLICIES=$([ -d ${ctx.policyDir} ] && echo ${ctx.policyDir} || echo ${ctx.localPolicyDir})
conftest test -p "$_EMDASH_POLICIES" \\
  <detected-iac-files> --output json 2>&1
\`\`\`

Parse JSON output. Each denial includes \`hipaa_ref\`, \`severity\`, and \`resource\` in the message object.

---

**Fallback (neither Checkov nor Conftest available):**

1. If \`TOOL_TRIVY=true\`, use Trivy config scanning (already covered in Phase 4A):
\`\`\`bash
trivy config . --severity HIGH,CRITICAL --format json 2>&1
\`\`\`

2. If no policy tools are available, use AskUserQuestion:

"Your project has IaC files but no policy-as-code tools installed. For the most thorough infrastructure scan, I recommend installing one:

RECOMMENDATION: Choose A — Checkov has the most built-in HIPAA rules.

A) Install Checkov now (\`pip install checkov\` — ~2 min)
B) Install Conftest now (\`brew install conftest\` — ~1 min, uses our bundled Rego policies)
C) Skip policy scanning — rely on cloud CLI checks and code-level scanning only"

3. If all tools are skipped, fall back to manual IaC review: read detected Terraform/CloudFormation/K8s files directly and check for the patterns covered by the Rego policies (encryption settings, security groups, IAM wildcards, etc.).

---

**IaC Scan Summary:**

Report which tools ran and their findings:

| Tool | Files Scanned | Findings | Compliance Checks |
|------|--------------|----------|-------------------|
| Checkov | N | N passed / N failed | Built-in compliance framework |
| Conftest | N | N denials | 6 Rego policy files |
| Trivy Config | N | N findings | Built-in misconfig rules |
| Manual Review | N | N findings | Pattern matching |`;
}

function generateDashboardUpdates(ctx: TemplateContext): string {
  const binDetect = `_EMDASH_BIN=$([ -d ${ctx.binDir} ] && echo ${ctx.binDir} || echo ${ctx.localBinDir})`;

  const updateUsage = `**How to update the dashboard:**

\`\`\`bash
${binDetect}
# Checklist: mark an item as complete with reasoning
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "<id>" complete "<your reasoning>"
# Checklist: mark as pending with an evidence gap
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "<id>" pending --gap "<what's missing>"
# Checklist: attach evidence file
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "<id>" complete --evidence "<filename>"

# Finding: add a new finding
"$_EMDASH_BIN"/hipaa-dashboard-update finding add --title "<title>" --severity <critical|high|medium|low> --requirement "<id>" --source "<skill>"
# Finding: resolve a finding
"$_EMDASH_BIN"/hipaa-dashboard-update finding resolve --title "<title>"

# Vendor: add a vendor/BA
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "<name>" --service "<service>" --baa-status <signed|pending|none> --risk-tier <low|medium|high|critical>
# Vendor: update BAA status
"$_EMDASH_BIN"/hipaa-dashboard-update vendor update --name "<name>" --baa-status signed

# Risk: add a risk
"$_EMDASH_BIN"/hipaa-dashboard-update risk add --description "<desc>" --likelihood <1-5> --impact <1-5> --treatment <mitigate|accept|transfer|avoid> --owner "<owner>" --requirement "<ids>"
\`\`\``;

  const maps: Record<string, string> = {
    'hipaa-assess': `## Dashboard Checklist Updates

As you conduct the interview, update the dashboard after each meaningful answer. Use your judgment — the user's answer tells you whether a control is genuinely in place or just aspirational.

**Principle:** An answer like "yeah we probably should do that" is NOT a complete control. "Our CTO handles security, we review access quarterly" IS evidence of a control in place.

**Reference — interview topics and their checklist IDs:**

| Topic | Checklist ID | What "complete" means |
|-------|-------------|----------------------|
| Security officer | 164.308(a)(2) | A specific person is designated and actively responsible — not "we all kind of do it" |
| Risk analysis | 164.308(a)(1)(ii)(A) | A formal risk assessment was conducted — not "we think about security" |
| Security training | 164.308(a)(5)(i) | An actual training program exists with records — not "we tell people to be careful" |
| Incident response | 164.308(a)(6)(i) | A documented procedure exists — not "we'd figure it out" |
| Contingency plan | 164.308(a)(7)(i) | Documented backup, disaster recovery, and emergency procedures — not just "we use AWS" |
| Termination procedures | 164.308(a)(3)(ii)(C) | Documented process to revoke access when someone leaves — not "we'd probably disable their account" |
| Workforce clearance | 164.308(a)(3)(i) | Defined process for granting/reviewing ePHI access levels |
| Password management | 164.308(a)(5)(ii)(D) | Enforced password policies (length, complexity, rotation) |
| BAAs with vendors | 164.314(a)(1) | Signed BAA on file for each vendor handling PHI |

**Beyond checklist — you also write vendors and risks:**

When the user mentions third-party services that handle PHI, add them as vendors:
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "AWS" --service "Cloud hosting" --baa-status signed --risk-tier high
\`\`\`

When you identify organizational risks from interview answers, add them:
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update risk add --description "Phishing risk — no MFA enforced" --likelihood 4 --impact 4 --treatment mitigate --owner "Security Officer"
\`\`\`

For vendors without BAAs, also create evidence gaps:
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" pending --gap "No BAA with Stripe"
\`\`\`

**Examples of good judgment:**

- User: "I'm the CTO and I handle security" → complete 164.308(a)(2) with note "CTO [name] is designated security officer"
- User: "We haven't really done a formal risk assessment" → pending 164.308(a)(1)(ii)(A) with gap "No formal risk analysis conducted"
- User: "We use AWS, Stripe, and Twilio for SMS" → add all three as vendors, check BAA status, add gaps for unsigned ones
- User: "We don't have a disaster recovery plan" → add risk (likelihood 3, impact 5, treatment mitigate) + pending 164.308(a)(7)(i)

${updateUsage}`,

    'hipaa-scan': `## Dashboard Updates

As you complete each scan check, update the dashboard based on your **interpretation** of the results. A grep match does NOT automatically mean a control is in place — you must read the code and understand whether the control is real.

**You write to: checklist, findings (MAIN SOURCE), vendors (detect clouds)**

**Principle:** You are an auditor, not a pattern matcher. \`grep -r "role"\` finding a variable called \`userRole\` in a React component is not the same as finding RBAC middleware protecting PHI endpoints. Read the context. Understand the intent. Then update.

**Reference — scan checks and their checklist IDs:**

| Check | Checklist ID | What "complete" actually means |
|-------|-------------|-------------------------------|
| CHECK 1-2: PHI identifiers | (informational) | These checks identify where PHI exists — they don't map to a pass/fail checklist item, but inform other checks |
| CHECK 3: PHI in logs | 164.312(b) | No PHI fields flowing into log output — not just "logging exists" |
| CHECK 5: RBAC | 164.312(a)(1) | Real role-based access control on PHI endpoints — not just a variable named \`role\` |
| CHECK 6: Audit logging | 164.312(b) | Audit trail recording who accessed what PHI when — not console.log debugging |
| CHECK 7: Encryption at rest | 164.312(a)(2)(iv) | ePHI encrypted with AES-256/KMS/pgcrypto — not just \`crypto\` imported for hashing tokens |
| CHECK 8: Session timeout | 164.312(a)(2)(iii) | Auto-logoff after inactivity (<=15 min for PHI systems) — not just a \`maxAge\` on a cookie |
| CHECK 9: Password hashing | 164.312(d) | bcrypt/argon2/scrypt actually used on user passwords — not just listed in package.json |
| CHECK 10: PHI in tests | (informational) | Real SSN patterns in test fixtures — flag but don't block |
| CHECK 11: PHI in errors | 164.312(a)(1) | Stack traces or error messages don't leak PHI to users |
| CHECK 12: IAM/permissions | 164.308(a)(4)(i) | Least-privilege IAM — no \`"Action": "*"\` on production policies |
| CHECK 13-16: DB security | 164.312(a)(1), 164.312(b) | DB columns with PHI have encryption, audit logging, and access controls |
| CHECK 17: DB SSL | 164.312(e)(2)(ii) | Database connections use SSL — \`sslmode=disable\` is a critical finding |
| CHECK 18: Push/email PHI | 164.312(a)(1) | PHI not exposed in push notifications or unencrypted email |
| CHECK 19: Secrets in config | 164.308(a)(5)(ii)(B) | No passwords/keys in committed config files; .env is gitignored |
| Unique user IDs | 164.312(a)(2)(i) | Auth system assigns unique identifiers (userId, email-based login) |
| Transmission security | 164.312(e)(1) | HTTPS enforced, TLS on all external connections |

**Cloud infrastructure checks:**

| Finding | Checklist ID | What "complete" means |
|---------|-------------|----------------------|
| CloudTrail / audit logs enabled | 164.312(b), 164.308(a)(1)(ii)(D) | Multi-region trail with log validation, actively logging |
| S3/storage encryption | 164.312(a)(2)(iv) | Default encryption on all buckets containing ePHI |
| VPC flow logs | 164.312(b) | Flow logs enabled on all VPCs — not just the default VPC |
| Cloud provider detected | 164.314(a)(1) | If AWS/GCP/Azure is in use, check for BAA evidence — add gap if missing |
| MFA enabled | 164.312(d) | MFA on all IAM users, especially root/admin |
| KMS key rotation | 164.312(a)(2)(iv) | Automatic key rotation enabled for encryption keys |

**Examples of good judgment:**

- grep finds \`bcrypt.hash(password)\` in \`src/auth/register.ts\` → **complete**: "Password hashing with bcrypt in src/auth/register.ts"
- grep finds \`bcrypt\` only in \`package.json\` dependencies → **NOT complete**: library installed but usage not verified — add gap
- grep finds \`auditLog.record({ userId, action, resourceId })\` on patient routes → **complete**: "PHI access audit trail in src/middleware/audit.ts"
- grep finds \`console.log('audit check')\` → **NOT complete**: debug logging is not an audit trail
- AWS CloudTrail exists but \`IsLogging: false\` → **NOT complete**: trail exists but isn't actively logging
- S3 bucket has encryption but \`PublicAccessBlock\` is not set → **partial**: encryption complete but access control needs work

**Evidence linking — connect checklist items to proof:**
When marking a checklist item complete or partial, always attach the relevant evidence file:
\`\`\`bash
${binDetect}
# Link scan evidence to checklist items when marking them
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.312(e)(1)" complete "TLS 1.2 verified" --evidence "scan-evidence/aws-tls-check.json"
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.312(b)" complete "CloudTrail active, multi-region" --evidence "scan-evidence/prowler-results.json"
\`\`\`
**Rule:** Every checklist item marked during scanning MUST include an \`--evidence\` reference to the scan output file that proves it. Use the evidence directory path from the Raw Evidence Preservation step.

**Findings — your main output:**
Every scan issue becomes a finding. Add them as you discover them:
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update finding add --title "S3 bucket has public ACL" --severity critical --requirement "164.312(a)(1)" --source scan
\`\`\`

**Vendor detection:**
If you detect AWS/GCP/Azure in use (from CLI checks or code imports), add as vendor if not already present:
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "AWS" --service "Cloud infrastructure" --baa-status pending --risk-tier high
\`\`\`

${updateUsage}`,

    'hipaa-remediate': `## Dashboard Updates

As you generate policy documents and apply code fixes, update the dashboard. Policy generation is straightforward — if you wrote the document, the control is documented. Code fixes require judgment — verify the fix actually addresses the finding.

**You write to: checklist (fixed items), findings (resolve), evidence (policies)**

**Principle:** Generating a policy document means the policy *exists as documentation*. It does NOT mean the organization is *following* it. Mark the documentation requirement as complete, but only mark the operational requirement as complete if you've verified the control is implemented in code/infrastructure.

**Reference — remediation outputs and their checklist IDs:**

| Remediation | Checklist ID | What to mark complete |
|-------------|-------------|----------------------|
| access-control.md generated | 164.308(a)(4)(i) | Access management policy documented |
| audit-logging.md generated | 164.312(b) | Audit control policy documented (operational check is separate) |
| encryption.md generated | 164.312(a)(2)(iv), 164.312(e)(2)(ii) | Encryption policy documented |
| incident-response.md generated | 164.308(a)(6)(i), 164.308(a)(6)(ii) | Incident response procedures documented |
| risk-assessment.md generated | 164.308(a)(1)(ii)(A) | Risk assessment procedure documented |
| workforce-security.md generated | 164.308(a)(3)(i) | Workforce security policy documented |
| contingency-plan.md generated | 164.308(a)(7)(i), 164.308(a)(7)(ii)(A) | Contingency and backup plan documented |
| baa-template.md generated | 164.314(a)(1) | BAA template available (still needs signing with each vendor) |
| Any policy generated | 164.316(a), 164.308(a)(1)(i) | Policies and procedures exist; security management process established |
| Code fix: added audit middleware | 164.312(b) | Audit controls implemented (not just documented) |
| Code fix: removed PHI from logs | 164.312(b) | PHI no longer exposed in log output |
| Code fix: added encryption | 164.312(a)(2)(iv) | Encryption implemented in code |
| Code fix: added session timeout | 164.312(a)(2)(iii) | Auto-logoff implemented |

**Examples of good judgment:**

- Generated access-control.md → complete 164.308(a)(4)(i) "Access management policy generated"
- Applied code fix adding RBAC middleware → complete 164.312(a)(1) "RBAC middleware added to PHI routes in src/middleware/auth.ts"
- Generated BAA template → complete 164.314(a)(1) ONLY if user confirms they'll sign it with vendors. Otherwise: note "BAA template generated — needs signing with [vendors]"

**Findings — resolve as you fix:**
After each successful remediation, resolve the corresponding finding:
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update finding resolve --title "RDS instance lacks encryption at rest"
\`\`\`

${updateUsage}`,

    'hipaa-report': `## Dashboard Updates

After generating reports, update the documentation and evaluation checklist items.

**Reference:**

| Report | Checklist ID | Update |
|--------|-------------|--------|
| Full compliance report | 164.316(b)(1) | Documentation requirement met |
| Executive summary | 164.316(b)(2)(ii) | Documentation available to responsible persons |
| Trust report | 164.308(a)(8) | Evaluation conducted and documented |
| Any report | 164.316(b)(2)(i) | Documentation retention initiated (6-year requirement) |

${updateUsage}`,

    'hipaa-monitor': `## Dashboard Checklist Updates

Monitor is unique — it can both **complete** and **un-check** items. If a control has drifted (code removed, config changed, permission widened), downgrade it back to pending with a gap.

**Principle:** Compliance is not permanent. A control that was in place last month may have been removed by a deploy this week. Your job is to re-verify and update honestly.

**Reference:**

| Finding | Action |
|---------|--------|
| Control still in place | Update note: "Re-verified [date]" |
| Control drifted/removed | **Downgrade to pending** with gap: "Drift detected: [description]" |
| New finding not in baseline | Add gap for the relevant checklist item |
| Finding resolved since baseline | Mark complete with note |

**Monitor itself satisfies:**
- 164.308(a)(1)(ii)(D) — Information system activity review (this IS the review)
- 164.316(b)(2)(iii) — Documentation updates (you're updating the compliance state)

${updateUsage}`,

    'hipaa-breach': `## Dashboard Checklist Updates

After documenting the breach response, update incident-related items based on how the response actually went.

**Principle:** A breach response is evidence that your incident procedures work (or don't). Update the dashboard based on what actually happened, not what the policy says should happen.

**Reference:**

| Outcome | Checklist ID | Update |
|---------|-------------|--------|
| Incident identified and documented | 164.308(a)(6)(i) | Security incident procedures followed |
| Response completed, notifications sent | 164.308(a)(6)(ii) | Response and reporting procedures work |
| Breach report saved | 164.308(a)(6)(ii) | Attach as evidence with --evidence flag |
| Response revealed gaps in procedures | 164.308(a)(6)(i) | Downgrade to pending if procedures failed |

${updateUsage}`,
  };

  // ─── New skills ──────────────────────────────────────────

  maps['hipaa-vendor'] = `## Dashboard Updates

As you discover vendors and confirm BAA status, update the dashboard in real time.

**Data types you write:**
- \`vendor add\` — for each discovered service
- \`checklist\` — 164.314(a)(1), 164.314(a)(2)(i), 164.308(b)(1) based on BAA coverage
- \`checklist ... --gap\` — for vendors missing BAAs

**Vendor detection → dashboard:**
After confirming each vendor's status, immediately update so the dashboard reflects progress:

\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "AWS" --service "Cloud infrastructure" --baa-status signed --risk-tier high --baa-expiry "2027-01-15"
\`\`\`

**BAA gaps:**
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" pending --gap "No BAA with Stripe"
\`\`\`

${updateUsage}`;

  maps['hipaa-risk'] = `## Dashboard Updates

As you identify and score risks with the user, update the dashboard in real time.

**Data types you write:**
- \`risk add\` — for each confirmed risk
- \`checklist\` — 164.308(a)(1)(ii)(A) Risk Analysis, 164.308(a)(1)(ii)(B) Risk Management

**After each confirmed risk:**
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update risk add --description "Unencrypted PHI at rest" --likelihood 4 --impact 5 --treatment mitigate --owner "Engineering" --requirement "164.312(a)(2)(iv)"
\`\`\`

**After completing the full assessment:**
\`\`\`bash
${binDetect}
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(a)(1)(ii)(A)" complete "Risk analysis completed — N risks identified"
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(a)(1)(ii)(B)" complete "Risk treatment plan established"
\`\`\`

${updateUsage}`;

  return maps[ctx.skillName] || '';
}

// ─── Resolver Registry ──────────────────────────────────────

type Resolver = (ctx: TemplateContext) => string;

const RESOLVERS: Record<string, Resolver> = {
  PREAMBLE: generatePreamble,
  COMPLIANCE_DASHBOARD: generateComplianceDashboard,
  TOOL_DETECTION: generateToolDetection,
  PHI_PATTERNS: generatePhiPatterns,
  EVIDENCE_COLLECTION: generateEvidenceCollection,
  AWS_CHECKS: generateAwsChecks,
  GCP_CHECKS: generateGcpChecks,
  AZURE_CHECKS: generateAzureChecks,
  IAC_POLICY_ENGINE: generateIacPolicyEngine,
  DASHBOARD_UPDATES: generateDashboardUpdates,
};

// ─── Template Processing ────────────────────────────────────

const GENERATED_HEADER = `<!-- AUTO-GENERATED from {{SOURCE}} — do not edit directly -->\n<!-- Regenerate: bun run gen:skill-docs -->\n`;

function processTemplate(tmplPath: string): { outputPath: string; content: string } {
  const tmplContent = fs.readFileSync(tmplPath, 'utf-8');
  const relTmplPath = path.relative(ROOT, tmplPath);
  const outputPath = tmplPath.replace(/\.tmpl$/, '');

  // Extract skill name from frontmatter
  const nameMatch = tmplContent.match(/^name:\s*(.+)$/m);
  const skillName = nameMatch ? nameMatch[1].trim() : path.basename(path.dirname(tmplPath));

  const framework = loadFrameworkForSkill(skillName);

  const ctx: TemplateContext = {
    skillName,
    tmplPath,
    binDir: '~/.claude/skills/em-dash/bin',
    localBinDir: '.claude/skills/em-dash/bin',
    policyDir: '~/.claude/skills/em-dash/policies',
    localPolicyDir: '.claude/skills/em-dash/policies',
    framework,
  };

  // Replace placeholders
  let content = tmplContent.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    const resolver = RESOLVERS[name];
    if (!resolver) throw new Error(`Unknown placeholder {{${name}}} in ${relTmplPath}`);
    return resolver(ctx);
  });

  // Check for unresolved placeholders
  const remaining = content.match(/\{\{(\w+)\}\}/g);
  if (remaining) {
    throw new Error(`Unresolved placeholders in ${relTmplPath}: ${remaining.join(', ')}`);
  }

  // Prepend generated header (after frontmatter)
  const header = GENERATED_HEADER.replace('{{SOURCE}}', path.basename(tmplPath));
  const fmStart = content.indexOf('---');
  const fmEnd = content.indexOf('---', fmStart + 3);
  if (fmEnd !== -1) {
    const insertAt = content.indexOf('\n', fmEnd) + 1;
    content = content.slice(0, insertAt) + header + content.slice(insertAt);
  } else {
    content = header + content;
  }

  return { outputPath, content };
}

// ─── Main ───────────────────────────────────────────────────

function findTemplates(): string[] {
  const templates: string[] = [];
  const skillsDir = path.join(ROOT, 'skills');

  if (!fs.existsSync(skillsDir)) return templates;

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const tmpl = path.join(skillsDir, entry.name, 'SKILL.md.tmpl');
    if (fs.existsSync(tmpl)) templates.push(tmpl);
  }
  return templates;
}

let hasChanges = false;

for (const tmplPath of findTemplates()) {
  const { outputPath, content } = processTemplate(tmplPath);
  const relOutput = path.relative(ROOT, outputPath);

  if (DRY_RUN) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';
    if (existing !== content) {
      console.log(`STALE: ${relOutput}`);
      hasChanges = true;
    } else {
      console.log(`FRESH: ${relOutput}`);
    }
  } else {
    fs.writeFileSync(outputPath, content);
    console.log(`GENERATED: ${relOutput}`);
  }
}

if (DRY_RUN && hasChanges) {
  console.error('\nGenerated SKILL.md files are stale. Run: bun run gen:skill-docs');
  process.exit(1);
}
