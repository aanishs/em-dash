# Contributing to em-dash

## Quick start

```bash
git clone https://github.com/aanishs/em-dash.git
cd em-dash
bun install
bun test          # ~340 tests, all free, under 3 seconds
```

## Project architecture

em-dash is a collection of Claude Code skills that chain together. Here's the mental model:

```
skills/           10 skills (7 HIPAA + vendor + risk + dashboard), each with a SKILL.md.tmpl template
    ↓
scripts/          gen-skill-docs.ts resolves {{PLACEHOLDERS}} → SKILL.md
    ↓
SKILL.md          Generated files — Claude reads these at runtime
    ↓
dashboard/        Static site (HTML/CSS/JS) + Bun server for visual compliance dashboard
policies/         6 Rego/OPA rules for IaC policy scanning
templates/        8 policy document templates (Markdown)
bin/              7 CLI utilities (config, slug, tool-detect, evidence-hash, review-log, update-check, dashboard-update)
test/             ~340 tests across 5 test files + helpers
```

**Skills** are prompt templates. They tell Claude what to do — run commands, ask questions, generate reports. The template engine (`scripts/gen-skill-docs.ts`) injects shared blocks like PHI scanning patterns, cloud CLI commands, and evidence collection logic.

**Policies** are Rego rules that Conftest runs against your IaC files. Each `deny` rule maps to a HIPAA requirement.

**Templates** are Markdown policy documents (Access Control Policy, Incident Response Plan, etc.) that `/hipaa-remediate` customizes for the user's organization.

## SKILL.md workflow

SKILL.md files are **generated** — don't edit them directly. They'd be overwritten on the next build.

1. Edit the `.tmpl` file (e.g., `skills/hipaa-assess/SKILL.md.tmpl`)
2. Run `bun run gen:skill-docs`
3. Commit both the `.tmpl` and generated `.md` files

**Why generated files?** The 10 skills share a lot of logic — PHI patterns, cloud commands, evidence collection, the preamble. Without the template engine, you'd copy-paste thousands of lines across skills and they'd drift apart. Placeholders keep everything in sync.

**Watch mode:** Run `bun run dev:skill` to auto-regenerate and validate on every template save.

## Your first PR in 15 minutes

The fastest way to contribute: add a single Rego policy rule.

```bash
git clone https://github.com/aanishs/em-dash.git && cd em-dash && bun install
```

1. Open `policies/hipaa-encryption-at-rest.rego`
2. Add a new `deny` rule (see example below)
3. Run `bun test` — if it passes, you're done
4. Open a PR

That's it. Each Rego rule is self-contained — you don't need to understand the rest of the system.

## Five ways to contribute

Pick your level:

| Level | Contribution | Time |
|-------|-------------|------|
| Beginner | Add a Rego policy rule | 15 min |
| Beginner | Add a policy template | 30 min |
| Intermediate | Add a new scanning check | 1 hour |
| Intermediate | Add cloud provider checks | 2-3 hours |
| Advanced | Add a new compliance framework | 1-2 days |

### 1. Add a Rego policy rule (beginner)

Add one `deny` rule to an existing file in `policies/`. Every rule must include `hipaa_ref`, `severity`, `resource`, and `msg`.

Example — add a rule to `policies/hipaa-encryption-at-rest.rego`:
```rego
deny[msg] {
    input.resource.aws_s3_bucket[name].versioning[_].enabled != true
    msg := {
        "hipaa_ref": "§164.312(c)(1)",
        "severity": "HIGH",
        "resource": name,
        "msg": sprintf("S3 bucket '%s' does not have versioning enabled", [name])
    }
}
```

Then add the filename to `expectedPolicies` in `test/skill-validation.test.ts` and run `bun test`.

### 2. Add a new scanning check (intermediate)

Add a check to `PHI_PATTERNS` in `scripts/gen-skill-docs.ts`. Each check needs:
- A grep/regex pattern that detects the problem
- The HIPAA requirement it maps to
- A severity level
- A human-readable description

Then run `bun run gen:skill-docs` and `bun test` to verify it appears in all the right places.

### 3. Add a policy template (beginner)

Write an organizational policy document in `templates/policies/`. Follow the existing pattern — Markdown with placeholder sections for organization-specific details. Reference the relevant HIPAA sections.

Add the filename to `expectedTemplates` in `test/skill-validation.test.ts`.

### 4. Add a new cloud provider or expand existing checks (intermediate)

Add a new resolver function in `scripts/gen-skill-docs.ts` for the provider's CLI commands. Follow the AWS/GCP/Azure pattern: group commands by HIPAA requirement, include the CLI command and what to check in the output.

Add a new `{{PROVIDER_CHECKS}}` placeholder, wire it into the scan skill template, and add test coverage.

### 5. Add a new compliance framework (advanced)

This is the big one. em-dash is designed for it — the architecture supports SOC 2, HITRUST, ISO 27001, and more. Here's how:

