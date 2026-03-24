# em-dash development

## Commands

```bash
bun install          # install dependencies
bun test             # run all tests (~390 tests)
bun run build        # alias for gen:skill-docs
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run gen:skill-docs -- --dry-run  # check if generated files are stale
bun run dashboard    # start the compliance dashboard on localhost:3000
bun run skill:check  # health dashboard for all skills/bins/policies
```

## Project structure

```
em-dash/
├── skills/              # All Claude Code skills (12 total)
│   ├── hipaa/           # /hipaa — HIPAA compliance router
│   ├── hipaa-assess/    # /hipaa-assess — organizational interview
│   ├── hipaa-scan/      # /hipaa-scan — automated scanning
│   ├── hipaa-remediate/ # /hipaa-remediate — fix findings + evidence
│   ├── hipaa-report/    # /hipaa-report — compliance reports
│   ├── hipaa-monitor/   # /hipaa-monitor — drift detection
│   ├── hipaa-breach/    # /hipaa-breach — breach notification
│   ├── hipaa-vendor/    # /hipaa-vendor — BA/vendor management + BAA tracking
│   ├── hipaa-risk/      # /hipaa-risk — NIST SP 800-30 risk assessment
│   ├── soc2/            # /soc2 — SOC 2 compliance router
│   ├── soc2-scan/       # /soc2-scan — SOC 2 automated scanning
│   └── em-dashboard/    # /em-dashboard — opens compliance dashboard
├── frameworks/          # Framework definitions (JSON) + checks registry
│   ├── schema.ts        # TypeScript interfaces for framework definitions
│   ├── hipaa.json       # HIPAA framework definition (requirements, checklist, questions)
│   ├── soc2.json        # SOC 2 framework definition (Trust Service Criteria)
│   ├── checks-registry.ts  # ~50 checks with multi-framework requirement mappings
│   └── index.ts         # Framework loader + validator
├── dashboard/           # Static dashboard site (HTML/CSS/JS)
├── policies/            # Rego/OPA rules — framework-agnostic (use check_id, not hipaa_ref)
├── templates/           # User-facing document templates
│   └── policies/        # Org policy markdown templates (9 files)
├── demo/                # Demo app with intentional HIPAA violations for testing
├── bin/                 # 7 CLI utilities (config, slug, tool-detect, evidence-hash, review-log, update-check, dashboard-update)
├── scripts/             # Build tooling + dashboard server
├── test/                # Validation + eval tests (~390 tests across 7 files)
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

These are resolved by `scripts/gen-skill-docs.ts`. The template engine loads framework
definitions from `frameworks/*.json` and uses them to parameterize content (disclaimer,
terminology, thresholds).

- `{{PREAMBLE}}` — shared preamble (session tracking, framework-specific disclaimer, AskUserQuestion format)
- `{{COMPLIANCE_DASHBOARD}}` — compliance dashboard display
- `{{TOOL_DETECTION}}` — scanning tool detection
- `{{PHI_PATTERNS}}` — 19 code-level sensitive data detection checks (framework-agnostic)
- `{{EVIDENCE_COLLECTION}}` — evidence hashing and storage
- `{{AWS_CHECKS}}` — ~65 AWS CLI commands grouped by compliance requirement
- `{{GCP_CHECKS}}` — ~40 gcloud commands grouped by compliance requirement
- `{{AZURE_CHECKS}}` — ~28 az CLI commands grouped by compliance requirement
- `{{IAC_POLICY_ENGINE}}` — Checkov + Conftest/Rego integration
- `{{DASHBOARD_UPDATES}}` — per-skill dashboard.json update instructions

## Framework architecture

em-dash supports multiple compliance frameworks from a shared scanning infrastructure.
Each framework is defined as a JSON file in `frameworks/`:

- **`frameworks/hipaa.json`** — HIPAA Security Rule (18 requirements, 50 checklist items)
- **`frameworks/soc2.json`** — SOC 2 Trust Service Criteria (7 requirements, 15 checklist items)
- **`frameworks/checks-registry.ts`** — ~50 checks mapped to multiple frameworks

Adding a new framework: write a `frameworks/<id>.json` definition mapping existing checks
to the framework's requirements. Create `skills/<id>/` and `skills/<id>-scan/` directories
with templates. Run `bun run gen:skill-docs`.

Rego policies in `policies/` use `check_id` (not `hipaa_ref`) and `package compliance.*`
so they work across all frameworks. Framework-specific requirement mapping happens in
the checks registry, not in Rego rules.

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
skills auto-update via the `hipaa-dashboard-update` utility (supports `--framework` flag
for multi-framework data separation).

**Features:** sidebar navigation, NL compliance summary, next-step recommendations,
skill run history with summaries, expandable findings with evidence linking,
compliance checklist (per-framework), risk register (matrix + table), vendor/BAA tracker,
drag-and-drop evidence upload (multi-framework), activity timeline, charts, HTML/CSV export,
open-in-Finder, styled confirm dialogs, dark mode (persisted), WebSocket live reload.

**Server endpoints:** `GET /api/dashboard`, `PUT /api/dashboard`, `POST /api/upload`,
`GET/DELETE /api/evidence/:file`, `GET /api/activity`, `POST /api/open`,
`GET /api/export/report?framework=hipaa`, `GET /api/export/csv?framework=hipaa`.
