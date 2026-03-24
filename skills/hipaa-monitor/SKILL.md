---
name: hipaa-monitor
version: 0.1.0
description: |
  Check for HIPAA compliance drift since the last audit. Re-scans
  infrastructure and code, compares against baseline, reports new findings,
  resolved findings, and compliance score trends.
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections:
  - "164.308(a)(1)(ii)(D)"
  - "164.308(a)(8)"
  - "164.312(b)"
risk_level: medium
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
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-monitor" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="monitor"
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

## Dashboard Checklist Updates

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

## Tool Detection

Run tool detection to understand what's available:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-tool-detect
```

**Interpret the results:**
- If `CLOUD_AWS=true` and `TOOL_PROWLER=true`: Full automated AWS HIPAA scanning available (83 checks)
- If `CLOUD_AWS=true` but `TOOL_PROWLER=false`: Offer to install Prowler or fall back to AWS CLI spot checks
- If `TOOL_LYNIS=true`: System-level security auditing available
- If `TOOL_TRIVY=true`: Container and code vulnerability scanning available
- If no scanning tools: Fall back to guided manual assessment with CLI commands

**Tier assignment:**
- **Tier 1 (fully automated):** Prowler + at least one of Lynis/Trivy
- **Tier 2 (partial):** Any scanning tool available
- **Tier 3 (guided manual):** No scanning tools — provide CLI commands for user to run

# HIPAA Compliance Drift Detection

You are running the `/hipaa-monitor` skill. Your job is to detect compliance drift by re-scanning infrastructure and code, then comparing results against the most recent baseline.

---

## Phase 1: Load Baseline

Find and read the most recent compliance report and scan results.

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
PROJ_DIR="$HOME/.em-dash/projects/$SLUG"
echo "PROJECT: $SLUG"
echo "ARTIFACT_DIR: $PROJ_DIR"

echo ""
echo "=== Most Recent Compliance Report ==="
ls -t "$PROJ_DIR"/*-compliance-report-*.md 2>/dev/null | head -1 || echo "NONE"

echo ""
echo "=== Most Recent Scan Results ==="
ls -t "$PROJ_DIR"/*-scan-*.md 2>/dev/null | head -1 || echo "NONE"

echo ""
echo "=== Most Recent Drift Report ==="
ls -t "$PROJ_DIR"/*-drift-*.md 2>/dev/null | head -1 || echo "NONE"

echo ""
echo "=== Compliance Review History ==="
"$_EMDASH_BIN"/hipaa-review-log read "$SLUG" 2>/dev/null | tail -10 || echo "NO_HISTORY"
```

Read the most recent compliance report and scan results. These form the baseline for drift comparison.

**If no compliance report and no scan results exist:** Stop and recommend:

"No baseline found for this project. Run `/hipaa-assess` and `/hipaa-scan` first to establish a compliance baseline, then `/hipaa-report` to generate your first compliance report. Drift detection requires a baseline to compare against."

**If scan results exist but no compliance report:** Note that the baseline is scan-only and continue — scan results are sufficient for technical drift detection.

---

## Phase 2: Re-scan

Run the same scans that `/hipaa-scan` performs against the current state. Adapt based on the tools detected in the preamble.

### 2a: Infrastructure Scanning

**If Prowler is available (TOOL_PROWLER=true):**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
EVIDENCE_DIR="$HOME/.em-dash/projects/$SLUG/evidence/monitor-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"
echo "EVIDENCE_DIR: $EVIDENCE_DIR"

# Run Prowler HIPAA checks
prowler aws --compliance hipaa --output-formats json --output-directory "$EVIDENCE_DIR" 2>&1 | tail -20
```

**If Prowler is not available but AWS CLI is (CLOUD_AWS=true):** Fall back to targeted AWS CLI spot checks:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
EVIDENCE_DIR="$HOME/.em-dash/projects/$SLUG/evidence/monitor-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# S3 bucket encryption
aws s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null | tr '\t' '\n' | while read bucket; do
  echo "BUCKET: $bucket"
  aws s3api get-bucket-encryption --bucket "$bucket" 2>/dev/null || echo "  NO_ENCRYPTION"
done > "$EVIDENCE_DIR/s3-encryption.txt"

# CloudTrail status
aws cloudtrail describe-trails --query 'trailList[].{Name:Name,IsMultiRegion:IsMultiRegionTrail,IsLogging:true}' --output table 2>/dev/null > "$EVIDENCE_DIR/cloudtrail.txt" || echo "CLOUDTRAIL_CHECK_FAILED"

# RDS encryption
aws rds describe-db-instances --query 'DBInstances[].{ID:DBInstanceIdentifier,Encrypted:StorageEncrypted,Engine:Engine}' --output table 2>/dev/null > "$EVIDENCE_DIR/rds-encryption.txt" || echo "RDS_CHECK_FAILED"

echo "Spot checks complete — results in $EVIDENCE_DIR"
```

