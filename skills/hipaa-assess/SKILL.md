---
name: hipaa-assess
version: 0.1.0
description: |
  Interactive HIPAA compliance assessment. Walks through Security Rule,
  Privacy Rule, Breach Notification, and Business Associate requirements
  one question at a time. Produces a gap analysis report with prioritized findings.
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
hipaa_sections:
  - "164.308(a)(1)"
  - "164.308(a)(2)"
  - "164.308(a)(3)"
  - "164.308(a)(4)"
  - "164.310"
  - "164.312"
  - "164.314"
risk_level: medium
requires_prior: []
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
mkdir -p ~/.em-dash/sessions
touch ~/.em-dash/sessions/"$PPID"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
# Detect bin directory (global install or project-level install)
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
source <("$_EMDASH_BIN"/hipaa-slug 2>/dev/null || true)
echo "SLUG: ${SLUG:-unknown}"
mkdir -p ~/.em-dash/projects/"${SLUG:-unknown}"
_TOOLS=$("$_EMDASH_BIN"/hipaa-tool-detect 2>/dev/null || true)
echo "$_TOOLS"
# Check for updates
"$_EMDASH_BIN"/../bin/emdash-update-check 2>/dev/null || true
```

Note: each bash block runs in a separate shell. To use bin utilities in later blocks, re-detect the path:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
```

## Update Check

If the preamble printed `UPGRADE_AVAILABLE <current> <latest>`, inform the user:

> A newer version of em-dash is available (current → latest).
> Run `cd ~/.claude/skills/em-dash && git pull && bun run build` to upgrade.

If `JUST_UPGRADED` was printed, note it and continue. Otherwise, skip this section silently.

## DISCLAIMER — Not Legal Advice

> **IMPORTANT:** This tool provides technical guidance for implementing HIPAA compliance
> controls. It is NOT legal advice and does not constitute HIPAA certification. HIPAA
> compliance is a legal determination that depends on your specific circumstances. Always
> consult qualified legal counsel and consider engaging a certified HIPAA auditor for
> formal compliance verification. This tool helps you implement and verify technical
> safeguards — it does not certify compliance.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current compliance phase (e.g., "Assessment Q5 of 20", "Scanning AWS infrastructure", "Remediating encryption findings"). (1-2 sentences)
2. **Simplify:** Explain the compliance requirement in plain English. No HIPAA regulation numbers in the question itself — reference them in a note below.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]`
4. **Options:** Lettered options: `A) ... B) ... C) ...`

When an option involves effort, show both scales: `(human: ~X / CC: ~Y)`

## Compliance Completeness Principle

**In compliance, shortcuts create audit gaps.**

A partial HIPAA scan is worse than no scan — it creates false confidence. An incomplete
remediation plan gives auditors the impression you knew about gaps and chose to ignore them.
Every skipped check is a finding your auditor will catch.

When estimating effort, always consider both scales:

| Task | Human team | CC+em-dash | Compression |
|------|-----------|-----------|-------------|
| Full codebase PHI scan | 2 days | 5 min | ~50x |
| Cloud infrastructure audit | 1 week | 15 min | ~50x |
| Policy document generation | 3 days | 10 min | ~40x |
| Remediation + evidence | 2 weeks | 1 hour | ~30x |
| Gap assessment interview | 4 hours | 20 min | ~12x |

**Rule:** If the complete implementation costs minutes more than the shortcut, do the
complete thing. Every time. Compliance is not the place for "good enough."

## Contributor Mode

If this skill is running from a development checkout (symlink at `.claude/skills/em-dash`
pointing to a working directory), you are in **contributor mode**. Be aware that:
- Template changes + `bun run gen:skill-docs` immediately affect all em-dash invocations
- Run `bun test` before committing to verify skill integrity
- Breaking changes to .tmpl files can break concurrent sessions

## Completion Status Protocol

When the skill completes, report one of:
- **DONE** — All phases completed successfully. Compliance status reported.
- **DONE_WITH_CONCERNS** — Completed, but critical findings remain unaddressed.
- **BLOCKED** — Cannot proceed without additional information or access.
- **NEEDS_CONTEXT** — Insufficient information to assess. Ask the user to provide more.

## Evidence Collection

When collecting evidence, always:
1. Write raw tool output to `~/.em-dash/projects/$SLUG/evidence/{phase}-{datetime}/`
2. Hash evidence files: `_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin) && "$_EMDASH_BIN"/hipaa-evidence-hash <evidence-directory>`
3. Never store actual PHI — only configuration states, scan results, and metadata

## Review Logging

After completing a skill, log the outcome:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-review-log write "$SLUG" "hipaa-assess" "<STATUS>" <FINDINGS_COUNT>
```

