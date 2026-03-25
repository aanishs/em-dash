---
name: comply-report
version: 2.0.0
description: |
  Generate HIPAA compliance report and signed audit packet from SQLite evidence.
  Includes attestation verification and user signature.
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /comply-report — Compliance Report + Audit Packet

You compile all evidence from SQLite into a compliance report and signed audit packet.

## Step 1: Check readiness

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db summary
```

Show the user their compliance score. If less than 50% complete, warn:
"Your compliance coverage is low. Consider running `/comply-auto` first."

## Step 2: Generate report

Query all controls and their evidence from SQLite:
```bash
"$_EMDASH_BIN"/comply-db query "SELECT c.oscal_id, c.title, c.family, c.status, c.framework_refs, (SELECT COUNT(*) FROM check_results WHERE control_id = c.oscal_id AND result = 'PASS') as passes, (SELECT COUNT(*) FROM check_results WHERE control_id = c.oscal_id AND result = 'FAIL') as fails, (SELECT COUNT(*) FROM evidence WHERE control_id = c.oscal_id) as evidence_count FROM controls c ORDER BY c.family, c.oscal_id"
```

Generate a compliance report with:
- Executive summary (compliance score, key findings)
- Per-family breakdown (Access Control, Audit, etc.)
- Per-control detail (status, checks run, evidence collected)
- Findings requiring attention (failed controls)
- HIPAA requirement coverage matrix

## Step 3: Verify attestations

If attestations exist, verify their integrity:
```bash
"$_EMDASH_BIN"/comply-verify --attestation-dir ~/.em-dash/projects/$SLUG/attestations 2>/dev/null || echo "NO_ATTESTATIONS"
```

## Step 4: User signature

Ask the user via AskUserQuestion:
"Do you attest that the evidence collected in this compliance assessment is accurate and complete to the best of your knowledge?"

If yes, record the signature:
```bash
"$_EMDASH_BIN"/comply-attest init-keys 2>/dev/null || true
```

## Step 5: Generate audit packet

```bash
"$_EMDASH_BIN"/comply-audit-packet --attestation-dir ~/.em-dash/projects/$SLUG/attestations --output ~/.em-dash/projects/$SLUG/audit-packet.zip 2>/dev/null || echo "PACKET_SKIPPED"
```

If no attestations exist, generate a report-only package (no cryptographic signatures).

## Step 6: Deliver

Tell the user where the report and packet are:
- Report: displayed in conversation
- Audit packet: `~/.em-dash/projects/{slug}/audit-packet.zip`

## Important

- Include the HIPAA "not legal advice" disclaimer in every report
- The report should be understandable by a non-technical reader
- Group findings by HIPAA section (Administrative, Technical, Physical, Organizational)
- For addressable controls that weren't implemented, note the alternative safeguard
