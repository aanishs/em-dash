---

name: comply
version: 2.0.0
description: |
  Compliance status dashboard. Shows progress across all active frameworks.
  To start a specific framework, use /hipaa, /soc2, /gdpr, or /pci-dss.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## DISCLAIMER

> **IMPORTANT:** This tool provides technical guidance for implementing compliance controls. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.


# /comply — Compliance Status

Show compliance status across all active frameworks.

## Step 1: Check if any framework is initialized

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
_SLUG=$("$_EMDASH_BIN"/comply-slug 2>/dev/null | grep SLUG= | cut -d= -f2)
_DB_PATH=~/.em-dash/projects/$_SLUG/compliance.db
[ -f "$_DB_PATH" ] && echo "DB_EXISTS" || echo "NO_DB"
```

## Step 2: If NO_DB — no framework initialized yet

Tell the user:

"No compliance framework initialized yet. Start with one of these:

- `/hipaa` — healthcare, patient data (PHI)
- `/soc2` — SaaS trust service criteria
- `/gdpr` — EU data protection
- `/pci-dss` — payment card security

You can add multiple frameworks — controls are shared automatically."

## Step 3: If DB_EXISTS — show status

```bash
"$_EMDASH_BIN"/comply-db summary
"$_EMDASH_BIN"/comply-db status
```

Show which frameworks are active:
```bash
"$_EMDASH_BIN"/comply-db query "SELECT key, value FROM metadata WHERE key = 'framework'"
```

## Step 4: Recommend next step

- **0% complete:** "Run `/comply-auto` to start."
- **Some scans done:** "Run `/comply-assess` for interviews or `/comply-scan` for checks."
- **Failures found:** "Run `/comply-fix` to remediate."
- **Complete:** "Run `/comply-report` to generate your audit packet."

Want to add another framework? Run `/soc2`, `/gdpr`, or `/pci-dss`.
Want the visual dashboard? Run `/em-dashboard`.
