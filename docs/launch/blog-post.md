---
title: I audited my own AWS infrastructure for HIPAA compliance — with an AI assistant
published: false
description: I used an open-source tool to walk through HIPAA compliance on a production health-tech stack. The AI surfaced 22 issues. I decided what to do about each one.
tags: hipaa, security, aws, opensource
---

# I audited my own AWS infrastructure for HIPAA compliance — with an AI assistant

If you build health-tech, you've had this conversation:

"We need to be HIPAA compliant."

"How much does that cost?"

"Vanta is $10k a year. Or we could hire a consultant."

"What if we just... don't?"

That last option isn't as hypothetical as it should be. OCR's most common enforcement finding is inadequate risk analysis — the most basic HIPAA requirement. Teams buy the dashboard, download the PDF, and hope nobody asks a follow-up question.

I build [CoralEHR](https://coralehr.com), an EHR for behavioral therapists. We needed real compliance, not compliance cosplay. So we built [em-dash](https://github.com/aanishs/em-dash) — an open-source HIPAA compliance toolkit that runs as Claude Code skills — and used it to audit our real AWS infrastructure.

The AI didn't do the audit. I did. The AI made it possible to do in an afternoon instead of a quarter.

Here's what that looked like.

## The setup

Our stack: AWS HealthLake (FHIR R4), DynamoDB (30 tables), Lambda (56 functions), Cognito, S3, API Gateway. We use Anthropic's Claude for AI features — treatment plan generation, clinical note drafting, assessment insights.

em-dash has 10 slash commands. I started with two:

```
/hipaa-assess    — organizational interview (20 minutes)
/hipaa-scan      — automated technical scanning
```

## The assessment: 17 findings in 7 minutes

The assessment asks questions one at a time. Not a survey — a guided interview. It adapts based on your answers and skips questions you've already covered. But the answers come from you. You're the expert on your organization — the tool structures the conversation so you don't miss anything.

What came out of it:

- **1 CRITICAL:** No formal risk analysis. This is HIPAA's foundational requirement. Without it, everything else is technically out of compliance.
- **7 HIGH:** No designated security officer. No incident response plan. No workforce training program. No disaster recovery plan. MFA not enforced. No offboarding process. No PHI access audit trail.
- **7 MEDIUM:** No contingency plan testing. Developer access to production PHI. Draft NPP not published. No amendment request workflow.
- **2 LOW:** No formal breach notification plan. No PHI disclosure log.

The report maps every finding to a specific HIPAA section (§164.308, §164.312, etc.) with severity, description, and recommended remediation.

## The scan: 22 issues across 830 checks

Then I ran the scan. em-dash proposed a set of scanning commands — Prowler for AWS HIPAA checks, Trivy for secrets, Checkov for IaC, plus 65 AWS CLI commands and 19 code-level grep patterns. I approved the scan plan and watched it run.

18 minutes later, I had a structured list of findings to review:

### What passed (12 controls)

The good news:
- CloudTrail: multi-region, KMS-encrypted, log file validation enabled
- S3: all PHI buckets KMS-encrypted, versioned, public access blocked
- Authorization: ABAC (attribute-based access control) on all 20+ PHI endpoints
- Audit logging: 157 audit calls across 30 Lambda functions
- TLS 1.2 enforced on all API endpoints (ECDHE-RSA-AES128-GCM-SHA256)
- Zero secrets in code (Trivy clean)
- Zero PHI in logs (FHIR UUIDs only)
- BAAs signed with AWS and Anthropic

### What failed (22 findings)

| Severity | Count | Examples |
|----------|-------|---------|
| HIGH | 9 | No IAM password policy. No VPC flow logs. GuardDuty not enabled. IAM wildcard permissions (10 policies). 45 log groups without retention. API Gateway without access logging. Admin user without MFA. AdministratorAccess attached to users. No CloudTrail S3 data events. |
| MEDIUM | 11 | Security Hub not subscribed. Lambda env vars not KMS encrypted (54 functions). DynamoDB not using customer-managed KMS (30 tables). No S3 access logging. Secrets Manager rotation not configured (9 secrets). AWS Config not enabled. Session timeout 60min (15min recommended). SNS topics unencrypted. No CloudWatch metric filters. Account-level S3 public access block missing. |
| LOW | 2 | Test Lambda publicly accessible. Minor configuration gaps. |

Most HIGH findings were auto-fixable via CDK changes. em-dash told me exactly which ones it could fix and which needed manual intervention.

## What surprised me

**Prowler's 70% pass rate was better than I expected.** Our technical controls were solid — encryption, TLS, ABAC, audit logging. The gaps were all in monitoring and detection: no VPC flow logs, no GuardDuty, no Security Hub. We had the locks but no cameras.

**The organizational gaps were worse than the technical ones.** No formal risk analysis. No security officer designation. No incident response plan. The code was more compliant than the organization running it.

**The scan found things I didn't know to look for.** I didn't know CloudTrail S3 data events were a thing (they log who accessed which objects in your PHI buckets). I didn't know about CloudWatch metric filters for security events. em-dash mapped each finding to the specific HIPAA requirement and explained why it mattered.

## The dashboard

em-dash includes a visual dashboard at localhost:3000 that updates in real time as skills run:

- 49-item HIPAA requirements checklist with evidence linking
- Expandable findings with severity, status, and discovery dates
- 5x5 risk register with likelihood/impact matrix
- Vendor tracker with BAA status and expiry warnings
- Drag-and-drop evidence upload with SHA-256 integrity
- HTML and CSV export for auditors

<!-- TODO: Add dashboard screenshot -->

Everything Vanta charges $10k/year for, running locally, for free.

## Why human-in-the-loop matters for compliance

em-dash is a collection of Claude Code skills — prompt templates that guide an AI assistant through structured compliance work. But the operative word is *guide*. The human is in the loop at every step.

This is deliberate. Compliance is not a problem you want to automate away. The value of a risk analysis isn't the document — it's the thinking that goes into it. The value of a gap assessment isn't the list of gaps — it's the person who understands the organization well enough to evaluate each one.

What AI is good at: running 830 scanning checks without getting bored. Mapping findings to specific HIPAA sections without making mistakes. Drafting policy documents that follow a consistent structure. Generating Terraform patches for 45 log groups that all need the same retention policy.

What AI is not good at: deciding whether a finding is acceptable risk for your specific situation. Understanding that your "wildcard IAM policy" exists because of a deployment constraint you're working around. Knowing that the 60-minute session timeout is intentional because your clinicians have 45-minute appointments.

em-dash gives you the information faster. You make the decisions. That's the right division of labor for compliance — and it's the reason everything runs locally, in your terminal, where you can see exactly what's happening.

## Try it yourself

```bash
# Install (30 seconds)
cd ~/.claude/skills
git clone https://github.com/aanishs/em-dash.git
cd em-dash && ./setup

# Run against the demo app (no AWS needed)
cd demo/hipaa-demo-app
/hipaa-scan
```

The demo app has 15 intentional HIPAA violations — PHI in logs, weak auth, open S3 buckets, IAM wildcards. Safe to scan without touching real infrastructure.

For your own stack:
```
/hipaa          — see your compliance state
/hipaa-assess   — organizational interview
/hipaa-scan     — automated scanning
/hipaa-remediate — fix what's broken
/hipaa-report   — generate compliance reports
/em-dashboard   — visual dashboard
```

Works with or without Prowler/Trivy/Checkov. Works with or without AWS credentials. The 19 code-level checks only need grep.

## Contributing

em-dash is MIT licensed with ~340 passing tests. We want to expand to SOC 2, GDPR, ISO 27001, and PCI-DSS — the architecture already supports it.

Easiest contribution: add a single Rego policy rule. Takes 15 minutes. See [CONTRIBUTING.md](https://github.com/aanishs/em-dash/blob/main/CONTRIBUTING.md).

If you know compliance frameworks and want to help build the open-source alternative to Vanta, [good first issues are waiting](https://github.com/aanishs/em-dash/issues).

---

*em-dash provides technical guidance, not legal advice. Consult qualified legal counsel for formal HIPAA compliance verification.*

[GitHub](https://github.com/aanishs/em-dash) | [MIT License](https://github.com/aanishs/em-dash/blob/main/LICENSE) | [Contributing](https://github.com/aanishs/em-dash/blob/main/CONTRIBUTING.md)
