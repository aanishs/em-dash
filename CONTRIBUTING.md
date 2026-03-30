# Contributing to em-dash

## Quick start

```bash
git clone https://github.com/aanishs/em-dash.git
cd em-dash
bun install
bun test          # ~141 tests, all free, under 4 seconds
```

## Architecture (v3 — cross-framework)

em-dash v3 ships the official NIST 800-53 catalog (1,196 controls). The LLM reads the actual law at runtime. Six framework filter files + tool bindings drive everything:

```
nist/
├── NIST_SP-800-53_rev5_catalog.json  # official NIST catalog (NEVER modify)
├── hipaa-filter.json                  # HIPAA → 800-53 (59 controls)
├── soc2-filter.json                   # SOC 2 → 800-53 (40 controls)
├── gdpr-filter.json                   # GDPR → 800-53 (22 controls)
├── pci-dss-filter.json                # PCI-DSS → 800-53 (16 controls)
├── cis-filter.json                    # CIS v8.1 → 800-53 (33 controls, with IG tiers)
├── tool-bindings.json                 # 800-53 control → verification tools (v3.0)
└── cross-framework.ts                 # shared cross-framework matrix module

frameworks/checks-registry.ts          # 68 em-dash checks — HOW to execute (pure execution)
bin/comply-db                           # SQLite compliance database + cross-framework matrix
bin/comply-orchestrate                  # parallel tool scanner (Prowler, Checkov, Trivy, etc.)
skills/                                # 8 skills + 6 framework routers
policies/                              # 8 Rego/OPA policy files (AWS, GCP, Azure, K8s, Docker)
templates/policies/                    # Policy document templates
scripts/validate-*.ts                  # filter validation scripts
```

**NIST catalog** is the source of truth. Never modify it.
**Filter files** map framework requirements to 800-53 control IDs. This is where domain knowledge lives.
**Tool bindings** map control IDs to em-dash/Prowler/Checkov/Trivy check IDs + CIS Benchmark refs.
**Checks registry** defines HOW to execute each check (command, pattern). No compliance mappings.
**Cross-framework module** joins all filter files on 800-53 control IDs for cross-framework impact scoring.
**Orchestrator** runs external scanning tools in parallel, normalizes findings to 800-53 controls.
**SQLite** stores all evidence per project: `~/.em-dash/projects/{slug}/compliance.db`

**Policies** are Rego rules that Conftest runs against IaC files (8 files, multi-cloud).
**Templates** are Markdown policy documents that `/comply-fix` customizes for the user.

## SKILL.md workflow

SKILL.md files are **generated** — don't edit them directly. They'd be overwritten on the next build.

1. Edit the `.tmpl` file (e.g., `skills/comply-assess/SKILL.md.tmpl`)
2. Run `bun run gen:skill-docs`
3. Commit both the `.tmpl` and generated `.md` files

**Why generated files?** The 8 skills share a lot of logic — PHI patterns, cloud commands, evidence collection, the preamble. Without the template engine, you'd copy-paste thousands of lines across skills and they'd drift apart. Placeholders keep everything in sync.

**Watch mode:** Run `bun run dev:skill` to auto-regenerate and validate on every template save.

## Your first PR in 15 minutes

The fastest way to contribute: add a single Rego policy rule.

```bash
git clone https://github.com/aanishs/em-dash.git && cd em-dash && bun install
```

1. Open `policies/encryption-at-rest.rego`
2. Add a new `deny` rule (see example below)
3. Run `bun test` — if it passes, you're done
4. Open a PR

That's it. Each Rego rule is self-contained — you don't need to understand the rest of the system.

## Five ways to contribute

Pick your level:

| Level        | Contribution                   | Time      |
| ------------ | ------------------------------ | --------- |
| Beginner     | Add a Rego policy rule         | 15 min    |
| Beginner     | Add a policy template          | 30 min    |
| Intermediate | Add a new scanning check       | 1 hour    |
| Intermediate | Add cloud provider checks      | 2-3 hours |
| Advanced     | Add a new compliance framework | 1-2 days  |

