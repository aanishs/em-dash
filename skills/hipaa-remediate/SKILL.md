---
name: hipaa-remediate
version: 0.1.0
description: |
  Fix HIPAA compliance findings from assessment and scan reports. Generates
  infrastructure fixes (Terraform/CloudFormation), code fixes (PHI removal),
  policy documents, and evidence for each remediation.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections:
  - "164.312(a)(1)"
  - "164.312(a)(2)(iv)"
  - "164.312(b)"
  - "164.312(e)(1)"
risk_level: high
requires_prior: [hipaa-scan]
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
mkdir -p ~/.em-dash/sessions
touch ~/.em-dash/sessions/"$PPID"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
# Detect bin directory (global install or project-level install)
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
echo "SLUG: ${SLUG:-unknown}"
mkdir -p ~/.em-dash/projects/"${SLUG:-unknown}"
_TOOLS=$("$_EMDASH_BIN"/hipaa-tool-detect 2>/dev/null || true)
echo "$_TOOLS"
# Check for updates
"$_EMDASH_BIN"/../bin/emdash-update-check 2>/dev/null || true
```

Note: each bash block runs in a separate shell. To use bin utilities in later blocks, re-detect the path:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
```

## Update Check

If the preamble printed `UPGRADE_AVAILABLE <current> <latest>`, inform the user:

> A newer version of em-dash is available (current → latest).
> Run `cd ~/.claude/skills/em-dash && git pull && bun run build` to upgrade.

If `JUST_UPGRADED` was printed, note it and continue. Otherwise, skip this section silently.

## DISCLAIMER — Not Legal Advice

> **IMPORTANT:** This provides technical guidance for implementing HIPAA compliance controls. It is NOT legal advice and does not constitute HIPAA certification. Consult qualified legal counsel and consider engaging a certified HIPAA auditor for formal compliance verification.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current compliance phase (e.g., "Assessment Q5 of 20", "Scanning AWS infrastructure", "Remediating encryption findings"). (1-2 sentences)
2. **Simplify:** Explain the compliance requirement in plain English. No HIPAA Security Rule regulation numbers in the question itself — reference them in a note below.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]`
4. **Options:** Lettered options: `A) ... B) ... C) ...`

When an option involves effort, show both scales: `(human: ~X / CC: ~Y)`

## Compliance Completeness Principle

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
complete thing. Every time. Compliance is not the place for "good enough."

## Contributor Mode

If this skill is running from a development checkout (symlink at `.claude/skills/em-dash`
pointing to a working directory), you are in **contributor mode**. Be aware that:
- Template changes + `bun run gen:skill-docs` immediately affect all em-dash invocations
- Run `bun test` before committing to verify skill integrity
- Breaking changes to .tmpl files can break concurrent sessions

## Completion Status Protocol

When the skill completes, report one of:
- **DONE** — All phases completed successfully. Compliance status reported.
- **DONE_WITH_CONCERNS** — Completed, but critical findings remain unaddressed.
- **BLOCKED** — Cannot proceed without additional information or access.
- **NEEDS_CONTEXT** — Insufficient information to assess. Ask the user to provide more.

## Evidence Collection

When collecting evidence, always:
1. Write raw tool output to `~/.em-dash/projects/$SLUG/evidence/{phase}-{datetime}/`
2. Hash evidence files: `_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin) && "$_EMDASH_BIN"/hipaa-evidence-hash <evidence-directory>`
3. Never store actual PHI — only configuration states, scan results, and metadata

## Review Logging

After completing a skill, log the outcome:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-remediate" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="remediate"
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
    fs.writeFileSync('.em-dash/dashboard.json', JSON.stringify(d, null, 2) + '\\n');
  " 2>/dev/null || true
fi
```

**Checklist updates** are handled inline by each skill as it discovers findings — not here. Use `hipaa-dashboard-update` to update individual checklist items based on actual results:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
# Mark a checklist item as complete with a note:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.312(a)(1)" complete "RBAC found in src/auth.ts"
# Mark as pending with an evidence gap:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.312(b)" pending --gap "No audit logging found"
# Add evidence file to an item:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.314(a)(1)" complete --evidence "baa-aws.pdf"
```

## Dashboard Updates

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
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update finding resolve --title "RDS instance lacks encryption at rest"
```