## Dashboard Sync

After logging the review, if `.em-dash/dashboard.json` exists in the project root, update the skill status:

```bash
if [ -f .em-dash/dashboard.json ]; then
  _SKILL_KEY="assess"
  _STATUS_VAL="<STATUS>"
  _FINDINGS_VAL=<FINDINGS_COUNT>
  _SUMMARY="<ONE_LINE_SUMMARY>"
  _TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  bun -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('.em-dash/dashboard.json', 'utf-8'));
    if (!d.frameworks) d.frameworks = {};
    if (!d.frameworks.hipaa) d.frameworks.hipaa = { status: 'in-progress', skills: {}, checklist: [], evidence_gaps: [] };
    d.frameworks.hipaa.skills['$_SKILL_KEY'] = {
      status: '$_STATUS_VAL'.toLowerCase(),
      timestamp: '$_TIMESTAMP',
      findings: $_FINDINGS_VAL,
      summary: '$_SUMMARY'
    };
    d.frameworks.hipaa.last_updated = '$_TIMESTAMP';
    fs.writeFileSync('.em-dash/dashboard.json', JSON.stringify(d, null, 2) + '\\n');
  " 2>/dev/null || true
fi
```

**Checklist updates** are handled inline by each skill as it discovers findings — not here. Use `hipaa-dashboard-update` to update individual checklist items based on actual results:

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
# Mark a checklist item as complete with a note:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.312(a)(1)" complete "RBAC found in src/auth.ts"
# Mark as pending with an evidence gap:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.312(b)" pending --gap "No audit logging found"
# Add evidence file to an item:
"$_EMDASH_BIN"/hipaa-dashboard-update "164.314(a)(1)" complete --evidence "baa-aws.pdf"
```

## Dashboard Checklist Updates

As you conduct the interview, update the dashboard after each meaningful answer. Use your judgment — the user's answer tells you whether a control is genuinely in place or just aspirational.

**Principle:** An answer like "yeah we probably should do that" is NOT a complete control. "Our CTO handles security, we review access quarterly" IS evidence of a control in place.

**Reference — interview topics and their checklist IDs:**

| Topic | Checklist ID | What "complete" means |
|-------|-------------|----------------------|
| Security officer | 164.308(a)(2) | A specific person is designated and actively responsible — not "we all kind of do it" |
| Risk analysis | 164.308(a)(1)(ii)(A) | A formal risk assessment was conducted — not "we think about security" |
| Security training | 164.308(a)(5)(i) | An actual training program exists with records — not "we tell people to be careful" |
| Incident response | 164.308(a)(6)(i) | A documented procedure exists — not "we'd figure it out" |
| Contingency plan | 164.308(a)(7)(i) | Documented backup, disaster recovery, and emergency procedures — not just "we use AWS" |
| Termination procedures | 164.308(a)(3)(ii)(C) | Documented process to revoke access when someone leaves — not "we'd probably disable their account" |
| Workforce clearance | 164.308(a)(3)(i) | Defined process for granting/reviewing ePHI access levels |
| Password management | 164.308(a)(5)(ii)(D) | Enforced password policies (length, complexity, rotation) |
| BAAs with vendors | 164.314(a)(1) | Signed BAA on file for each vendor handling PHI |

**Beyond checklist — you also write vendors and risks:**

When the user mentions third-party services that handle PHI, add them as vendors:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "AWS" --service "Cloud hosting" --baa-status signed --risk-tier high
```

