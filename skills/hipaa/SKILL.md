---
name: hipaa
version: 0.1.0
description: |
  HIPAA compliance audit suite for startups handling PHI.
  Routes to the right sub-skill based on your project's compliance state.

  Start here — run /hipaa to see your compliance dashboard and get guidance
  on which audit step to run next.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections: []
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

> **IMPORTANT:** This tool provides technical guidance for implementing HIPAA compliance
> controls. It is NOT legal advice and does not constitute HIPAA certification. HIPAA
> compliance is a legal determination that depends on your specific circumstances. Always
> consult qualified legal counsel and consider engaging a certified HIPAA auditor for
> formal compliance verification. This tool helps you implement and verify technical
> safeguards — it does not certify compliance.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current compliance phase (e.g., "Assessment Q5 of 20", "Scanning AWS infrastructure", "Remediating encryption findings"). (1-2 sentences)
2. **Simplify:** Explain the compliance requirement in plain English. No HIPAA regulation numbers in the question itself — reference them in a note below.
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
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa" "<STATUS>" <FINDINGS_COUNT>
```

## Compliance Dashboard

Display the current compliance status by running:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log dashboard "$SLUG"
```

If no prior reviews exist, show:
```
No prior compliance work found for this project.
Recommended: Start with /hipaa-assess for an organizational assessment.
```

# HIPAA Compliance Router

You are running the `/hipaa` skill — the entry point to the HIPAA compliance audit suite. Your job is to assess the current compliance state and route the user to the right sub-skill.

---

## Step 1: Detect Project Context

Gather information about the project and its compliance state.

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
echo "PROJECT: $SLUG"
```

Read `CLAUDE.md` and `README.md` if they exist — understand what this project does, what PHI it handles, and any compliance context already documented.

---

## Step 1.5: Check Scanning Tools

Detect which scanning tools are available. Display results clearly.

```bash
echo "=== Scanning Tools ==="
echo -n "prowler:  "; which prowler 2>/dev/null && echo "✓" || echo "✗ not installed (pip install prowler)"
echo -n "trivy:    "; which trivy 2>/dev/null && echo "✓" || echo "✗ not installed (brew install trivy)"
echo -n "checkov:  "; which checkov 2>/dev/null && echo "✓" || echo "✗ not installed (pip install checkov)"
echo -n "conftest: "; which conftest 2>/dev/null && echo "✓" || echo "✗ not installed (brew install conftest)"
echo ""
echo "=== Cloud CLIs ==="
echo -n "aws:      "; which aws 2>/dev/null && echo "✓" || echo "✗ not installed"
echo -n "gcloud:   "; which gcloud 2>/dev/null && echo "✓" || echo "✗ not installed"
echo -n "az:       "; which az 2>/dev/null && echo "✓" || echo "✗ not installed"
```

Include the tool status in the dashboard output. If any recommended tools are missing, after displaying the dashboard, ask:

"Some recommended scanning tools are not installed. Would you like me to install them now? This will give you deeper scanning coverage.

Missing tools:
[list each missing tool with its install command]

A) Install all missing tools now
B) Skip — em-dash works without them (code-level checks always run)"

If the user chooses A, install the missing tools before proceeding. If B, continue normally.

---

## Step 2: Check Existing Compliance Artifacts

Look for prior audit artifacts to understand where the user is in their compliance journey.

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
PROJ_DIR="$HOME/.em-dash/projects/$SLUG"
echo "ARTIFACT_DIR: $PROJ_DIR"

# Check for each artifact type
[ -d "$PROJ_DIR" ] && echo "PROJECT_DIR_EXISTS" || echo "NO_PROJECT_DIR"
ls "$PROJ_DIR"/*-assessment-*.md 2>/dev/null && echo "HAS_ASSESSMENT" || echo "NO_ASSESSMENT"
ls "$PROJ_DIR"/*-scan-*.md 2>/dev/null && echo "HAS_SCAN" || echo "NO_SCAN"
ls "$PROJ_DIR"/*-remediation-*.md 2>/dev/null && echo "HAS_REMEDIATION" || echo "NO_REMEDIATION"
ls "$PROJ_DIR"/*-report-*.md 2>/dev/null && echo "HAS_REPORT" || echo "NO_REPORT"
ls "$PROJ_DIR"/*-monitor-*.md 2>/dev/null && echo "HAS_MONITOR" || echo "NO_MONITOR"
ls "$PROJ_DIR"/*-breach-*.md 2>/dev/null && echo "HAS_BREACH" || echo "NO_BREACH"
```

