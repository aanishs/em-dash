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

Consider:
- Improve CIS AWS coverage from 71% → 90%+ (add Section 4 CloudWatch alarm checks)
- HITRUST CSF framework filter
- FedRAMP framework filter (NIST publishes baselines)
- Auditor co-signing (multi-party attestation)