When you identify organizational risks from interview answers, add them:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update risk add --description "Phishing risk — no MFA enforced" --likelihood 4 --impact 4 --treatment mitigate --owner "Security Officer"
```

For vendors without BAAs, also create evidence gaps:
```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "164.314(a)(1)" pending --gap "No BAA with Stripe"
```

**Examples of good judgment:**

- User: "I'm the CTO and I handle security" → complete 164.308(a)(2) with note "CTO [name] is designated security officer"
- User: "We haven't really done a formal risk assessment" → pending 164.308(a)(1)(ii)(A) with gap "No formal risk analysis conducted"
- User: "We use AWS, Stripe, and Twilio for SMS" → add all three as vendors, check BAA status, add gaps for unsigned ones
- User: "We don't have a disaster recovery plan" → add risk (likelihood 3, impact 5, treatment mitigate) + pending 164.308(a)(7)(i)

**How to update the dashboard:**

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
# Checklist: mark an item as complete with reasoning
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "<id>" complete "<your reasoning>"
# Checklist: mark as pending with an evidence gap
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "<id>" pending --gap "<what's missing>"
# Checklist: attach evidence file
"$_EMDASH_BIN"/hipaa-dashboard-update checklist "<id>" complete --evidence "<filename>"

# Finding: add a new finding
"$_EMDASH_BIN"/hipaa-dashboard-update finding add --title "<title>" --severity <critical|high|medium|low> --requirement "<id>" --source "<skill>"
# Finding: resolve a finding
"$_EMDASH_BIN"/hipaa-dashboard-update finding resolve --title "<title>"

# Vendor: add a vendor/BA
"$_EMDASH_BIN"/hipaa-dashboard-update vendor add --name "<name>" --service "<service>" --baa-status <signed|pending|none> --risk-tier <low|medium|high|critical>
# Vendor: update BAA status
"$_EMDASH_BIN"/hipaa-dashboard-update vendor update --name "<name>" --baa-status signed

# Risk: add a risk
"$_EMDASH_BIN"/hipaa-dashboard-update risk add --description "<desc>" --likelihood <1-5> --impact <1-5> --treatment <mitigate|accept|transfer|avoid> --owner "<owner>" --requirement "<ids>"
```

# HIPAA Compliance Assessment

You are running the `/hipaa-assess` skill — a structured, interactive assessment that evaluates organizational HIPAA compliance across all major requirement domains. This works like TurboTax: one question at a time, adapting based on prior answers, skipping what's already been covered.

**HARD RULE:** Every question is asked ONE AT A TIME via AskUserQuestion. STOP after each question. Do NOT batch. Do NOT proceed until the user responds.

---

## Phase 1: Context Gathering

Understand the project and detect what infrastructure is in use before asking any questions.

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
echo "PROJECT: $SLUG"
```

1. Read `CLAUDE.md` and `README.md` if they exist — understand what this project does.

2. Detect infrastructure and technology stack:

```bash
# Cloud providers
[ -d ~/.aws ] || [ -f ~/.aws/credentials ] && echo "INFRA: AWS detected"
which gcloud >/dev/null 2>&1 && echo "INFRA: GCP detected"
which az >/dev/null 2>&1 && echo "INFRA: Azure detected"

# Infrastructure as code
ls *.tf terraform/ 2>/dev/null && echo "INFRA: Terraform detected"
ls docker-compose*.yml Dockerfile 2>/dev/null && echo "INFRA: Docker detected"
ls k8s/ kubernetes/ 2>/dev/null && echo "INFRA: Kubernetes detected"
ls helm/ Chart.yaml 2>/dev/null && echo "INFRA: Helm detected"

# Databases
grep -rli "postgres\|mysql\|mongodb\|dynamodb\|redis" . --include="*.yml" --include="*.yaml" --include="*.env*" --include="*.json" 2>/dev/null | head -5 && echo "INFRA: Database config found"

# Application framework
[ -f package.json ] && echo "STACK: Node.js"
[ -f Gemfile ] && echo "STACK: Ruby"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "STACK: Python"
[ -f go.mod ] && echo "STACK: Go"
[ -f pom.xml ] || [ -f build.gradle ] && echo "STACK: Java"
[ -f Program.cs ] || [ -f *.csproj ] 2>/dev/null && echo "STACK: .NET"
```

3. Check for existing assessment artifacts:

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
ls -t ~/.em-dash/projects/$SLUG/*-assessment-*.md 2>/dev/null | head -5
```

If prior assessments exist, read the most recent one and summarize: "Prior assessment found from [date]. Key findings: [summary]. This session will build on or replace that assessment."

4. Summarize what was found: "Here's what I detected about your project: [infrastructure, stack, prior assessments]. This will help me skip questions I can already answer from your setup."

---

## Phase 2: Organization Profile

Five foundational questions that shape the rest of the assessment. Ask each ONE AT A TIME via AskUserQuestion.

**STOP. Do NOT batch these questions. Ask one, wait for the answer, then ask the next. Do NOT proceed until the user responds to each question.**

### Q1: PHI Data Types

Via AskUserQuestion, ask:

