---
name: hipaa-risk
version: 0.1.0
description: |
  NIST SP 800-30 style risk assessment for HIPAA. Identifies threats
  and vulnerabilities, scores risks by likelihood and impact, and
  produces a treatment plan mapped to HIPAA requirements.

  Run /hipaa-risk to conduct a formal risk assessment.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections:
  - "164.308(a)(1)(ii)(A)"
  - "164.308(a)(1)(ii)(B)"
risk_level: high
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
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-risk" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="risk"
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

As you identify and score risks with the user, update the dashboard in real time.

**Data types you write:**
- `risk add` — for each confirmed risk
- `checklist` — 164.308(a)(1)(ii)(A) Risk Analysis, 164.308(a)(1)(ii)(B) Risk Management

**After each confirmed risk:**
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update risk add --description "Unencrypted PHI at rest" --likelihood 4 --impact 5 --treatment mitigate --owner "Engineering" --requirement "164.312(a)(2)(iv)"
```

**After completing the full assessment:**
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(a)(1)(ii)(A)" complete "Risk analysis completed — N risks identified"
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(a)(1)(ii)(B)" complete "Risk treatment plan established"
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

# HIPAA Risk Assessment (NIST SP 800-30)

You are running the `/hipaa-risk` skill. Your job is to conduct a structured risk assessment following the NIST SP 800-30 framework, mapped to HIPAA Security Rule requirements. This is the single most important HIPAA requirement — inadequate risk analysis is OCR's most common enforcement finding.

**Ask ONE question at a time using AskUserQuestion.**

---

## Phase 1: System Characterization

Understand the scope of ePHI in the organization.

### 1A: Auto-scan for context

Read prior assessment and scan results if they exist:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
ls ~/.em-dash/projects/"$SLUG"/*-assessment-*.md 2>/dev/null | tail -1
ls ~/.em-dash/projects/"$SLUG"/*-scan-*.md 2>/dev/null | tail -1
```

If prior artifacts exist, read them for context — don't re-ask questions already answered.

Also check the dashboard for existing data:

```bash
cat .em-dash/dashboard.json 2>/dev/null | head -5
```

### 1B: Interview — System Boundaries

Ask questions to characterize the ePHI environment:

1. "What types of ePHI does your system store, process, or transmit? (e.g., patient records, lab results, insurance claims, prescription data)"

2. "Where does ePHI flow? Describe the path from creation to storage. (e.g., patient enters data → API → database → backup)"

3. "What systems have access to ePHI? (e.g., web app, mobile app, internal tools, reporting dashboards)"

4. "How many users have access to ePHI and what are their roles? (e.g., 5 developers, 20 clinicians, 3 admins)"

---

## Phase 2: Threat Identification

Identify threats from both automated scanning and organizational context.

### 2A: Auto-scan threats

Check for existing scan findings:

```bash
cat .em-dash/dashboard.json 2>/dev/null | grep -c '"status": "open"' || echo "0"
```

If scan findings exist, use them as the basis for technical threats. Each open finding represents a confirmed vulnerability that creates a threat.

Also scan for common threat indicators:

```bash
# Public-facing services
grep -rl "listen\|createServer\|app\.listen\|express()" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . 2>/dev/null | head -5
```

```bash
# External API integrations (data egress points)
grep -rl "fetch\|axios\|http\.request\|requests\.\(get\|post\)" --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules . 2>/dev/null | wc -l
```

### 2B: Interview — Threat Sources

Ask about threats that can't be detected from code:

5. "What are your top security concerns? What keeps you up at night regarding patient data?"

6. "Have you experienced any security incidents in the past 12 months? (breaches, near-misses, unauthorized access attempts)"

7. "What external threats are most relevant to your organization? (e.g., ransomware, insider threat, nation-state, compliance audit)"

8. "Are there any physical security concerns? (e.g., shared office, remote workers accessing PHI, mobile devices)"

### 2C: Standard HIPAA Threat Categories

For each category, determine if it applies. Use your judgment based on the interview answers and scan results:

| Category | Example Threats |
|----------|----------------|
| **Unauthorized access** | Credential theft, privilege escalation, insider threat |
| **Data breach** | Exfiltration, accidental disclosure, lost devices |
| **System failure** | Downtime, data corruption, backup failure |
| **Natural/environmental** | Disaster, power outage, facility damage |
| **Malicious software** | Ransomware, malware, supply chain attack |
| **Human error** | Misconfiguration, accidental deletion, PHI in logs |
| **Third-party risk** | Vendor breach, BAA violation, service outage |

---

## Phase 3: Vulnerability Analysis

Cross-reference threats with existing controls (or lack thereof).

