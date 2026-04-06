---

name: comply-explain
version: 1.0.0
description: |
  Explain any compliance standard in plain English, in context.
  Accepts NIST control IDs (SC-28), HIPAA CFR sections (164.312(a)(2)(iv)),
  or natural language queries (encryption). Searches authoritative .gov
  sources when available. Can be triggered by user or by Claude when relevant.
allowed-tools:
  - Bash
  - Read
  - WebSearch
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## DISCLAIMER

> **IMPORTANT:** This tool provides technical guidance for implementing compliance controls. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.


# /comply-explain — Understand Any Compliance Standard

Explain a compliance control in plain English, tailored to the user's specific context and stack.

## Step 1: Parse Input

The user may provide:
- A **NIST control ID** like `SC-28` or `AC-2`
- A **HIPAA CFR section** like `164.312(a)(2)(iv)`
- A **natural language query** like `encryption` or `access control`

If the input looks like a NIST ID or CFR section (starts with letters+dash+numbers, or starts with `164.`), use it directly.

If the input looks like natural language, read `nist/plain-english.json` and search for controls where `plain_english`, `why_it_matters`, or `nist_name` match the query. If multiple controls match, present a disambiguation list:

> "Several controls relate to [query]. Which one?"
> 1. SC-28 — Encryption at rest (Patient data must be encrypted when stored)
> 2. SC-13 — Cryptographic protection (Use real encryption, not homebrew)
> 3. SC-8 — Transmission security (Encrypt data in transit)

Ask the user to pick one using AskUserQuestion. Then proceed with that control ID.

## Step 2: Get Control Data

```bash
_EMDASH_BIN=$([ -d ~/.claude/skills/em-dash/bin ] && echo ~/.claude/skills/em-dash/bin || echo .claude/skills/em-dash/bin)
"$_EMDASH_BIN"/comply-db control <ID> --json
```

Replace `<ID>` with the NIST control ID or HIPAA CFR section from Step 1.

If the command fails (no database initialized), try the `--json` flag anyway — the command reads from data files (plain-english.json, NIST catalog) even without a SQLite database.

## Step 3: Format the Explanation

Using the JSON output, build a conversational explanation for the user. Follow this structure:

1. **Lead with the plain-English explanation.** Use the `plain_english` field. This is the first thing the user reads.

2. **Explain why it matters.** Use the `why_it_matters` field. Connect it to real consequences.

3. **Stack-specific guidance.** If `detected_stack` is populated (e.g., `["aws"]`), tailor the explanation:
   - AWS + SC-28 → "In your case, this means enabling RDS encryption and S3 default encryption."
   - Auth0 + AC-2 → "Auth0 handles unique logins for you, but you still need to manage access levels."
   - Generate this contextual guidance based on the control and detected vendors.

4. **Related controls.** If `related_controls` is non-empty, mention the most relevant 2-3:
   - "This connects to SC-13 (Cryptographic Protection) — SC-13 defines WHICH crypto to use, SC-28 says USE it at rest."

5. **Current status.** If `status` is not "unknown", tell the user where they stand:
   - "pending" → "You haven't addressed this yet."
   - "partial" → "You've started on this but it's not complete."
   - "complete" → "This control is verified and passing."

6. **Verification approach.** If `verification` is present:
   - automated → "This can be verified automatically using [tools]."
   - interview_only → "This requires an interview/document review — no automated check exists."

7. **If `--simple` was requested or the user asks for a simpler explanation:** Generate an analogy-based ELI5 version. Example: "Think of encryption like a safe. Right now your patient data is sitting on a desk where anyone can read it. Encryption puts it in a safe — even if someone breaks into your office, they can't read the contents."

## Step 4: Add Authoritative Sources

If WebSearch is available, search for official guidance:

```
Query: "HIPAA [CFR section] [control name] guidance"
Allowed domains: hhs.gov, nist.gov, healthit.gov
```

Append 1-2 source links at the end of the explanation. Only cite .gov sources.

If WebSearch is not available, append:
> For official guidance, see: https://www.hhs.gov/hipaa/for-professionals

## Tone

- Plain English. No jargon unless explaining the jargon itself.
- Concrete examples over abstract descriptions.
- Connect to the user's actual situation when stack context is available.
- Be honest about what the control requires without sugar-coating.
- Encourage, don't lecture. The user is trying to do the right thing.