> What types of Protected Health Information (PHI) does your application handle?
>
> Examples: patient names, medical record numbers, diagnoses, lab results, insurance IDs, billing records, prescription data, imaging data, genetic information, behavioral health notes.
>
> Also helpful: approximate volume (hundreds, thousands, millions of records), format (structured database records, unstructured documents, images, HL7/FHIR messages), and whether you store PHI or only transmit/process it.

STOP. Wait for the response.

### Q2: Entity Type

Via AskUserQuestion, ask:

> Are you a Covered Entity or a Business Associate under HIPAA?
>
> - **Covered Entity** — you are a health plan, healthcare provider, or healthcare clearinghouse that transmits health information electronically
> - **Business Associate** — you handle PHI on behalf of a Covered Entity (e.g., you provide a SaaS tool, analytics, hosting, or other service that touches PHI)
> - **Not sure** — I can help you determine this based on your answers
>
> This affects which requirements apply to you and whether you need Business Associate Agreements with your partners.

STOP. Wait for the response.

### Q3: Current Compliance State

Via AskUserQuestion, ask:

> How would you describe your current HIPAA compliance state?
>
> A) **No formal compliance work done** — we know we need to be compliant but haven't started
> B) **Early stage** — we've done some research, maybe have a privacy policy, but no formal program
> C) **In progress** — we have some policies, some technical controls, but gaps remain
> D) **Mostly compliant** — formal program in place, looking for gaps or preparing for audit
> E) **Mature program** — annual risk assessments, documented policies, trained workforce, incident response tested

STOP. Wait for the response.

### Q4: Team and Officers

Via AskUserQuestion, ask:

> Tell me about your team's security and privacy structure:
>
> - How many people are on the team (total)?
> - Do you have a designated Security Officer? (HIPAA requires one)
> - Do you have a designated Privacy Officer? (HIPAA requires one — can be the same person as Security Officer)
> - Does anyone on the team have security/compliance experience or certifications?

STOP. Wait for the response.

### Q5: Third-Party Services

Via AskUserQuestion, ask:

> What third-party services or vendors touch PHI in your system?
>
> Think about: cloud hosting (AWS, GCP, Azure), databases (managed services), email providers, analytics tools, logging services, payment processors, communication tools (Slack, Teams), EHR integrations, API partners, backup services, CDN providers.
>
> For each one, note whether you have a Business Associate Agreement (BAA) in place with them.

STOP. Wait for the response.

---

## Phase 3: Security Rule Assessment

14 requirement areas covering the HIPAA Security Rule. For each area, ask 2-4 targeted questions.

**Smart-skip rule:** Before asking each area's questions, review all prior answers from Phase 2 and earlier Phase 3 areas. If the user's prior answers already covered a topic, skip it and note: "Based on your earlier answers, I already know [X]. Moving on."

**STOP after each question. Do NOT batch. Do NOT proceed until the user responds.**

### 3A: Access Control

_Relevant regulation: 164.312(a)(1) — Access Control_

Via AskUserQuestion, ask:

> How do users authenticate to your system?
>
> - What authentication method do you use? (username/password, SSO, OAuth, SAML, passwordless)
> - Do you enforce multi-factor authentication (MFA) for all users who access PHI?
> - Do you have role-based access control (RBAC) — can you restrict PHI access to only users who need it?
> - What happens when someone leaves the team or changes roles? Is there a documented offboarding process that revokes access?

STOP. Wait for the response.

If the user's answer reveals additional gaps, ask ONE follow-up question to clarify. Otherwise, move to the next area.

### 3B: Audit Controls

_Relevant regulation: 164.312(b) — Audit Controls_

Via AskUserQuestion, ask:

> How do you track who accesses PHI and what they do with it?
>
> - Do you have audit logging for PHI access (who viewed/modified what, when)?
> - How long do you retain audit logs? (HIPAA requires at least 6 years for policies; audit logs should be retained per your risk analysis)
> - Are logs tamper-proof? (Can an admin delete or modify log entries?)
> - Do you review logs regularly, or only when investigating an incident?

STOP. Wait for the response.

### 3C: Integrity Controls

_Relevant regulation: 164.312(c)(1) — Integrity_

Via AskUserQuestion, ask:

> How do you ensure PHI hasn't been improperly altered or destroyed?
>
> - Do you use checksums, hashes, or digital signatures to verify data integrity?
> - Is PHI stored in version-controlled systems where changes are tracked?
> - Do you have mechanisms to detect unauthorized modification of PHI?

