# CI/CD HIPAA Scanning Setup

Run em-dash compliance scans automatically on every PR using Claude Code.

## Quick Start

1. **Add your Anthropic API key** as a repository secret:
   - Go to Settings → Secrets and variables → Actions
   - Add `ANTHROPIC_API_KEY` with your API key

2. **Label PRs for scanning**: Add the `hipaa-scan` label to any PR to trigger an automatic compliance scan.

3. **Manual trigger**: Go to Actions → "HIPAA Compliance Scan" → Run workflow. Choose which skill to run.

## How It Works

The workflow uses [claude-code-action](https://github.com/anthropics/claude-code-action) to run em-dash skills in a GitHub Actions runner. The scan:

- Runs 19 code-level PHI checks (grep-based pattern detection)
- Scans IaC files (Terraform, CloudFormation, K8s) against 6 Rego policies
- Reports findings as a PR comment with severity ratings

## Cost

Each scan costs approximately $0.50-2.00 depending on repository size and number of findings. The scan uses Claude Sonnet by default for cost efficiency.

## Available Skills

| Skill | Description | Typical Cost |
|-------|-------------|-------------|
| `hipaa-scan` | Full code + infrastructure scan | ~$1.50 |
| `hipaa-assess` | Organizational assessment interview | ~$0.50 |
| `hipaa-remediate` | Fix findings from a prior scan | ~$2.00 |
| `hipaa-report` | Generate compliance report | ~$1.00 |

## Customization

To scan on every PR (not just labeled ones), remove the label condition from `.github/workflows/hipaa-scan.yml`:

```yaml
# Remove this line:
if: contains(github.event.pull_request.labels.*.name, 'hipaa-scan')
```