**If no cloud CLI is available:** Skip infrastructure scanning and note: "No cloud CLI detected. Infrastructure drift detection skipped — only code-level scanning will be performed."

### 2b: System Security Scanning

**If Lynis is available (TOOL_LYNIS=true):**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
EVIDENCE_DIR="$HOME/.em-dash/projects/$SLUG/evidence/monitor-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

sudo lynis audit system --quick --no-colors 2>&1 | tee "$EVIDENCE_DIR/lynis-output.txt" | grep -E "warning|suggestion|hardening" | tail -30
```

**If Lynis is not available:** Skip and note: "Lynis not available. System-level security drift detection skipped."

### 2c: Container and Dependency Scanning

**If Trivy is available (TOOL_TRIVY=true):**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
EVIDENCE_DIR="$HOME/.em-dash/projects/$SLUG/evidence/monitor-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# Scan filesystem for vulnerabilities
trivy fs --severity HIGH,CRITICAL --format json --output "$EVIDENCE_DIR/trivy-fs.json" . 2>&1 | tail -10

# Scan container images if Docker is available
if command -v docker >/dev/null 2>&1; then
  docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | head -10 | while read img; do
    echo "Scanning image: $img"
    trivy image --severity HIGH,CRITICAL "$img" 2>&1 | tail -5
  done > "$EVIDENCE_DIR/trivy-images.txt"
fi
```

**If Trivy is not available:** Skip and note: "Trivy not available. Container and dependency vulnerability drift detection skipped."

### 2d: Code-Level Security & PHI Scanning

Always run code-level scanning regardless of tool availability — this uses only grep. Run the same comprehensive checks as `/hipaa-scan` Phase 5.

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
EVIDENCE_DIR="$HOME/.em-dash/projects/$SLUG/evidence/monitor-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

echo "=== CHECK 3: PHI in Logs ==="
grep -rn "console\.\(log\|warn\|error\|debug\).*\(patient\|ssn\|mrn\|diagnosis\|medical\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules . 2>/dev/null | head -50 | tee "$EVIDENCE_DIR/phi-in-logs.txt"

echo ""
echo "=== CHECK 4: PHI in Browser Storage ==="
grep -rn "localStorage\.\(setItem\|getItem\).*\(patient\|ssn\|mrn\|health\|medical\)" --include="*.ts" --include="*.js" --include="*.tsx" --exclude-dir=node_modules . 2>/dev/null | head -30 | tee "$EVIDENCE_DIR/phi-in-browser.txt"
grep -rn "sessionStorage\.\(setItem\|getItem\).*\(patient\|ssn\|mrn\|health\)" --include="*.ts" --include="*.js" --include="*.tsx" --exclude-dir=node_modules . 2>/dev/null | head -30 >> "$EVIDENCE_DIR/phi-in-browser.txt"

echo ""
echo "=== CHECK 4: PHI in URLs ==="
grep -rn "\(searchParams\|URLSearchParams\|req\.query\|req\.params\).*\(patient\|ssn\|mrn\|diagnosis\)" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . 2>/dev/null | head -30 | tee "$EVIDENCE_DIR/phi-in-urls.txt"