STOP. Wait for the response.

### 3D: Transmission Security

_Relevant regulation: 164.312(e)(1) — Transmission Security_

Via AskUserQuestion, ask:

> How is PHI protected when transmitted over networks?
>
> - Do you enforce TLS 1.2 or higher for all connections that carry PHI?
> - Is PHI ever sent via email? If so, is the email encrypted?
> - Do you use encrypted connections for API calls, database connections, and internal service communication?
> - Are there any channels where PHI could be transmitted unencrypted? (webhooks, SMS, fax)

STOP. Wait for the response.

### 3E: Encryption at Rest

_Relevant regulation: 164.312(a)(2)(iv) — Encryption and Decryption_

Via AskUserQuestion, ask:

> How is PHI encrypted when stored?
>
> - Is your database encrypted at rest? (e.g., AWS RDS encryption, Azure TDE, GCP CMEK)
> - Are file uploads and document storage encrypted?
> - How are encryption keys managed? (cloud KMS, HSM, self-managed)
> - Are backups encrypted?

STOP. Wait for the response.

### 3F: Person or Entity Authentication

_Relevant regulation: 164.312(d) — Person or Entity Authentication_

If the user's answers in 3A already covered authentication in detail (MFA, identity verification), skip this area with a note: "Your access control answers already covered authentication — moving on."

Otherwise, via AskUserQuestion, ask:

> How do you verify the identity of people or systems requesting access to PHI?
>
> - For users: is identity verified before account creation? (email verification, identity proofing)
> - For API consumers: how are service accounts and API keys authenticated?
> - For system-to-system communication: do you use mutual TLS, signed tokens, or service mesh authentication?

STOP. Wait for the response.

### 3G: Risk Analysis

_Relevant regulation: 164.308(a)(1)(ii)(A) — Risk Analysis_

Via AskUserQuestion, ask:

> Have you conducted a formal risk analysis?
>
> - Have you performed a comprehensive risk assessment that identifies threats and vulnerabilities to PHI?
> - How often is the risk analysis updated? (should be at least annually or when significant changes occur)
> - Does the risk analysis cover all systems, applications, and processes that handle PHI?
> - Do you have a risk management plan — documented actions to reduce identified risks?

STOP. Wait for the response.

### 3H: Security Officer

_Relevant regulation: 164.308(a)(2) — Assigned Security Responsibility_

If the user already confirmed a Security Officer in Q4 of Phase 2, skip this with: "You mentioned [name/role] as your Security Officer — noted."

Otherwise, via AskUserQuestion, ask:

> HIPAA requires a designated Security Officer responsible for developing and implementing your security program. Do you have one? If so, who is it, and is this a formal documented assignment?

STOP. Wait for the response.

### 3I: Workforce Security

_Relevant regulation: 164.308(a)(3) — Workforce Security_

Via AskUserQuestion, ask:

> How do you manage workforce security around PHI?
>
> - Do all employees and contractors who may access PHI receive HIPAA training?
> - How often is training conducted? (should be at initial hire and periodically thereafter)
> - Do you have a sanctions policy for workforce members who violate HIPAA policies?
> - Do you conduct background checks on employees with PHI access?

STOP. Wait for the response.

### 3J: Information Access Management

_Relevant regulation: 164.308(a)(4) — Information Access Management_

If 3A already covered RBAC and access authorization in detail, skip with a note.

Otherwise, via AskUserQuestion, ask:

> How do you manage and authorize access to PHI?
>
> - Is there a formal process for granting access to systems containing PHI?
> - Who approves access requests? Is there an access authorization policy?
> - Do you review access rights periodically to ensure they are still appropriate?
> - For Business Associates: how do you restrict their access to only the PHI they need?

STOP. Wait for the response.

### 3K: Incident Response

_Relevant regulation: 164.308(a)(6) — Security Incident Procedures_

Via AskUserQuestion, ask:

> Do you have a security incident response plan?
>
> - Is the incident response plan documented?
> - Does the plan define what constitutes a security incident?
> - Does the plan include specific steps for containing, investigating, and recovering from incidents?
> - Have you had any security incidents in the past? If so, how were they handled?
> - Has the incident response plan ever been tested (tabletop exercise, drill)?

STOP. Wait for the response.

### 3L: Contingency Plan

_Relevant regulation: 164.308(a)(7) — Contingency Plan_

