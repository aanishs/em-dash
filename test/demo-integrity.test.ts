/**
 * Demo app integrity guard.
 *
 * demo/hipaa-demo-app exists to BE broken — it is the benchmark target for
 * em-dash's detection claims. These violations were once silently remediated
 * in place (phase-0 commits fixed main.tf and auth.ts while the README's
 * violation table went stale), which corrupted the benchmark without anything
 * noticing. This suite makes that failure mode impossible: "fixing" a planted
 * violation fails CI.
 *
 * Enumerating the planted set here is intentional. This set is public by
 * design (and derivable from git history regardless); blind-detection scoring
 * uses a separate held-out set planted immediately before a scored run and
 * pre-registered out-of-tree. See demo/hipaa-demo-app/README.md.
 *
 * If you legitimately want to change a planted violation, update the matching
 * assertion in the same PR — that is the visible, reviewable path.
 */
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const DEMO = path.join(import.meta.dir, "..", "demo", "hipaa-demo-app");
const read = (rel: string) => fs.readFileSync(path.join(DEMO, rel), "utf-8");

describe("Demo app integrity: planted violations stay planted", () => {
	test("auth.ts hashes passwords with MD5 (weak hashing — §164.312(d))", () => {
		const src = read("src/auth.ts");
		expect(src).toContain("createHash('md5')");
		expect(src).not.toContain("bcrypt");
	});

	test("auth.ts has no session timeout (§164.312(a)(2)(iii))", () => {
		const src = read("src/auth.ts");
		// The violation is documented in comments, so match code shape, not words:
		// no expiresAt/maxAge property is ever set on a session.
		expect(src).not.toMatch(/expiresAt\s*:/);
		expect(src).not.toMatch(/maxAge\s*:/);
		expect(src).toContain("VIOLATION: No session timeout");
	});

	test("patients.ts logs PHI to console (§164.312(b))", () => {
		expect(read("src/patients.ts")).toMatch(/console\.log\(.*SSN.*\)/i);
	});

	test("dashboard.ts stores PHI in localStorage (§164.312(a)(1))", () => {
		expect(read("src/dashboard.ts")).toContain(
			"localStorage.setItem('currentPatient'",
		);
	});

	test("patients.test.ts uses realistic SSN fixtures (§164.502)", () => {
		expect(read("src/patients.test.ts")).toMatch(/\d{3}-\d{2}-\d{4}/);
	});

	test("api.ts keeps its planted violations (audit logging, RBAC, PHI in errors)", () => {
		const src = read("src/api.ts");
		expect((src.match(/VIOLATION/g) || []).length).toBeGreaterThanOrEqual(3);
	});

	test(".env.example contains hardcoded secrets (§164.312(a)(1))", () => {
		const env = read(".env.example");
		expect(env).toMatch(/^AWS_SECRET_ACCESS_KEY=\S+/m);
		expect(env).toMatch(/^ANTHROPIC_API_KEY=\S+/m);
		expect(env).toMatch(/^STRIPE_SECRET_KEY=\S+/m);
	});

	test("main.tf S3 bucket lacks encryption, versioning, and public access block", () => {
		const tf = read("infra/main.tf");
		expect(tf).not.toContain('server_side_encryption_configuration" ');
		expect(tf).not.toContain("aws_s3_bucket_public_access_block");
		expect(tf).not.toContain("aws_s3_bucket_versioning");
	});

	test("main.tf RDS is publicly accessible with a hardcoded password", () => {
		const tf = read("infra/main.tf");
		expect(tf).toMatch(/publicly_accessible\s*=\s*true/);
		expect(tf).toMatch(/password\s*=\s*"/);
	});

	test("main.tf IAM uses wildcard action and resource (§164.308(a)(4))", () => {
		const tf = read("infra/main.tf");
		expect(tf).toMatch(/Action\s*=\s*"\*"/);
		expect(tf).toMatch(/Resource\s*=\s*"\*"/);
	});

	test("main.tf has no CloudTrail and no VPC flow logs (§164.312(b))", () => {
		const tf = read("infra/main.tf");
		expect(tf).not.toContain("aws_cloudtrail");
		expect(tf).not.toContain("aws_flow_log");
	});

	test("README does not contain the violation table (answer key stays out of the scanned tree)", () => {
		const readme = read("README.md");
		expect(readme).not.toMatch(/\|\s*Violation\s*\|/);
	});
});
