---
name: comply-breach
version: 0.1.0
description: |
  Guided HIPAA breach notification workflow. Walks through incident intake,
  four-factor risk assessment (per 45 CFR 164.402), notification determination,
  and notification plan with timelines and templates.
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
hipaa_sections:
  - "164.308(a)(6)"
  - "164.404"
  - "164.406"
  - "164.408"
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
source <("$_EMDASH_BIN"/comply-slug 2>/dev/null || true)
echo "SLUG: ${SLUG:-unknown}"
mkdir -p ~/.em-dash/projects/"${SLUG:-unknown}"
_TOOLS=$("$_EMDASH_BIN"/comply-orchestrate detect 2>/dev/null || true)
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

> **IMPORTANT:** This tool provides technical guidance for implementing compliance
> controls. It is NOT legal advice and does not constitute certification. Compliance
> is a legal determination that depends on your specific circumstances. Always
> consult qualified legal counsel and consider engaging a certified auditor for
> formal compliance verification. This tool helps you implement and verify technical
> safeguards — it does not certify compliance.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current compliance phase (e.g., "Assessment Q5 of 20", "Scanning AWS infrastructure", "Remediating encryption findings"). (1-2 sentences)
2. **Simplify:** Explain the compliance requirement in plain English. No compliance regulation numbers in the question itself — reference them in a note below.
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
"$_EMDASH_BIN"/comply-db write "$SLUG" "comply-breach" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="comply-breach"
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



# HIPAA Breach Response Workflow

You are running the `/comply-breach` skill. This is a guided workflow for assessing a potential HIPAA breach and determining notification requirements per the Breach Notification Rule (45 CFR 164.400-414).

**IMPORTANT: This is time-sensitive.** The HIPAA Breach Notification Rule requires individual notification within 60 calendar days of discovering a breach of unsecured PHI. Every day counts. Document everything.

---

## Phase 1: Incident Intake

Gather the facts about the incident through a structured interview. Ask ONE question at a time via AskUserQuestion. Wait for each answer before proceeding to the next.

### Question 1: What happened?

Use AskUserQuestion:
```
HIPAA BREACH ASSESSMENT — Incident Intake (Question 1 of 6)

Describe the security incident. What happened?

Examples: unauthorized access to a database, lost laptop with ePHI,
misdirected email containing patient records, ransomware attack,
employee snooping in medical records.

Please provide as much detail as possible.
```

Record the answer as the incident description.

### Question 2: Timeline

Use AskUserQuestion:
```
HIPAA BREACH ASSESSMENT — Incident Intake (Question 2 of 6)

When was this incident discovered, and when did it likely start?

A) Discovered today — timing unknown
B) Discovered today — started on a known prior date (please specify)
C) Discovered on a prior date (please specify both discovery and start dates)
D) Ongoing — the incident has not been contained yet

IMPORTANT: The 60-day notification clock starts on the DISCOVERY date,
not the incident start date. "Discovery" means the date you knew or
should have known about the breach (per 45 CFR 164.404(a)(2)).
```

Record the discovery date — this is Day 0 for the notification timeline.

### Question 3: PHI types exposed

Use AskUserQuestion:
```
HIPAA BREACH ASSESSMENT — Incident Intake (Question 3 of 6)

What types of Protected Health Information (PHI) were potentially exposed?
Select all that apply:

A) Names
B) Social Security Numbers
C) Dates (birth, admission, discharge, death)
D) Contact information (address, phone, email)
E) Medical record numbers
F) Health plan beneficiary numbers
G) Diagnoses or clinical information
H) Medications or treatment information
I) Billing or financial information
J) Biometric identifiers
K) Full-face photographs
L) Other unique identifiers (please describe)

RECOMMENDATION: Select all types that MIGHT have been exposed. It is
better to over-include than to discover additional PHI types later.
```

Record the PHI types — these determine the sensitivity level for the risk assessment.

### Question 4: Number of individuals affected

