# hipaa-demo-app

A deliberately insecure health-tech backend for demonstrating em-dash.

**This app has intentional HIPAA violations.** It exists so you can run em-dash against it
and see what a real compliance scan looks like — without touching production infrastructure.

## Where's the list of violations?

Not here, on purpose. The violation inventory (the "answer key") lives outside this
directory so that benchmark runs of em-dash against this app aren't graded against a
cheat sheet sitting in the scanned tree:

- The **planted set** is guarded by `test/demo-integrity.test.ts` at the repo root —
  if anyone "fixes" a planted violation, CI fails. (That test enumerates the violations,
  which is fine: this set is public by design and derivable from git history anyway.)
- Benchmark scoring against a **held-out set** (novel violations planted just before a
  scored run, pre-registered via a timestamped public gist) is what measures blind
  detection. See the Trust Sprint notes in the repo for the protocol.

## Try it

```bash
# From the em-dash repo root:
cd demo/hipaa-demo-app

# Run em-dash against this project:
/comply-scan
```

em-dash will find 15+ violations across code, infrastructure, and missing policies.

## Contributing

Want to add a new vulnerability for em-dash to detect? Add a file to `src/` or `infra/`
with an intentional HIPAA gap, and add a matching guard assertion to
`test/demo-integrity.test.ts` so the violation can't be silently "fixed" later. Open a PR.
