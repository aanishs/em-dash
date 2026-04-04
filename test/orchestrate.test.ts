/**
 * comply-orchestrate tests — normalizer functions + detect subcommand.
 *
 * Uses the `normalize-test` subcommand to pipe JSON fixtures through
 * normalizeTool() and verify the output structure.
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const BIN = path.join(ROOT, "bin");
const FIXTURES = path.join(import.meta.dir, "fixtures", "scan");

interface NormalizedFinding {
	check_id: string;
	result: string;
	severity: string;
	resource: string;
	tool: string;
	control_ids: string[];
	output: string;
	[key: string]: unknown;
}

async function normalize(
	tool: string,
	fixturePath: string,
): Promise<NormalizedFinding[]> {
	const input = fs.readFileSync(fixturePath, "utf8");
	const proc = Bun.spawn(
		[path.join(BIN, "comply-orchestrate"), "normalize-test", tool],
		{
			cwd: ROOT,
			stdin: new Blob([input]),
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;
	return JSON.parse(stdout.trim());
}

// ─── Prowler ────────────────────────────────────────────────

describe("normalizeTool: prowler", () => {
	test("normalizes PASS and FAIL findings", async () => {
		const findings = await normalize(
			"prowler",
			path.join(FIXTURES, "prowler-sample.json"),
		);
		expect(findings).toHaveLength(2);

		const pass = findings.find((f: NormalizedFinding) => f.result === "PASS");
		const fail = findings.find((f: NormalizedFinding) => f.result === "FAIL");
		expect(pass).toBeDefined();
		expect(fail).toBeDefined();
	});

	test("extracts check_id, severity, and resource", async () => {
		const findings = await normalize(
			"prowler",
			path.join(FIXTURES, "prowler-sample.json"),
		);
		const fail = findings.find((f: NormalizedFinding) => f.result === "FAIL")!;
		expect(fail.check_id).toBe("iam_user_mfa_enabled_console_access");
		expect(fail.severity).toBe("CRITICAL");
		expect(fail.resource).toBe("admin-user");
		expect(fail.tool).toBe("prowler");
	});

	test("produces structured output JSON", async () => {
		const findings = await normalize(
			"prowler",
			path.join(FIXTURES, "prowler-sample.json"),
		);
		const output = JSON.parse(findings[0].output);
		expect(output.title).toBeTruthy();
		expect(output.resource_arn).toBeTruthy();
		expect(output.region).toBeTruthy();
	});

	test("resolves prowler check IDs to NIST controls", async () => {
		const findings = await normalize(
			"prowler",
			path.join(FIXTURES, "prowler-sample.json"),
		);
		// prowler check IDs should resolve to control_ids via tool-bindings
		const withControls = findings.filter(
			(f: NormalizedFinding) => f.control_ids.length > 0,
		);
		expect(withControls.length).toBeGreaterThanOrEqual(1);
	});

	test("handles empty input", async () => {
		const proc = Bun.spawn(
			[path.join(BIN, "comply-orchestrate"), "normalize-test", "prowler"],
			{
				cwd: ROOT,
				stdin: new Blob(["[]"]),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		expect(JSON.parse(stdout.trim())).toEqual([]);
	});
});

// ─── Checkov ────────────────────────────────────────────────

describe("normalizeTool: checkov", () => {
	test("separates passed_checks from failed_checks", async () => {
		const findings = await normalize(
			"checkov",
			path.join(FIXTURES, "checkov-sample.json"),
		);
		expect(findings).toHaveLength(2);
		const pass = findings.find((f: NormalizedFinding) => f.result === "PASS");
		const fail = findings.find((f: NormalizedFinding) => f.result === "FAIL");
		expect(pass).toBeDefined();
		expect(fail).toBeDefined();
	});

	test("extracts check_id and resource", async () => {
		const findings = await normalize(
			"checkov",
			path.join(FIXTURES, "checkov-sample.json"),
		);
		const fail = findings.find((f: NormalizedFinding) => f.result === "FAIL")!;
		expect(fail.check_id).toBe("CKV_AWS_16");
		expect(fail.resource).toBe("aws_db_instance.main");
		expect(fail.severity).toBe("HIGH");
	});

	test("handles missing results key", async () => {
		const proc = Bun.spawn(
			[path.join(BIN, "comply-orchestrate"), "normalize-test", "checkov"],
			{
				cwd: ROOT,
				stdin: new Blob(["{}"]),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		expect(JSON.parse(stdout.trim())).toEqual([]);
	});
});

// ─── Trivy ──────────────────────────────────────────────────

describe("normalizeTool: trivy", () => {
	test("extracts Vulnerabilities", async () => {
		const findings = await normalize(
			"trivy",
			path.join(FIXTURES, "trivy-sample.json"),
		);
		const vulns = findings.filter(
			(f: NormalizedFinding) => f.check_id === "CVE-2024-1234",
		);
		expect(vulns).toHaveLength(1);
		expect(vulns[0].result).toBe("FINDING");
		expect(vulns[0].severity).toBe("HIGH");
		expect(vulns[0].resource).toBe("lodash");
	});

	test("extracts Misconfigurations with PASS/FINDING status", async () => {
		const findings = await normalize(
			"trivy",
			path.join(FIXTURES, "trivy-sample.json"),
		);
		const misconfigs = findings.filter((f: NormalizedFinding) =>
			f.check_id.startsWith("AVD-"),
		);
		expect(misconfigs).toHaveLength(2);
		expect(
			misconfigs.find((f: NormalizedFinding) => f.result === "FINDING"),
		).toBeDefined();
		expect(
			misconfigs.find((f: NormalizedFinding) => f.result === "PASS"),
		).toBeDefined();
	});

	test("extracts Secrets with CRITICAL severity", async () => {
		const findings = await normalize(
			"trivy",
			path.join(FIXTURES, "trivy-sample.json"),
		);
		const secrets = findings.filter(
			(f: NormalizedFinding) => f.check_id === "secret-detection",
		);
		expect(secrets).toHaveLength(1);
		expect(secrets[0].severity).toBe("CRITICAL");
		expect(secrets[0].result).toBe("FINDING");
	});

	test("handles empty Results array", async () => {
		const proc = Bun.spawn(
			[path.join(BIN, "comply-orchestrate"), "normalize-test", "trivy"],
			{
				cwd: ROOT,
				stdin: new Blob(['{"Results": []}']),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		expect(JSON.parse(stdout.trim())).toEqual([]);
	});
});

// ─── Semgrep ────────────────────────────────────────────────

describe("normalizeTool: semgrep", () => {
	test("extracts check_id, path:line resource, severity", async () => {
		const findings = await normalize(
			"semgrep",
			path.join(FIXTURES, "semgrep-sample.json"),
		);
		expect(findings).toHaveLength(2);
		expect(findings[0].check_id).toContain("mustache-escape");
		expect(findings[0].resource).toBe("src/app.js:42");
		expect(findings[0].result).toBe("FINDING");
	});

	test("handles empty results", async () => {
		const proc = Bun.spawn(
			[path.join(BIN, "comply-orchestrate"), "normalize-test", "semgrep"],
			{
				cwd: ROOT,
				stdin: new Blob(['{"results": []}']),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		expect(JSON.parse(stdout.trim())).toEqual([]);
	});
});

// ─── Kube-bench ─────────────────────────────────────────────

describe("normalizeTool: kube-bench", () => {
	test("extracts nested Controls > tests > results", async () => {
		const findings = await normalize(
			"kube-bench",
			path.join(FIXTURES, "kube-bench-sample.json"),
		);
		expect(findings).toHaveLength(3);
		expect(findings[0].check_id).toBe("1.1.1");
		expect(findings[0].result).toBe("PASS");
	});

	test("maps scored=true to HIGH severity", async () => {
		const findings = await normalize(
			"kube-bench",
			path.join(FIXTURES, "kube-bench-sample.json"),
		);
		const scored = findings.find(
			(f: NormalizedFinding) => f.check_id === "1.1.1",
		)!;
		const unscored = findings.find(
			(f: NormalizedFinding) => f.check_id === "1.1.3",
		)!;
		expect(scored.severity).toBe("HIGH");
		expect(unscored.severity).toBe("LOW");
	});
});

// ─── Default/unknown tool ───────────────────────────────────

describe("normalizeTool: default/unknown", () => {
	test("iterates array input", async () => {
		const proc = Bun.spawn(
			[path.join(BIN, "comply-orchestrate"), "normalize-test", "unknown-tool"],
			{
				cwd: ROOT,
				stdin: new Blob(['[{"id": "check-1", "severity": "LOW"}]']),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		const findings = JSON.parse(stdout.trim());
		expect(findings).toHaveLength(1);
		expect(findings[0].tool).toBe("unknown-tool");
		expect(findings[0].result).toBe("FINDING");
	});

	test("iterates { findings: [...] } wrapper", async () => {
		const proc = Bun.spawn(
			[path.join(BIN, "comply-orchestrate"), "normalize-test", "custom"],
			{
				cwd: ROOT,
				stdin: new Blob(['{"findings": [{"id": "f1"}, {"id": "f2"}]}']),
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		const findings = JSON.parse(stdout.trim());
		expect(findings).toHaveLength(2);
	});
});

// ─── Detect subcommand ──────────────────────────────────────

describe("detect subcommand", () => {
	test("runs without error and outputs tool availability", async () => {
		const proc = Bun.spawn([path.join(BIN, "comply-orchestrate"), "detect"], {
			cwd: ROOT,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Tool Detection Report");
		expect(stdout).toContain("tools available");
	}, 15000);
});
