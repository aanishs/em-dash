---

name: comply-assess
version: 2.0.0
description: |
  HIPAA compliance interview. Processes one NIST 800-53 control at a time —
  reads the official NIST assessment method and asks relevant questions.
  Covers vendors (SA-9), risk (RA-3), training (AT-2), and all other
  interview-only controls.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## DISCLAIMER

> **IMPORTANT:** This tool provides technical guidance for implementing compliance controls. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.


# /comply-assess — Compliance Interview

You conduct the organizational compliance assessment, one NIST 800-53 control at a time.

## Step 1: Setup

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db init 2>/dev/null || true
```

## Step 2: Find next control needing interview

Controls that need interviews are those where automated checks alone can't verify compliance — policies, procedures, organizational decisions.

```bash
"$_EMDASH_BIN"/comply-db query "SELECT oscal_id, title, nist_prose, nist_assess FROM controls WHERE status IN ('pending', 'partial') ORDER BY oscal_id"
```

Pick the first control. Load its full detail:
```bash
"$_EMDASH_BIN"/comply-db control <OSCAL_ID>
```

## Step 3: Read the NIST assessment method

The `nist_assess` field contains the official NIST assessment method. It tells you:
- What to **examine** (documents, configurations)
- What to **interview** (people, roles)
- What to **test** (processes, mechanisms)

Read this carefully. Your questions should be derived FROM the NIST text.

## Step 4: Ask questions ONE AT A TIME

Before asking questions for a control, get the plain-English context:
```bash
"$_EMDASH_BIN"/comply-db control <OSCAL_ID> --json 2>/dev/null
```
If the output includes `why_it_matters`, include it as a one-liner under your question so the user understands WHY they're being asked.

For each control, ask 1-3 questions via AskUserQuestion. Derive the questions from the NIST prose.

**Format each question:**
1. State the HIPAA requirement in plain English (use `plain_english` field if available)
2. Include why it matters: the `why_it_matters` field explains the consequence
3. Reference the NIST control: "NIST AC-2 requires..."
4. Ask the specific question
5. Provide examples of good answers

**Smart-skip:** If the user's previous answer already covers this question, skip it.

## Step 5: Record evidence

After the user answers, record in SQLite:
```bash
"$_EMDASH_BIN"/comply-db update-scan <OSCAL_ID> <PASS|FAIL> interview assessment "<summary of answer>"
```

## Step 6: Move to next control

Ask: "Continue to the next control, or stop here?"

## Special controls

- **SA-9 (External System Services):** This is the vendor/BAA interview. Ask about third-party services, BAAs, vendor risk.
- **RA-3 (Risk Assessment):** Walk through threat identification, likelihood, impact. This is the risk assessment.
- **AT-2 (Security Awareness Training):** Ask about training programs, completion tracking.
- **PM-2 (Security Officer):** Ask who the designated security officer is.
- **IR-6 (Incident Reporting):** Ask about incident response plan and procedures.
- **CP-2 (Contingency Plan):** Ask about backup, disaster recovery, business continuity.

These used to be separate skills. Now they're just controls in the same interview loop.

## Important

- Ask ONE question at a time via AskUserQuestion
- Derive questions from the NIST text, not from hardcoded templates
- Record evidence immediately after each answer
- The user can stop at any time — SQLite remembers progress
