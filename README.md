# em-dash

[![Tests](https://img.shields.io/badge/tests-197-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.4.0-orange)]()
[![NIST 800-53](https://img.shields.io/badge/NIST%20800--53-1196%20controls-blue)]()
[![Frameworks](https://img.shields.io/badge/frameworks-6%20supported-blue)]()
[![Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-blueviolet)]()

I'm [Aanish](https://github.com/aanishs). I build [CoralEHR](https://coralehr.com), an EHR for behavioral therapists.

We needed HIPAA compliance.

What we found was an industry that treats compliance like a procurement accessory.

[Vanta](https://www.vanta.com/) wants $10k a year. We almost paid [Delve](https://delve.co/). They raised millions. Then [got accused of fabricating compliance evidence](https://techcrunch.com/2026/03/22/delve-accused-of-misleading-customers-with-fake-compliance/). Which is, admittedly, a bold approach to compliance.

So we built em-dash. Originally for CoralEHR, now open source — because "pay $10k/year" and "guess" should not be the two main options.

em-dash is Claude Code plus compliance. You pick your frameworks. The AI reads the actual law, scans your infrastructure, finds gaps, drafts fixes, and produces signed evidence. You stay in control. Nothing disappears into a black box.

(Why "em-dash"? The em dash and "delve" are both classic AI tells. LLMs can't stop using them. The Delve scandal pushed us to ship this publicly, so the name just... worked.)

---

## Install

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+

```bash
cd ~/.claude/skills
git clone https://github.com/aanishs/em-dash.git
cd em-dash && ./setup
```

To vendor into a project:

```bash
cp -Rf ~/.claude/skills/em-dash .claude/skills/em-dash
rm -rf .claude/skills/em-dash/.git
cd .claude/skills/em-dash && ./setup
```

---

## How it works

You opt into the frameworks you need. em-dash only shows what you asked for.

```bash
You:    /hipaa          # → active_frameworks: ["hipaa"]
You:    /cis            # → active_frameworks: ["hipaa", "cis"]
```

Dashboard, CLI, cross-framework matrix, and scan results are all scoped to your active frameworks.

### What happens when you type `/hipaa`

```mermaid
flowchart TD
    A["You type /hipaa"] --> B["em-dash imports 59 HIPAA controls\nfrom the NIST 800-53 catalog"]
    B --> C["You type /comply-auto"]
    C --> D{For each control}
    D -->|has automated checks| E["Scans your code + cloud infra"]
    D -->|interview only| F["Asks you a plain-English question"]
    E -->|PASS| G["Evidence recorded in SQLite"]
    E -->|FAIL| H["AI suggests a fix\nYou approve → applied → re-scanned"]
    F --> I["Your answer recorded as evidence"]
    H --> G
    I --> G
    G --> J{More controls?}
    J -->|yes| D
    J -->|done| K["/comply-report → signed audit packet"]
```

### How the scanning actually works

```mermaid
flowchart TD
    subgraph law ["What the law requires"]
        A1["HIPAA §164.312(a)(2)(iv)\n'encrypt ePHI at rest'"]
        A2["CIS Safeguard 3.1\n'classify sensitive data'"]
        A3["SOC 2 CC6.1\n'logical access security'"]
    end

    subgraph nist ["NIST 800-53 (shared control)"]
        B["SC-28\nProtection of Information at Rest"]
    end

    subgraph bindings ["tool-bindings.json (what to check)"]
        C1["em-dash: rego-s3-encryption,\naws-s3-encryption, ..."]
        C2["Prowler: s3_bucket_default_encryption"]
        C3["Checkov: CKV_AWS_18"]
        C4["Trivy: AVD-AWS-0088"]
        C5["CIS Benchmark: 2.1.1\n<i>(auditor-facing label only —\nnot part of execution)</i>"]
    end

    subgraph execution ["comply-orchestrate (run in parallel)"]
        D1["grep patterns\n(no tools needed)"]
        D2["Prowler scan"]
        D3["Checkov scan"]
        D4["Trivy scan"]
    end

    A1 & A2 & A3 --> B
    B --> C1 & C2 & C3 & C4
    B -.->|metadata only| C5
    C1 --> D1
    C2 --> D2
    C3 --> D3
    C4 --> D4
    D1 & D2 & D3 & D4 --> E[(SQLite\nfindings tagged with\ncontrol IDs + CIS refs)]
```

Key: CIS Benchmark IDs (like "2.1.1") are **labels attached to findings after the scan**, not routing. They give auditors a recognizable reference point. The actual execution is driven by tool-bindings mapping controls directly to Prowler/Checkov/Trivy/em-dash check IDs.

### Cross-framework impact

All frameworks are peers — they all map to the same NIST 800-53 controls. Fixing one thing satisfies requirements across every active framework:

```mermaid
graph LR
    S3[Fix S3 encryption] --> SC28[NIST SC-28]
    SC28 --> HIPAA[HIPAA ✓]
    SC28 --> CIS[CIS ✓]
    SC28 --> SOC2[SOC 2 ✓]
    SC28 --> GDPR[GDPR ✓]
    SC28 --> PCI[PCI-DSS ✓]
    SC28 --> ISO[ISO 27001 ✓]

    style S3 fill:#16a34a,color:#fff
    style SC28 fill:#2563eb,color:#fff
```

```
$ bin/comply-db cross-framework

Control  CIS       HIPAA     ISO27001  Impact
──────────────────────────────────────────────
AC-2       ✓         ✓         ✓       3/3
SC-28      ✓         ✓         ✓       3/3
AU-2       ✓         ✓         ✓       3/3
```

Only your active frameworks appear. Use `--all` to see all 6.

---

## Frameworks

| Command | Framework | Controls | Maturity | What it protects |
|---------|-----------|----------|----------|------------------|
| `/hipaa` | HIPAA Security Rule | 59 | **Alpha** — domain-specific checks, validated against SP 800-66r2 | Patient health data (PHI) |
| `/soc2` | SOC 2 Type II | 40 | Community — filter file, needs TSC expert review | SaaS trust criteria |
| `/gdpr` | GDPR | 22 | Community — filter file, needs DPO review | EU personal data |
| `/pci-dss` | PCI-DSS v4.0 | 16 | Community — filter file, needs QSA review | Payment card data |
| `/cis` | CIS Controls v8.1 | 33 | **Alpha** — filter file with IG tiers, validated against CIS crosswalk, 71% AWS Level 1 coverage | Infrastructure security baseline |
| `/iso27001` | ISO/IEC 27001:2022 | 49 | Community — filter file, needs auditor review | Information security management |

**What "alpha" means:** HIPAA has the most depth — PHI-specific code checks, a validation script against the official NIST guidance (SP 800-66r2), and assessment questions tailored to the Security Rule. It still hasn't been validated by a compliance professional. Everything is early.

**What "community" means:** The filter file maps framework requirements to NIST 800-53 controls. The mapping is plausible (AI-generated from official crosswalks) but unverified by a domain expert. The framework shares all the same scanning infrastructure as HIPAA — it just hasn't been reviewed by someone who knows the specific regulation. **[Help wanted: Issues #25-29](https://github.com/aanishs/em-dash/issues)**

Run multiple — each adds to your `active_frameworks` list. Controls are shared automatically.

```bash
bin/comply-db frameworks              # list active frameworks
bin/comply-db frameworks --add soc2   # add without full init
bin/comply-db frameworks --remove cis # remove a framework
```

---

## Skills (Claude Code slash commands)

| Command | What it does |
|---------|-------------|
| `/comply` | Status dashboard — compliance score, next step recommendation |
| `/comply-auto` | **Autopilot.** Scans, fixes, interviews — one control at a time |
| `/comply-scan` | Run all available scanning tools in parallel |
| `/comply-fix` | Remediate failures, generate policy docs, re-scan to verify |
| `/comply-assess` | Focused interview — one NIST control at a time |
| `/comply-report` | Compliance report + Ed25519 signed audit packet |
| `/comply-breach` | Guided incident response and breach notification |
| `/hipaa-audit` | **Mock HIPAA audit.** 7-phase OCR simulation with findings and action checklist |
| `/em-dashboard` | Visual compliance dashboard at localhost:3000 |

---

## 71 automated checks

```mermaid
pie title Check Distribution
    "Code-level (grep)" : 30
    "Cloud CLI (AWS/Azure)" : 21
    "Rego policies" : 12
    "Tool integrations" : 8
```

**Code-level (30):** PHI detection, RBAC, audit logging, encryption, session timeout, password hashing, least privilege, secrets in config, DB security, container image signing, plus 10 policy document checks that partially automate interview-only controls. No tools required.

**Cloud infrastructure (21):** IAM, MFA, CloudTrail, VPC flow logs, S3/RDS/EBS/DynamoDB encryption, KMS rotation, Azure Key Vault rotation, security groups, GuardDuty, Security Hub, Config.

**Rego policies (12 across 8 files):** Terraform/K8s IaC validation. Multi-cloud: AWS, GCP, Azure. Encryption, access control, audit logging, transmission security, backup/DR (35-day RDS retention), container security, secrets.

**Tool integrations (8):** Orchestrated via `comply-orchestrate`:

| Tool | What it scans |
|------|---------------|
| [Prowler](https://github.com/prowler-cloud/prowler) | AWS CIS/HIPAA/PCI-DSS (83+ checks) |
| [Checkov](https://github.com/bridgecrewio/checkov) | Terraform, CloudFormation, K8s (1000+ rules) |
| [Trivy](https://github.com/aquasecurity/trivy) | Containers, IaC, secrets, SBOM |
| [KICS](https://github.com/Checkmarx/kics) | IaC scanning (2400+ Rego queries) |
| [Semgrep](https://github.com/semgrep/semgrep) | SAST code scanning |
| [kube-bench](https://github.com/aquasecurity/kube-bench) | CIS Kubernetes Benchmark |
| [ScoutSuite](https://github.com/nccgroup/ScoutSuite) | Multi-cloud security audit |
| [Lynis](https://github.com/CISOfy/lynis) | System security auditing |

All optional. em-dash works with just grep. Tools are auto-detected and run in parallel.

---

## Evidence and signing

```mermaid
flowchart LR
    A[Scan results] --> B[SHA-256 hash]
    B --> C[Ed25519 sign]
    C --> D[SQLite evidence store]
    D --> E[Audit packet ZIP]
    E --> F[verify with public key]

    U[User attestation] --> C
    U -.->|"comply-db sign --name 'Jane Smith'"| D
```

- **Ed25519 signed attestations** — RFC 8785 JSON canonicalization
- **User signatures** — named person cryptographically attests evidence accuracy
- **Evidence redaction** — `--redact` flag strips AWS account IDs, ARNs, IPs from audit packets
- **Compliance drift** — baseline snapshots track per-framework score changes over time

---

## Dashboard

`bun run dashboard` — visual compliance at localhost:3000.

| Feature | Description |
|---------|-------------|
| **Cross-Framework Matrix** | Controls shared across your active frameworks with impact badges |
| **Requirements Checklist** | Filterable by section, evidence linking, notes |
| **Findings** | Severity, description, dates, linked evidence |
| **Risk Register** | 5x5 likelihood/impact matrix |
| **Vendor Tracker** | BAA status, expiry warnings, risk tiers |
| **Evidence Library** | Drag-and-drop upload, SHA-256 integrity |
| **Compliance Score** | Per-family breakdown from SQLite |
| **Scan Trigger** | Start orchestrator scans from the dashboard |

The dashboard is framework-aware — it only shows frameworks you've initialized. Evidence upload dropdown, charts, and NL summary all scope to your active frameworks.

---

## CLI tools

```bash
# Framework management
bin/comply-db init --framework hipaa    # initialize HIPAA (adds to active list)
bin/comply-db frameworks                 # list active + available frameworks
bin/comply-db frameworks --add cis       # add framework to active list

# Compliance operations
bin/comply-db status                     # compliance status per control
bin/comply-db control AC-2               # NIST prose + evidence for one control
bin/comply-db cross-framework            # cross-framework matrix (active only)
bin/comply-db cross-framework --all      # show all 6 frameworks
bin/comply-db cis-coverage               # CIS AWS Level 1 coverage gap report
bin/comply-db sign AC-2 --name "Jane"    # Ed25519 user attestation

# Scanning
bin/comply-orchestrate detect            # list available tools + versions
bin/comply-orchestrate scan              # run all tools, write to SQLite
bin/comply-orchestrate diff              # compliance drift with per-framework breakdown

# Mock audit
bin/comply-audit start --type ocr-desk   # start 7-phase audit simulation
bin/comply-audit resume                  # resume in-progress audit

# Signing
bin/comply-attest init-keys              # generate Ed25519 keypair
bin/comply-audit-packet --output audit.zip --redact
```

---

## Architecture

```
em-dash/
├── nist/                              # IMMUTABLE — official NIST data
│   ├── NIST_SP-800-53_rev5_catalog.json  # 1,196 controls, 20 families
│   ├── {hipaa,soc2,gdpr,pci-dss,cis,iso27001}-filter.json  # 6 framework filters
│   ├── tool-bindings.json             # control → check mappings (v3.0)
│   └── cross-framework.ts             # shared cross-framework matrix module
├── frameworks/
│   ├── checks-registry.ts             # 71 checks (pure execution)
│   ├── schema.ts                      # TypeScript interfaces
│   └── {hipaa,cis,iso27001}.json      # display metadata (soc2/gdpr/pci-dss need community contributions)
├── policies/                          # 8 Rego policy files (multi-cloud)
├── bin/                               # 8 CLI utilities
├── scripts/                           # dashboard server, filter validators
├── dashboard/                         # visual dashboard (HTML/CSS/JS)
├── skills/                            # 9 skills + 6 framework routers + em-dashboard
└── test/                              # 197 tests across 10 files
```

**Key design decisions:**
- **NIST 800-53 is the law** — official catalog ships unmodified
- **SQLite is the evidence store** — one DB per project, tracks `active_frameworks`
- **Framework-aware opt-in** — only show what you initialized
- **checks-registry is pure execution** — no compliance mappings
- **tool-bindings is the mapping layer** — controls → checks + CIS Benchmark refs
- **Adding a framework = one filter file** — zero code changes

---

## How em-dash compares

|  | em-dash | Vanta | Drata |
|--|---------|-------|-------|
| **Price** | Free (MIT) | $10k+/yr | $10k+/yr |
| **Frameworks** | 6 (HIPAA, SOC 2, GDPR, PCI-DSS, CIS, ISO 27001) | HIPAA, SOC 2, ISO, GDPR | HIPAA, SOC 2, ISO, GDPR |
| **Cross-framework** | Yes — shared 800-53 controls, scoped to your selection | No | No |
| **Runs locally** | Yes | No (SaaS) | No (SaaS) |
| **Scanning** | 68 checks + 8 tool integrations | Via integrations | Via integrations |
| **Evidence integrity** | Ed25519 signed, SHA-256 hashed, user attestations | Vendor-managed | Vendor-managed |
| **Remediation** | AI generates fixes + re-verifies | Manual guidance | Manual guidance |
| **See every action** | Yes (terminal + dashboard) | No (black box) | No (black box) |

---

## Contributing

Adding a framework: write `nist/<id>-filter.json`, write `frameworks/<id>.json`, run `bin/comply-db init --framework <id>`. See [CONTRIBUTING.md](CONTRIBUTING.md).

**What we need help with:**
- **SOC 2** — Trust Service Criteria mapping accuracy
- **GDPR** — Article 32 technical measures, data subject rights
- **PCI-DSS** — Cardholder data environment scoping
- **ISO 27001** — Annex A control mapping completeness

## Disclaimer

> This is technical guidance, not legal advice. It does not constitute compliance certification. Consult qualified legal counsel for formal compliance verification.

## License

[MIT](LICENSE)