---

## Step 3: Display Compliance Dashboard

Based on the artifacts found, display a compliance dashboard showing the current state.

```
+====================================================================+
|                 HIPAA COMPLIANCE DASHBOARD                          |
+====================================================================+
| Phase              | Status     | Last Run            | Artifacts  |
|--------------------|------------|---------------------|------------|
| Assessment         | [status]   | [date or —]         | [count]    |
| Technical Scan     | [status]   | [date or —]         | [count]    |
| Remediation        | [status]   | [date or —]         | [count]    |
| Compliance Report  | [status]   | [date or —]         | [count]    |
| Ongoing Monitoring | [status]   | [date or —]         | [count]    |
+--------------------------------------------------------------------+
| NEXT STEP: [recommendation]                                        |
+====================================================================+
```

Status values: COMPLETE, IN PROGRESS, NOT STARTED, STALE (>90 days old)

---

## Step 4: Route to the Right Sub-Skill

Based on the compliance state detected in Step 2, recommend the appropriate next step. Apply these rules in order:

1. If the user mentions "breach", "incident", "unauthorized access", or "data exposure" in their message, recommend `/hipaa-breach` immediately — breach response is always urgent and overrides the normal workflow.

2. If no project directory exists or no assessment artifacts are found, recommend `/hipaa-assess`:
   "No compliance assessment found for this project. Start with `/hipaa-assess` — it walks through a structured interview covering Security Rule, Privacy Rule, Breach Notification, and Business Associate requirements."

3. If an assessment exists but no technical scan, recommend `/hipaa-scan`:
   "Assessment complete. Next step: `/hipaa-scan` — automated technical scan of your infrastructure, codebase, and configurations against HIPAA requirements."

4. If both assessment and scan exist but no remediation artifacts, recommend `/hipaa-remediate`:
   "Assessment and scan complete. Next step: `/hipaa-remediate` — prioritized remediation of findings from your assessment and scan, with automated fixes where possible."

5. If remediation is done but no compliance report exists, recommend `/hipaa-report`:
   "Remediation complete. Next step: `/hipaa-report` — generate a formal HIPAA compliance report suitable for auditors, business partners, and internal stakeholders."

6. If a compliance report exists, recommend `/hipaa-monitor`:
   "Compliance report generated. Next step: `/hipaa-monitor` — set up ongoing compliance monitoring, drift detection, and periodic re-assessment triggers."

7. If all phases are complete and artifacts are current (<90 days), display:
   "All compliance phases are current. Run any sub-skill directly to update a specific area, or `/hipaa-monitor` to check for drift."

---

## Sub-Skill Reference

| Skill | Purpose | When to use |
|-------|---------|-------------|
| `/hipaa-assess` | Interactive compliance assessment interview | First step — understand your current compliance posture |
| `/hipaa-scan` | Automated technical infrastructure scan | After assessment — find technical gaps in code and config |
| `/hipaa-remediate` | Prioritized remediation with automated fixes | After scan — fix findings by priority |
| `/hipaa-report` | Formal compliance report generation | After remediation — produce auditor-ready documentation |
| `/hipaa-monitor` | Ongoing monitoring and drift detection | After report — maintain compliance over time |
| `/hipaa-breach` | Breach response and notification workflow | Anytime — when a breach or incident is suspected |

---

## Important Notes

- You can run any sub-skill directly without going through this router. The router is a convenience — it detects state and recommends, but every sub-skill works independently.
- All artifacts are stored in `~/.em-dash/projects/$SLUG/` and are local to your machine. Nothing is sent externally.
- HIPAA compliance is a continuous process, not a one-time event. Artifacts older than 90 days are flagged as STALE and should be refreshed.
- This tool assists with compliance assessment and documentation. It does not constitute legal advice. Consult a qualified HIPAA compliance officer or attorney for formal compliance determinations.
