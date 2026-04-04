/**
 * Plain-English Control Translations Tests
 *
 * Validates that nist/plain-english.json:
 * - Covers all HIPAA-mapped NIST 800-53 controls
 * - Has well-formed entries with required fields
 * - Contains no orphaned entries
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const NIST = path.join(ROOT, "nist");

const plainEnglish: Record<
	string,
	{ nist_name: string; plain_english: string; why_it_matters: string }
> = JSON.parse(fs.readFileSync(path.join(NIST, "plain-english.json"), "utf-8"));

const hipaaFilter: { mapping: Record<string, string[]> } = JSON.parse(
	fs.readFileSync(path.join(NIST, "hipaa-filter.json"), "utf-8"),
);

// Extract all unique NIST control IDs from hipaa-filter
const allControlIds = new Set<string>();
for (const ids of Object.values(hipaaFilter.mapping)) {
	for (const id of ids) allControlIds.add(id);
}

describe("Plain-English control translations", () => {
	test("has entries for all HIPAA-mapped NIST controls", () => {
		const missing: string[] = [];
		for (const id of allControlIds) {
			if (!plainEnglish[id]) missing.push(id);
		}
		expect(missing).toEqual([]);
	});

	test("has exactly 59 entries", () => {
		expect(Object.keys(plainEnglish).length).toBe(59);
	});

	test("every entry has required fields", () => {
		for (const [_id, entry] of Object.entries(plainEnglish)) {
			expect(entry.nist_name).toBeDefined();
			expect(entry.plain_english).toBeDefined();
			expect(entry.why_it_matters).toBeDefined();
			expect(typeof entry.nist_name).toBe("string");
			expect(typeof entry.plain_english).toBe("string");
			expect(typeof entry.why_it_matters).toBe("string");
			expect(entry.nist_name.length).toBeGreaterThan(0);
			expect(entry.plain_english.length).toBeGreaterThan(0);
			expect(entry.why_it_matters.length).toBeGreaterThan(0);
		}
	});

	test("no orphaned entries", () => {
		const orphans: string[] = [];
		for (const id of Object.keys(plainEnglish)) {
			if (!allControlIds.has(id)) orphans.push(id);
		}
		expect(orphans).toEqual([]);
	});

	test("plain_english field is rewritten, not copied from NIST name", () => {
		for (const [_id, entry] of Object.entries(plainEnglish)) {
			expect(entry.plain_english).not.toBe(entry.nist_name);
			expect(entry.plain_english.toLowerCase()).not.toStartWith(
				entry.nist_name.toLowerCase(),
			);
		}
	});
});

// ═══ NIST catalog data availability for explain enrichment ═══

const nistCatalog = JSON.parse(
	fs.readFileSync(
		path.join(NIST, "NIST_SP-800-53_rev5_catalog.json"),
		"utf-8",
	),
);

const toolBindings = JSON.parse(
	fs.readFileSync(path.join(NIST, "tool-bindings.json"), "utf-8"),
);

describe("NIST catalog data for explain enrichment", () => {
	const TOOL_KEYS = ["emdash", "prowler", "checkov", "trivy", "lynis"];

	function findControl(catalog: any, controlId: string) {
		const id = controlId.toLowerCase();
		for (const group of catalog.catalog.groups) {
			for (const ctrl of group.controls || []) {
				if (ctrl.id === id) return ctrl;
				for (const enh of ctrl.controls || []) {
					if (enh.id === id) return enh;
				}
			}
		}
		return null;
	}

	test("every HIPAA control exists in the NIST catalog", () => {
		const missing: string[] = [];
		for (const id of allControlIds) {
			if (!findControl(nistCatalog, id)) missing.push(id);
		}
		expect(missing).toEqual([]);
	});

	test("related control links resolve to valid control IDs", () => {
		const badLinks: string[] = [];
		for (const id of allControlIds) {
			const ctrl = findControl(nistCatalog, id);
			if (!ctrl) continue;
			for (const link of ctrl.links || []) {
				if (link.rel === "related") {
					const refId = link.href.replace("#", "").toLowerCase();
					if (!findControl(nistCatalog, refId)) {
						badLinks.push(`${id} -> ${link.href}`);
					}
				}
			}
		}
		expect(badLinks).toEqual([]);
	});

	test("tool bindings use expected key types", () => {
		for (const [_controlId, binding] of Object.entries(
			toolBindings.bindings,
		)) {
			const b = binding as any;
			for (const key of TOOL_KEYS) {
				if (b[key] !== undefined) {
					expect(Array.isArray(b[key])).toBe(true);
				}
			}
			if (b.interview_only !== undefined) {
				expect(typeof b.interview_only).toBe("boolean");
			}
			if (b.description !== undefined) {
				expect(typeof b.description).toBe("string");
			}
		}
	});
});
