# TODOS

## P1: Dashboard Frontend SQLite Integration

**What:** Update dashboard HTML/JS to fetch from `/api/compliance` endpoint (SQLite) instead of only `/api/dashboard` (JSON).
**Why:** The dashboard server now has a SQLite API but the frontend still reads legacy JSON.
**Context:** Server endpoint `GET /api/compliance?view=summary` returns controls, check results, evidence counts from SQLite. Frontend needs to display control-level compliance status.
**Effort:** L (human: ~2 weeks / CC: ~4 hours)

## P2: SOC 2 Filter File

**What:** Write `nist/soc2-filter.json` mapping SOC 2 Trust Service Criteria to 800-53 controls.
**Why:** Validates multi-framework architecture. Should work with zero code changes.
**Context:** AICPA publishes TSC-to-800-53 mappings. Same NIST catalog, different filter.
**Effort:** M (human: ~1 week / CC: ~2 hours)

## P2: Evidence Sensitivity/Redaction Model

**What:** Add redaction mechanism for audit packets when using `--include-evidence`.
**Why:** Evidence from AWS scans may contain account IDs, ARNs, IP addresses.
**Effort:** M (human: ~1 week / CC: ~3 hours)

## P3: User Signature Crypto

**What:** Real Ed25519 user signatures (not just a flag in SQLite). User signs "I attest this evidence is accurate."
**Why:** Binds a named person to the evidence with cryptographic proof.
**Effort:** M (human: ~1 week / CC: ~1 hour)
