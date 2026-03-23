---
name: hipaa-vendor
version: 0.1.0
description: |
  Business associate and vendor management. Auto-detects third-party services
  from your codebase, interviews about BAA status, and tracks vendor risk.

  Run /hipaa-vendor to discover and manage your vendors.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections:
  - "164.314(a)(1)"
  - "164.314(a)(2)(i)"
  - "164.308(b)(1)"
risk_level: medium
requires_prior: []
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
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-vendor" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="vendor"
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

As you discover vendors and confirm BAA status, update the dashboard in real time.

**Data types you write:**
- `vendor add` — for each discovered service
- `checklist` — 164.314(a)(1), 164.314(a)(2)(i), 164.308(b)(1) based on BAA coverage
- `checklist ... --gap` — for vendors missing BAAs

**Vendor detection → dashboard:**
After confirming each vendor's status, immediately update so the dashboard reflects progress:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "AWS" --service "Cloud infrastructure" --baa-status signed --risk-tier high --baa-expiry "2027-01-15"
```

**BAA gaps:**
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" pending --gap "No BAA with Stripe"
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

# HIPAA Business Associate & Vendor Management

You are running the `/hipaa-vendor` skill. Your job is to identify every third-party service that handles PHI, verify BAA coverage, and track vendor risk. This directly addresses HIPAA §164.314 (Organizational Requirements).

---

## Phase 1: Auto-Detect Services

Scan the project for third-party service dependencies.

### 1A: Package managers

```bash
cat package.json 2>/dev/null | head -100
```

```bash
cat requirements.txt 2>/dev/null || cat Pipfile 2>/dev/null | head -50
```

```bash
cat go.mod 2>/dev/null | head -50
```

```bash
cat Gemfile 2>/dev/null | head -50
```

### 1B: Infrastructure files

```bash
cat docker-compose*.yml 2>/dev/null | head -100
```

```bash
find . -name "*.tf" -not -path "*/node_modules/*" -not -path "*/.git/*" | head -20
```

### 1C: Code imports for known services

```bash
grep -rl "aws-sdk\|@aws-sdk\|boto3\|google-cloud\|@google-cloud\|@azure" --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --exclude-dir=node_modules --exclude-dir=vendor . 2>/dev/null | head -10
```

```bash
grep -rl "stripe\|@stripe\|twilio\|sendgrid\|@sendgrid\|mailgun\|postmark\|ses\.send\|pinpoint" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . 2>/dev/null | head -10
```

```bash
grep -rl "datadog\|sentry\|newrelic\|bugsnag\|logrocket\|segment\|mixpanel\|amplitude\|intercom\|zendesk" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . 2>/dev/null | head -10
```

```bash
grep -rl "firebase\|supabase\|mongodb\|mongoose\|redis\|elasticsearch\|algolia" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . 2>/dev/null | head -10
```

### 1D: Environment variables

```bash
grep -h "API_KEY\|SECRET\|_URL\|_HOST\|_ENDPOINT" .env.example .env.sample .env.template 2>/dev/null | grep -v "^#" | head -20
```

---

## Phase 2: Present Discovered Services

Show the user what you found. Group by category:

```
Detected Services
═════════════════

Cloud Infrastructure:
  • AWS (aws-sdk in package.json)
  • GCP (@google-cloud/* imports)

Communication:
  • Twilio (twilio in package.json)
  • SendGrid (@sendgrid/mail import)

Payments:
  • Stripe (@stripe/stripe-node)

Monitoring:
  • Datadog (dd-trace import)
  • Sentry (@sentry/node)

Databases:
  • MongoDB Atlas (mongodb connection string)
```

---

## Phase 3: BAA Status Interview

For each detected service, ask ONE question at a time using AskUserQuestion:

**Question format:**
"Does [Vendor Name] handle any PHI (patient data, health records, identifiers)?

If YES: Do you have a signed Business Associate Agreement (BAA) with them?
A) Yes, BAA is signed
B) BAA is pending / in progress
C) No BAA — need to get one
D) They don't handle PHI — no BAA needed"

**Decision logic:**
- If the vendor handles PHI and has a BAA → add as vendor with `baa_status: signed`
- If the vendor handles PHI but no BAA → add with `baa_status: none` + create evidence gap
- If the vendor handles PHI and BAA pending → add with `baa_status: pending`
- If the vendor doesn't handle PHI → add with `baa_status: none`, risk_tier: low, note "Does not process PHI"

For signed BAAs, ask: "When does the BAA expire?" to set `baa_expiry`.

**Risk tier assignment:**
- Cloud infrastructure (AWS, GCP, Azure) → `high` (they host everything)
- Auth/identity (Okta, Auth0) → `high` (they control access)
- Communication with PHI (Twilio SMS to patients, SendGrid patient emails) → `medium`
- Payments → `medium` (may see patient identifiers with billing)
- Monitoring/analytics → `low` (should not see PHI if configured correctly)
- Databases → `high` (direct PHI storage)

After each answer, update the dashboard:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "<name>" --service "<service>" --baa-status <status> --risk-tier <tier>
```

If BAA is missing for a PHI-handling vendor:
```bash
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" pending --gap "No BAA with <vendor>"
```

---

## Phase 4: Additional Vendors

After processing all detected services, ask:

"Are there any other vendors or services that handle your patients' data that I didn't detect? For example:
- EHR/EMR systems
- Billing/claims processors
- Cloud fax services
- Secure messaging platforms
- Analytics or reporting tools
- Physical storage or shredding services"

Add any additional vendors the user mentions.

---

## Phase 5: Overall BAA Assessment

After all vendors are processed, update the overall BAA checklist items:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
```

If ALL PHI-handling vendors have signed BAAs:
```bash
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" complete "All BA contracts signed"
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(2)(i)" complete "BA contracts establish permitted uses"
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(b)(1)" complete "Satisfactory assurances from all BAs"
```

If ANY PHI-handling vendors lack BAAs:
```bash
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" pending --gap "Missing BAAs: [vendor list]"
```

---

## Phase 6: Summary

Display a summary:

```
Vendor Management Summary
═════════════════════════

Total vendors: N
  BAA signed:  N (✓)
  BAA pending: N (⚠)
  BAA missing: N (✗)
  No PHI:      N (—)

High risk vendors: [list]
Expiring BAAs: [list with dates]

Evidence gaps:
  ⚠ [vendor] — no BAA on file
```

---

## Completion

Log the review:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-vendor" "<STATUS>" <FINDINGS_COUNT>
```

Report your completion status using the Completion Status Protocol.
