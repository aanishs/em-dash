# hipaa-demo-app

A deliberately insecure health-tech backend for demonstrating em-dash.

**This app has intentional HIPAA violations.** It exists so you can run em-dash against it
and see what a real compliance scan looks like — without touching production infrastructure.

## What's broken (on purpose)

| Violation | File | HIPAA Ref |
|-----------|------|-----------|
| PHI in console.log | `src/patients.ts` | 164.312(b) |
| No audit logging on PHI endpoints | `src/api.ts` | 164.312(b) |
| PHI stored in localStorage | `src/dashboard.ts` | 164.312(a)(1) |
| Weak password hashing (MD5) | `src/auth.ts` | 164.312(d) |
| No session timeout | `src/auth.ts` | 164.312(a)(2)(iii) |
| No RBAC on patient endpoints | `src/api.ts` | 164.312(a)(1) |
| Real SSN patterns in tests | `src/patients.test.ts` | 164.502 |
| PHI in error responses | `src/api.ts` | 164.312(a)(1) |
| Secrets in config | `.env.example` | 164.312(a)(1) |
| No encryption at rest config | `infra/main.tf` | 164.312(a)(2)(iv) |
| Open S3 bucket | `infra/main.tf` | 164.312(a)(1) |
| No VPC flow logs | `infra/main.tf` | 164.312(b) |
| IAM wildcard permissions | `infra/main.tf` | 164.308(a)(4) |
| No CloudTrail | `infra/main.tf` | 164.312(b) |
| DB without TLS | `infra/main.tf` | 164.312(e)(1) |

## Try it

```bash
# From the em-dash repo root:
cd demo/hipaa-demo-app

# Run em-dash against this project:
/hipaa-scan
```

em-dash will find 15+ violations across code, infrastructure, and missing policies.

## Contributing

Want to add a new vulnerability for em-dash to detect? Add a file to `src/` or `infra/`
with an intentional HIPAA gap. Update this README's violation table. Open a PR.
