import { describe, expect, test } from "bun:test";
import {
	E2E_TOUCHFILES,
	GLOBAL_TOUCHFILES,
	LLM_JUDGE_TOUCHFILES,
	matchGlob,
	selectTests,
} from "./helpers/touchfiles";

describe("matchGlob", () => {
	test("matches exact file", () => {
		expect(
			matchGlob("scripts/gen-skill-docs.ts", "scripts/gen-skill-docs.ts"),
		).toBe(true);
	});

	test("matches single wildcard", () => {
		expect(matchGlob("skills/hipaa-scan/SKILL.md", "skills/*/SKILL.md")).toBe(
			true,
		);
		expect(
			matchGlob("skills/hipaa-scan/SKILL.md.tmpl", "skills/*/SKILL.md"),
		).toBe(false);
	});

	test("matches globstar", () => {
		expect(matchGlob("skills/hipaa-scan/SKILL.md", "skills/**")).toBe(true);
		expect(matchGlob("skills/hipaa-scan/nested/deep.ts", "skills/**")).toBe(
			true,
		);
		expect(matchGlob("policies/test.rego", "skills/**")).toBe(false);
	});

	test("matches dotfiles and extensions", () => {
		expect(matchGlob("scripts/gen-skill-docs.ts", "scripts/*.ts")).toBe(true);
		expect(matchGlob("scripts/gen-skill-docs.js", "scripts/*.ts")).toBe(false);
	});
});

describe("selectTests", () => {
	const touchfiles = {
		"test-a": ["skills/hipaa-scan/**"],
		"test-b": ["skills/hipaa-assess/**"],
		"test-c": ["policies/**"],
	};

	test("selects only tests whose files changed", () => {
		const result = selectTests(
			["skills/hipaa-scan/SKILL.md.tmpl"],
			touchfiles,
			[],
		);
		expect(result.selected).toEqual(["test-a"]);
		expect(result.skipped).toContain("test-b");
		expect(result.skipped).toContain("test-c");
		expect(result.reason).toBe("diff");
	});

	test("global touchfile triggers all tests", () => {
		const result = selectTests(["scripts/gen-skill-docs.ts"], touchfiles, [
			"scripts/gen-skill-docs.ts",
		]);
		expect(result.selected.length).toBe(3);
		expect(result.skipped.length).toBe(0);
		expect(result.reason).toContain("global");
	});

	test("no changes selects nothing", () => {
		const result = selectTests([], touchfiles, []);
		expect(result.selected).toEqual([]);
		expect(result.skipped.length).toBe(3);
	});
});

describe("touchfile maps are well-formed", () => {
	test("E2E_TOUCHFILES has entries for all 7 skills", () => {
		expect(Object.keys(E2E_TOUCHFILES).length).toBeGreaterThanOrEqual(7);
	});

	test("LLM_JUDGE_TOUCHFILES has entries", () => {
		expect(Object.keys(LLM_JUDGE_TOUCHFILES).length).toBeGreaterThanOrEqual(7);
	});

	test("GLOBAL_TOUCHFILES includes gen-skill-docs", () => {
		expect(GLOBAL_TOUCHFILES).toContain("scripts/gen-skill-docs.ts");
	});

	test("all touchfile values are non-empty arrays", () => {
		for (const [_name, patterns] of Object.entries(E2E_TOUCHFILES)) {
			expect(patterns.length).toBeGreaterThan(0);
		}
		for (const [_name, patterns] of Object.entries(LLM_JUDGE_TOUCHFILES)) {
			expect(patterns.length).toBeGreaterThan(0);
		}
	});
});
