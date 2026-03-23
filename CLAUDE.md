# em-dash development

## Commands

```bash
bun install          # install dependencies
bun test             # run all tests (~330 tests)
bun run build        # alias for gen:skill-docs
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run gen:skill-docs -- --dry-run  # check if generated files are stale
bun run dashboard    # start the compliance dashboard on localhost:3000
bun run skill:check  # health dashboard for all skills/bins/policies
```

## Project structure

```
em-dash/
├── skills/              # All Claude Code skills
│   ├── hipaa/           # /hipaa — compliance dashboard + routing
│   ├── hipaa-assess/    # /hipaa-assess — organizational interview
│   ├── hipaa-scan/      # /hipaa-scan — automated scanning
│   ├── hipaa-remediate/ # /hipaa-remediate — fix findings + evidence
│   ├── hipaa-report/    # /hipaa-report — compliance reports
│   ├── hipaa-monitor/   # /hipaa-monitor — drift detection
│   ├── hipaa-breach/    # /hipaa-breach — breach notification
│   ├── hipaa-vendor/    # /hipaa-vendor — BA/vendor management + BAA tracking
│   ├── hipaa-risk/      # /hipaa-risk — NIST SP 800-30 risk assessment
│   └── em-dashboard/    # /em-dashboard — opens compliance dashboard
├── dashboard/           # Static dashboard site (HTML/CSS/JS)
├── policies/            # Rego/OPA rules for IaC policy scanning
├── templates/           # User-facing document templates
│   └── policies/        # Org policy markdown templates (8 files)
├── bin/                 # 7 CLI utilities (config, slug, tool-detect, evidence-hash, review-log, update-check, dashboard-update)
├── scripts/             # Build tooling + dashboard server
├── test/                # Validation + eval tests
├── .github/             # CI workflows, issue/PR templates
├── setup                # One-time install script
└── package.json
```

## SKILL.md workflow

SKILL.md files are **generated** from `.tmpl` templates. To update:

1. Edit the `.tmpl` file
2. Run `bun run gen:skill-docs`
3. Commit both the `.tmpl` and generated `.md` files

## Template placeholders

These are resolved by `scripts/gen-skill-docs.ts`:
- `{{PREAMBLE}}` — shared preamble (session tracking, disclaimer, AskUserQuestion format)
- `{{COMPLIANCE_DASHBOARD}}` — compliance dashboard display
- `{{TOOL_DETECTION}}` — scanning tool detection
- `{{PHI_PATTERNS}}` — 19 code-level security checks for HIPAA compliance
- `{{EVIDENCE_COLLECTION}}` — evidence hashing and storage
- `{{AWS_CHECKS}}` — ~65 AWS CLI commands grouped by HIPAA requirement
- `{{GCP_CHECKS}}` — ~40 gcloud commands grouped by HIPAA requirement
- `{{AZURE_CHECKS}}` — ~28 az CLI commands grouped by HIPAA requirement
- `{{IAC_POLICY_ENGINE}}` — Checkov + Conftest/Rego integration
- `{{DASHBOARD_UPDATES}}` — per-skill dashboard.json update instructions

## Key design decisions

- **Interview skills ask ONE question at a time** via AskUserQuestion
- **Smart-skip**: if a prior answer already covered a question, skip it
- **Graceful degradation**: scan skill works with or without Prowler/Lynis/Trivy
- **Evidence integrity**: SHA-256 hashing of all evidence files
- **Never store PHI**: only configuration states, scan results, and metadata
- **Not legal advice**: every output includes a disclaimer

## Artifact persistence

All skill artifacts persist to `~/.em-dash/projects/{slug}/` for cross-skill
discovery. Downstream skills automatically find upstream outputs.

## Dashboard

The visual dashboard lives in `dashboard/` (HTML/CSS/JS) and is served by
`scripts/dashboard-server.ts`. It reads from `.em-dash/dashboard.json` which
skills auto-update via the `hipaa-dashboard-update` utility.

**Features:** sidebar navigation, NL compliance summary, next-step recommendations,
skill run history with summaries, expandable findings with evidence linking,
49-item HIPAA checklist, risk register (matrix + table), vendor/BAA tracker,
drag-and-drop evidence upload, activity timeline, charts, HTML/CSV export,
open-in-Finder, styled confirm dialogs, dark mode, WebSocket live reload.

**Server endpoints:** `GET /api/dashboard`, `PUT /api/dashboard`, `POST /api/upload`,
`GET/DELETE /api/evidence/:file`, `GET /api/activity`, `POST /api/open`,
`GET /api/export/report`, `GET /api/export/csv`.
