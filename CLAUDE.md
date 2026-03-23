# em-dash development

## Commands

```bash
bun install          # install dependencies
bun test             # run skill validation tests
bun run build        # generate SKILL.md files from templates
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run gen:skill-docs -- --dry-run  # check if generated files are stale
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
│   └── hipaa-breach/    # /hipaa-breach — breach notification
├── policies/            # Rego/OPA rules for IaC policy scanning
├── templates/           # User-facing document templates
│   └── policies/        # Org policy markdown templates (8 files)
├── bin/                 # CLI utilities (hipaa-config, hipaa-slug, etc.)
├── scripts/             # Build tooling (gen-skill-docs.ts)
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