**How to update the dashboard:**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
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
```

# /hipaa-remediate: HIPAA Compliance Remediation

You are running the `/hipaa-remediate` skill. Fix HIPAA compliance findings from prior assessment and scan reports. For each finding: apply the fix, collect evidence, and track progress. Ask one question at a time. Never apply destructive changes without user confirmation.

---

## Phase 1: Load Prior Findings

Read the most recent assessment and scan reports for this project:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
PROJ_DIR="$HOME/.em-dash/projects/${SLUG:-unknown}"
echo "PROJECT_DIR: $PROJ_DIR"

# Most recent assessment
ls -t "$PROJ_DIR"/*-assessment-*.md 2>/dev/null | head -1

# Most recent scan
ls -t "$PROJ_DIR"/*-scan-*.md 2>/dev/null | head -1

# Most recent remediation (if resuming)
ls -t "$PROJ_DIR"/*-remediation-*.md 2>/dev/null | head -1
```

Read both the assessment and scan reports. Extract all findings into a unified list.

**Build a prioritized findings list** sorted by:
1. CRITICAL findings first (immediate risk of PHI exposure or breach)
2. HIGH findings (significant compliance gaps)
3. MEDIUM findings (partial controls, improvement needed)
4. LOW findings (minor gaps, best practices)

If a prior remediation report exists, cross-reference it to identify which findings have already been addressed. Skip those and note: "N findings previously remediated — focusing on M remaining."

**If no prior reports are found,** use AskUserQuestion:

```
No prior assessment or scan reports found for this project.

RECOMMENDATION: Choose A — the assessment provides the compliance context needed for effective remediation.

A) Run /hipaa-assess first — structured interview to understand your compliance posture
B) Enter findings manually — describe what you need to fix
C) Scan first — run /hipaa-scan for automated technical findings
```

---

## Phase 2: Triage and Prioritize

Present the unified findings list to the user as a numbered, prioritized summary:

```
FINDINGS TRIAGE
====================================
CRITICAL (fix immediately):
  1. [SCAN-001] PHI logged in plaintext — app/services/patient_service.ts:42
  2. [SCAN-005] CloudTrail disabled — no audit trail for PHI access
  3. [ASSESS-012] No encryption at rest for patient database

HIGH (fix soon):
  4. [SCAN-008] S3 bucket without encryption — patient-uploads
  5. [ASSESS-019] No access control policy documented
  6. [SCAN-011] Secrets in environment file committed to repo

MEDIUM (address within 30 days):
  7. [ASSESS-025] Incident response plan not documented
  8. [SCAN-015] TLS 1.0 still accepted on API endpoint

LOW (address within 90 days):
  9. [ASSESS-030] Employee training records not tracked
 10. [ASSESS-033] BAA template not customized
====================================
Total: N findings (X critical, Y high, Z medium, W low)
```

Then use AskUserQuestion to determine the remediation approach:

```
How would you like to proceed with remediation?

RECOMMENDATION: Choose A for the fastest path to compliance — auto-fixable items are applied with your review, manual items get checklists.

A) Fix all auto-fixable items (review each before applying) + generate checklists for manual items
B) Work sequentially from highest priority — one finding at a time
C) Choose specific findings to fix now (enter numbers, e.g., "1,2,5,8")
```

**Group findings by remediation type** for efficient processing:

| Type | Examples | How fixed |
|------|----------|-----------|
| Infrastructure fixes | Enable encryption, configure logging, enforce MFA | Terraform/CloudFormation/CLI commands |
| Code fixes | PHI in logs, missing encryption, exposed secrets | Edit tool — code changes |
| Policy generation | Access control policy, incident response plan | Templates customized for the org |
| Manual items | BAA signing, employee training, physical security | Checklists with deadlines |

---

## Phase 3: Infrastructure Remediation

For each infrastructure finding, follow this workflow:

