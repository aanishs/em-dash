# em-dash v2

## Architecture

NIST 800-53 is the source of truth. The LLM reads the actual law at runtime.

```
nist/
├── NIST_SP-800-53_rev5_catalog.json  # official NIST catalog (1,196 controls, never modify)
├── hipaa-filter.json                  # HIPAA specs → 800-53 control IDs (52 specs → 50 controls)
└── tool-bindings.json                 # control IDs → verification tools (50 controls, 21 automated)

SQLite per project: ~/.em-dash/projects/{slug}/compliance.db
  controls → evidence → check_results → signatures
```

## Commands

```bash
bun install          # install dependencies
bun test             # run all tests (~102 tests)
bun run build        # alias for gen:skill-docs
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run dashboard    # start the compliance dashboard on localhost:3000
```

## Project structure

```
em-dash/
├── nist/                              # IMMUTABLE — official NIST data
│   ├── NIST_SP-800-53_rev5_catalog.json  # 1,196 controls, 20 families
│   ├── hipaa-filter.json              # HIPAA → 800-53 mapping
│   └── tool-bindings.json             # control → tool check mapping
├── frameworks/
│   ├── checks-registry.ts            # 50 checks — HOW to execute (pure execution, no compliance mappings)
│   ├── hipaa.json                     # display metadata only (terminology, thresholds, checklist)
│   ├── schema.ts                      # TypeScript interfaces
│   └── index.ts                       # framework loader
├── skills/                            # 8 skills
│   ├── hipaa/                         # status + router
│   ├── comply-auto/                    # autopilot: scan → fix → ask → next
│   ├── comply-assess/                  # focused interview
│   ├── comply-scan/                    # focused scan
│   ├── comply-fix/                     # focused remediation
│   ├── comply-report/                  # report + audit packet
│   ├── comply-breach/                  # incident response
│   └── em-dashboard/                 # visual compliance dashboard
├── bin/                               # 6 CLI utilities
│   ├── comply-db                       # SQLite operations (init, status, control, query)
│   ├── comply-attest                   # Ed25519 attestation signing
│   ├── comply-verify                   # attestation verification
│   ├── comply-audit-packet             # signed audit packet generation
│   ├── comply-evidence-hash            # SHA-256 hashing
│   └── comply-slug                     # project slug generation
├── policies/                          # Rego/OPA rules (framework-agnostic)
├── templates/policies/                # org policy markdown templates
├── dashboard/                         # visual dashboard (HTML/CSS/JS)
├── test/                              # ~102 tests across 8 files
└── package.json
```

## Key design decisions

- **NIST 800-53 is the law** — official catalog ships unmodified, LLM reads it directly
- **SQLite is the evidence store** — one DB per project, replaces all JSON state files
- **One control at a time** — every skill processes controls individually, not in batch
- **Three files we maintain**: hipaa-filter.json (50 lines), tool-bindings.json (200 lines), checks-registry.ts
- **Ed25519 signed attestations** — RFC 8785 JSON canonicalization
- **Adding a framework = one filter file** — soc2-filter.json, same catalog, zero code changes
- **Checks registry is pure execution** — no compliance mappings, just id → command/pattern

## Adding a new framework

1. Write `nist/<framework>-filter.json` mapping framework specs → 800-53 control IDs
2. Run `bin/comply-db init --framework <name>`
3. Done — same catalog, same tools, same skills

## Adding a new check

1. Add to `frameworks/checks-registry.ts` (id, type, command/pattern)
2. Add check ID to relevant control in `nist/tool-bindings.json`