echo ""
echo "=== CHECK 5: RBAC/Authorization Check ==="
RBAC_FILES=$(grep -rln "\(role\|permission\|authorize\|hasRole\|hasPermission\|checkAccess\|requireRole\|guard\|@Roles\|@Authorize\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --exclude-dir=node_modules . 2>/dev/null | wc -l | tr -d ' ')
echo "RBAC_PATTERNS_FOUND: $RBAC_FILES files" | tee "$EVIDENCE_DIR/rbac-check.txt"

echo ""
echo "=== CHECK 6: Audit Logging Check ==="
AUDIT_FILES=$(grep -rln "\(audit_log\|auditLog\|AuditTrail\|audit_trail\|accessLog\|PHIAccess\|phi_access\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" --exclude-dir=node_modules . 2>/dev/null | wc -l | tr -d ' ')
echo "AUDIT_LOG_PATTERNS_FOUND: $AUDIT_FILES files" | tee "$EVIDENCE_DIR/audit-log-check.txt"

echo ""
echo "=== CHECK 8: Session Timeout Check ==="
grep -rn "\(session.*timeout\|sessionTimeout\|maxAge\|idle.*timeout\|auto.*logoff\|SESSION_TIMEOUT\|TOKEN_EXPIRY\)" --include="*.ts" --include="*.js" --include="*.py" --include="*.env*" --include="*.yml" --exclude-dir=node_modules . 2>/dev/null | head -10 | tee "$EVIDENCE_DIR/session-timeout-check.txt"

echo ""
echo "=== CHECK 12: Least Privilege (IAM Wildcards) ==="
grep -rn '"\\*"' --include="*.json" --include="*.tf" --include="*.yaml" --include="*.yml" --exclude-dir=node_modules . 2>/dev/null | grep -i "\(action\|resource\|Effect.*Allow\)" | head -10 | tee "$EVIDENCE_DIR/iam-wildcards.txt"

echo ""
echo "=== SSN Patterns ==="
grep -rn "[0-9]\{3\}-[0-9]\{2\}-[0-9]\{4\}" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules . 2>/dev/null | head -50 | tee "$EVIDENCE_DIR/ssn-patterns.txt"

TOTAL=$(cat "$EVIDENCE_DIR"/*.txt 2>/dev/null | grep -c . || echo 0)
echo ""
echo "TOTAL FINDINGS: $TOTAL"
```

### 2e: Hash Evidence

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
EVIDENCE_DIR=$(ls -td "$HOME/.em-dash/projects/$SLUG/evidence/monitor-"* 2>/dev/null | head -1)
if [ -n "$EVIDENCE_DIR" ] && [ -d "$EVIDENCE_DIR" ]; then
  "$_EMDASH_BIN"/hipaa-evidence-hash "$EVIDENCE_DIR"
else
  echo "No evidence directory found for hashing"
fi
```

---

## Phase 3: Diff Analysis

Compare the new scan results against the baseline. For each finding category, classify every item as one of:

### 3a: NEW Findings

Findings that appear in the current scan but were NOT present in the baseline. These represent compliance regression — something changed that introduced a new gap.

For each new finding, include:
- Severity (CRITICAL / HIGH / MEDIUM / LOW)
- Category (infrastructure / code / configuration / policy)
- Description of the finding
- What likely changed to introduce it (check `git log` for recent changes in the affected area)

### 3b: RESOLVED Findings

Findings that were present in the baseline but are NOT present in the current scan. These represent remediation progress.

For each resolved finding, include:
- Original severity
- Description
- How it was resolved (if determinable from git history or remediation artifacts)

### 3c: UNCHANGED Findings

Findings that remain open from the baseline. These have not been addressed since the last scan.

For each unchanged finding, include:
- Severity
- Description
- How long it has been open (days since baseline)
- Whether it was flagged in a corrective action plan

### 3d: CONFIGURATION CHANGES

Infrastructure or code configuration changes detected since the baseline, regardless of whether they introduce findings. These are informational.

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)

echo "=== Git Changes Since Last Scan ==="
LAST_SCAN_DATE=$(ls -t "$HOME/.em-dash/projects/$SLUG"/*-scan-*.md 2>/dev/null | head -1 | sed 's/.*-scan-\([0-9]*\)-.*/\1/' | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')
if [ -n "$LAST_SCAN_DATE" ]; then
  echo "Changes since $LAST_SCAN_DATE:"
  git log --oneline --since="$LAST_SCAN_DATE" -- . 2>/dev/null | head -30
  echo ""
  echo "Files changed:"
  git diff --stat "$(git log --format=%H --since="$LAST_SCAN_DATE" -- . 2>/dev/null | tail -1)" HEAD -- . 2>/dev/null | tail -5
else
  echo "Could not determine last scan date"
  git log --oneline -20
fi
```

---

## Phase 4: Compliance Score Trend

Calculate a compliance score based on the ratio of passing controls to total controls assessed.

Score formula: `(PASS controls + 0.5 * PARTIAL controls) / TOTAL controls * 100`

Read the compliance review history and extract scores from prior reports to build a trend.

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
"$_EMDASH_BIN"/hipaa-review-log read "$SLUG" 2>/dev/null || echo "NO_HISTORY"
```

Display the compliance score trend as an ASCII bar chart:

```
Compliance Score Trend
══════════════════════════════════════════════════

2026-01-15  ████████████████████░░░░░░░░░░  65%  (DEVELOPING)
2026-02-10  ██████████████████████████░░░░  82%  (ESTABLISHED)
2026-03-01  ████████████████████████████░░  88%  (ESTABLISHED)
2026-03-20  █████████████████████████████░  92%  (ADVANCED)    ← current

Trend: IMPROVING (+27% over 3 months)
```

If only one data point exists (first monitoring run), show just the current score and note: "Trend data will be available after the next monitoring run."

---

## Phase 5: Generate Drift Report

Write the drift report to `~/.em-dash/projects/$SLUG/{user}-drift-{datetime}.md` where `{user}` is from `whoami` and `{datetime}` is `YYYYMMDD-HHMMSS`.

The drift report must include:

1. **Header** — project name, monitoring date, baseline date, time elapsed since baseline
2. **Summary Dashboard** — total findings (new/resolved/unchanged), compliance score, trend direction
3. **NEW Findings** — detailed list from Phase 3a, sorted by severity
4. **RESOLVED Findings** — detailed list from Phase 3b
5. **UNCHANGED Findings** — detailed list from Phase 3c with aging information
6. **Configuration Changes** — from Phase 3d
7. **Compliance Score Trend** — the ASCII chart from Phase 4
8. **Recommendations** — specific next actions based on findings
9. **DISCLAIMER** — from the preamble

```bash
USER=$(whoami)
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
DATETIME=$(date +%Y%m%d-%H%M%S)
REPORT_PATH="$HOME/.em-dash/projects/$SLUG/${USER}-drift-${DATETIME}.md"
echo "REPORT_PATH: $REPORT_PATH"
```

Write the report using the Write tool.

---

## Phase 6: Log and Recommend

### 6a: Log the monitoring run

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
NEW_FINDINGS=$(echo "PLACEHOLDER_COUNT")
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-monitor" "complete" "$NEW_FINDINGS"
```

Replace `PLACEHOLDER_COUNT` with the actual count of NEW findings detected during this monitoring run.

### 6b: Display dashboard

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
"$_EMDASH_BIN"/hipaa-review-log dashboard "$SLUG"
```

### 6c: Recommendations

Based on the drift analysis, provide specific recommendations:

1. **If new CRITICAL findings detected:** "URGENT: [N] new critical findings detected since baseline. Run `/hipaa-remediate` immediately to address these gaps before they become audit findings."

2. **If new HIGH findings detected:** "[N] new high-severity findings detected. Schedule `/hipaa-remediate` within the next sprint to address these."

3. **If compliance score dropped:** "Compliance score dropped from [X]% to [Y]%. The regression is primarily in [category]. Key areas to investigate: [list specific controls that regressed]."

4. **If compliance score improved:** "Compliance score improved from [X]% to [Y]%. [N] findings have been resolved since the last baseline."

5. **If no new findings and score stable or improved:** "No compliance drift detected. Current posture is stable. Next recommended monitoring run: [date based on maturity level from Phase 4]."

6. **Always recommend:** "Run `/hipaa-report` to generate an updated compliance report reflecting current state."

---

## Important Rules

- **Never skip PHI pattern scanning.** It requires no external tools and catches the most dangerous compliance gaps.
- **Baseline comparison is the core value.** If you cannot load a baseline, the drift report has limited value — say so honestly.
- **Each bash block is self-contained.** Re-derive SLUG and paths in every block.
- **One question at a time** via AskUserQuestion. Never batch multiple questions.
- **Every report includes the DISCLAIMER.** This tool does not certify compliance.
- **Completion status:**
  - DONE — Monitoring complete, drift report generated, baseline comparison successful
  - DONE_WITH_CONCERNS — Monitoring complete but new critical findings detected
  - BLOCKED — Cannot load baseline or scanning tools unavailable
  - NEEDS_CONTEXT — No prior scans or assessments found; recommend running prerequisite skills
