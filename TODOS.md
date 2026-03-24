# TODOS

Deferred work from OSCAL Bridge review (2026-03-24).

## P2: OSCAL Version Pinning Strategy

**What:** Define how em-dash handles NIST catalog updates without breaking existing attestation chains.
**Why:** NIST will update the 800-53 catalog. Attestations signed against catalog v5 shouldn't be invalidated by v6.
**Context:** Currently we bundle a pinned snapshot. Need versioning/migration strategy before Phase 2 expansion (full HIPAA catalog). The session attestation includes `oscal_catalog_version` which links the attestation to a specific catalog version.
**Effort:** M (human: ~1 week / CC: ~2 hours)
**Depends on:** Phase 1 complete

## P2: Evidence Sensitivity/Redaction Model

**What:** Add redaction mechanism for audit packets when using `--include-evidence`.
**Why:** Evidence from AWS scans may contain account IDs, ARNs, IP addresses. `--include-evidence` dumps everything with no filtering.
**Context:** Hashes-only mode (default) is safe. Redaction only matters for `--include-evidence` flag. Needs pattern-based redaction (account IDs, ARNs, IPs) that's framework-aware.
**Effort:** M (human: ~1 week / CC: ~3 hours)
**Depends on:** Audit packet feature complete

## P2: dashboard.json Race Condition

**What:** Fix concurrent write safety for dashboard.json across CLI, dashboard server, and browser UI.
**Why:** All three write full-file overwrites with no locking. Attestation reads during packet generation make collisions more likely.
**Context:** Fix is temp-file-then-rename (atomic write) in `bin/hipaa-dashboard-update`, `scripts/dashboard-server.ts`, and `dashboard/app.js`. Pre-existing issue, not introduced by OSCAL Bridge.
**Effort:** M (human: ~1 day / CC: ~30 min)
**Depends on:** Nothing

## P3: OSCAL Phase 2 — Full HIPAA Catalog

**What:** Expand from 10 controls to the full HIPAA-to-800-53 mapping based on SP 800-66r2.
**Why:** Phase 1 covers the 10 most critical controls. Full coverage needed for comprehensive audit packets.
**Context:** Requires reading SP 800-66r2 guidance document and encoding remaining mappings. Estimated ~50-80 total controls.
**Effort:** L (human: ~2 weeks / CC: ~1 week — domain review required)
**Depends on:** Phase 1 validated with a compliance professional