### 1. Add a Rego policy rule (beginner)

Add one `deny` rule to an existing file in `policies/`. Every rule must include `check_id`, `severity`, `resource`, and `msg`.

Example — add a rule to `policies/encryption-at-rest.rego`:

```rego
deny[msg] {
    input.resource.aws_s3_bucket[name].versioning[_].enabled != true
    msg := {
        "check_id": "rego-s3-encryption",
        "severity": "HIGH",
        "resource": name,
        "msg": sprintf("S3 bucket '%s' does not have versioning enabled", [name])
    }
}
```

Then add the filename to `expectedPolicies` in `test/skill-validation.test.ts` and run `bun test`.

<details>
<summary>Example PR: Add a Rego policy rule</summary>

File: `policies/encryption-at-rest.rego`

```diff
diff --git a/policies/encryption-at-rest.rego b/policies/encryption-at-rest.rego
index 1a2b3c4..5d6e7f8 100644
--- a/policies/encryption-at-rest.rego
+++ b/policies/encryption-at-rest.rego
@@ -45,3 +45,13 @@ deny[msg] {
         "msg": sprintf("RDS instance '%s' does not have encryption enabled", [name])
     }
 }
+
+deny[msg] {
+    input.resource.aws_s3_bucket[name].versioning[_].enabled != true
+    msg := {
+        "check_id": "rego-s3-encryption",
+        "severity": "HIGH",
+        "resource": name,
+        "msg": sprintf("S3 bucket '%s' does not have versioning enabled", [name])
+    }
+}
```

Then run:

```bash
bun test
```

</details>

### 2. Add a new scanning check (intermediate)

Add a check to `PHI_PATTERNS` in `scripts/gen-skill-docs.ts`. Each check needs:

- A grep/regex pattern that detects the problem
- The HIPAA requirement it maps to
- A severity level
- A human-readable description

Then run `bun run gen:skill-docs` and `bun test` to verify it appears in all the right places.

<details>
<summary>Example PR: Add a new scanning check</summary>

File: `scripts/gen-skill-docs.ts`

```diff
diff --git a/scripts/gen-skill-docs.ts b/scripts/gen-skill-docs.ts
index 3a4b5c6..7d8e9f0 100644
--- a/scripts/gen-skill-docs.ts
+++ b/scripts/gen-skill-docs.ts
@@ -156,6 +156,16 @@ const PHI_PATTERNS = [
       severity: "HIGH",
       description: "Log files containing unencrypted database credentials"
     },
+    {
+      pattern: "process\\.env\\.\\w+",
+      requirement: "§164.312(a)(2)(i)",
+      severity: "HIGH",
+      description: "Credentials accessed from environment variables without encryption wrapper"
+    },
     {
       pattern: "TODO.*encrypt|FIXME.*HIPAA",
       requirement: "§164.312(c)(1)",
```

Then run:

```bash
bun run gen:skill-docs
bun test
```

</details>

### 3. Add a policy template (beginner)

Write an organizational policy document in `templates/policies/`. Follow the existing pattern — Markdown with placeholder sections for organization-specific details. Reference the relevant HIPAA sections.

Add the filename to `expectedTemplates` in `test/skill-validation.test.ts`.

<details>
<summary>Example PR: Add a policy template</summary>

File: `templates/policies/data-retention-policy.md`

