/**
 * Skill validation tests — v2 architecture.
 *
 * Validates skill templates, generated files, Rego policies,
 * and bin utilities.
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const BIN_DIR = path.join(ROOT, "bin");

function findTemplates(): string[] {
	const templates: string[] = [];
	for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const tmpl = path.join(SKILLS_DIR, entry.name, "SKILL.md.tmpl");
		if (fs.existsSync(tmpl)) templates.push(tmpl);
	}
	return templates;
}

function findGenerated(): string[] {
	const generated: string[] = [];
	for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const md = path.join(SKILLS_DIR, entry.name, "SKILL.md");
		if (fs.existsSync(md)) generated.push(md);
	}
	return generated;
}

describe("Skill template validation", () => {
	const templates = findTemplates();

	test("16 skill templates exist", () => {
		expect(templates.length).toBe(16);
	});

	for (const tmpl of templates) {
		const name = path.relative(ROOT, tmpl);

		test(`${name} has valid frontmatter`, () => {
			const content = fs.readFileSync(tmpl, "utf-8");
			expect(content.startsWith("---")).toBe(true);
			const fmEnd = content.indexOf("---", 3);
			expect(fmEnd).toBeGreaterThan(3);
			const frontmatter = content.slice(3, fmEnd);
			expect(frontmatter).toContain("name:");
			expect(frontmatter).toContain("version:");
			expect(frontmatter).toContain("description:");
			expect(frontmatter).toContain("allowed-tools:");
		});
	}
});

describe("Generated SKILL.md files", () => {
	const generated = findGenerated();

	test("16 generated files exist", () => {
		expect(generated.length).toBe(16);
	});

	for (const md of generated) {
		const name = path.relative(ROOT, md);

		test(`${name} has no unresolved placeholders`, () => {
			const content = fs.readFileSync(md, "utf-8");
			const unresolved = content.match(/\{\{(\w+)\}\}/g);
			expect(unresolved).toBeNull();
		});
	}
});

describe("Generated files are fresh", () => {
	test("gen-skill-docs --dry-run passes", async () => {
		const bunPath = Bun.which("bun") ?? process.argv[0];
		const proc = Bun.spawn(
			[bunPath, "run", "scripts/gen-skill-docs.ts", "--dry-run"],
			{
				cwd: ROOT,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
	});
});

describe("Rego policy files", () => {
	const policyDir = path.join(ROOT, "policies");

	test("policy directory exists", () => {
		expect(fs.existsSync(policyDir)).toBe(true);
	});

	test("has .rego files", () => {
		const files = fs.readdirSync(policyDir).filter((f) => f.endsWith(".rego"));
		expect(files.length).toBeGreaterThan(3);
	});

	test("policies use check_id (not hipaa_ref)", () => {
		const files = fs.readdirSync(policyDir).filter((f) => f.endsWith(".rego"));
		for (const file of files) {
			const content = fs.readFileSync(path.join(policyDir, file), "utf-8");
			expect(content).not.toContain("hipaa_ref");
			if (content.includes("deny[msg]")) {
				expect(content).toContain("check_id");
			}
		}
	});

	test("policies use compliance.* package (framework-agnostic)", () => {
		const files = fs.readdirSync(policyDir).filter((f) => f.endsWith(".rego"));
		for (const file of files) {
			const content = fs.readFileSync(path.join(policyDir, file), "utf-8");
			expect(content).toContain("package compliance.");
		}
	});
});

describe("Bin utilities", () => {
	const expectedBins = [
		"comply-attest",
		"comply-audit-packet",
		"comply-db",
		"comply-evidence-hash",
		"comply-slug",
		"comply-verify",
	];

	test("expected bins exist", () => {
		for (const bin of expectedBins) {
			expect(fs.existsSync(path.join(BIN_DIR, bin))).toBe(true);
		}
	});

	test("all bins are executable", () => {
		const bins = fs.readdirSync(BIN_DIR);
		for (const bin of bins) {
			const stat = fs.statSync(path.join(BIN_DIR, bin));
			expect(stat.mode & 0o111).toBeGreaterThan(0);
		}
	});

	test("all bins have shebang", () => {
		const bins = fs.readdirSync(BIN_DIR);
		for (const bin of bins) {
			const content = fs.readFileSync(path.join(BIN_DIR, bin), "utf-8");
			expect(content.startsWith("#!")).toBe(true);
		}
	});
});

describe("Policy templates", () => {
	const templateDir = path.join(ROOT, "templates", "policies");

	test("template directory exists", () => {
		expect(fs.existsSync(templateDir)).toBe(true);
	});

	test("has markdown templates", () => {
		if (fs.existsSync(templateDir)) {
			const files = fs
				.readdirSync(templateDir)
				.filter((f) => f.endsWith(".md"));
			expect(files.length).toBeGreaterThan(0);
		}
	});
});
