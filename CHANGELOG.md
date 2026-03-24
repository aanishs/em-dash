# Changelog

## v1.3.0 — Multi-framework architecture + launch kit

**Framework abstraction layer.** em-dash is no longer HIPAA-only. A new `frameworks/` directory defines compliance frameworks as JSON files with requirements, checklists, thresholds, terminology, and assessment questions. A shared checks registry (~50 checks) maps each check to requirements across multiple frameworks. Adding a new framework means writing a JSON definition — not duplicating the skill set.

**SOC 2 scaffolding.** Two new skills: `/soc2` (router) and `/soc2-scan` (automated scanning mapped to Trust Service Criteria). Same scanning infrastructure as HIPAA, different requirement lens. The SOC 2 definition is a stub that needs domain expertise — contributions welcome.

**Framework-agnostic Rego policies.** All 6 policy files renamed (removed `hipaa-` prefix), package names changed from `hipaa.*` to `compliance.*`, and `hipaa_ref` replaced with `check_id` in all 43 deny rules. Framework-specific mapping happens in the checks registry, not in Rego.

**Framework-aware dashboard.** `hipaa-dashboard-update` now accepts `--framework soc2` (or any framework ID). Export endpoints support `?framework=` query param. Upload form offers HIPAA, SOC 2, GDPR, PCI-DSS, and ISO 27001. Each framework's findings, checklist, and evidence tracked separately in `dashboard.json`.

**Template engine parameterization.** `gen-skill-docs.ts` loads framework definitions and uses them for disclaimers, terminology ("PHI" vs "sensitive information" vs "cardholder data"), and section headers. Generates 12 skills (10 HIPAA + 2 SOC 2).

**Bug fixes from real-world scanning.** 7 bugs fixed after running em-dash against a production AWS account:
- Slug inconsistency: 6 skills used `basename` while others used `hipaa-slug` — standardized all 30+ calls
- Evidence hash: `xargs` pipeline failed silently on macOS — rewrote using `hash_file()` with validation
- Dashboard note duplication: same note appended twice — added `includes()` dedup
- Prowler timing: scan report written before Prowler finished — added must-complete instructions
- Finding count drift: `findingAdd()` didn't update skill counts — now auto-recalculates
- Evidence linking: scan skill never used `--evidence` flag — added examples and instructions
- Evidence preservation: raw Prowler/Trivy/Checkov output not saved — added explicit copy section

**Demo app.** `demo/hipaa-demo-app` — a deliberately insecure health-tech backend with 15 intentional HIPAA violations across code (PHI in logs, weak auth, no RBAC) and Terraform (open S3, unencrypted RDS, IAM wildcards). Safe surface for demos and testing.

**Launch kit.** README badges + comparison table (em-dash vs Vanta vs Drata vs Comp AI). CONTRIBUTING.md "first PR in 15 minutes" guide with skill-level labels. Comparison landing page for GitHub Pages. 9 good-first-issues seeded.

