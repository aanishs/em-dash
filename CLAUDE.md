# em-dash v3

## Architecture

NIST 800-53 is the source of truth. The LLM reads the actual law at runtime. Users opt into frameworks explicitly — only active frameworks appear in dashboards, CLI, and reports.

```
nist/
├── NIST_SP-800-53_rev5_catalog.json  # official NIST catalog (1,196 controls, never modify)
├── hipaa-filter.json                  # HIPAA → 800-53 (64 controls)
├── soc2-filter.json                   # SOC 2 → 800-53 (39 controls)
├── gdpr-filter.json                   # GDPR → 800-53 (22 controls)
├── pci-dss-filter.json                # PCI-DSS → 800-53 (16 controls)
├── cis-filter.json                    # CIS v8.1 → 800-53 (33 controls, with IG tiers)
├── iso27001-filter.json               # ISO 27001:2022 → 800-53 (49 controls)
├── tool-bindings.json                 # control IDs → verification tools (v3.0, 60+ checks)
└── cross-framework.ts                 # shared cross-framework matrix module

SQLite per project: ~/.em-dash/projects/{slug}/compliance.db
  metadata (active_frameworks) → controls → evidence → check_results → signatures → compliance_baselines
```

## Commands

```bash
bun install          # install dependencies
bun test             # run all tests (~141 tests)
bun run build        # alias for gen:skill-docs
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run dashboard    # start the compliance dashboard on localhost:3000
```

## Project structure

```
em-dash/
├── nist/                              # IMMUTABLE — official NIST data
│   ├── NIST_SP-800-53_rev5_catalog.json  # 1,196 controls, 20 families
│   ├── {hipaa,soc2,gdpr,pci-dss,cis,iso27001}-filter.json  # 6 framework filters
│   ├── tool-bindings.json             # control → tool check mapping (v3.0)
│   └── cross-framework.ts             # shared cross-framework matrix module
├── frameworks/
│   ├── checks-registry.ts            # 60+ checks — HOW to execute (pure execution, no compliance mappings)
│   ├── {hipaa,soc2,gdpr,pci-dss,cis,iso27001}.json  # display metadata
│   ├── schema.ts                      # TypeScript interfaces
│   └── index.ts                       # framework loader
├── skills/                            # 8 skills + 6 framework routers
│   ├── hipaa/ soc2/ gdpr/ pci-dss/ cis/ iso27001/  # framework routers
│   ├── comply-auto/                    # autopilot: scan → fix → ask → next
│   ├── comply-assess/                  # focused interview
│   ├── comply-scan/                    # focused scan
│   ├── comply-fix/                     # focused remediation
│   ├── comply-report/                  # report + audit packet
│   ├── comply-breach/                  # incident response
│   └── em-dashboard/                 # visual compliance dashboard
├── bin/                               # 7 CLI utilities
│   ├── comply-db                       # SQLite operations (init, status, control, cross-framework, frameworks, cis-coverage, query)
│   ├── comply-orchestrate              # parallel tool scanner with CIS tagging
│   ├── comply-attest                   # Ed25519 attestation signing + user-sign
│   ├── comply-verify                   # attestation verification
│   ├── comply-audit-packet             # signed audit packet generation (--redact)
│   ├── comply-evidence-hash            # SHA-256 hashing
│   └── comply-slug                     # project slug generation
├── policies/                          # 8 Rego/OPA policy files (AWS, GCP, Azure, K8s, Docker)
├── templates/policies/                # org policy markdown templates
├── scripts/
│   ├── dashboard-server.ts            # dashboard + REST APIs + scan trigger
│   ├── validate-hipaa-filter.ts       # SP 800-66r2 validation
│   └── validate-cis-filter.ts         # CIS filter structure validation
├── dashboard/                         # visual dashboard (HTML/CSS/JS) — framework-aware
├── test/                              # ~141 tests across 8 files
└── package.json
```

## Key design decisions

- **NIST 800-53 is the law** — official catalog ships unmodified, LLM reads it directly
- **SQLite is the evidence store** — one DB per project, tracks `active_frameworks` in metadata
- **Framework-aware opt-in** — user runs `/hipaa`, only HIPAA appears. Cross-framework matrix, dashboard, and CLI all scope to active frameworks
- **One control at a time** — every skill processes controls individually, not in batch
- **checks-registry is pure execution** — no compliance mappings, just id → command/pattern
- **tool-bindings is the mapping layer** — controls → em-dash/Prowler/Checkov/Trivy checks + CIS Benchmark refs
- **Ed25519 signed attestations** — RFC 8785 JSON canonicalization, user attestation support
- **Adding a framework = one filter file** — same catalog, zero code changes
- **Cross-framework matrix** — all 6 frameworks converge on 800-53, enabling cross-framework impact scoring (scoped to active frameworks)

## Adding a new framework

1. Write `nist/<framework>-filter.json` mapping framework specs → 800-53 control IDs
2. Write `frameworks/<framework>.json` with display metadata
3. Run `bin/comply-db init --framework <name>`
4. Done — same catalog, same tools, same skills

## Adding a new check

1. Add to `frameworks/checks-registry.ts` (id, type, command/pattern)
2. Add check ID to relevant control in `nist/tool-bindings.json`