```diff
diff --git a/templates/policies/data-retention-policy.md b/templates/policies/data-retention-policy.md
new file mode 100644
index 0000000..1a2b3c4
--- /dev/null
+++ b/templates/policies/data-retention-policy.md
@@ -0,0 +1,45 @@
+# Data Retention and Disposal Policy
+
+**Organization:** [Organization Name]\
+**Effective Date:** [Date]\
+**HIPAA Reference:** § 164.316(b)(1)(i) — Policies and procedures for information security
+
+## Purpose
+
+This policy establishes data retention and secure disposal procedures for all Protected Health Information (PHI) and electronic Protected Health Information (ePHI) to ensure compliance with HIPAA requirements.
+
+## Scope
+
+This policy applies to all employees, contractors, and workforce members who handle PHI/ePHI.
+
+## Retention Schedule
+
+| Data Type | Minimum Retention Period | Justification |
+|-----------|--------------------------|---------------|
+| Patient Records | [7 years] | § 164.530(j)(1) |
+| Audit Logs | [6 months] | § 164.312(b) |
+| Incident Reports | [3 years] | § 164.404(b) |
+
+## Secure Disposal
+
+All PHI must be securely destroyed using:
+
+- [Your standard: e.g., NIST SP 800-88 Guidelines]
+- [Destruction method: e.g., encrypted-hard-drive incineration]
+- [Verification: Certificate of Destruction required]
```

File: `test/skill-validation.test.ts`

```diff
diff --git a/test/skill-validation.test.ts b/test/skill-validation.test.ts
index 2a3b4c5..6d7e8f9 100644
--- a/test/skill-validation.test.ts
+++ b/test/skill-validation.test.ts
@@ -28,6 +28,7 @@ const expectedTemplates = [
   "contingency-plan",
   "encryption",
   "workforce-security",
+  "data-retention-policy",
 ];

 test("all expected policy templates exist", () => {
```

Then run:

```bash
bun test
```

</details>

### 4. Add a new cloud provider or expand existing checks (intermediate)

Add a new resolver function in `scripts/gen-skill-docs.ts` for the provider's CLI commands. Follow the AWS/GCP/Azure pattern: group commands by HIPAA requirement, include the CLI command and what to check in the output.

Add a new `{{PROVIDER_CHECKS}}` placeholder, wire it into the scan skill template, and add test coverage.

<details>
<summary>Example PR: Add cloud provider checks</summary>

Add a new resolver to `scripts/gen-skill-docs.ts`:

````diff
diff --git a/scripts/gen-skill-docs.ts b/scripts/gen-skill-docs.ts
index 3a4b5c6..7d8e9f0 100644
--- a/scripts/gen-skill-docs.ts
+++ b/scripts/gen-skill-docs.ts
@@ -520,6 +520,18 @@ function resolveAzureChecks(): string {
   return checks.join("\\n\\n");
 }

+// Used via custom placeholder integration similar to AWS_CHECKS
+function resolveOciBucketEncryption(): string {
+  return `## Encryption — Oracle Cloud
+**§ 164.312(c)(1) — Encryption and decryption mechanisms**
+\`\`\`bash
+oci os bucket get --bucket-name my-bucket --query 'data.\"encryption-properties\"'
+# Check: kmsKeyId is set
+\`\`\``;
+}
+
 module.exports = {
   resolveSkillTemplates,
   resolveAwsChecks,
   resolveGcpChecks,
   resolveAzureChecks,
+  resolveOciBucketEncryption,
 };

