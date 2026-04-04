---

name: hipaa
version: 3.0.0
description: |
  HIPAA compliance. For first-time users, runs the founder onramp
  (advisory detection, 9 questions, PHI flow map, action plan).
  For returning users, shows status and routes to comply-auto/scan/assess/fix/report.
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## DISCLAIMER

> **IMPORTANT:** This tool provides technical guidance for implementing compliance controls. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.


# /hipaa — HIPAA Compliance

Initialize HIPAA compliance and show your status.

## Step 1: Check if this is a first-time user

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db summary 2>/dev/null
_DB_EXISTS=$?
echo "DB_EXIT: $_DB_EXISTS"
```

If the database does not exist (exit code non-zero or output shows 0 controls), this is a first-time user. Go to **Step 2: Founder Onramp**.

If the database exists and has controls, go to **Step 5: Returning User**.

## Step 2: Founder Onramp — Advisory Detection

Tell the user: "Welcome! Let me scan your project to see what technologies you're using."

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-start scan
```

Present the detected technologies to the user in plain English:

> **We detected these technologies in your project:**
> - AWS (from @aws-sdk in package.json)
> - Stripe (from stripe in package.json)
> - PostgreSQL (from pg in package.json)
>
> **Is this correct? Any technologies missing or wrong?**

Let the user confirm or correct the detected technologies. Use AskUserQuestion.

If no technologies were detected, tell the user: "No project files found. Let me ask you about your stack directly."

## Step 3: Founder Onramp — 9 Questions

Ask these questions ONE AT A TIME using AskUserQuestion. Use plain English. No NIST jargon.

**Q1:** What are you building? (In one sentence, what does your app do?)

**Q2:** Who uses it? (Patients directly? Doctors? Clinic staff? All of the above?)

**Q3:** Where does patient data enter your system? (Web form? API? File upload? Manual entry?)

**Q4:** Where is patient data stored? (Database? Cloud storage? File system?)

**Q5:** Who has access to patient data? (Just you? Your team? Third-party services?)

**Q6:** What cloud provider do you use? (AWS, GCP, Azure, or something else?)

**Q7:** How do users log in? (Auth0, Firebase Auth, custom login, or no login yet?)

**Q8:** What third-party services touch patient data? (Payment processing, email, analytics, etc.)

**Q9:** Are you handling patient data on behalf of other healthcare organizations? (e.g., building a platform that hospitals or clinics use)

### Q9 — B2B2C Conditional Questions

If the user answers YES to Q9, ask these additional questions:

**Q9a:** Who are your covered entities? (Hospitals, clinics, health plans, etc.)

**Q9b:** Do you use subcontractors who also handle their data?

**Q9c:** Who handles breach notification — you or the covered entity?

**Q9d:** Do you have Business Associate Agreement (BAA) templates, or do your clients provide them?

## Step 4: Founder Onramp — Apply and Report

Construct the answers JSON from the user's responses and the confirmed vendor list. Include phi_flows based on Q3+Q4 answers, and vendor details from the scan + Q6/Q7/Q8.

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)

# Write answers to temp file
cat > /tmp/hipaa-onramp-answers.json << 'ANSWERS_EOF'
{CONSTRUCT JSON FROM USER RESPONSES}
ANSWERS_EOF

"$_EMDASH_BIN"/comply-start apply --answers /tmp/hipaa-onramp-answers.json
"$_EMDASH_BIN"/comply-start report
```

Present the report to the user in plain English. Use the output from `comply-start report` which includes:

1. **PHI Flow Map** — Where patient data goes in your system
2. **Vendor Inventory** — Which services touch patient data and their BAA status
3. **Top 5 Blockers** — The most important things to fix first
4. **30-Day Action Plan** — What to do this week, this month, and this quarter

After presenting the report, tell the user:

> "This is your starting point. Your compliance data is saved and signed.
> Run `/hipaa` again anytime to see your progress. Run `/comply-scan` to
> check your infrastructure, or `/comply-fix` to start fixing blockers."

Clean up:
```bash
rm -f /tmp/hipaa-onramp-answers.json
```

## Step 5: Returning User

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db init --framework hipaa 2>/dev/null || true
"$_EMDASH_BIN"/comply-db summary
"$_EMDASH_BIN"/comply-db status
```

Tell the user: "HIPAA compliance initialized. [N] NIST 800-53 controls imported."

## Step 6: Recommend next step (returning users)

- **0% complete:** "Run `/comply-auto` to start — it scans your infrastructure, fixes what it can, and asks you questions."
- **Partial:** "Run `/comply-assess` for interviews or `/comply-scan` for automated checks."
- **Failures found:** "Run `/comply-fix` to remediate."
- **Complete:** "Run `/comply-report` to generate your signed audit packet."
- **Want to experience a mock audit?** "Run `/hipaa-audit` — it simulates a real HHS OCR audit in 7 phases with findings and a prioritized action checklist."

## Step 7: Multiple frameworks

If user wants to add another framework: "Run `/soc2`, `/gdpr`, or `/pci-dss` to add more. Controls are shared automatically."

## Important

- All `/comply-*` skills work with whichever frameworks you've initialized.
- Evidence lives in SQLite: `~/.em-dash/projects/{slug}/compliance.db`
- Healthcare compliance — PHI protection, security rule, privacy rule
- First-time users get the guided onramp. Returning users see the dashboard.
- The onramp uses advisory detection — it tells you what it found, you confirm.
