---
name: New compliance framework
about: Propose adding a new compliance framework (SOC 2, GDPR, ISO 27001, etc.)
labels: framework, enhancement
---

**Framework name**
e.g., GDPR, SOC 2 Type II, ISO 27001, HITRUST, PCI DSS

**Why this framework?**
Who needs it? What's the market demand? Link to the official standard if public.

**Scope — which skills would it need?**
Check all that apply. Every framework reuses the shared scanning/evidence/reporting infrastructure — the work is writing the requirement mappings and skill templates.

- [ ] `/<framework>-assess` — organizational interview (which controls/articles to ask about)
- [ ] `/<framework>-scan` — automated checks (which code/cloud/IaC patterns map to requirements)
- [ ] `/<framework>-remediate` — fix findings + generate policy documents
- [ ] `/<framework>-report` — compliance report format
- [ ] `/<framework>-monitor` — drift detection rules
- [ ] `/<framework>-vendor` — vendor/processor management (e.g., GDPR data processors)
- [ ] `/<framework>-risk` — risk assessment methodology

**Key requirements to map**
List the top 10-20 requirements/articles/controls. For example:
- GDPR Art. 5 — Principles of data processing
- GDPR Art. 30 — Records of processing activities
- etc.

**Overlap with existing frameworks**
Which HIPAA controls overlap? (e.g., encryption, access control, audit logging, breach notification). This determines how much can be reused vs written from scratch.

**Rego policies needed?**
Any IaC-specific rules? (e.g., data residency checks for GDPR, encryption requirements)

**Are you willing to contribute?**
- [ ] Yes, I'd like to lead this framework implementation
- [ ] I can help with requirement mappings
- [ ] Just suggesting — not able to contribute right now