Use AskUserQuestion:
```
HIPAA BREACH ASSESSMENT — Incident Intake (Question 4 of 6)

How many individuals are potentially affected?

A) 1-9 individuals
B) 10-499 individuals
C) 500+ individuals (triggers media notification requirement)
D) Unknown — still determining scope

NOTE: If 500+ individuals in a single state or jurisdiction are affected,
you are ALSO required to notify prominent media outlets in that state.
If 500+ individuals total, HHS must be notified within 60 days.
```

Record the count — this determines notification scope requirements.

### Question 5: Containment status

Use AskUserQuestion:
```
HIPAA BREACH ASSESSMENT — Incident Intake (Question 5 of 6)

Has the breach been contained? Is the unauthorized access still possible?

A) Fully contained — access has been revoked, systems secured
B) Partially contained — some remediation done, but gaps remain
C) Not contained — unauthorized access may still be occurring
D) Unknown — still investigating

If contained, briefly describe what containment steps were taken.
```

Record containment status — this affects Factor 4 (mitigation) of the risk assessment.

### Question 6: Actions already taken

Use AskUserQuestion:
```
HIPAA BREACH ASSESSMENT — Incident Intake (Question 6 of 6)

What steps have already been taken in response to this incident?
Select all that apply:

A) Internal incident report filed
B) Forensic investigation initiated
C) Affected systems isolated or taken offline
D) Passwords/credentials rotated
E) Law enforcement notified
F) Legal counsel engaged
G) Insurance carrier notified
H) No actions taken yet — starting now
I) Other (please describe)

RECOMMENDATION: If you haven't already, engage legal counsel (option F).
Breach notification has legal implications that benefit from attorney guidance.
```

Record all actions taken to date.

---

## Phase 2: Four-Factor Risk Assessment

Per 45 CFR 164.402(2), a covered entity must perform a risk assessment considering at least four factors to determine whether a breach of unsecured PHI compromises the security or privacy of the PHI. Present each factor's analysis, then ask the user to confirm or adjust the risk rating.

### Factor 1: Nature and Extent of PHI Involved

Analyze the PHI types reported in Question 3 and present your assessment:

```
FOUR-FACTOR RISK ASSESSMENT — Factor 1 of 4

NATURE AND EXTENT OF PHI INVOLVED
(45 CFR 164.402(2)(i))

PHI types involved: [list from Question 3]

Analysis:
- Types of identifiers: [direct identifiers like SSN vs. demographic only]
- Sensitivity level: [clinical/diagnostic data is more sensitive than demographic]
- Likelihood of re-identification: [could this data be used to identify individuals?]
- Financial risk: [does the data include SSN, billing info that enables identity theft?]
```

Use AskUserQuestion:
```
Factor 1: Nature and Extent of PHI

Based on the PHI types involved, I assess this factor as:
[LOW / MEDIUM / HIGH] — [one-sentence justification]

A) Agree with this rating
B) Adjust to LOW — the PHI is limited in scope and re-identification risk is minimal
C) Adjust to MEDIUM — some sensitive identifiers but limited clinical data
D) Adjust to HIGH — includes highly sensitive data (SSN, diagnoses, financial)
```

### Factor 2: Unauthorized Person

Analyze who gained access and present your assessment:

```
FOUR-FACTOR RISK ASSESSMENT — Factor 2 of 4

THE UNAUTHORIZED PERSON WHO USED THE PHI OR TO WHOM THE DISCLOSURE WAS MADE
(45 CFR 164.402(2)(ii))

Incident description: [from Question 1]

Analysis:
- Who received or accessed the PHI: [known individual? unknown party? employee?]
- Was the recipient a covered entity or business associate: [if so, lower risk]
- Does the recipient have obligations to protect PHI: [contractual, legal, ethical]
- Likelihood of intentional misuse: [accidental exposure vs. malicious access]
```

Use AskUserQuestion:
```
Factor 2: The Unauthorized Person

Based on who accessed the PHI, I assess this factor as:
[LOW / MEDIUM / HIGH] — [one-sentence justification]

A) Agree with this rating
B) Adjust to LOW — recipient is trusted (e.g., another covered entity, employee with HIPAA training)
C) Adjust to MEDIUM — recipient identity is known but not bound by HIPAA
D) Adjust to HIGH — recipient is unknown, or known to be malicious
```