1. **Create skill templates.** Start with `skills/<framework>-assess/SKILL.md.tmpl` using the HIPAA assess skill as a pattern. You need at minimum: assess, scan, remediate, report.
2. **Reuse shared infrastructure.** `{{TOOL_DETECTION}}`, `{{EVIDENCE_COLLECTION}}`, `{{AWS_CHECKS}}` etc. all work across frameworks. You're writing the compliance logic (which requirements map to which checks), not the scanning plumbing.
3. **Add framework-specific Rego policies** to `policies/` with `package <framework>.<category>` naming.
4. **Add requirement mappings** — which cloud CLI commands map to which framework controls.
5. **Add tests** to `test/skill-validation.test.ts` for template existence, generated file freshness, and requirement coverage.
6. **Update `scripts/gen-skill-docs.ts`** — the `findTemplates()` function already scans `skills/` automatically, but you may need new placeholders for framework-specific content.
7. **Update the README** roadmap table and the router skill.

## Template placeholders

These are resolved by `scripts/gen-skill-docs.ts`:

| Placeholder | What it generates |
|-------------|------------------|
| `{{PREAMBLE}}` | Session tracking, update check, disclaimer, AskUserQuestion format, compliance completeness principle, contributor mode, completion status, evidence collection, review logging |
| `{{COMPLIANCE_DASHBOARD}}` | Compliance status dashboard |
| `{{TOOL_DETECTION}}` | Scanning tool and cloud CLI detection |
| `{{PHI_PATTERNS}}` | 19 code-level security checks |
| `{{EVIDENCE_COLLECTION}}` | Evidence hashing and storage |
| `{{AWS_CHECKS}}` | ~65 AWS CLI commands for HIPAA scanning |
| `{{GCP_CHECKS}}` | ~40 gcloud commands for HIPAA scanning |
| `{{AZURE_CHECKS}}` | ~28 az CLI commands for HIPAA scanning |
| `{{IAC_POLICY_ENGINE}}` | Checkov + Conftest/Rego policy scanning |
| `{{DASHBOARD_UPDATES}}` | Per-skill dashboard.json update instructions (checklist, findings, vendors, risks) |

## Testing

```bash
bun test                  # ~340 tests, free, <3s
bun run skill:check       # health dashboard for all skills/bins/policies
bun run dev:skill         # watch mode: auto-regen + validate on change
```

### Test files

| File | Tests | What it validates |
|------|-------|------------------|
| `test/skill-validation.test.ts` | ~250 | 10 skill templates, generated files, frontmatter, PHI checks, cloud coverage, bin utilities, path hygiene, preamble sections |
| `test/rego-policy.test.ts` | ~22 | Rego policies against IaC fixtures (AWS, GCP, Azure, K8s) |
| `test/bin-smoke.test.ts` | ~20 | Actually executes bin utilities and validates output format |
| `test/touchfiles.test.ts` | ~11 | Diff-based test selection logic (glob matching, touchfile maps) |
| `test/skill-e2e.test.ts` | (stub) | E2E skill tests — gated behind EVALS=1 |

### Eval infrastructure (for paid E2E tests)

```bash
bun run test:evals        # E2E tests via claude -p (diff-based, ~$2/run)
bun run test:evals:all    # force all E2E tests regardless of diff
bun run eval:list         # show all eval runs
bun run eval:select       # preview which tests would run based on diff
bun run eval:compare      # compare two eval runs
bun run eval:summary      # aggregate stats across all runs
```

Test helpers in `test/helpers/`:
- **touchfiles.ts** — diff-based test selection (only run tests whose files changed)
- **session-runner.ts** — spawns `claude -p` with NDJSON streaming
- **eval-store.ts** — persists results to `~/.em-dash-dev/evals/` with auto-comparison
- **llm-judge.ts** — scores compliance reports on regulatory accuracy, finding specificity, remediation quality, evidence rigor
- **e2e-helpers.ts** — scaffolds test projects with planted HIPAA violations

### Adding tests

Tests live in `test/skill-validation.test.ts`. To add a test for your change:

```typescript
test("my new check appears in generated scan skill", () => {
  const scanSkill = fs.readFileSync("skills/hipaa-scan/SKILL.md", "utf-8");
  expect(scanSkill).toContain("my-new-pattern");
});
```

## Code style

- Skill templates use natural language for logic between bash blocks
- Each bash block is self-contained (no shell variables carried between blocks)
- Questions are asked ONE AT A TIME via AskUserQuestion
- Every output includes the DISCLAIMER

## PR checklist

Before submitting:

- [ ] `bun test` passes (~340 tests)
- [ ] `bun run gen:skill-docs -- --dry-run` passes (if templates changed)
- [ ] `bun run skill:check` is all green
- [ ] Both `.tmpl` and generated `.md` files committed (if templates changed)
- [ ] New Rego policies have `hipaa_ref` and `severity` in all `deny` rules
- [ ] New policy templates added to `expectedTemplates` in tests
- [ ] CHANGELOG updated (user-facing language, not implementation details)
- [ ] README updated if adding a new skill or check category

## License

By contributing, you agree that your contributions will be licensed under MIT.