```bash
bun run gen:skill-docs
bun test
````

</details>

### 5. Add a new compliance framework (advanced)

This is the big one. em-dash is designed for it — the architecture supports SOC 2, HITRUST, ISO 27001, and more. Here's how:

1. **Create skill templates.** Start with `skills/<framework>-assess/SKILL.md.tmpl` using the HIPAA assess skill as a pattern. You need at minimum: assess, scan, remediate, report.
2. **Reuse shared infrastructure.** `{{TOOL_DETECTION}}`, `{{EVIDENCE_COLLECTION}}`, `{{AWS_CHECKS}}` etc. all work across frameworks. You're writing the compliance logic (which requirements map to which checks), not the scanning plumbing.
3. **Add framework-specific Rego policies** to `policies/` with `package <framework>.<category>` naming.
4. **Add requirement mappings** — which cloud CLI commands map to which framework controls.
5. **Add tests** to `test/skill-validation.test.ts` for template existence, generated file freshness, and requirement coverage.
6. **Update `scripts/gen-skill-docs.ts`** — the `findTemplates()` function already scans `skills/` automatically, but you may need new placeholders for framework-specific content.
7. **Update the README** roadmap table and the router skill.

<details>
<summary>Example PR: Add a new compliance framework</summary>

File: `skills/iso27001-assess/SKILL.md.tmpl`

```diff
diff --git a/skills/iso27001-assess/SKILL.md.tmpl b/skills/iso27001-assess/SKILL.md.tmpl
new file mode 100644
index 0000000..1a2b3c4
--- /dev/null
+++ b/skills/iso27001-assess/SKILL.md.tmpl
@@ -0,0 +1,95 @@
+{{PREAMBLE}}
+
+# ISO 27001 Information Security Assessment
+
+## Overview
+
+This skill guides you through a structured ISO 27001 compliance assessment for your organization. You'll document your current security controls, identify gaps against the 14 domains of ISO 27001, and receive a remediation roadmap.
+
+**Domains covered:**
+1. Information Security Policies
+2. Organization of Information Security
+3. Human Resource Security
+4. Asset Management
+5. Access Control
+6. Cryptography
+7. Physical and Environmental Security
+8. Operations Security
+9. Communications Security
+10. System Acquisition, Development, and Maintenance
+11. Supplier Relationships
+12. Information Security Incident Management
+13. Business Continuity Management
+14. Compliance
+
+**Duration:** ~45 minutes
+
+---
+
+## Domain 1: Information Security Policies (Clause A.5)
+
+### Question 1
+
+\`\`\`json
+{
+  "type": "AskUserQuestion",
+  "title": "Do you have documented information security policies?",
+  "options": ["Fully documented and approved", "Partially documented", "Under development", "Not in place"],
+  "followUp": "Provide a brief summary of your policy documentation scope."
+}
+\`\`\`
+
+---
+
+## Automated Scanning
+
+Run the companion \`iso27001-scan\` skill to:
+
+- Detect security tools (SIEM, DLP, encryption, access management)
+- Scan for common configuration weaknesses
+- Test cloud compliance posture
+- Verify asset inventory practices
+- Check incident response capabilities
+
+{{TOOL_DETECTION}}
+
+{{EVIDENCE_COLLECTION}}
+
+---
+
+## Next Steps
+
+1. Complete all assessment questions
+2. Run \`iso27001-scan\` to collect automated evidence
+3. Review findings in the compliance dashboard
+4. Use \`iso27001-remediate\` to plan remediation
+5. Track progress with \`iso27001-monitor\`
```

File: `policies/iso27001-access-control.rego`

```diff
diff --git a/policies/iso27001-access-control.rego b/policies/iso27001-access-control.rego
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/policies/iso27001-access-control.rego
@@ -0,0 +1,28 @@
+package iso27001.access_control
+
+import rego.v1
+
+deny[msg] {
+    input.resource.aws_iam_policy[name].Statement[_].Effect == "Allow"
+    input.resource.aws_iam_policy[name].Statement[_].Action == "*"
+    input.resource.aws_iam_policy[name].Statement[_].Resource == "*"
+    msg := {
+        "iso27001_ref": "A.9.2.1 User registration and de-registration",
+        "severity": "CRITICAL",
+        "resource": name,
+        "msg": sprintf("IAM policy '%s' grants overly broad permissions (*)", [name])
+    }
+}
+
+deny[msg] {
+    input.resource.aws_security_group[name].ingress[_].cidr_blocks[_] == "0.0.0.0/0"
+    input.resource.aws_security_group[name].ingress[_].from_port == 3306
+    msg := {
+        "iso27001_ref": "A.9.4.3 Password management",
+        "severity": "HIGH",
+        "resource": name,
+        "msg": sprintf("Security group '%s' allows public access to database port 3306", [name])
+    }
+}
```

File: `test/skill-validation.test.ts`

