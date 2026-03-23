---
name: hipaa-report
version: 0.1.0
description: |
  Generate HIPAA compliance reports from assessment and scan data.
  Three formats: full compliance report (internal), executive summary
  (C-suite), and trust report (shareable with prospects/partners).
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections:
  - "164.308(a)(1)(ii)(D)"
  - "164.312"
risk_level: low
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

> **IMPORTANT:** This tool provides technical guidance for implementing HIPAA compliance
> controls. It is NOT legal advice and does not constitute HIPAA certification. HIPAA
> compliance is a legal determination that depends on your specific circumstances. Always
> consult qualified legal counsel and consider engaging a certified HIPAA auditor for
> formal compliance verification. This tool helps you implement and verify technical
> safeguards — it does not certify compliance.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current compliance phase (e.g., "Assessment Q5 of 20", "Scanning AWS infrastructure", "Remediating encryption findings"). (1-2 sentences)
2. **Simplify:** Explain the compliance requirement in plain English. No HIPAA regulation numbers in the question itself — reference them in a note below.
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
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-report" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="report"
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

After generating reports, update the documentation and evaluation checklist items.

**Reference:**

| Report | Checklist ID | Update |
|--------|-------------|--------|
| Full compliance report | 164.316(b)(1) | Documentation requirement met |
| Executive summary | 164.316(b)(2)(ii) | Documentation available to responsible persons |
| Trust report | 164.308(a)(8) | Evaluation conducted and documented |
| Any report | 164.316(b)(2)(i) | Documentation retention initiated (6-year requirement) |

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

# HIPAA Compliance Report Generator

You are running the `/hipaa-report` skill. Your job is to aggregate all prior compliance artifacts and generate polished, auditor-ready reports in the user's chosen format.

---

## Phase 1: Aggregate Artifacts

Read all prior compliance artifacts from the project directory.

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
PROJ_DIR="$HOME/.em-dash/projects/$SLUG"
echo "PROJECT: $SLUG"
echo "ARTIFACT_DIR: $PROJ_DIR"

