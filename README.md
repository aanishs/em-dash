# em-dash

I'm [Aanish](https://github.com/aanishs). I build [CoralEHR](https://coralehr.com), an EHR for behavioral therapists.

We needed HIPAA compliance.

What we found was an industry that treats compliance like a badge. A nice logo. A dashboard. A procurement accessory. Something to wave around as temporary emotional support.

That would be fine if compliance were decorative. It is not.

It matters because healthcare data is deeply personal. Because one bad workflow, one missing control, one lazy assumption can create a very real mess for very real people. And when that happens, the vendor does not spiritually absorb the consequences on your behalf. They just invoice annually.

[Vanta](https://www.vanta.com/) wants $10k a year. We almost paid [Delve](https://delve.co/). They raised millions. Then [got accused of fabricating compliance evidence](https://techcrunch.com/2026/03/22/delve-accused-of-misleading-customers-with-fake-compliance/). Which is, admittedly, a bold approach to compliance.

But this is not just about one company acting insane in public. It points to a bigger problem. The market got very good at selling the *feeling* of compliance. Much less good at helping teams do the work.

Pay a vendor. Trust the black box. Download the PDF. Hope nobody asks a follow-up question.

Meanwhile, [OCR's most common enforcement finding](https://www.hipaajournal.com/hipaa-violation-cases/) is inadequate risk analysis. So even after all the dashboards, all the checklists, all the very serious security pages, teams are still missing the part that actually matters.

So we built em-dash.

Originally for CoralEHR. Now open source.

Because "pay $10k a year" and "guess" should not be the two main options.

em-dash is Claude Code plus HIPAA compliance.

Ten slash commands. A visual dashboard. Assess. Scan. Remediate. Report. Track vendors. Score risks. Export everything.

It checks your code, your cloud, your policies, and the gaps between them. It fixes what it can. Writes what's missing. Generates reports an auditor can actually use. And now it gives you a real-time compliance dashboard — evidence management, risk register, vendor/BAA tracking, findings, exportable reports — the things Vanta charges $10k/year for.

Everything runs locally. Everything is readable. No mystery score. No compliance cosplay.

(Why "em-dash"? The em dash and "delve" are both classic AI tells. LLMs can't stop using them. The Delve scandal pushed us to ship this publicly, so the name just... worked.)

**Who this is for:**
- You handle PHI and don't have a compliance person
- You know you need HIPAA but don't know where to start
- You got burned by vendor lock-in and want to own your compliance
- You want to see your compliance state, not just hear about it

---

## Install

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+

```bash
cd ~/.claude/skills
git clone https://github.com/aanishs/em-dash.git
cd em-dash && ./setup
```

To add it to a project (so teammates get it automatically):

```bash
cp -Rf ~/.claude/skills/em-dash .claude/skills/em-dash
rm -rf .claude/skills/em-dash/.git
cd .claude/skills/em-dash && ./setup
```

Optional scanning tools (recommended, not required):

```bash
pip install prowler        # AWS — 83 HIPAA checks
brew install trivy         # containers, code, IaC
pip install checkov        # 1000+ IaC rules with HIPAA framework
brew install conftest      # runs em-dash's bundled Rego policies
```

em-dash works without any of these. The 19 code-level checks only need grep. Cloud scanning uses native CLI commands.

## Demo

```
You:    /hipaa
Claude: No assessment yet. Run /hipaa-assess first.

You:    /hipaa-assess
Claude: Question 1/20: Has your organization designated a HIPAA Security Officer?

You:    Yeah, me. I'm the CTO.

Claude: Question 2/20: Formal risk analysis in the last 12 months?
        [... 18 more questions ...]

        Done. 3 CRITICAL gaps. Report saved.
        → ~/.em-dash/projects/myapp/assessment-report.md

You:    /hipaa-scan
Claude: prowler ✓ trivy ✓ checkov ✓
        19 code checks... cloud scan... IaC policies...

        7 findings:
        CRITICAL  PHI in console.log — src/api/patients.ts:47
        HIGH      No audit logging on PHI endpoints
        HIGH      S3 bucket unencrypted — patient-records-prod
        MEDIUM    No session timeout
        → ~/.em-dash/projects/myapp/scan-report.md

You:    /hipaa-remediate
Claude: 12 findings. Starting with CRITICAL.
        [patches patients.ts — removes PHI from logs]
        [generates audit-log middleware]
        [writes terraform patch for S3 encryption]
        [generates Access Control Policy from template]
        10/12 fixed. 2 need manual action.

You:    /hipaa-report
Claude: → Full Compliance Report (47 pages)
        → Executive Summary (1 page, 78% maturity)
        → Evidence Index (SHA-256 hashed)
```

Four commands. Assess, scan, fix, report.

## Usage

Open Claude Code in any project that handles PHI.

| Step | Command | What it does |
|------|---------|-------------|
| 1 | `/hipaa-assess` | 20-minute organizational interview. Security Rule, Privacy Rule, Breach Notification, BAAs. |
| 2 | `/hipaa-scan` | Automated scanning. Code (19 checks), cloud infrastructure (AWS/GCP/Azure), IaC (Checkov + Rego). |
| 3 | `/hipaa-remediate` | Fix findings. Code patches, Terraform fixes, policy document generation, evidence collection. |
| 4 | `/hipaa-report` | Generate compliance reports. Full report, executive summary, or trust report. |
| Ongoing | `/hipaa-monitor` | Detect compliance drift since last audit. |
| Ongoing | `/hipaa-vendor` | Vendor/BA management. Auto-detects services, tracks BAA status and risk tiers. |
| Ongoing | `/hipaa-risk` | NIST SP 800-30 risk assessment. Threat identification, scoring, treatment planning. |
| Anytime | `/hipaa-breach` | Guided breach notification with 4-factor risk assessment. |
| Start here | `/hipaa` | Compliance dashboard. Shows current state and recommends what to run next. |
| Dashboard | `/em-dashboard` | Opens the visual compliance dashboard at localhost:3000. |

### Workflow

```
/hipaa           ──> init dashboard + route to next step
/hipaa-assess    ──> Assessment Report ──┐
/hipaa-vendor    ──> Vendor/BAA Registry  ├──> /hipaa-remediate ──> /hipaa-report
/hipaa-scan      ──> Scan Findings ──────┘           │
/hipaa-risk      ──> Risk Register                   v
                                           /hipaa-monitor (ongoing)

/hipaa-breach (standalone — use when things go wrong)
/em-dashboard (opens visual dashboard at localhost:3000)
```

All skills auto-update `.em-dash/dashboard.json` as they run. The visual dashboard (`bun run dashboard` or `/em-dashboard`) shows checklists, findings, risks, vendors, evidence, and activity in real time.

## What it checks

### Code-level checks (always run, no tools required)

| Check | HIPAA Req | What it finds |
|-------|-----------|---------------|
| PHI identifiers | §164.514 | Patient names, SSNs, MRNs, DOBs, insurance IDs in code |
| Health data fields | §164.501 | Diagnosis codes, medications, lab results, clinical notes |
| PHI in logs | §164.312(b) | `console.log(patient.ssn)` |
| PHI in browser | §164.312(a)(1) | localStorage, cookies, URL params with PHI |
| RBAC | §164.312(a)(1) | Missing role checks on PHI endpoints |
| Audit logging | §164.312(b) | No audit trail for PHI access |
| Encryption at rest | §164.312(a)(2)(iv) | Unencrypted PHI, missing KMS |
| Session timeout | §164.312(a)(2)(iii) | No auto-logoff |
| Password hashing | §164.312(d) | MD5/SHA1 instead of bcrypt/argon2 |
| PHI in tests | §164.502 | Real SSNs in fixtures |
| PHI in errors | §164.312(a)(1) | Stack traces leaking PHI |
| Least privilege | §164.308(a)(4) | Wildcard IAM, hardcoded creds |
| DB columns | §164.502 | PHI column names in schemas |
| DB audit logging | §164.312(b) | Missing pgaudit config |
| DB encryption | §164.312(a)(2)(iv) | No TDE/pgcrypto |
| DB access | §164.312(a)(1) | GRANT ALL, PUBLIC grants |
| DB connections | §164.312(e)(1) | sslmode=disable |
| Push/email PHI | §164.312(a)(1) | PHI on lock screens, unencrypted email |
| Secrets in config | §164.312(a)(1) | Passwords in .env files |

<details>
<summary><strong>Cloud infrastructure scanning (AWS/GCP/Azure)</strong></summary>

| Provider | Checks | Coverage |
|----------|--------|----------|
| AWS | ~65 CLI commands | IAM, MFA, CloudTrail, VPC flow logs, S3/RDS/EBS encryption, KMS, security groups, GuardDuty, WAF, Config, Macie, Inspector, CloudFront TLS, backup immutability |
| GCP | ~40 gcloud commands | Cloud SQL, IAM, service account keys, KMS, firewall, GKE, audit logs, VPC Service Controls, Cloud Armor, DLP, Memorystore, Secret Manager |
| Azure | ~28 az commands | Storage encryption, SQL TDE/auditing, Key Vault, NSG, Defender, App Gateway WAF, Cosmos DB, private endpoints, backup policies |

All commands are read-only.

</details>

<details>
<summary><strong>IaC and scanning tool integrations</strong></summary>

| Tool | What it does |
|------|-------------|
| [Checkov](https://github.com/bridgecrewio/checkov) | 1000+ rules with built-in HIPAA framework. Terraform, CloudFormation, K8s. |
| [Conftest](https://github.com/open-policy-agent/conftest) | Runs em-dash's 6 bundled Rego policies against IaC files. |
| [Prowler](https://github.com/prowler-cloud/prowler) | 83 AWS HIPAA-specific checks. |
| [Trivy](https://github.com/aquasecurity/trivy) | Container, code, and IaC vulnerability scanning. |

All optional. em-dash works with just grep.

</details>

## What it produces

### Dashboard

Run `bun run dashboard` to open the compliance dashboard at localhost:3000.

| Feature | Description |
|---------|-------------|
| **NL Summary** | Auto-generated compliance summary: score, open findings, missing BAAs, top risk, next step |
| **Audit Pipeline** | Visual skill status with timestamps, finding counts, and 1-line summaries |
| **Requirements Checklist** | 49 HIPAA items, filterable by section, with evidence linking and notes |
| **Findings** | Expandable rows with severity, description, dates, linked evidence |
| **Risk Register** | 5x5 likelihood/impact matrix + table view with treatment strategies |
| **Vendor Tracker** | BAA status, expiry warnings, risk tiers, notes |
| **Evidence Library** | Drag-and-drop upload, SHA-256 integrity, search, pagination |
| **Export** | HTML compliance report + CSV findings export |

### Reports

| Report | Description |
|--------|-------------|
| **Full Compliance Report** | Every §164 requirement mapped, evidence indexed, corrective action plan |
| **Executive Summary** | 1 page. Compliance maturity score. For leadership. |
| **Trust Report** | Shareable with prospects and partners. Verified controls only. SHA-256 evidence hash. |

### Policy documents

`/hipaa-remediate` generates these from audited templates, customized for your organization:

| Policy |
|--------|
| Access Control Policy |
| Audit Logging Policy |
| Encryption Policy |
| Incident Response Plan |
| Risk Assessment Procedure |
| Workforce Security Policy |
| Contingency Plan |
| Business Associate Agreement (BAA) Template |

Based on [Datica's open-source HIPAA policies](https://github.com/Jowin/policies) (independently audited).

## CI/CD

Scan every PR automatically. Add the `hipaa-scan` label to trigger a compliance check via GitHub Actions.

```yaml
# .github/workflows/hipaa-scan.yml is included — just add your API key:
# Settings → Secrets → ANTHROPIC_API_KEY
```

See [docs/ci-setup.md](docs/ci-setup.md) for full setup instructions.

## Roadmap

HIPAA is shipped. We want to do everything Vanta and Delve claim to do — SOC 2, HITRUST, GDPR, ISO 27001 — and give it away for free.

The architecture already supports it. Each framework follows the same pattern: assess, scan, remediate, report, monitor. The template engine, evidence collection, Rego policies, and cloud scanning infrastructure are shared. Adding a new framework means writing skill templates and requirement mappings. The plumbing is built.

Contributors welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) — "Adding a new compliance framework."

## Disclaimer

> This is technical guidance, not legal advice. It does not constitute HIPAA certification. Consult qualified legal counsel and consider engaging a certified HIPAA auditor for formal compliance verification.

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Project architecture, contribution paths, testing guide |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [CLAUDE.md](CLAUDE.md) | Development reference |

## Troubleshooting

**Skills not showing up?** `cd ~/.claude/skills/em-dash && ./setup`

**Tests failing after pulling?** `bun install && bun run gen:skill-docs`

**Scanning tools not detected?** Verify they're in your PATH: `which prowler`

**Assessment seems stuck?** Say "continue the assessment." It picks up from saved state in `~/.em-dash/`.

## License

[MIT](LICENSE)
