---

name: comply-auto
version: 2.0.0
description: |
  HIPAA compliance autopilot. Loops through ALL controls: scans infrastructure,
  fixes what it can, asks questions for interview-only controls. The "just
  handle it" command.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## DISCLAIMER

> **IMPORTANT:** This tool provides technical guidance for implementing compliance controls. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.


# /comply-auto — Compliance Autopilot

You are the autopilot. Loop through every NIST 800-53 control and handle it end-to-end.

## Step 1: Setup

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db init 2>/dev/null || true
"$_EMDASH_BIN"/comply-db summary

# Detect tools
command -v prowler >/dev/null 2>&1 && echo "TOOL_PROWLER=true" || echo "TOOL_PROWLER=false"
command -v checkov >/dev/null 2>&1 && echo "TOOL_CHECKOV=true" || echo "TOOL_CHECKOV=false"
command -v aws >/dev/null 2>&1 && echo "TOOL_AWS=true" || echo "TOOL_AWS=false"
command -v conftest >/dev/null 2>&1 && echo "TOOL_CONFTEST=true" || echo "TOOL_CONFTEST=false"
```

```bash
cat "$_EMDASH_BIN"/../nist/tool-bindings.json
```

## Step 2: Get next incomplete control

```bash
"$_EMDASH_BIN"/comply-db query "SELECT oscal_id, title, status FROM controls WHERE status != 'complete' ORDER BY oscal_id LIMIT 1"
```

If all complete: "All controls addressed! Run `/comply-report` to generate your audit packet."

## Step 3: Load and display the control

```bash
"$_EMDASH_BIN"/comply-db control <OSCAL_ID>
```

Tell the user: "Working on [OSCAL_ID]: [title]"

## Step 4: For this control, do EVERYTHING

**4a. Check if tool bindings exist → SCAN**

Look up the control in tool-bindings.json. If it has em-dash/Prowler/Checkov checks:
- Run each available check
- Record results: `comply-db update-scan <ID> <PASS|FAIL> <tool> <check_id> "<output>"`

**4b. If any checks FAILED → FIX**

Read the NIST prose to understand what's required. Attempt to fix:
- Code issues: generate patches
- Terraform/IaC: modify configuration
- AWS settings: provide the CLI command to fix it

After fixing, re-run the failed check to verify. Record the new result.

If the fix requires human judgment (e.g., organizational policy decision), flag it:
"Control [ID] needs manual attention: [what's needed]"

**4c. If control needs interview evidence → ASK**

Read the NIST assessment method. Derive 1-2 questions from it.
Ask via AskUserQuestion — one question at a time.
Record the answer as evidence.

**4d. Update control status**

After all actions for this control:
```bash
"$_EMDASH_BIN"/comply-db update-scan <ID> <final_result> summary assessment "<what was done>"
```

## Step 5: Report progress and continue

"Control [ID]: [title] — [result]. [X] of [Y] controls complete."

Go back to Step 2 for the next control.

## Step 6: Session summary (when done or stopped)

When all controls are processed or the user stops:
```bash
"$_EMDASH_BIN"/comply-db summary
```

Show what was accomplished this session:
- Controls scanned: N
- Checks run: N (M passed, K failed)
- Fixes applied: N
- Questions answered: N
- Remaining: N controls need attention

## Important

- This is the "fire and forget" mode — do as much as possible with minimal user input
- Only ask the user when you MUST (interview questions, ambiguous fixes)
- Record everything to SQLite as you go
- The user can interrupt at any time — progress is saved
- For controls with NO tool bindings and NO assessment method, mark as "needs manual review"