Read the checklist to see which controls are in place:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
# Count complete vs pending
cat .em-dash/dashboard.json 2>/dev/null | grep -c '"status": "complete"' || echo "0"
cat .em-dash/dashboard.json 2>/dev/null | grep -c '"status": "pending"' || echo "0"
```

For each identified threat, assess:
- **Is there a control in place?** (check the dashboard checklist)
- **Is the control effective?** (check scan findings for the related requirement)
- **Are there compensating controls?** (ask the user if needed)

---

## Phase 4: Risk Determination

For each identified risk, determine likelihood and impact.

### Likelihood Scale (1-5):

| Score | Level | Definition |
|-------|-------|-----------|
| 1 | Very Unlikely | Control is strong, threat is rare (<1% annual probability) |
| 2 | Unlikely | Controls exist but could be circumvented (1-10%) |
| 3 | Possible | Controls are partial or threat is common (10-50%) |
| 4 | Likely | Controls are weak or missing for a common threat (50-90%) |
| 5 | Very Likely | No controls and threat is active or imminent (>90%) |

### Impact Scale (1-5):

| Score | Level | Definition |
|-------|-------|-----------|
| 1 | Insignificant | No PHI exposed, minimal operational impact |
| 2 | Minor | Limited PHI exposure (<10 records), contained quickly |
| 3 | Moderate | PHI exposure (10-500 records), requires notification |
| 4 | Major | Significant PHI exposure (500-5000), regulatory action likely |
| 5 | Severe | Mass PHI exposure (>5000), potential organizational harm, OCR investigation |

### Risk Score = Likelihood × Impact

| Score | Level | Action Required |
|-------|-------|----------------|
| 1-3 | Low | Accept or monitor |
| 4-7 | Moderate | Mitigate within 90 days |
| 8-14 | High | Mitigate within 30 days |
| 15-25 | Critical | Immediate action required |

Present each risk to the user for validation:

"I've identified this risk:

**[Risk Description]**
- Likelihood: [score] — [reasoning]
- Impact: [score] — [reasoning]
- Risk Score: [L × I] ([level])
- Related HIPAA: [requirement]

Do you agree with this assessment?
A) Yes, this looks right
B) Likelihood should be higher/lower — [explain]
C) Impact should be higher/lower — [explain]
D) This isn't a real risk for us — [explain]"

After the user confirms each risk, add it to the dashboard:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update risk add \
  --description "<risk description>" \
  --likelihood <L> --impact <I> \
  --treatment mitigate \
  --owner "<owner>" \
  --requirement "<HIPAA requirement IDs>"
```

---

## Phase 5: Treatment Planning

For each high and critical risk, determine the treatment strategy.

Ask the user for each:

"For this risk ([score] — [description]):

How should we treat it?
A) **Mitigate** — Reduce likelihood or impact (implement controls)
B) **Accept** — Risk is within tolerance (document the decision)
C) **Transfer** — Shift to third party (insurance, vendor SLA)
D) **Avoid** — Eliminate the activity that creates the risk"

For risks treated with "mitigate," identify specific actions:
- Link to scan findings that need remediation
- Suggest running `/hipaa-remediate` for technical fixes
- Suggest running `/hipaa-vendor` for third-party risks
- Identify policy gaps that need documentation

Update each risk's treatment in the dashboard after the user decides.

---

## Phase 6: Update Dashboard

After all risks are assessed, update the risk analysis checklist items:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(a)(1)(ii)(A)" complete "Risk analysis completed — [N] risks identified, [M] critical/high"
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.308(a)(1)(ii)(B)" complete "Risk management plan established — treatment strategies assigned"
```

---

## Phase 7: Summary

Display a risk assessment summary:

```
Risk Assessment Summary (NIST SP 800-30)
═════════════════════════════════════════

Total risks identified: N

By severity:
  Critical (15-25): N — IMMEDIATE ACTION
  High (8-14):      N — mitigate within 30 days
  Moderate (4-7):   N — mitigate within 90 days
  Low (1-3):        N — accept or monitor

Treatment plan:
  Mitigate:  N risks
  Accept:    N risks
  Transfer:  N risks
  Avoid:     N risks

Top risks:
  1. [score] [description] — [treatment] (owner: [name])
  2. [score] [description] — [treatment] (owner: [name])
  3. [score] [description] — [treatment] (owner: [name])

Next steps:
  • Run /hipaa-remediate to address technical findings
  • Run /hipaa-vendor to verify BAA coverage
  • Review and approve the risk register in the dashboard
```

---

## Completion

Log the review:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-risk" "<STATUS>" <FINDINGS_COUNT>
```

Report your completion status using the Completion Status Protocol.
