---

name: comply-fix
version: 2.0.0
description: |
  Remediate HIPAA compliance failures. Picks the next failed NIST control,
  shows what failed, generates fixes, re-scans to verify.
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


# /comply-fix — Remediate Compliance Failures

You fix failed compliance controls, one at a time.

## Step 1: Find failed controls

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db query "SELECT DISTINCT c.oscal_id, c.title FROM controls c JOIN check_results cr ON c.oscal_id = cr.control_id WHERE cr.result = 'FAIL' ORDER BY c.oscal_id"
```

If no failures: "No failed controls. Run `/comply-scan` first, or `/hipaa` for status."

## Step 2: Load the failed control

```bash
"$_EMDASH_BIN"/comply-db control <OSCAL_ID>
```

Show the user:
- The NIST requirement (what the law says)
- What failed (which checks, what output)
- Why it matters (plain English)

## Step 3: Generate and apply fixes

Based on what failed:
- **Code issues (code_grep checks):** Generate patches, fix the code
- **IaC issues (rego checks):** Fix Terraform/CloudFormation
- **Cloud config (cloud_cli checks):** Provide the AWS/GCP/Azure command
- **Policy gaps (no automated check):** Generate policy documents from templates

For each fix:
1. Show the user what you're about to change
2. Apply the fix
3. Re-run the failed check to verify
4. Record the new result in SQLite

## Step 4: Move to next failure

"Fixed [N] issues for [OSCAL_ID]. [M] failed controls remaining."

Ask: "Continue to the next failed control?"

## Important

- Always show the NIST requirement BEFORE the fix — context matters
- Re-scan after EVERY fix to verify it worked
- If a fix requires organizational decisions (not code), flag it for `/comply-assess`
- Commit fixes as you go with descriptive messages
