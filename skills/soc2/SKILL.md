---

name: soc2
version: 3.0.0
description: |
  SOC 2 compliance. Initializes the framework, asks domain-specific questions
  about trust service criteria and audit type, then routes to comply skills.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## DISCLAIMER

> **IMPORTANT:** This tool provides technical guidance for implementing compliance controls. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.


# /soc2 — SOC 2 Compliance

Initialize SOC 2 compliance with domain-specific context.

## Step 1: Initialize framework

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db init --framework soc2 2>/dev/null || true
"$_EMDASH_BIN"/comply-db journey init 2>/dev/null || true
"$_EMDASH_BIN"/comply-db summary
```

Tell the user: "SOC 2 compliance initialized. [N] NIST 800-53 controls imported."

## Step 2: SOC 2-specific questions

Ask these via AskUserQuestion, one at a time:

### Q1: Trust Service Criteria

> "Which SOC 2 Trust Service Criteria matter for your customers?"
>
> - A) Security only (most common for startups)
> - B) Security + Availability (SaaS with uptime SLAs)
> - C) Security + Confidentiality (handling sensitive data)
> - D) All five (Security, Availability, Confidentiality, Processing Integrity, Privacy)

### Q2: Audit type

> "Are you pursuing a Type I or Type II audit?"
>
> - A) Type I — point-in-time assessment (faster, cheaper, good for first audit)
> - B) Type II — over a review period, typically 6-12 months (stronger, required by most enterprises)
> - C) Not sure yet

### Q3: Primary driver

> "What's driving your SOC 2 effort?"
>
> - A) A prospect or customer requires it to close a deal
> - B) We want to sell to enterprises and need it proactively
> - C) An investor asked about it
> - D) Internal security improvement

Store answers in metadata for context in assessments and reports.

## Step 3: Recommend next step

Based on progress:
- **0% complete:** "Run `/comply` to start your compliance journey, or `/comply-auto` to scan everything."
- **Partial:** "Run `/comply-assess` for interviews or `/comply-scan` for automated checks."
- **Failures found:** "Run `/comply-fix` to remediate."
- **Complete:** "Run `/comply-report` to generate your signed audit packet."

## Step 4: Multiple frameworks

"Want to add another framework? Run `/hipaa`, `/gdpr`, or `/pci-dss`. Controls are shared automatically."

## Important

- All `/comply-*` skills work with whichever frameworks you've initialized.
- Evidence lives in SQLite: `~/.em-dash/projects/{slug}/compliance.db`
- SOC 2 covers Trust Service Criteria: Security, Availability, Confidentiality, Processing Integrity, Privacy
