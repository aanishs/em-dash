## Summary

<!-- What does this PR do? 1-3 bullet points. -->

## Compliance requirements affected

<!-- Which framework/controls does this relate to? e.g., HIPAA 164.312(a)(1), CIS 3.1, SOC2 CC6.1, or N/A -->

## Checklist

- [ ] `bun test` passes (~135 tests)
- [ ] `bun run gen:skill-docs -- --dry-run` passes (if templates changed)
- [ ] Both `.tmpl` and generated `.md` files committed (if templates changed)
- [ ] New Rego policies have `check_id` and `severity` in all `deny` rules
- [ ] New checks added to `nist/tool-bindings.json` under relevant controls
