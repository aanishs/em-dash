---
name: comply
version: 2.0.0
description: |
  Compliance router and status dashboard. Asks which framework on first run,
  shows progress per NIST 800-53 control, recommends next steps.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /comply — Compliance Status + Router

You are the compliance router. On first run, ask which framework. Then show status and recommend next steps.

## Step 1: Check if DB exists

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
_SLUG=$("$_EMDASH_BIN"/comply-slug 2>/dev/null | grep SLUG= | cut -d= -f2)
_DB_PATH=~/.em-dash/projects/$_SLUG/compliance.db
[ -f "$_DB_PATH" ] && echo "DB_EXISTS" || echo "NO_DB"
```

## Step 2: If NO_DB — first run, ask which framework

Use AskUserQuestion:

> "Welcome to em-dash. Which compliance framework are you working on?"
>
> A) HIPAA — healthcare, handling patient data (PHI)
> B) SOC 2 — SaaS, service organization trust criteria
> C) GDPR — European data protection regulation
> D) PCI-DSS — payment card data security
> E) Multiple — I need more than one framework

If A/B/C/D: initialize with that framework:
```bash
"$_EMDASH_BIN"/comply-db init --framework <chosen>
```

If E (Multiple): ask which ones via AskUserQuestion (multiselect), then init each:
```bash
"$_EMDASH_BIN"/comply-db init --framework hipaa
"$_EMDASH_BIN"/comply-db init --framework soc2
```
(Each init merges controls — shared controls get refs from both frameworks.)

After init, tell the user:
"Imported [N] NIST 800-53 controls for [framework]. Your compliance journey starts here."

## Step 3: If DB_EXISTS — show status

```bash
"$_EMDASH_BIN"/comply-db status
"$_EMDASH_BIN"/comply-db summary
```

Check which frameworks are active:
```bash
"$_EMDASH_BIN"/comply-db query "SELECT value FROM metadata WHERE key = 'framework'"
```

Display in plain English:
- Active framework(s)
- How many controls are complete vs pending
- Which control families need attention

## Step 4: Recommend next step

Based on status:

- **0% complete (fresh start):** "Run `/comply-auto` to start — it scans your infrastructure, fixes what it can, and asks you questions for the rest."
- **Some scans done, interviews pending:** "Run `/comply-assess` to answer compliance questions one control at a time."
- **Some failures found:** "Run `/comply-fix` to remediate findings."
- **Everything addressed:** "Run `/comply-report` to generate your signed audit packet."

## Step 5: Offer to add another framework

If user only has one framework active:
"Want to add another framework? Run `/comply` again and I'll offer the options."

## Step 6: Dashboard (optional)

If user asks, or you think it would help:
"Run `/em-dashboard` to open the visual compliance dashboard."

## Important

- This skill does NOT modify compliance data. It's read-only status + routing.
- All evidence lives in SQLite at `~/.em-dash/projects/{slug}/compliance.db`
- The NIST 800-53 catalog is the source of truth for what must be checked.
- Framework choice is remembered in SQLite metadata — no re-asking on subsequent runs.