### Factor 3: Whether PHI Was Actually Acquired or Viewed

Analyze whether the PHI was actually accessed vs. merely exposed:

```
FOUR-FACTOR RISK ASSESSMENT — Factor 3 of 4

WHETHER THE PHI WAS ACTUALLY ACQUIRED OR VIEWED
(45 CFR 164.402(2)(iii))

Containment status: [from Question 5]

Analysis:
- Was the PHI actually viewed or downloaded: [evidence of access vs. theoretical exposure]
- Access logs available: [do logs show actual access or just potential access?]
- Duration of exposure: [seconds vs. days vs. ongoing]
- Volume accessed: [single record vs. bulk export]
```

Use AskUserQuestion:
```
Factor 3: Whether PHI Was Actually Acquired or Viewed

Based on the evidence, I assess this factor as:
[LOW / MEDIUM / HIGH] — [one-sentence justification]

A) Agree with this rating
B) Adjust to LOW — evidence suggests PHI was not actually viewed or acquired
C) Adjust to MEDIUM — uncertain whether PHI was accessed
D) Adjust to HIGH — confirmed that PHI was viewed, downloaded, or exfiltrated
```

### Factor 4: Extent of Risk Mitigation

Analyze what has been done to reduce harm:

```
FOUR-FACTOR RISK ASSESSMENT — Factor 4 of 4

THE EXTENT TO WHICH THE RISK TO THE PHI HAS BEEN MITIGATED
(45 CFR 164.402(2)(iv))

Actions taken: [from Questions 5 and 6]

Analysis:
- Containment effectiveness: [is the vulnerability closed?]
- Recipient assurances: [has the unauthorized recipient confirmed destruction/non-use?]
- Monitoring in place: [identity monitoring, credit monitoring offered?]
- Technical remediation: [encryption, access control changes, audit log review]
```

Use AskUserQuestion:
```
Factor 4: Extent of Risk Mitigation

Based on the mitigation steps taken, I assess this factor as:
[LOW / MEDIUM / HIGH] — [one-sentence justification]

A) Agree with this rating
B) Adjust to LOW — comprehensive mitigation, recipient provided assurances
C) Adjust to MEDIUM — some mitigation in place but gaps remain
D) Adjust to HIGH — limited or no mitigation, ongoing risk
```

---

## Phase 3: Notification Determination

Based on the four-factor risk assessment, determine whether breach notification is required.

**Decision rule per 45 CFR 164.402:**

A breach is presumed unless the covered entity demonstrates through the risk assessment that there is a LOW probability that the PHI has been compromised.

1. **If ALL four factors are rated LOW:** The entity may determine that notification is NOT required. Document the analysis thoroughly — the burden of proof is on the entity to justify non-notification.

2. **If ANY factor is rated MEDIUM or HIGH:** Notification IS required. The breach has not been demonstrated to pose a low probability of compromise.

Present the determination to the user:

```
NOTIFICATION DETERMINATION
═══════════════════════════════════════════════════

Factor 1 (Nature of PHI):          [LOW/MEDIUM/HIGH]
Factor 2 (Unauthorized Person):     [LOW/MEDIUM/HIGH]
Factor 3 (PHI Acquired/Viewed):     [LOW/MEDIUM/HIGH]
Factor 4 (Mitigation):             [LOW/MEDIUM/HIGH]

DETERMINATION: [NOTIFICATION REQUIRED / NOTIFICATION NOT REQUIRED]

Reasoning: [2-3 sentence explanation of why notification is or is not required]
```

Use AskUserQuestion:
```
Based on the four-factor risk assessment, I have determined:
[NOTIFICATION REQUIRED / NOTIFICATION NOT REQUIRED]

[Reasoning]

A) Agree — proceed with this determination
B) Override to NOTIFICATION REQUIRED — we want to notify even though risk is low
   (Note: you can always choose to notify voluntarily)
C) Override to NOTIFICATION NOT REQUIRED — we believe the risk assessment
   supports non-notification (Note: document justification thoroughly)

RECOMMENDATION: [A if clear-cut, or B if borderline — when in doubt, notify]
```