### Step 1: Detect IaC

```bash
ls *.tf terraform/ 2>/dev/null && echo "IAC_TERRAFORM=true" || echo "IAC_TERRAFORM=false"
ls cloudformation/ cfn/ *.template *.yaml 2>/dev/null | grep -i cloud && echo "IAC_CFN=true" || echo "IAC_CFN=false"
ls cdk/ 2>/dev/null && echo "IAC_CDK=true" || echo "IAC_CDK=false"
```

### Step 2: Generate the fix

**If Terraform exists:** Generate a `.tf` fix or modify the existing Terraform resource. For example, to enable S3 bucket encryption:

```hcl
resource "aws_s3_bucket_server_side_encryption_configuration" "patient_uploads" {
  bucket = aws_s3_bucket.patient_uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}
```

**If CloudFormation exists:** Generate the equivalent CloudFormation resource update.

**If no IaC:** Generate AWS CLI commands to apply the fix directly:

```bash
aws s3api put-bucket-encryption --bucket <bucket-name> --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
```

### Step 3: Show the user what will change

Before applying any infrastructure change, use AskUserQuestion:

```
Finding: [SCAN-004] S3 bucket 'patient-uploads' has no encryption at rest
HIPAA Requirement: 164.312(a)(2)(iv) — Encryption and Decryption

Proposed fix: Enable AWS KMS server-side encryption on the bucket.

[Show the Terraform diff or CLI command]

RECOMMENDATION: Choose A — this is a standard encryption fix with no data loss risk.

A) Apply this fix
B) Skip — I'll handle this manually
C) Modify — I want a different approach
```

### Step 4: Apply and collect evidence

If the user approves, apply the fix. Then collect before/after evidence:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
_EVIDENCE_DIR=~/.em-dash/projects/${SLUG:-unknown}/evidence/infra-$(date +%Y%m%d-%H%M%S)
mkdir -p "$_EVIDENCE_DIR"
```

Save the before state, the fix applied, and the after state to the evidence directory. Hash the evidence for integrity.

### Common Infrastructure Fixes

Apply these patterns based on the finding type:

- **Enable CloudTrail:** Create a multi-region trail with S3 logging and log file validation
- **Enable encryption at rest:** KMS encryption for S3, RDS, EBS, DynamoDB
- **Enforce MFA:** IAM policy requiring MFA for console access and sensitive API operations
- **Configure VPC Flow Logs:** Enable flow logs to CloudWatch or S3 for network audit trail
- **Enable access logging:** S3 access logging, ALB access logs, API Gateway logging
- **Restrict security groups:** Remove overly permissive inbound rules (0.0.0.0/0)

---

## Phase 4: Code Remediation

For each code finding (PHI exposure, missing encryption, access control gaps):

### Step 1: Read the offending file

Read the full file to understand the context — not just the flagged line. Understand the data flow: where does PHI enter, how is it processed, where does it go?

### Step 2: Apply the fix

Use the Edit tool to make targeted changes. Common code fixes:

**Remove PHI from log output:**
```
# Before
logger.info("Processing patient: #{patient.name}, SSN: #{patient.ssn}")

# After
logger.info("Processing patient: #{patient.id}")
```

**Add field-level encryption:**
```
# Before
patient.diagnosis = params[:diagnosis]

# After
patient.diagnosis = EncryptionService.encrypt(params[:diagnosis])
```

**Redact PHI in error messages:**
```
# Before
raise "Invalid patient data: #{patient.inspect}"

# After
raise "Invalid patient data for patient_id=#{patient.id}"
```

**Remove PHI from client-side storage:**
```
# Before
localStorage.setItem('patientData', JSON.stringify(patient))