**Dark mode persistence.** Dashboard theme preference saved in localStorage. Early `<script>` in `<head>` prevents flash on load. (Thanks @adityakulraj — PR #13)

**Workforce training policy template.** New `templates/policies/workforce-training.md` with new hire training, ongoing refresher, sanctions, remote worker requirements. (Thanks @weedorflow — PR #14)

**CONTRIBUTING.md examples.** Collapsible diff examples for each of the 5 contribution types. (Thanks @shogun444 — PR #15)

**~390 tests. 12 skills. 50 checks. 6 Rego policies. 9 policy templates.**

## v1.2.0 — Design system polish + documentation

**Pipeline fix.** The audit pipeline now correctly reads skill status from `dashboard.json`. Previously all 6 steps showed `–` because the code looked up `assess` but the data used `hipaa-assess`. Fixed key resolution, status normalization (`completed`→`complete`, `not-run`→`pending`), and the next-step recommendation logic.

**Pipeline redesign.** 6 equal-width columns (`repeat(6, 1fr)`), larger icons (36px), `font-weight: 600` step names, 2-line summary clamp instead of single-line truncation. Pending steps use dashed borders to signal "not yet run." Collapses to 3-col on mobile.

**Chart grid fix.** The third overview chart (Evidence Coverage) was overflowing offscreen because chart containers lacked `min-width: 0`. All three charts now render correctly at any viewport width.

**Risk matrix scaling.** Changed from fixed 48px cell widths to fluid `1fr` columns with `max-width: 480px`. Matrix fills its container instead of sitting tiny and centered.

**Vendor row alignment.** BAA badges, expiry dates, and risk tier pills now have minimum widths and consistent text alignment, so they form proper columns across rows.

**Design system document.** New `docs/design.md` covering colors, typography, spacing, every component spec, Chart.js v4 configuration, responsive breakpoints, and interaction patterns.

**Usage guide.** New `docs/guide.md` with Playwright-captured screenshots of all 7 pages: Overview, Findings, Checklist, Evidence, Risks, Vendors, Activity. Each section explains what the page shows and how to use it.

**README screenshot.** Hero image of the dashboard added to the README intro.

**328 tests. 0 failures.**

## v1.1.0 — Compliance dashboard + vendor/risk management

**Visual compliance dashboard.** Run `bun run dashboard` or `/em-dashboard` to open a real-time dashboard at localhost:3000. Sidebar navigation, dark mode, live reload. Checklist tracking, evidence management, risk register, vendor/BAA tracking, findings, activity timeline, charts — running locally for free.

**Natural language summary.** The Overview page generates a plain-English compliance summary from your data: "Your HIPAA compliance is 72%. 9 open findings (2 critical). 1 vendor missing BAA. Top risk: unencrypted PHI (score 20)." Plus a "Next step" recommendation based on which skills you've run.

**Skill intelligence.** Pipeline cards show when each skill last ran ("4 days ago"), how many findings it produced, and a 1-line summary of what it did. Skills write a `summary` field to the dashboard on completion.

**Two new skills.** `/hipaa-vendor` auto-detects third-party services from your codebase (AWS SDK, Stripe, Twilio, etc.) and interviews about BAA status. `/hipaa-risk` conducts a NIST SP 800-30 risk assessment with likelihood/impact scoring and treatment planning. Both write directly to the dashboard.

**Dashboard-aware skills.** All 10 skills now auto-update `.em-dash/dashboard.json` as they work. Scan finds a public S3 bucket? Dashboard shows the finding. Assessment confirms a security officer? Checklist item gets checked. Remediation fixes an issue? Finding gets resolved. No manual sync needed.

**Expandable findings.** Click any finding to see full description, discovered/resolved dates, linked evidence files, and requirement mapping. Evidence auto-matched by requirement ID.

**`hipaa-dashboard-update` utility.** CLI tool with subcommands for all dashboard data types — `checklist`, `finding` (add/resolve), `vendor` (add/update), `risk` (add). Skills call it inline as they discover things.

**Export.** Download a full HTML compliance report or CSV findings export from the sidebar.

**Open in Finder.** Reveal evidence files and compliance artifacts in your system file manager. Per-file "Reveal" button + sidebar shortcut.

**Styled confirm dialogs.** No more browser `confirm()` popups. All destructive actions use styled modals matching the dashboard design.

**~330 tests. All free. Under 3 seconds.**

## v1.0.0 — Initial release

em-dash: a HIPAA compliance platform for Claude Code. Built for teams handling PHI.

**Seven skills that chain together.** `/hipaa-assess` interviews you about organizational controls, `/hipaa-scan` checks your code and infrastructure, `/hipaa-remediate` fixes findings and generates policy documents, `/hipaa-report` produces auditor-ready reports, `/hipaa-monitor` detects drift, and `/hipaa-breach` guides breach notification. `/hipaa` is the router that shows your dashboard and tells you what to do next.

**Cloud infrastructure scanning.** ~65 AWS CLI commands, ~40 gcloud commands, and ~28 Azure CLI commands — all read-only — covering encryption, IAM, logging, network security, and more. Each finding maps to a specific HIPAA requirement.

**Infrastructure-as-Code scanning.** Checkov integration (1000+ rules with a built-in HIPAA framework) and 6 bundled Rego/OPA policies for Terraform, CloudFormation, and Kubernetes via Conftest.

**19 code-level security checks.** PHI in logs, PHI in browser storage, missing RBAC, missing audit logging, weak password hashing, hardcoded credentials, and more — all run with just grep.

**8 policy document templates.** Access Control, Audit Logging, Encryption, Incident Response, Risk Assessment, Workforce Security, Contingency Plan, and BAA template.

**CI/CD integration.** Add the `hipaa-scan` label to any PR and em-dash scans it automatically via GitHub Actions. See [docs/ci-setup.md](docs/ci-setup.md).

**Evidence collection with integrity.** SHA-256 hashed evidence files with timestamps for auditor verification.

**280+ tests. All free. Under 3 seconds.**