---

## Phase 4: Notification Plan

**Only generate this phase if notification is required** (from Phase 3 determination or user override).

### 4a: Notification Timeline

Calculate and display the key dates:

```
NOTIFICATION TIMELINE
═══════════════════════════════════════════════════

Day 0  (Discovery):     [discovery date from Question 2]
Day 60 (Deadline):      [discovery date + 60 calendar days]
Today:                   Day [N] of 60
Days Remaining:          [60 - N]

⚠ Individual notification must be completed by [deadline date]
```

```bash
# Calculate days since discovery (user will need to provide the discovery date)
echo "NOTE: Calculate Day 0 from the discovery date provided in Question 2."
echo "The 60-day deadline is absolute — extensions are not available under HIPAA."
echo "TODAY: $(date +%Y-%m-%d)"
```

### 4b: Individual Notification Requirements

Per 45 CFR 164.404, individual notification must include:

**Method:** First-class mail to last known address. Email is acceptable ONLY if the individual has previously agreed to receive electronic notices.

**Required content per 164.404(c):**

1. A brief description of what happened, including the date of the breach and the date of discovery (if known)
2. A description of the types of unsecured PHI involved (e.g., names, SSN, dates, diagnoses)
3. Steps the individual should take to protect themselves from potential harm (e.g., monitor credit reports, change passwords)
4. A brief description of what the entity is doing to investigate, mitigate harm, and prevent future breaches
5. Contact procedures — a toll-free phone number, email address, website, or postal address for individuals to ask questions or get additional information

**If 10 or fewer individuals have insufficient contact information:** Substitute notification by telephone or other means.

**If more than 10 individuals have insufficient contact information:** Substitute notification via conspicuous posting on the entity's website for 90 days, OR conspicuous notice in major print or broadcast media where affected individuals likely reside. Include a toll-free number active for at least 90 days.

### 4c: Media Notification

**Required if 500+ individuals in a single state or jurisdiction are affected** (per 45 CFR 164.406):

- Notify prominent media outlets serving the state or jurisdiction
- Notification must be provided without unreasonable delay, no later than 60 days from discovery
- Content requirements are the same as individual notification

### 4d: HHS Notification

**If 500+ individuals total are affected:**
- Notify the Secretary of HHS within 60 days of discovery
- Submit via the HHS breach reporting portal: https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf
- This triggers listing on the HHS "Wall of Shame" (Breach Portal)

**If fewer than 500 individuals are affected:**
- Maintain a log of breaches
- Submit to HHS annually, no later than 60 days after the end of the calendar year in which the breach was discovered (effectively by March 1 of the following year)

### 4e: State Law Considerations

Many states have their own breach notification laws that may impose ADDITIONAL requirements beyond HIPAA. Common additional state requirements include:

- Shorter notification timelines (some states require 30 days or less)
- Attorney General notification requirements
- State-specific content requirements
- Consumer reporting agency notification for large breaches

Use AskUserQuestion:
```
State breach notification laws may impose additional requirements.
Which state(s) are the affected individuals primarily located in?

A) We know the state(s) — [user provides]
B) Multiple states — we'll need to check each state's law
C) Unknown at this time
D) Our legal counsel is handling state requirements

RECOMMENDATION: Choose D if you have legal counsel engaged. State breach
notification laws vary significantly and change frequently — legal
counsel will have the most current requirements.
```

---

## Phase 5: Generate Documentation

Write the breach assessment and notification plan to `~/.em-dash/projects/$SLUG/{user}-breach-{datetime}.md`.

```bash
USER=$(whoami)
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/comply-slug 2>/dev/null || true)
DATETIME=$(date +%Y%m%d-%H%M%S)
REPORT_PATH="$HOME/.em-dash/projects/$SLUG/${USER}-breach-${DATETIME}.md"
mkdir -p "$HOME/.em-dash/projects/$SLUG"
echo "REPORT_PATH: $REPORT_PATH"
```

