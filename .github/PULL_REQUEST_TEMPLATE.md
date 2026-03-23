## Summary

<!-- What does this PR do? 1-3 bullet points. -->

## HIPAA requirements affected

<!-- Which HIPAA sections does this change relate to? e.g., 164.312(a)(1), or N/A -->

## Checklist

- [ ] `bun test` passes
- [ ] `bun run gen:skill-docs -- --dry-run` passes (if templates changed)
- [ ] Both `.tmpl` and generated `.md` files committed (if templates changed)
- [ ] New Rego policies have `hipaa_ref` and `severity` in all deny rules