# After
localStorage.setItem('patientSession', JSON.stringify({ id: patient.id, expiresAt: session.expiresAt }))
```

### Step 3: Suggest a regression test

After each code fix, suggest a test that would catch a future regression. For example:

```
Suggested test: Verify that log output for patient processing does not contain
patient name, SSN, or other PHI identifiers. Grep test log output for PHI patterns
after running the patient processing flow.
```

### Step 4: Collect evidence

```bash
git diff -- <fixed-file> 2>/dev/null
```

Save the diff output to the evidence directory. This proves the remediation was applied.

---

## Phase 5: Policy Generation

For each missing policy identified in the assessment:

### Step 1: Check for existing templates

```bash
ls ~/.claude/skills/em-dash/templates/policies/ 2>/dev/null
```

### Step 2: Customize the template

Read the template and customize it with organization details gathered from the assessment report. Key details to fill in:
- Organization name and type
- Types of PHI handled
- Systems and services used
- Team size and structure
- Existing security controls

### Step 3: Present for review

Use AskUserQuestion to present the draft policy:

```
Generated policy: [Policy Name]
HIPAA Requirement: [requirement ID and description]

I've drafted a [policy type] policy based on your assessment. Key sections:

1. [Section overview]
2. [Section overview]
3. [Section overview]

RECOMMENDATION: Choose A to review the full document, then we'll finalize it.

A) Show me the full policy — I'll review and approve
B) Write it directly — I trust the template
C) Skip this policy for now
```

### Step 4: Write the policy

Write the finalized policy to the project's policies directory:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
mkdir -p ~/.em-dash/projects/${SLUG:-unknown}/policies
```

### Available Policy Templates

Generate policies for any of these areas when findings indicate they are missing:

| Policy | HIPAA Section | Purpose |
|--------|--------------|---------|
| Access Control | 164.312(a) | Who can access PHI, how access is granted/revoked |
| Audit Logging | 164.312(b) | What is logged, retention period, review process |
| Encryption | 164.312(a)(2)(iv), 164.312(e) | Encryption standards for data at rest and in transit |
| Incident Response | 164.308(a)(6) | How breaches are detected, assessed, reported |
| Risk Assessment | 164.308(a)(1)(ii)(A) | Annual risk assessment methodology and findings |
| Workforce Security | 164.308(a)(3) | Employee onboarding/offboarding, access provisioning |
| Contingency Plan | 164.308(a)(7) | Backup, disaster recovery, emergency mode operations |
| BAA Template | 164.308(b) | Business Associate Agreement for third-party vendors |

---

## Phase 6: Manual Remediation Checklist

For items that require human action (cannot be automated):

### Generate a checklist with deadlines

```
MANUAL REMEDIATION CHECKLIST
============================================
Due dates based on severity:
  CRITICAL → within 7 days
  HIGH → within 30 days
  MEDIUM → within 60 days
  LOW → within 90 days

[ ] BAA signed with [vendor name] — due [date]
    Template: ~/.em-dash/projects/$SLUG/policies/baa-template.md
    Action: Legal review → countersign → file copy

[ ] Security awareness training completed — due [date]
    Action: All workforce members with PHI access must complete training
    Evidence needed: Training completion records with dates

[ ] Physical security controls verified — due [date]
    Action: Verify workstation locks, screen timeouts, secure disposal
    Evidence needed: Photo documentation or security walk checklist

[ ] Risk assessment reviewed by management — due [date]
    Action: Management review and sign-off on risk assessment report
    Evidence needed: Signed risk assessment with date
============================================
```

### Track completion

For each manual item, use AskUserQuestion one at a time to track progress:

```
Manual item: [description]
Due: [date]

Has this been completed?

A) Yes — completed on [date]
B) In progress — expected completion [date]
C) Not started — remind me later
D) Not applicable — explain why
```

Record the response in the remediation report for evidence purposes.

---

## Phase 7: Evidence Collection & Report

## Evidence Collection Protocol

For each finding that is remediated, collect evidence:

```bash
_EVIDENCE_DIR=~/.em-dash/projects/$SLUG/evidence/${_PHASE:-general}-$(date +%Y%m%d-%H%M%S)
mkdir -p "$_EVIDENCE_DIR"
```

**Evidence types by source:**
- **Infrastructure scans:** Save raw JSON output from Prowler/Lynis/Trivy
- **Code fixes:** Save git diff of the remediation commit
- **Policy documents:** Save the generated policy document
- **Configuration checks:** Save CLI output showing compliant state
- **Manual verification:** Note the user's confirmation of physical/admin controls

