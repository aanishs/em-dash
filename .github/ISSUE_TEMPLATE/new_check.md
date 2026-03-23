---
name: New scanning check
about: Propose a new code-level, infrastructure, or IaC check
labels: enhancement, new-check
---

**What should em-dash detect?**
Describe the security issue or misconfiguration.

**HIPAA requirement**
Which section? e.g., §164.312(a)(1) Access Control, §164.312(b) Audit Controls

**Severity**
- [ ] CRITICAL — direct PHI exposure
- [ ] HIGH — missing required safeguard
- [ ] MEDIUM — defense-in-depth gap
- [ ] LOW — best practice

**Check type**
- [ ] Code-level (grep/regex pattern)
- [ ] Cloud infrastructure (CLI command)
- [ ] IaC policy (Rego rule)
- [ ] Scanning tool integration

**Detection logic**
How would you detect this? Include grep patterns, CLI commands, or Rego rule sketches.

```
# Example: detect PHI in Redis cache keys
grep -rn "redis.*set.*patient\|redis.*set.*ssn" --include="*.ts" --include="*.js"
```

**False positive risk**
How likely is this to flag legitimate code? What would a false positive look like?

**Are you willing to contribute this?**
- [ ] Yes, I'd like to submit a PR
- [ ] No, just proposing
