---
name: hipaa-oscal-import
version: 0.1.0
description: |
  Import and manage OSCAL catalog data for em-dash. Shows mapping status,
  lists controls with plain-English translations, and validates references.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
framework: hipaa
hipaa_sections:
  - "164.308(a)(1)(i)"
  - "164.312(a)(1)"
  - "164.312(b)"
  - "164.312(d)"
  - "164.312(e)(1)"
risk_level: low
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
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-oscal-import" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="oscal-import"
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

# /hipaa-oscal-import: OSCAL Catalog Management

Manage the OSCAL HIPAA control mapping — the bridge between NIST 800-53 controls
and em-dash's compliance checks.

## Phase 1: Status Check

Run the status command to see current OSCAL mapping state:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-oscal-import status
```

Report the output to the user. Explain:
- How many controls are mapped (Phase 1 = 10 core controls)
- How many have automated checks vs manual verification
- What the mapping source is (SP 800-66r2)

## Phase 2: Validation

Validate that all check references in the mapping are valid:

```bash
"$_EMDASH_BIN"/hipaa-oscal-import validate
```

If validation fails, report the specific invalid references.

## Phase 3: Control Listing

If the user wants to see the mapped controls:

```bash
"$_EMDASH_BIN"/hipaa-oscal-import controls
```

Each control includes:
- OSCAL ID (e.g., AC-2)
- Title and family
- HIPAA requirement references
- Plain-English explanation
- Automated check status

## Phase 4: Export

To export the mapping as human-readable markdown:

```bash
"$_EMDASH_BIN"/hipaa-oscal-import export > ~/.em-dash/projects/$SLUG/oscal-mapping.md
```