```diff
diff --git a/test/skill-validation.test.ts b/test/skill-validation.test.ts
index 2a3b4c5..6d7e8f9 100644
--- a/test/skill-validation.test.ts
+++ b/test/skill-validation.test.ts
@@ -8,11 +8,13 @@ const expectedSkills = [
   "hipaa-assess",
   "hipaa-fix",
   "hipaa-report",
   "hipaa-auto",
   "hipaa-breach",
   "hipaa-assess",
   "hipaa-scan",
+  "iso27001-assess",
+  "iso27001-scan",
 ];

 const expectedPolicies = [
@@ -22,6 +24,7 @@ const expectedPolicies = [
   "hipaa-secrets",
   "hipaa-transmission-security",
   "hipaa-k8s-security",
+  "iso27001-access-control",
 ];

 test("all expected skills exist", () => {
```

Then run:

```bash
bun run gen:skill-docs
bun test
```

</details>

## Template placeholders

These are resolved by `scripts/gen-skill-docs.ts`:

| Placeholder                | What it generates                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{PREAMBLE}}`             | Session tracking, update check, disclaimer, AskUserQuestion format, compliance completeness principle, contributor mode, completion status, evidence collection, review logging |
| `{{COMPLIANCE_DASHBOARD}}` | Compliance status dashboard                                                                                                                                                     |
| `{{TOOL_DETECTION}}`       | Scanning tool and cloud CLI detection                                                                                                                                           |
| `{{PHI_PATTERNS}}`         | 19 code-level security checks                                                                                                                                                   |
| `{{EVIDENCE_COLLECTION}}`  | Evidence hashing and storage                                                                                                                                                    |
| `{{AWS_CHECKS}}`           | ~65 AWS CLI commands for HIPAA scanning                                                                                                                                         |
| `{{GCP_CHECKS}}`           | ~40 gcloud commands for HIPAA scanning                                                                                                                                          |
| `{{AZURE_CHECKS}}`         | ~28 az CLI commands for HIPAA scanning                                                                                                                                          |
| `{{IAC_POLICY_ENGINE}}`    | Checkov + Conftest/Rego policy scanning                                                                                                                                         |
| `{{DASHBOARD_UPDATES}}`    | Per-skill dashboard.json update instructions (checklist, findings, vendors, risks)                                                                                              |

## Testing

```bash
bun test                  # ~135 tests, free, <4s
bun run skill:check       # health dashboard for all skills/bins/policies
bun run dev:skill         # watch mode: auto-regen + validate on change
```

### Test files

| File                            | Tests  | What it validates                                                                                                            |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `test/architecture.test.ts`     | ~47    | NIST catalog, all filter files, tool bindings, CIS, cross-framework matrix, SQLite DB |
| `test/skill-validation.test.ts` | ~40    | skill templates, generated files, frontmatter, bin utilities, Rego policies |
| `test/rego-policy.test.ts`      | ~22    | Rego policies against IaC fixtures (AWS, GCP, Azure, K8s, Docker)           |
| `test/framework.test.ts`        | ~10    | checks-registry validation, framework loader                                |
| `test/bin-smoke.test.ts`        | ~20    | Actually executes bin utilities and validates output format                  |
| `test/touchfiles.test.ts`       | ~11    | Diff-based test selection logic (glob matching, touchfile maps)              |
| `test/skill-e2e.test.ts`        | (stub) | E2E skill tests — gated behind EVALS=1                                      |

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
  const scanSkill = fs.readFileSync("skills/comply-scan/SKILL.md", "utf-8");
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

- [ ] `bun test` passes (~141 tests)
- [ ] `bun run gen:skill-docs -- --dry-run` passes (if templates changed)
- [ ] `bun run skill:check` is all green
- [ ] Both `.tmpl` and generated `.md` files committed (if templates changed)
- [ ] New Rego policies have `check_id` and `severity` in all `deny` rules
- [ ] New policy templates added to `expectedTemplates` in tests
- [ ] CHANGELOG updated (user-facing language, not implementation details)
- [ ] README updated if adding a new skill or check category

## License

By contributing, you agree that your contributions will be licensed under MIT.