echo ""
echo "=== Assessment Artifacts ==="
ls -lt "$PROJ_DIR"/*-assessment-*.md 2>/dev/null || echo "NONE"

echo ""
echo "=== Scan Artifacts ==="
ls -lt "$PROJ_DIR"/*-scan-*.md 2>/dev/null || echo "NONE"

echo ""
echo "=== Remediation Artifacts ==="
ls -lt "$PROJ_DIR"/*-remediation-*.md 2>/dev/null || echo "NONE"

echo ""
echo "=== Evidence Directory ==="
ls -lt "$PROJ_DIR"/evidence/ 2>/dev/null || echo "NONE"

echo ""
echo "=== Prior Reports ==="
ls -lt "$PROJ_DIR"/*-compliance-report-*.md "$PROJ_DIR"/*-executive-summary-*.md "$PROJ_DIR"/*-trust-report-*.md 2>/dev/null || echo "NONE"
```

Read the most recent artifact of each type (assessment, scan, remediation). These are the inputs for report generation. If no assessment or scan artifacts exist, stop and recommend:

- "No assessment artifacts found. Run `/hipaa-assess` first to complete a compliance interview."
- "No scan artifacts found. Run `/hipaa-scan` to perform automated technical scanning."

A report requires at minimum an assessment AND a scan. Remediation artifacts are optional but improve the report quality.

---

## Phase 2: Choose Report Format

Use AskUserQuestion to determine which reports to generate:

```
We have compliance artifacts ready for report generation. Which format do you need?

RECOMMENDATION: Choose D (all three) — the full report takes the most work, and
the executive summary and trust report are derivatives of it. Generating all three
costs almost nothing extra.

A) Full Compliance Report — internal, detailed, auditor-ready
B) Executive Summary — 1-page C-suite overview with compliance maturity rating
C) Trust Report — shareable with prospects/partners, verified controls checklist
D) All three
```

---

## Phase 3: Generate Full Compliance Report

Write the full compliance report to `~/.em-dash/projects/$SLUG/{user}-compliance-report-{datetime}.md` where `{user}` is derived from `whoami` and `{datetime}` is `YYYYMMDD-HHMMSS`.

The full compliance report must include these sections:

### 3a: Compliance Summary

A 3-5 paragraph executive overview covering:
- Organization name and scope of assessment
- Date range of assessment activities
- Overall compliance posture (percentage of controls satisfied)
- Key strengths and critical gaps

### 3b: Security Rule Compliance Table

A table with three subsections:

**Technical Safeguards (45 CFR 164.312):**

| Control | Requirement | Status | Evidence | Notes |
|---------|-------------|--------|----------|-------|
| Access Control | Unique user IDs, emergency access, auto-logoff, encryption | PASS/PARTIAL/FAIL | [reference] | |
| Audit Controls | Hardware/software/procedural mechanisms | PASS/PARTIAL/FAIL | [reference] | |
| Integrity Controls | ePHI alteration/destruction protection | PASS/PARTIAL/FAIL | [reference] | |
| Authentication | Person/entity identity verification | PASS/PARTIAL/FAIL | [reference] | |
| Transmission Security | Encryption, integrity controls for ePHI in transit | PASS/PARTIAL/FAIL | [reference] | |

**Administrative Safeguards (45 CFR 164.308):**

| Control | Requirement | Status | Evidence | Notes |
|---------|-------------|--------|----------|-------|
| Security Management | Risk analysis, risk management, sanctions, information system activity review | PASS/PARTIAL/FAIL | [reference] | |
| Assigned Security Responsibility | Designated security official | PASS/PARTIAL/FAIL | [reference] | |
| Workforce Security | Authorization, clearance, termination procedures | PASS/PARTIAL/FAIL | [reference] | |
| Security Awareness & Training | Reminders, malicious software, login monitoring, password management | PASS/PARTIAL/FAIL | [reference] | |
| Security Incident Procedures | Response and reporting | PASS/PARTIAL/FAIL | [reference] | |
| Contingency Plan | Data backup, disaster recovery, emergency mode operations | PASS/PARTIAL/FAIL | [reference] | |
| Evaluation | Periodic technical and nontechnical evaluation | PASS/PARTIAL/FAIL | [reference] | |
| BAA Management | Business associate contracts and arrangements | PASS/PARTIAL/FAIL | [reference] | |

**Physical Safeguards (45 CFR 164.310):**

| Control | Requirement | Status | Evidence | Notes |
|---------|-------------|--------|----------|-------|
| Facility Access Controls | Contingency operations, facility security plan, access control | PASS/PARTIAL/FAIL | [reference] | |
| Workstation Use | Policies and procedures for workstation use | PASS/PARTIAL/FAIL | [reference] | |
| Workstation Security | Physical safeguards for workstations | PASS/PARTIAL/FAIL | [reference] | |
| Device & Media Controls | Disposal, re-use, accountability, data backup | PASS/PARTIAL/FAIL | [reference] | |

Populate each row by cross-referencing the assessment and scan artifacts. Use scan evidence where available; note "self-reported" for assessment-only controls.

### 3c: Privacy Rule Compliance

Summarize Privacy Rule (45 CFR 164.500-534) compliance:
- Minimum Necessary standard adherence
- Notice of Privacy Practices
- Individual rights (access, amendment, accounting of disclosures)
- Uses and disclosures policies
- De-identification methods in use

### 3d: Breach Notification Compliance

Summarize Breach Notification Rule (45 CFR 164.400-414) readiness:
- Breach detection capabilities
- Notification procedures in place
- Documentation and logging practices
- Prior breach history (if any from artifacts)

### 3e: Evidence Index Table

| Evidence ID | Phase | Description | File Path | SHA-256 Hash | Date Collected |
|-------------|-------|-------------|-----------|--------------|----------------|

Populate from the evidence index JSONL file if it exists:

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
cat "$HOME/.em-dash/projects/$SLUG/evidence/evidence-index.jsonl" 2>/dev/null || echo "NO_EVIDENCE_INDEX"
```

### 3f: Open Findings Table

| Finding ID | Severity | Category | Description | Recommendation | Status |
|------------|----------|----------|-------------|----------------|--------|

List all findings from assessment and scan that remain open (not addressed in remediation artifacts). Sort by severity: CRITICAL > HIGH > MEDIUM > LOW.

### 3g: Corrective Action Plan

For each open finding, provide:
- Description of the gap
- Recommended corrective action
- Responsible party (suggest role, e.g., "Security Officer", "Engineering Lead")
- Target completion date (suggest reasonable timeframes: CRITICAL = 30 days, HIGH = 60 days, MEDIUM = 90 days, LOW = next review cycle)
- Priority ranking

### 3h: Append Disclaimer

Include the DISCLAIMER from the preamble at the end of the report.

---

## Phase 4: Generate Executive Summary

Write the executive summary to `~/.em-dash/projects/$SLUG/{user}-executive-summary-{datetime}.md`.

This is a 1-page document for C-suite stakeholders. It must include:

### 4a: Compliance Maturity Rating

Assign one of four maturity levels based on the full report findings:

- **INITIAL** — Ad-hoc compliance efforts. Multiple critical gaps. No formal policies. (Typically <40% controls satisfied)
- **DEVELOPING** — Some policies in place. Technical controls partially implemented. Active remediation underway. (40-70% controls satisfied)
- **ESTABLISHED** — Formal compliance program. Most controls implemented. Regular assessments. (70-90% controls satisfied)
- **ADVANCED** — Mature compliance program. Continuous monitoring. Industry best practices. (>90% controls satisfied)

### 4b: Key Metrics

Display as a compact dashboard:

```
Compliance Score:     [X]% ([maturity level])
Controls Assessed:   [N] total
Controls Passing:    [N] ([X]%)
Controls Partial:    [N] ([X]%)
Controls Failing:    [N] ([X]%)
Critical Findings:   [N] open
High Findings:       [N] open
Assessment Date:     [date]
```

### 4c: Risk Posture

A 2-3 sentence summary of the organization's overall HIPAA risk posture — the single most important takeaway for leadership.

### 4d: Next Audit Date Recommendation

Based on maturity level:
- INITIAL: Re-assess in 30 days after remediation
- DEVELOPING: Re-assess in 60 days
- ESTABLISHED: Re-assess in 90 days
- ADVANCED: Re-assess in 180 days (or per regulatory schedule)

### 4e: Append Disclaimer

Include the DISCLAIMER from the preamble.

---

## Phase 5: Generate Trust Report

Write the trust report to `~/.em-dash/projects/$SLUG/{user}-trust-report-{datetime}.md`.

This document is designed to be shared externally with prospects, partners, and customers. It demonstrates compliance without exposing internal details.

### 5a: Header

```
HIPAA COMPLIANCE TRUST REPORT
Organization: [name from assessment]
Report Date:  [date]
Report ID:    [generated UUID or timestamp-based ID]
```

### 5b: Verified Controls Checklist

| Control Category | Control | Verification Method | Status | Last Verified |
|-----------------|---------|-------------------|--------|---------------|
| Access Control | Unique user identification | Automated scan | VERIFIED | [date] |
| Access Control | Automatic logoff | Automated scan | VERIFIED | [date] |
| Encryption | Data at rest | Automated scan | VERIFIED | [date] |
| Encryption | Data in transit | Automated scan | VERIFIED | [date] |
| Audit Logging | System activity recording | Automated scan | VERIFIED | [date] |
| ... | ... | ... | ... | ... |

Only include controls with status VERIFIED (PASS from full report). Do NOT expose failing or partial controls in the trust report — those are internal.

Verification methods: "Automated scan", "Configuration review", "Policy review", "Self-reported" (descending trustworthiness).

### 5c: Scan Summary

```
Last Technical Scan:  [date]
Tools Used:           [Prowler, Lynis, Trivy — whatever was detected]
Scope:                [infrastructure, codebase, containers — whatever was scanned]
```

### 5d: Aggregate Evidence Hash

Generate a single aggregate hash covering all evidence files to prove integrity:

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
EVIDENCE_DIR="$HOME/.em-dash/projects/$SLUG/evidence"
if [ -d "$EVIDENCE_DIR" ]; then
  _EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
  "$_EMDASH_BIN"/hipaa-evidence-hash "$EVIDENCE_DIR"
  echo ""
  echo "AGGREGATE_HASH:"
  cat "$EVIDENCE_DIR/evidence-manifest.sha256" 2>/dev/null | sha256sum | cut -d' ' -f1
else
  echo "NO_EVIDENCE_DIRECTORY"
fi
```

Include the aggregate hash in the trust report so recipients can request verification.

### 5e: Append Disclaimer

Include the DISCLAIMER from the preamble. Additionally, append:

> This trust report represents a point-in-time assessment. HIPAA compliance requires
> ongoing monitoring and periodic reassessment. The aggregate evidence hash can be
> used to verify that underlying evidence has not been modified since this report
> was generated.

---

## Phase 6: Log and Recommend

### 6a: Log the review

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
REPORT_COUNT=$(ls "$HOME/.em-dash/projects/$SLUG"/*-compliance-report-*.md "$HOME/.em-dash/projects/$SLUG"/*-executive-summary-*.md "$HOME/.em-dash/projects/$SLUG"/*-trust-report-*.md 2>/dev/null | wc -l | tr -d ' ')
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-report" "complete" "$REPORT_COUNT"
```

### 6b: Display compliance dashboard

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log dashboard "$SLUG"
```

### 6c: Recommend next steps

Based on the report findings:

1. If there are open CRITICAL or HIGH findings: "You have [N] critical/high findings still open. Run `/hipaa-remediate` to address them, then regenerate the report."
2. If all controls are passing: "All controls verified. Run `/hipaa-monitor` to set up ongoing compliance drift detection."
3. In all cases: "Run `/hipaa-monitor` periodically to detect compliance drift and maintain your compliance posture."

---

## Important Rules

- **Never fabricate evidence.** If a control was not assessed or scanned, mark it "NOT ASSESSED" — never infer PASS.
- **Trust reports must never expose failures.** Only verified/passing controls appear in the trust report. Internal gaps stay in the full report.
- **Every report includes the DISCLAIMER.** This tool does not certify compliance.
- **One question at a time** via AskUserQuestion. Never batch multiple questions.
- **Each bash block is self-contained.** Re-derive SLUG and paths in every block.
- **Completion status:**
  - DONE — All requested reports generated successfully
  - DONE_WITH_CONCERNS — Reports generated but critical findings remain unaddressed
  - BLOCKED — Insufficient artifacts to generate a meaningful report
  - NEEDS_CONTEXT — Missing assessment or scan data; recommend running prerequisite skills
