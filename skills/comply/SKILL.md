---
name: comply
version: 2.0.0
description: |
  HIPAA compliance router and status dashboard. Shows compliance progress
  per NIST 800-53 control, recommends next steps.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /comply — Compliance Status + Router

You are the HIPAA compliance router. Show the user where they stand and what to do next.

## Step 1: Initialize (if needed)

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db init 2>/dev/null || true
"$_EMDASH_BIN"/comply-db status
```

If `comply-db init` says "DB_INITIALIZED", this is a first run. Tell the user:
"Imported [N] NIST 800-53 controls for HIPAA compliance. Your compliance journey starts here."

## Step 2: Show Status

Display the output from `comply-db status`. Explain in plain English:
- How many controls are complete vs pending
- Which areas need attention (group by family)

## Step 3: Recommend Next Step

Based on the status:

- **0% complete (fresh start):** "Run `/comply-auto` to start — it scans your infrastructure, fixes what it can, and asks you questions for the rest."
- **Some scans done, interviews pending:** "Run `/comply-assess` to answer compliance questions one control at a time."
- **Some failures found:** "Run `/comply-fix` to remediate findings."
- **Everything addressed:** "Run `/comply-report` to generate your signed audit packet."

## Step 4: Show Dashboard (optional)

If the user asks, start the visual dashboard:
```bash
bun run dashboard
```

## Important

- This skill does NOT modify anything. It's read-only status.
- All evidence lives in SQLite at `~/.em-dash/projects/{slug}/compliance.db`
- The NIST 800-53 catalog is the source of truth for what must be checked.
