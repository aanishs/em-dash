# Changelog

## v1.0.0 — Initial release

em-dash: a HIPAA compliance platform for Claude Code. Built for teams handling PHI.

**Seven skills that chain together.** `/hipaa-assess` interviews you about organizational controls, `/hipaa-scan` checks your code and infrastructure, `/hipaa-remediate` fixes findings and generates policy documents, `/hipaa-report` produces auditor-ready reports, `/hipaa-monitor` detects drift, and `/hipaa-breach` guides breach notification. `/hipaa` is the router that shows your dashboard and tells you what to do next.

**Cloud infrastructure scanning.** ~65 AWS CLI commands, ~40 gcloud commands, and ~28 Azure CLI commands — all read-only — covering encryption, IAM, logging, network security, and more. Each finding maps to a specific HIPAA requirement.

**Infrastructure-as-Code scanning.** Checkov integration (1000+ rules with a built-in HIPAA framework) and 6 bundled Rego/OPA policies for Terraform, CloudFormation, and Kubernetes via Conftest.

**19 code-level security checks.** PHI in logs, PHI in browser storage, missing RBAC, missing audit logging, weak password hashing, hardcoded credentials, and more — all run with just grep.

**8 policy document templates.** Access Control, Audit Logging, Encryption, Incident Response, Risk Assessment, Workforce Security, Contingency Plan, and BAA template.

**CI/CD integration.** Add the `hipaa-scan` label to any PR and em-dash scans it automatically via GitHub Actions. See [docs/ci-setup.md](docs/ci-setup.md).

**Evidence collection with integrity.** SHA-256 hashed evidence files with timestamps for auditor verification.

**280 tests. All free. Under 3 seconds.**
