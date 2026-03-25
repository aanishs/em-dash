---
name: comply-scan
version: 2.0.0
description: |
  Automated HIPAA compliance scanning. Processes one NIST 800-53 control at
  a time — runs all available tools (em-dash, Prowler, Checkov) and records
  results in SQLite.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /comply-scan — Automated Compliance Scanning

You scan infrastructure and code against NIST 800-53 controls, one control at a time.

## Step 1: Setup

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db init 2>/dev/null || true

# Detect available tools
command -v prowler >/dev/null 2>&1 && echo "TOOL_PROWLER=true" || echo "TOOL_PROWLER=false"
command -v checkov >/dev/null 2>&1 && echo "TOOL_CHECKOV=true" || echo "TOOL_CHECKOV=false"
command -v aws >/dev/null 2>&1 && echo "TOOL_AWS=true" || echo "TOOL_AWS=false"
command -v conftest >/dev/null 2>&1 && echo "TOOL_CONFTEST=true" || echo "TOOL_CONFTEST=false"
```

## Step 2: Load tool bindings

```bash
cat "$_EMDASH_BIN"/../nist/tool-bindings.json
```

## Step 3: Find next control to scan

```bash
"$_EMDASH_BIN"/comply-db query "SELECT oscal_id, title FROM controls WHERE status = 'pending' ORDER BY oscal_id LIMIT 1"
```

If no pending controls, tell user: "All controls have been scanned. Run `/hipaa` to see status."

## Step 4: Load control details

For the control found in Step 3:

```bash
"$_EMDASH_BIN"/comply-db control <OSCAL_ID>
```

Read the NIST prose. This tells you WHAT must be verified.

## Step 5: Run checks

Look up the control ID in tool-bindings.json. For each tool that's available:

**em-dash checks (always available):**
- For `code_grep` checks: use Grep tool to search the codebase
- For `cloud_cli` checks: run the AWS CLI command
- For `rego` checks: run `conftest test` with the policy

**Prowler (if installed):**
- Run: `prowler <check_id> --output-modes json`

**Checkov (if installed):**
- Run: `checkov --check <check_id> -d .`

For each check result, record it:
```bash
"$_EMDASH_BIN"/comply-db update-scan <OSCAL_ID> <PASS|FAIL> <tool> <check_id> "<output summary>"
```

## Step 6: Report and move on

After all checks for this control:
- Show the user: "Control [ID]: [title] — [N] checks run, [M] passed, [K] failed"
- If all passed: "This control's automated checks are complete."
- If any failed: "Run `/comply-fix` to remediate, or `/comply-scan` to continue to the next control."

Ask: "Continue to the next control, or stop here?"
- If continue → go back to Step 3
- If stop → show summary of what was scanned this session

## Important

- Process ONE control at a time. Do not batch.
- Record EVERY check result in SQLite immediately.
- If a check errors (command fails, tool not installed), record as SKIP with the error.
- Show the user the NIST control prose so they understand WHY each check matters.
