# Show HN Post

**Title:** Show HN: Em-dash – open-source HIPAA compliance you actually control

**URL:** https://github.com/aanishs/em-dash

**Text:**

I build an EHR for behavioral therapists. We needed HIPAA compliance. Vanta wanted $10k/year. Delve just got accused of fabricating compliance evidence. So we built our own and open-sourced it.

em-dash is a set of Claude Code skills that guide you through HIPAA compliance — code, cloud infrastructure, organizational policies. You drive every step. The AI proposes, you decide. Nothing runs without your approval. Nothing leaves your machine.

That matters because compliance isn't something you outsource to an algorithm. The whole point is that a human understood the requirements, evaluated the gaps, and made informed decisions about how to close them. em-dash makes that process faster — not invisible.

When I ran it against our real AWS account (HealthLake, DynamoDB, Lambda, S3), it surfaced 22 issues across 830 checks. But I reviewed every finding. I decided which ones to fix, which to accept as risk, and which needed more investigation. The AI didn't make those calls — I did, with better information than I had before.

What the workflow looks like:

- /hipaa-assess — asks you questions one at a time about your organization. Adapts based on your answers. You're the expert on your own company; the tool structures the conversation.
- /hipaa-scan — proposes scanning commands, waits for your approval to run them against your infra. Shows you every result.
- /hipaa-remediate — suggests fixes (code patches, Terraform changes, policy documents). You review each one before it's applied.
- /hipaa-report — generates reports from the evidence you've collected and the decisions you've made.
- Visual dashboard — your compliance state at a glance. Checklist, findings, risk register, vendor tracker.

It wraps Prowler, Trivy, and Checkov when available, but works with just grep if you don't have those installed. Everything runs locally.

MIT licensed. ~340 tests. Looking for contributors — especially if you know SOC 2, GDPR, or PCI-DSS.

There's a demo app in the repo (demo/hipaa-demo-app) with 15 intentional HIPAA violations if you want to try it without pointing at real infrastructure.