**After collecting evidence, hash for integrity:**
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin) && "$_EMDASH_BIN"/hipaa-evidence-hash "$_EVIDENCE_DIR"
```

**Evidence index:** Append to master index:
```bash
echo '{"evidence_id":"EVD-'$(date +%s)'","phase":"'${_PHASE}'","path":"'$_EVIDENCE_DIR'","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.em-dash/projects/$SLUG/evidence/evidence-index.jsonl
```

**Compile all evidence from the remediation session into a structured report.**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
_USER=$(whoami 2>/dev/null || echo "unknown")
_DATETIME=$(date +%Y%m%d-%H%M%S)
_REPORT_PATH="$HOME/.em-dash/projects/${SLUG:-unknown}/${_USER}-remediation-${_DATETIME}.md"
echo "REPORT_PATH: $_REPORT_PATH"
```

Write the remediation report with this structure:

```markdown
# HIPAA Remediation Report
**Project:** [project name]
**Date:** [date]
**Auditor:** [username]

## Remediation Summary

| Category | Total | Fixed | Skipped | Manual Pending |
|----------|-------|-------|---------|----------------|
| Infrastructure | N | N | N | N |
| Code | N | N | N | N |
| Policy | N | N | N | N |
| Manual | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

## Remediation Details

### Infrastructure Fixes Applied
[For each fix:
- Finding ID and description
- HIPAA requirement addressed
- What was changed (before → after)
- Evidence reference]

### Code Fixes Applied
[For each fix:
- Finding ID and description
- File:line reference
- Git diff summary
- Regression test suggested/created
- Evidence reference]

### Policies Generated
[For each policy:
- Policy name
- HIPAA requirement addressed
- Location: ~/.em-dash/projects/$SLUG/policies/[name].md
- Review status (approved/pending)]

### Manual Items Pending
[For each manual item:
- Description
- Assigned to / responsible party
- Due date
- Current status
- Template/guidance provided]

## Remaining Findings

[List any findings that were not addressed in this session, with reason:
- Skipped by user
- Requires additional access/information
- Deferred to next remediation cycle]

## Evidence Archive

Evidence directory: ~/.em-dash/projects/$SLUG/evidence/
Evidence manifest: [path to manifest]
Manifest hash: [SHA-256]

## Compliance Posture Change

Before remediation: N critical, N high, N medium, N low findings
After remediation: N critical, N high, N medium, N low findings
Reduction: N findings addressed (X%)

## Next Step

Run `/hipaa-report` to generate a formal HIPAA compliance report suitable
for auditors, business partners, and internal stakeholders.
```

**Log the review:**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
"$_EMDASH_BIN"/hipaa-review-log write "${SLUG:-unknown}" "hipaa-remediate" "<STATUS>" <FINDINGS_COUNT>
```

Substitute STATUS with "clean" (all findings addressed), "issues_found" (some findings remain), or "critical" (critical findings still unaddressed). Substitute FINDINGS_COUNT with the number of remaining unaddressed findings.

---

## Important Rules

- **Ask one question at a time.** Do not batch multiple unrelated questions. Each remediation decision deserves the user's full attention.
- **Never apply destructive changes without user confirmation.** Infrastructure changes, data migrations, and security policy changes all require explicit approval via AskUserQuestion.
- **Show before applying.** For every fix, show the user what will change before making the change. Use terraform plan output, git diff previews, or clear descriptions.
- **Collect evidence for every remediation.** A fix without evidence is invisible to auditors. Every change should have a before state, the action taken, and an after state.
- **Never store actual PHI in evidence.** Evidence files contain configuration states, scan results, diffs, and metadata. If a code fix involves PHI, the evidence shows the diff (which removes the PHI), not the PHI itself.
- **Preserve existing controls.** When fixing one finding, verify that the fix does not break an existing security control. For example, enabling encryption should not disable access logging.
- **Recommend /hipaa-report as the next step** at the end of every remediation session.