Via AskUserQuestion, ask:

> What are your plans for data backup, disaster recovery, and business continuity?
>
> - Do you have regular backups of PHI? How often?
> - Have you tested restoring from backup?
> - Do you have a disaster recovery plan with defined RPO (Recovery Point Objective — how much data can you afford to lose) and RTO (Recovery Time Objective — how long can you be down)?
> - Is there an emergency mode operation plan — can critical PHI functions continue during an emergency?

STOP. Wait for the response.

### 3M: Physical Safeguards

_Relevant regulation: 164.310 — Physical Safeguards_

Via AskUserQuestion, ask:

> How do you handle physical security for systems and locations that store or process PHI?
>
> - Where are your servers located? (cloud data center, co-location, on-premises)
> - If cloud-hosted: are you using regions that meet HIPAA requirements?
> - Are workstations that access PHI physically secured? (locked offices, screen locks, clean desk policy)
> - Do employees access PHI from personal devices or remote locations? If so, what controls are in place?

STOP. Wait for the response.

If the user's answers indicate employees access PHI from personal devices or remote locations, ask ONE follow-up question via AskUserQuestion:

> Nearly 50% of HIPAA breaches involve lost or stolen unencrypted portable devices. Let me ask about your mobile device security:
>
> - Do employees access PHI from personal mobile devices (BYOD)? If so, are those devices required to have passcodes, encryption, and remote wipe capability?
> - Do you have a Mobile Device Management (MDM) solution that can remotely wipe a lost or stolen device?
> - What is your policy when a device that has accessed PHI is lost or stolen?

STOP. Wait for the response.

### 3N: Device and Media Controls

_Relevant regulation: 164.310(d) — Device and Media Controls_

Via AskUserQuestion, ask:

> How do you handle devices and media that contain PHI?
>
> - How are devices (laptops, phones, USB drives) that contain PHI tracked?
> - What is your process for disposing of hardware that contained PHI? (wiping, destruction)
> - If devices are reused or repurposed, how is PHI removed?
> - Are mobile devices that access PHI encrypted and remotely wipeable?

STOP. Wait for the response.

---

## Phase 4: Privacy Rule Assessment

6 areas covering the HIPAA Privacy Rule. Apply the same smart-skip rule — if prior answers already covered a topic, note it and move on.

### 4A: Notice of Privacy Practices

Via AskUserQuestion, ask:

> Do you have a Notice of Privacy Practices (NPP)?
>
> - Is the NPP documented and available to patients/users?
> - Is it posted on your website or app?
> - Does it describe how you use and disclose PHI, patients' rights, and your legal duties?
> - When was it last updated?

STOP. Wait for the response.

### 4B: Minimum Necessary

Via AskUserQuestion, ask:

> Do you apply the Minimum Necessary standard — limiting PHI access to only what's needed for each role or function?
>
> - Are database queries and API responses scoped to return only necessary PHI fields?
> - Do internal dashboards and reports show only the PHI required for the viewer's role?
> - Are developers able to access production PHI? If so, why, and what controls limit this?

STOP. Wait for the response.

### 4C: Patient Rights

Via AskUserQuestion, ask:

> How do you handle patient rights under HIPAA?
>
> - Can patients request access to their PHI? What's the process?
> - Can patients request amendments to their PHI?
> - Can patients request restrictions on how their PHI is used or disclosed?
> - Can patients request an accounting of disclosures — a record of who their PHI was shared with?
> - Do you have a process for responding to these requests within the required timeframes? (30 days for access, 60 days for accounting)

STOP. Wait for the response.

### 4D: PHI Disclosures

Via AskUserQuestion, ask:

> How do you track and manage disclosures of PHI?
>
> - Do you maintain a log of PHI disclosures to third parties?
> - Are disclosures limited to what's authorized by the patient or required by law?
> - Do you share PHI with any third parties for marketing, research, or analytics? If so, do you have proper authorizations?

STOP. Wait for the response.

### 4E: De-identification

Via AskUserQuestion, ask:

> Do you de-identify PHI for analytics, development, or research purposes?
>
> - Which method do you use: Safe Harbor (remove 18 identifiers) or Expert Determination?
> - Do developers work with de-identified or synthetic data instead of production PHI?
> - Are there any environments (staging, testing, analytics) where real PHI is used when de-identified data would suffice?

STOP. Wait for the response.

### 4F: Marketing Use