The breach documentation must include:

1. **Incident Summary** — description, timeline, affected systems, PHI types involved, number of individuals affected
2. **Four-Factor Risk Assessment** — each factor with analysis, risk rating, and justification
3. **Notification Determination** — determination, reasoning, who made the determination (user confirmation)
4. **Notification Plan** (if applicable) — timeline with specific dates, individual notification method and content outline, media notification requirements (if applicable), HHS notification requirements and method, state law considerations
5. **Checklist of Required Actions:**

```
BREACH RESPONSE CHECKLIST
═══════════════════════════════════════════════════
[ ] Incident documented and timestamped
[ ] Four-factor risk assessment completed
[ ] Notification determination made and documented
[ ] Legal counsel consulted
[ ] Individual notification letters prepared
[ ] Individual notifications sent (by [deadline date])
[ ] Media notification sent (if 500+ in a state)
[ ] HHS notification submitted (if 500+ total)
[ ] State AG notification (check applicable state laws)
[ ] Post-breach remediation plan documented
[ ] Staff re-training scheduled
[ ] Policies updated based on lessons learned
═══════════════════════════════════════════════════
```

6. **DISCLAIMER** — from the preamble, plus the additional note:

> This breach assessment is a technical aid for organizing your response. It does NOT
> constitute legal advice. HIPAA breach notification has significant legal consequences.
> Consult a qualified HIPAA compliance attorney before finalizing any notification
> determination or sending notifications.

Write the report using the Write tool.

---

## Phase 6: Log and Advise

### 6a: Log the review

```bash
# Findings count = number of risk factors rated MEDIUM or HIGH
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/comply-slug 2>/dev/null || true)
"$_EMDASH_BIN"/comply-db write "$SLUG" "hipaa-breach" "complete" "PLACEHOLDER_FINDINGS"
```

Replace `PLACEHOLDER_FINDINGS` with the actual count of risk factors rated MEDIUM or HIGH (0-4).

### 6b: Critical reminders

Present these reminders prominently after completing the assessment:

```
CRITICAL REMINDERS
═══════════════════════════════════════════════════
1. DOCUMENT EVERYTHING. The 60-day clock started on [discovery date].
2. Your deadline for individual notification is [deadline date].
3. Consult a HIPAA compliance attorney for legal guidance.
4. Preserve all evidence — do not delete logs, emails, or system data.
5. If you have cyber insurance, notify your carrier immediately.
═══════════════════════════════════════════════════
```

### 6c: Display dashboard

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/comply-slug 2>/dev/null || true)
"$_EMDASH_BIN"/comply-db dashboard "$SLUG"
```

---

## Important Rules

- **This is time-sensitive.** Treat every breach assessment with urgency. The 60-day clock is absolute.
- **One question at a time.** Incident intake is stressful. Never overwhelm the user with multiple questions in a single AskUserQuestion.
- **Never tell the user "you don't need to notify."** Only present the risk assessment framework and let the determination emerge from the analysis. Recommend consulting legal counsel for the final decision.
- **Never store PHI.** The breach report should describe the TYPES of PHI involved, never the actual data. No patient names, SSNs, or medical records in any artifact.
- **Each bash block is self-contained.** Re-derive SLUG and paths in every block.
- **Every report includes the DISCLAIMER.** This tool does not constitute legal advice.
- **Default to notification when borderline.** If the risk assessment is ambiguous, recommend notification. The consequences of failing to notify are far worse than unnecessary notification.
- **Completion status:**
  - DONE — Breach assessment complete, documentation generated, notification plan created (if applicable)
  - DONE_WITH_CONCERNS — Assessment complete but containment is incomplete or notification deadline is imminent
  - BLOCKED — Insufficient information to complete the four-factor risk assessment
  - NEEDS_CONTEXT — Key incident details unknown; continue intake when information becomes available
