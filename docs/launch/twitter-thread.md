# Twitter/X Thread

**Tweet 1 (hook):**
I audited my own AWS infrastructure for HIPAA compliance — with an AI assistant, not a $10k/year vendor.

22 findings. 18 minutes. I reviewed every one and decided what to do about each.

Here's what that looked like: [thread]

<!-- Attach: dashboard screenshot showing findings summary -->

**Tweet 2:**
The problem with compliance vendors: you pay $10k/year for a black box. It gives you a score. You download a PDF. You hope nobody asks a follow-up question.

Meanwhile, the #1 HIPAA enforcement finding is "inadequate risk analysis."

The industry sells the *feeling* of compliance. Not the understanding.

**Tweet 3:**
em-dash is different. It's an AI assistant that guides you through the audit — but you drive.

It proposes scans. You approve them.
It surfaces findings. You evaluate them.
It suggests fixes. You review before applying.

The AI makes it faster. The human makes it real.

<!-- Attach: terminal screenshot showing approval gate -->

**Tweet 4:**
What I found on my real AWS stack (HealthLake, DynamoDB, Lambda, S3):

9 HIGH: No VPC flow logs, IAM wildcards, admin without MFA
11 MEDIUM: Lambda env vars unencrypted, no S3 access logging

Some I fixed immediately. Some were acceptable risk for our situation. That's the point — I made the call, not the tool.

**Tweet 5:**
The whole thing runs locally. In your terminal. Nothing leaves your machine.

You watch every scan command. You see every finding as it's discovered. You read every remediation before it's applied.

No mystery score. No compliance cosplay.

<!-- Attach: comparison table screenshot from README -->

**Tweet 6:**
It's free. Open source. MIT licensed. ~340 tests.

There's a demo app with 15 intentional HIPAA violations if you want to try it without touching real infrastructure.

github.com/aanishs/em-dash

**Tweet 7:**
Looking for contributors — especially if you know SOC 2, GDPR, or PCI-DSS.

Your first PR in 15 minutes: add a single Rego policy rule.

github.com/aanishs/em-dash/blob/main/CONTRIBUTING.md

---

## Scheduling notes

- Post tweet 1-4 as a thread
- Tweets 5-7 as replies spaced 5-10 min apart
- Best time: Tuesday-Thursday, 9-11am PST
- Retweet thread from personal account if you have one
