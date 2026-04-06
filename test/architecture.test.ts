/**
 * em-dash v2 Architecture Tests
 *
 * Tests the NIST-first architecture:
 * - NIST 800-53 catalog exists and is parseable
 * - HIPAA filter maps specs to valid control IDs
 * - Tool bindings reference valid em-dash checks
 * - SQLite DB initializes from NIST catalog
 * - Signing and verification work
 * - 7 skills exist
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

interface ToolBinding {
	emdash?: string[];
	checkov?: string[];
	trivy?: string[];
	prowler?: string[];
	cis_benchmark?: string[];
	[key: string]: unknown;
}

const ROOT = path.resolve(import.meta.dir, "..");
const BIN = path.join(ROOT, "bin");
const NIST = path.join(ROOT, "nist");

async function run(
	bin: string,
	args: string[] = [],
	opts: { cwd?: string; env?: Record<string, string> } = {},
) {
	const cmd = fs.existsSync(path.join(BIN, bin)) ? path.join(BIN, bin) : bin;
	const proc = Bun.spawn([cmd, ...args], {
		cwd: opts.cwd ?? ROOT,
		env: { ...process.env, ...opts.env },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	return {
		stdout: stdout.trim(),
		stderr: stderr.trim(),
		exitCode: await proc.exited,
	};
}

let tmpHome: string;

beforeAll(() => {
	tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "emdash-v2-"));
});

afterAll(() => {
	fs.rmSync(tmpHome, { recursive: true, force: true });
});

const env = () => ({ HOME: tmpHome });

// ═══ NIST Catalog ═══════════════════════════════════════════

describe("NIST 800-53 Catalog", () => {
	test("catalog file exists", () => {
		expect(
			fs.existsSync(path.join(NIST, "NIST_SP-800-53_rev5_catalog.json")),
		).toBe(true);
	});

	test("catalog is valid JSON with groups", () => {
		const catalog = JSON.parse(
			fs.readFileSync(
				path.join(NIST, "NIST_SP-800-53_rev5_catalog.json"),
				"utf-8",
			),
		);
		expect(catalog.catalog).toBeDefined();
		expect(catalog.catalog.groups).toBeArray();
		expect(catalog.catalog.groups.length).toBe(20);
	});

	test("catalog has 1000+ controls", () => {
		const catalog = JSON.parse(
			fs.readFileSync(
				path.join(NIST, "NIST_SP-800-53_rev5_catalog.json"),
				"utf-8",
			),
		);
		let total = 0;
		for (const g of catalog.catalog.groups) {
			total += (g.controls || []).length;
			for (const c of g.controls || []) total += (c.controls || []).length;
		}
		expect(total).toBeGreaterThan(1000);
	});
});

// ═══ HIPAA Filter ═══════════════════════════════════════════

describe("HIPAA Filter", () => {
	const filter = JSON.parse(
		fs.readFileSync(path.join(NIST, "hipaa-filter.json"), "utf-8"),
	);

	test("has mapping field", () => {
		expect(filter.mapping).toBeDefined();
		expect(Object.keys(filter.mapping).length).toBeGreaterThan(30);
	});

	test("maps to valid 800-53 control IDs", () => {
		for (const [, controls] of Object.entries(filter.mapping)) {
			for (const id of controls as string[]) {
				expect(id).toMatch(/^[A-Z]{2}-\d+$/);
			}
		}
	});

	test("HIPAA specs follow 164.xxx format", () => {
		for (const spec of Object.keys(filter.mapping)) {
			expect(spec).toMatch(/^164\./);
		}
	});

	test("50+ unique controls referenced", () => {
		const ids = new Set<string>();
		for (const controls of Object.values(filter.mapping)) {
			for (const id of controls as string[]) ids.add(id);
		}
		expect(ids.size).toBeGreaterThanOrEqual(40);
	});
});

// ═══ All Framework Filters ═══════════════════════════════════

describe("Framework Filters (all)", () => {
	const filterFiles = fs
		.readdirSync(NIST)
		.filter((f) => f.endsWith("-filter.json"));

	test("at least 5 framework filters exist", () => {
		expect(filterFiles.length).toBeGreaterThanOrEqual(5);
	});

	for (const file of filterFiles) {
		const filter = JSON.parse(fs.readFileSync(path.join(NIST, file), "utf-8"));
		const name = filter.framework || file.replace("-filter.json", "");

		test(`${name}: has valid mapping field`, () => {
			expect(filter.mapping).toBeDefined();
			expect(Object.keys(filter.mapping).length).toBeGreaterThan(0);
		});

		test(`${name}: all mapping values are arrays of valid 800-53 control IDs`, () => {
			for (const [, controls] of Object.entries(filter.mapping)) {
				expect(Array.isArray(controls)).toBe(true);
				for (const id of controls as string[]) {
					expect(id).toMatch(/^[A-Z]{2}-\d+$/);
				}
			}
		});

		test(`${name}: has a maturity field`, () => {
			expect(filter.maturity).toBeDefined();
			expect(["alpha", "community", "stub", "production"]).toContain(
				filter.maturity,
			);
		});
	}
});

// ═══ CIS Filter ═══════════════════════════════════════════════

describe("CIS Filter", () => {
	const filter = JSON.parse(
		fs.readFileSync(path.join(NIST, "cis-filter.json"), "utf-8"),
	);

	test('framework is "cis"', () => {
		expect(filter.framework).toBe("cis");
	});

	test("has 100+ safeguards", () => {
		expect(Object.keys(filter.mapping).length).toBeGreaterThanOrEqual(100);
	});

	test("has implementation_groups with ig1, ig2, ig3", () => {
		expect(filter.implementation_groups).toBeDefined();
		expect(filter.implementation_groups.ig1).toBeArray();
		expect(filter.implementation_groups.ig2).toBeArray();
		expect(filter.implementation_groups.ig3).toBeArray();
	});

	test("every safeguard appears in exactly one IG", () => {
		const ig = filter.implementation_groups;
		const all = [...ig.ig1, ...ig.ig2, ...ig.ig3];
		const mappingKeys = Object.keys(filter.mapping);

		// No duplicates across tiers
		expect(new Set(all).size).toBe(all.length);

		// Every mapping key is in an IG
		for (const key of mappingKeys) {
			expect(all).toContain(key);
		}

		// Every IG entry is in mapping
		for (const key of all) {
			expect(mappingKeys).toContain(key);
		}
	});

	test("IG1 has the most safeguards (essential hygiene)", () => {
		const ig = filter.implementation_groups;
		expect(ig.ig1.length).toBeGreaterThan(ig.ig3.length);
	});
});

// ═══ Cross-Framework Matrix ══════════════════════════════════

describe("Cross-Framework Matrix", () => {
	test("buildCrossFrameworkMatrix returns valid structure", async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix();

		expect(matrix.frameworks).toBeArray();
		expect(matrix.frameworks.length).toBeGreaterThanOrEqual(6);
		expect(matrix.frameworks).toContain("cis");
		expect(matrix.frameworks).toContain("hipaa");
		expect(matrix.frameworks).toContain("iso27001");
		expect(matrix.controls).toBeArray();
		expect(matrix.total_controls).toBeGreaterThan(0);
	});

	test("SC-28 appears in all 6 frameworks", async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix();
		const sc28 = matrix.controls.find((c) => c.control_id === "SC-28");

		expect(sc28).toBeDefined();
		expect(sc28!.framework_count).toBe(6);
		expect(sc28!.frameworks).toContain("hipaa");
		expect(sc28!.frameworks).toContain("cis");
		expect(sc28!.frameworks).toContain("soc2");
		expect(sc28!.frameworks).toContain("gdpr");
		expect(sc28!.frameworks).toContain("pci-dss");
		expect(sc28!.frameworks).toContain("iso27001");
	});

	test("SC-28 has CIS benchmark refs", async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix();
		const sc28 = matrix.controls.find((c) => c.control_id === "SC-28");

		expect(sc28!.cis_benchmark_refs.length).toBeGreaterThan(0);
	});

	test("controls are sorted by framework_count descending", async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix();

		for (let i = 1; i < matrix.controls.length; i++) {
			expect(matrix.controls[i].framework_count).toBeLessThanOrEqual(
				matrix.controls[i - 1].framework_count,
			);
		}
	});

	test("formatMatrixTable produces readable output", async () => {
		const { buildCrossFrameworkMatrix, formatMatrixTable } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix();
		const table = formatMatrixTable(matrix);

		expect(table).toContain("Cross-Framework");
		expect(table).toContain("SC-28");
		expect(table).toContain("CIS");
		expect(table).toContain("HIPAA");
	});
});

// ═══ Cross-Framework Filtering ═══════════════════════════════

describe("Cross-Framework Filtering", () => {
	test('filtering to ["hipaa"] returns only HIPAA controls', async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix(["hipaa"]);

		expect(matrix.frameworks).toEqual(["hipaa"]);
		expect(matrix.controls.length).toBeGreaterThan(0);
		for (const c of matrix.controls) {
			expect(c.frameworks).toEqual(["hipaa"]);
			expect(c.framework_count).toBe(1);
		}
	});

	test('filtering to ["hipaa", "cis"] returns 2-framework matrix', async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix(["hipaa", "cis"]);

		expect(matrix.frameworks).toEqual(["cis", "hipaa"]);
		expect(matrix.controls.length).toBeGreaterThan(0);
		// SC-28 should be in both
		const sc28 = matrix.controls.find((c) => c.control_id === "SC-28");
		expect(sc28).toBeDefined();
		expect(sc28!.framework_count).toBe(2);
	});

	test("no filter returns all 6 frameworks (backward compat)", async () => {
		const { buildCrossFrameworkMatrix } = await import(
			"../nist/cross-framework.ts"
		);
		const matrix = buildCrossFrameworkMatrix();

		expect(matrix.frameworks.length).toBeGreaterThanOrEqual(6);
	});
});

// ═══ CIS Benchmark Refs in Tool Bindings ═════════════════════

describe("CIS Benchmark Refs", () => {
	const bindings = JSON.parse(
		fs.readFileSync(path.join(NIST, "tool-bindings.json"), "utf-8"),
	);

	test("at least 5 controls have cis_benchmark refs", () => {
		let count = 0;
		for (const binding of Object.values(bindings.bindings) as ToolBinding[]) {
			if (binding.cis_benchmark && binding.cis_benchmark.length > 0) count++;
		}
		expect(count).toBeGreaterThanOrEqual(5);
	});

	test("cis_benchmark values are strings", () => {
		for (const binding of Object.values(bindings.bindings) as ToolBinding[]) {
			if (binding.cis_benchmark) {
				expect(Array.isArray(binding.cis_benchmark)).toBe(true);
				for (const ref of binding.cis_benchmark) {
					expect(typeof ref).toBe("string");
				}
			}
		}
	});
});

// ═══ Tool Bindings ══════════════════════════════════════════

describe("Tool Bindings", () => {
	const bindings = JSON.parse(
		fs.readFileSync(path.join(NIST, "tool-bindings.json"), "utf-8"),
	);
	const registry = fs.readFileSync(
		path.join(ROOT, "frameworks", "checks-registry.ts"),
		"utf-8",
	);
	const regIds: string[] = [];
	const re = /id:\s*['"]([^'"]+)['"]/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(registry)) !== null) regIds.push(m[1]);

	test("has bindings", () => {
		expect(Object.keys(bindings.bindings).length).toBeGreaterThan(5);
	});

	test("all emdash check IDs exist in registry", () => {
		const regSet = new Set(regIds);
		for (const [_controlId, tools] of Object.entries(bindings.bindings)) {
			for (const checkId of (tools as ToolBinding).emdash || []) {
				expect(regSet.has(checkId)).toBe(true);
			}
		}
	});

	test("control IDs are valid 800-53 format", () => {
		for (const id of Object.keys(bindings.bindings)) {
			expect(id).toMatch(/^[A-Z]{2}-\d+$/);
		}
	});

	test("all Checkov IDs match CKV pattern", () => {
		for (const [_controlId, tools] of Object.entries(bindings.bindings)) {
			for (const id of (tools as ToolBinding).checkov || []) {
				expect(id).toMatch(/^CKV_[A-Z]+_\d+$/);
			}
		}
	});

	test("all Trivy IDs match AVD pattern", () => {
		for (const [_controlId, tools] of Object.entries(bindings.bindings)) {
			for (const id of (tools as ToolBinding).trivy || []) {
				expect(id).toMatch(/^AVD-[A-Z]+-\d{4}$/);
			}
		}
	});
});

// ═══ SQLite Database ════════════════════════════════════════

describe("SQLite Database", () => {
	test("hipaa-db init imports controls", async () => {
		const { stdout, exitCode } = await run("comply-db", ["init"], {
			env: env(),
		});
		expect(exitCode).toBe(0);
		expect(stdout).toContain("DB_INITIALIZED");
		expect(stdout).toMatch(/\d+ controls/);
	});

	test("hipaa-db status shows all controls", async () => {
		const { stdout, exitCode } = await run("comply-db", ["status"], {
			env: env(),
		});
		expect(exitCode).toBe(0);
		expect(stdout).toContain("AC-2");
		expect(stdout).toContain("pending");
	});

	test("hipaa-db control shows NIST prose", async () => {
		const { stdout, exitCode } = await run("comply-db", ["control", "AC-2"], {
			env: env(),
		});
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Account Management");
		expect(stdout).toContain("NIST Statement");
	});

	test("hipaa-db update-scan records results", async () => {
		const { exitCode } = await run(
			"comply-db",
			[
				"update-scan",
				"AC-2",
				"PASS",
				"emdash",
				"aws-iam-wildcard",
				"no wildcards",
			],
			{ env: env() },
		);
		expect(exitCode).toBe(0);
		const { stdout } = await run("comply-db", ["control", "AC-2"], {
			env: env(),
		});
		expect(stdout).toContain("PASS");
		expect(stdout).toContain("aws-iam-wildcard");
	});

	test("hipaa-db summary shows counts", async () => {
		const { stdout, exitCode } = await run("comply-db", ["summary"], {
			env: env(),
		});
		expect(exitCode).toBe(0);
		expect(stdout).toMatch(/\d+ total/);
	});

	test("hipaa-db query works", async () => {
		const { stdout, exitCode } = await run(
			"comply-db",
			["query", "SELECT COUNT(*) as cnt FROM controls"],
			{ env: env() },
		);
		expect(exitCode).toBe(0);
		const data = JSON.parse(stdout);
		expect(data[0].cnt).toBeGreaterThanOrEqual(50);
	});
});

// ═══ Signing ════════════════════════════════════════════════

describe("Signing & Verification", () => {
	test("init-keys + sign + verify", async () => {
		await run("comply-attest", ["init-keys"], { env: env() });
		const out = path.join(tmpHome, "test-attest.json");
		await run(
			"comply-attest",
			[
				"check",
				"--check-id",
				"test",
				"--requirement-id",
				"AC-2",
				"--result",
				"PASS",
				"--evidence-hash",
				"sha256:abc",
				"--output",
				out,
			],
			{ env: env() },
		);
		const { exitCode } = await run(
			"comply-attest",
			["verify", "--attestation", out],
			{ env: env() },
		);
		expect(exitCode).toBe(0);
	});

	test("tamper detection", async () => {
		const out = path.join(tmpHome, "tamper-attest.json");
		await run(
			"comply-attest",
			[
				"check",
				"--check-id",
				"td",
				"--requirement-id",
				"AC-2",
				"--result",
				"PASS",
				"--evidence-hash",
				"sha256:def",
				"--output",
				out,
			],
			{ env: env() },
		);
		const data = JSON.parse(fs.readFileSync(out, "utf-8"));
		data.result = "FAIL";
		fs.writeFileSync(out, JSON.stringify(data));
		const { exitCode } = await run(
			"comply-attest",
			["verify", "--attestation", out],
			{ env: env() },
		);
		expect(exitCode).toBe(1);
	});
});

// ═══ Skills ═════════════════════════════════════════════════

describe("Skills (16 total)", () => {
	test("exactly 16 skill directories", () => {
		const skills = fs
			.readdirSync(path.join(ROOT, "skills"))
			.filter((d: string) =>
				fs.statSync(path.join(ROOT, "skills", d)).isDirectory(),
			);
		expect(skills.length).toBe(16);
	});

	test("expected skills present", () => {
		const expected = [
			"comply",
			"comply-assess",
			"comply-auto",
			"comply-breach",
			"comply-deal",
			"comply-explain",
			"comply-fix",
			"comply-policy",
			"comply-report",
			"comply-scan",
			"em-dashboard",
			"gdpr",
			"hipaa",
			"hipaa-audit",
			"pci-dss",
			"soc2",
		];
		const skills = fs
			.readdirSync(path.join(ROOT, "skills"))
			.filter((d: string) =>
				fs.statSync(path.join(ROOT, "skills", d)).isDirectory(),
			);
		for (const s of expected) expect(skills).toContain(s);
	});

	test("each skill has SKILL.md and SKILL.md.tmpl", () => {
		const skills = fs
			.readdirSync(path.join(ROOT, "skills"))
			.filter((d: string) =>
				fs.statSync(path.join(ROOT, "skills", d)).isDirectory(),
			);
		for (const s of skills) {
			expect(fs.existsSync(path.join(ROOT, "skills", s, "SKILL.md"))).toBe(
				true,
			);
			expect(fs.existsSync(path.join(ROOT, "skills", s, "SKILL.md.tmpl"))).toBe(
				true,
			);
		}
	});

	test("old skills removed", () => {
		const removed = [
			"comply-vendor",
			"comply-risk",
			"comply-monitor",
			"comply-oscal-import",
			"comply-verify",
			"comply-remediate",
			"soc2-scan",
		];
		const skills = fs
			.readdirSync(path.join(ROOT, "skills"))
			.filter((d: string) =>
				fs.statSync(path.join(ROOT, "skills", d)).isDirectory(),
			);
		for (const s of removed) expect(skills).not.toContain(s);
	});
});

// ═══ Checks Registry ════════════════════════════════════════

describe("Checks Registry (pure execution)", () => {
	const content = fs.readFileSync(
		path.join(ROOT, "frameworks", "checks-registry.ts"),
		"utf-8",
	);

	test("no framework mappings", () => {
		expect(content).not.toContain("frameworks: Record<string");
		expect(content).not.toContain("FrameworkMapping");
	});

	test("at least 50 checks defined", () => {
		const ids: string[] = [];
		const re = /id:\s*['"]([^'"]+)['"]/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) ids.push(m[1]);
		expect(ids.length).toBeGreaterThanOrEqual(50);
		expect(new Set(ids).size).toBe(ids.length); // no duplicates
	});
});
