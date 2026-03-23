# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in em-dash, **please report it privately** — do not open a public GitHub issue.

**Email:** [aanish@coralehr.com](mailto:aanish@coralehr.com)

Include:
- Description of the vulnerability
- Steps to reproduce
- Severity assessment (your best guess is fine)
- Any suggested fix

## What counts as a security issue

- **False negatives in scanning checks** — if a PHI pattern, Rego policy, or cloud check fails to detect a real HIPAA violation, that's a security issue. Users rely on these checks to find compliance gaps.
- **False negatives in policy templates** — if a generated policy document omits a required HIPAA control or gives incorrect guidance.
- **Information disclosure** — if em-dash leaks PHI, credentials, or sensitive project information through logs, reports, or evidence files.
- **Evidence integrity** — if the SHA-256 evidence hashing can be bypassed or tampered with.

## What is NOT a security issue

- Feature requests or missing checks (use the GitHub issue tracker)
- HIPAA interpretation disagreements (em-dash is not legal advice)
- Issues in third-party scanning tools (Prowler, Trivy, Checkov) — report those upstream

## Response

We'll respond as quickly as possible. Security issues are prioritized above all other work.

## Disclosure

We follow coordinated disclosure. Once a fix is released, we'll credit you in the changelog (unless you prefer to remain anonymous).
