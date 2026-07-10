# TODOS

## ~~P1: Dashboard Frontend SQLite Integration~~ DONE

Dashboard fetches from SQLite APIs (`/api/compliance`, `/api/cross-framework`, `/api/compliance/score`, `/api/tools`). Scan trigger button. WebSocket live-reload.

## ~~P2: Cross-Framework Drift Tracking~~ DONE

`comply-orchestrate diff` shows per-framework score breakdown. Baselines store `cross_framework_scores`.

## ~~P2: CIS Coverage Gap Report~~ DONE

`comply-db cis-coverage` — 71% coverage (24/34 CIS AWS Level 1 recommendations). Gaps: Section 4 (CloudWatch alarms) + 2 IAM + 1 Networking.

## ~~P2: Evidence Sensitivity/Redaction~~ DONE

`comply-audit-packet --redact` handles AWS Account IDs, ARNs, Access Keys, IPs, EC2/VPC/Subnet/SG IDs.

## ~~P3: User Signature Crypto~~ DONE

`comply-db sign AC-2 --name "Jane Smith" --role "Security Officer"` — Ed25519 signed user attestation stored in SQLite + file-based attestation for audit packets.

## ~~P3: ISO 27001 Framework~~ DONE

6th framework. `nist/iso27001-filter.json` maps 80 Annex A controls → 49 NIST 800-53 controls. `frameworks/iso27001.json` display metadata. SC-28 now appears in all 6 frameworks.

---

## ~~P1: Grading Algorithm Specification~~ WON'T DO

HIPAA has no scoring system. Compliance is per-requirement, not a letter grade. The made-up weighted formula (`100 - 25×Critical - 10×Major`) created false confidence. Removed `comply-db grade` subcommand. Kept per-control PASS/FAIL/PENDING + % complete in dashboard.

## P2: Multi-Framework Audit Skills

Create /soc2-audit, /gdpr-audit, /pci-dss-audit using the same 7-phase structure. `bin/comply-audit --framework <name>` handles the orchestration. Each framework needs: reverse-map logic (CFR-prefix equivalent for that framework's regulation) and framework-appropriate interview question selection. Depends on /hipaa-audit shipping first.

---

## Infrastructure

### Future Multi-Host Expansion Beyond Codex

**What:** Extend the new host-aware skill generation and setup flow beyond `claude` and `codex` once Codex support has shipped cleanly.

**Why:** The Codex work will introduce the right abstraction boundary for host-specific skill generation, install topology, and runtime path rewrites; future agents can reuse that design instead of starting from another Claude-only implementation.

**Context:** The current eng review explicitly keeps scope to `claude` + `codex` only. This avoids dragging `--host auto`, broader agent support, and extra install branches into the first host-expansion PR. Revisit this after the Codex path is stable, tested, and adopted enough to justify more surface area.

**Effort:** M
**Priority:** P3
**Depends on:** Codex support landing with green generator/install/smoke tests

---

Consider:
- Improve CIS AWS coverage from 71% → 90%+ (add Section 4 CloudWatch alarm checks)
- HITRUST CSF framework filter
- FedRAMP framework filter (NIST publishes baselines)
- Auditor co-signing (multi-party attestation)

## P3: comply-db CLI Contract Specification

**What:** Document comply-db's CLI contract (subcommand → expected stdout JSON shape + exit codes).

**Why:** Other scripts (comply-audit, comply-start, comply-orchestrate, dashboard-server) parse comply-db stdout. The contract tests from the infrastructure PR partially address this, but a formal specification would be the single source of truth for any future callers.

**Context:** Codex (outside voice review, 2026-04-03) identified that comply-db's output format is an implicit API used by 4+ consumers. Contract tests verify behavior; a spec documents intent. Consider OpenAPI-style YAML or a simple markdown table of subcommand → JSON schema.

**Effort:** S
**Priority:** P3
**Depends on:** Infrastructure PR2 (module split stabilizes output format)

## P3: E2E Test Fixtures

**What:** Create pre-seeded compliance.db fixtures, sample scan outputs, and expected response patterns for reproducible E2E testing.

**Why:** E2E tests that depend on live Claude responses are nondeterministic. Fixtures enable deterministic regression testing for the non-LLM portions (database queries, report generation, audit lifecycle).

**Context:** test/fixtures/ already has IaC and scan samples. Extend with DB fixtures (pre-populated compliance.db at various journey stages) and golden output files for comply-db subcommands.

**Effort:** M
**Priority:** P3
**Depends on:** Infrastructure PR1 (schema migrations establish stable schema versions)