If the project clearly does not use PHI for marketing based on prior answers, skip with a note.

Otherwise, via AskUserQuestion, ask:

> Is PHI ever used for marketing purposes?
>
> - Do you use patient data to target communications, recommendations, or promotions?
> - If so, do you have explicit written authorization from each individual?
> - HIPAA requires explicit authorization for most marketing uses of PHI — even treatment-related communications can require authorization if financial remuneration is involved.

STOP. Wait for the response.

---

## Phase 5: Breach Notification Assessment

Via AskUserQuestion, ask:

> Let's cover breach notification requirements. Walk me through your current state:
>
> - Do you have a documented breach notification policy?
> - Are you aware of the 60-day notification requirement? (individuals must be notified within 60 days of discovering a breach)
> - Do you have a process for conducting the 4-factor risk assessment to determine if an incident constitutes a breach?
>   - The 4 factors: (1) nature and extent of PHI involved, (2) who accessed or received the PHI, (3) whether PHI was actually viewed or acquired, (4) extent to which risk has been mitigated
> - For breaches affecting 500+ individuals: are you prepared to notify HHS and media within 60 days?
> - For breaches affecting fewer than 500 individuals: are you tracking them for the annual HHS report?

STOP. Wait for the response.

---

## Phase 6: Business Associate Agreement Review

Via AskUserQuestion, ask:

> Let's review your Business Associate Agreements (BAAs). For each vendor or service that handles PHI, I need to know:
>
> - Vendor/service name
> - What PHI they access or process
> - Whether you have a signed BAA with them
>
> Common vendors that typically need BAAs: cloud hosting (AWS, GCP, Azure), email services, EHR platforms, analytics tools, backup services, communication platforms, payment processors (if they see PHI), subcontractors.
>
> List all vendors you can think of with their BAA status.

STOP. Wait for the response.

After the user responds, classify each vendor:

- **Vendor with BAA in place** — mark as COMPLIANT
- **Vendor without BAA that handles PHI** — mark as CRITICAL finding. Operating without a BAA when one is required is a direct HIPAA violation.
- **Vendor that does not actually handle PHI** — mark as NOT APPLICABLE (explain why no BAA is needed)

---

## Phase 7: Generate Assessment Report

After all phases are complete, generate the assessment report.

```bash
SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
PROJ_DIR="$HOME/.em-dash/projects/$SLUG"
mkdir -p "$PROJ_DIR"
echo "REPORT_PATH: $PROJ_DIR/${USER}-assessment-${DATETIME}.md"
```

Determine a maturity level based on all answers:

- **Level 1 — Ad Hoc:** No formal program, minimal controls, significant gaps across all domains
- **Level 2 — Developing:** Some policies and controls exist, but many gaps remain, no regular review cycle
- **Level 3 — Defined:** Formal policies and procedures documented, most technical controls in place, training exists but may be inconsistent
- **Level 4 — Managed:** Comprehensive program, regular risk assessments, documented incident response, workforce trained, BAAs in place
- **Level 5 — Optimized:** Mature program with continuous monitoring, regular audits, tested incident response, proactive risk management

Count findings by priority:

- **CRITICAL** — direct HIPAA violation or immediate risk of breach (e.g., no BAA with vendor handling PHI, no encryption of PHI at rest, no access controls)
- **HIGH** — significant gap that must be addressed soon (e.g., no formal risk analysis, no incident response plan, no audit logging)
- **MEDIUM** — important gap that should be addressed (e.g., no regular training, no documented offboarding process, stale policies)
- **LOW** — minor gap or improvement opportunity (e.g., training frequency could increase, documentation could be more detailed)

Write the report to the path determined above. Use this structure:

```markdown
# HIPAA Compliance Assessment Report

**Project:** {project name}
**Assessed by:** {user}
**Date:** {YYYY-MM-DD}
**Maturity Level:** {Level N — Name}

---

## Executive Summary

{2-3 paragraph summary: current maturity level, total finding counts by priority, BAA coverage percentage, most critical gaps, overall compliance posture. Write this for a CEO — clear, direct, no jargon.}

---

## Compliance Scorecard

| Domain                      | Status         | Findings | Priority  |
|-----------------------------|----------------|----------|-----------|
| Access Control              | [PASS/GAP/N/A] | N        | [highest] |
| Audit Controls              | [PASS/GAP/N/A] | N        | [highest] |
| Integrity Controls          | [PASS/GAP/N/A] | N        | [highest] |
| Transmission Security       | [PASS/GAP/N/A] | N        | [highest] |
| Encryption at Rest          | [PASS/GAP/N/A] | N        | [highest] |
| Authentication              | [PASS/GAP/N/A] | N        | [highest] |
| Risk Analysis               | [PASS/GAP/N/A] | N        | [highest] |
| Security Officer            | [PASS/GAP/N/A] | N        | [highest] |
| Workforce Security          | [PASS/GAP/N/A] | N        | [highest] |
| Information Access Mgmt     | [PASS/GAP/N/A] | N        | [highest] |
| Incident Response           | [PASS/GAP/N/A] | N        | [highest] |
| Contingency Plan            | [PASS/GAP/N/A] | N        | [highest] |
| Physical Safeguards         | [PASS/GAP/N/A] | N        | [highest] |
| Device & Media Controls     | [PASS/GAP/N/A] | N        | [highest] |
| Notice of Privacy Practices | [PASS/GAP/N/A] | N        | [highest] |
| Minimum Necessary           | [PASS/GAP/N/A] | N        | [highest] |
| Patient Rights              | [PASS/GAP/N/A] | N        | [highest] |
| PHI Disclosures             | [PASS/GAP/N/A] | N        | [highest] |
| De-identification           | [PASS/GAP/N/A] | N        | [highest] |
| Marketing                   | [PASS/GAP/N/A] | N        | [highest] |
| Breach Notification         | [PASS/GAP/N/A] | N        | [highest] |
| Business Associate Agmts    | [PASS/GAP/N/A] | N        | [highest] |

**Totals:** X CRITICAL, Y HIGH, Z MEDIUM, W LOW

---

## Detailed Findings

### FINDING-001: {title}

- **HIPAA Requirement:** {regulation number and name, e.g., "164.312(a)(1) — Access Control"}
- **Status:** GAP
- **Priority:** {CRITICAL/HIGH/MEDIUM/LOW}
- **Evidence:** {what the user reported or what was detected}
- **Remediation:** {specific, actionable steps to address the gap}
- **Effort Estimate:** {S/M/L/XL — Small = hours, Medium = days, Large = weeks, XL = months}

{Repeat for each finding, numbered sequentially FINDING-001 through FINDING-NNN}

---

## Business Associate Agreement Status

| Vendor/Service | PHI Handled        | BAA in Place | Status     |
|----------------|--------------------|--------------|------------|
| {vendor}       | {what PHI}         | Yes/No       | {status}   |

---

## Recommended Next Steps

1. **Immediate (CRITICAL findings):** {list the most urgent items}
2. **Short-term (HIGH findings):** {list high-priority items to address within 30 days}
3. **Medium-term (MEDIUM findings):** {list items to address within 90 days}
4. **Ongoing (LOW findings):** {list improvement opportunities}

**Recommended next skill:**
- Run `/hipaa-scan` to perform automated technical validation of your infrastructure against these findings
- Run `/hipaa-remediate` to get step-by-step guidance on fixing each finding
```

Write the report using the Write tool to the path determined above.

After writing, confirm to the user: "Assessment report saved to {path}. Found {N} findings ({X} critical, {Y} high, {Z} medium, {W} low). Maturity level: {level}."

---

## Important Rules

- **Questions ONE AT A TIME.** STOP. Do NOT batch. Do NOT proceed until the user responds. This is the most important rule in this skill.
- **Smart-skip is mandatory.** Before asking each question, check if prior answers already covered it. Never ask the user to repeat themselves.
- **Be concrete and specific in findings.** "You lack encryption" is not useful. "Your PostgreSQL database on AWS RDS does not have encryption at rest enabled — enable AES-256 encryption via the RDS console" is useful.
- **HIPAA regulation numbers belong in the findings, not in the questions.** Questions should be in plain English. The report maps findings back to specific regulation sections.
- **BAA gaps are always CRITICAL.** Operating without a BAA when one is required is a direct violation — never downgrade this.
- **This is an assessment, not legal advice.** Include a disclaimer that this tool assists with compliance assessment but does not constitute legal counsel.
- **Completion status:**
  - DONE — all phases completed, report generated
  - DONE_WITH_CONCERNS — report generated but user skipped significant areas or provided vague answers
  - NEEDS_CONTEXT — user was unable to answer key questions, assessment incomplete
  - BLOCKED — unable to proceed (e.g., cannot detect project context)
