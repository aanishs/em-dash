#!/usr/bin/env bun
/**
 * validate-cis-filter.ts — Validate cis-filter.json structure and IG completeness.
 *
 * Validates:
 * 1. All mapping values are arrays of valid NIST 800-53 control IDs
 * 2. Every safeguard appears in exactly one Implementation Group (ig1, ig2, ig3)
 * 3. No orphaned IG entries (safeguard in IG but not in mapping)
 * 4. Flat mapping shape matches other filter files
 *
 * Source: CIS Controls v8.1 Mapping to NIST SP 800-53 Rev 5
 * Run: bun scripts/validate-cis-filter.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

const FILTER_PATH = path.join(import.meta.dir, "..", "nist", "cis-filter.json");
const BINDINGS_PATH = path.join(
	import.meta.dir,
	"..",
	"nist",
	"tool-bindings.json",
);

if (!fs.existsSync(FILTER_PATH)) {
	console.error(`CIS filter not found: ${FILTER_PATH}`);
	process.exit(1);
}

const filter = JSON.parse(fs.readFileSync(FILTER_PATH, "utf-8"));
const bindings = JSON.parse(fs.readFileSync(BINDINGS_PATH, "utf-8"));
const bindingControlIds = new Set(Object.keys(bindings.bindings));

let errors = 0;
let warnings = 0;

console.log("CIS Filter Validation Report");
console.log("══════════════════════════════════════════════════════════");

// ─── 1. Basic structure ────────────────────────────────────────────

if (!filter.mapping || typeof filter.mapping !== "object") {
	console.log('ERROR: Missing or invalid "mapping" field');
	errors++;
} else {
	console.log(`Safeguards in mapping: ${Object.keys(filter.mapping).length}`);
}

if (!filter.framework || filter.framework !== "cis") {
	console.log('ERROR: framework field must be "cis"');
	errors++;
}

// ─── 2. Validate control IDs ───────────────────────────────────────

const controlIdPattern = /^[A-Z]{2}-\d+$/;
const allMappedControls = new Set<string>();
const unmappedControls: string[] = [];

for (const [safeguard, controls] of Object.entries(filter.mapping)) {
	if (!Array.isArray(controls)) {
		console.log(`ERROR: ${safeguard} mapping value is not an array`);
		errors++;
		continue;
	}
	for (const controlId of controls as string[]) {
		if (!controlIdPattern.test(controlId)) {
			console.log(`ERROR: ${safeguard} has invalid control ID: ${controlId}`);
			errors++;
		}
		allMappedControls.add(controlId);
		if (!bindingControlIds.has(controlId)) {
			unmappedControls.push(controlId);
		}
	}
}

const uniqueUnmapped = [...new Set(unmappedControls)];
if (uniqueUnmapped.length > 0) {
	console.log(
		`\nWARNING: ${uniqueUnmapped.length} controls not in tool-bindings.json (no automated checks):`,
	);
	for (const c of uniqueUnmapped) console.log(`  ? ${c}`);
	warnings += uniqueUnmapped.length;
}

console.log(`\nUnique controls referenced: ${allMappedControls.size}`);
console.log(
	`  In tool-bindings: ${allMappedControls.size - uniqueUnmapped.length}`,
);
console.log(`  Not in tool-bindings: ${uniqueUnmapped.length}`);

// ─── 3. Implementation Group validation ────────────────────────────

const ig = filter.implementation_groups;
if (!ig) {
	console.log("\nWARNING: No implementation_groups section");
	warnings++;
} else {
	const allIgSafeguards = new Set<string>();
	const duplicates: string[] = [];

	for (const [tier, safeguards] of Object.entries(ig) as [string, string[]][]) {
		for (const s of safeguards) {
			if (allIgSafeguards.has(s)) {
				duplicates.push(`${s} (in ${tier} + another tier)`);
			}
			allIgSafeguards.add(s);
		}
	}

	if (duplicates.length > 0) {
		console.log(
			`\nERROR: ${duplicates.length} safeguards in multiple IG tiers:`,
		);
		for (const d of duplicates) console.log(`  ! ${d}`);
		errors += duplicates.length;
	}

	// Check for safeguards in mapping but not in any IG
	const mappingSafeguards = new Set(Object.keys(filter.mapping));
	const missingFromIg = [...mappingSafeguards].filter(
		(s) => !allIgSafeguards.has(s),
	);
	if (missingFromIg.length > 0) {
		console.log(
			`\nERROR: ${missingFromIg.length} safeguards in mapping but not in any IG tier:`,
		);
		for (const s of missingFromIg) console.log(`  ! ${s}`);
		errors += missingFromIg.length;
	}

	// Check for IG entries not in mapping
	const orphanedIg = [...allIgSafeguards].filter(
		(s) => !mappingSafeguards.has(s),
	);
	if (orphanedIg.length > 0) {
		console.log(
			`\nERROR: ${orphanedIg.length} safeguards in IG tiers but not in mapping:`,
		);
		for (const s of orphanedIg) console.log(`  ! ${s}`);
		errors += orphanedIg.length;
	}

	console.log(`\nIG breakdown:`);
	console.log(`  IG1 (essential hygiene): ${(ig.ig1 || []).length} safeguards`);
	console.log(`  IG2 (operational):       ${(ig.ig2 || []).length} safeguards`);
	console.log(`  IG3 (advanced):          ${(ig.ig3 || []).length} safeguards`);
	console.log(`  Total:                   ${allIgSafeguards.size} safeguards`);
}

// ─── 4. CIS Benchmark refs in tool-bindings ────────────────────────

let controlsWithCisBenchmark = 0;
for (const binding of Object.values(bindings.bindings) as {
	cis_benchmark?: string[];
}[]) {
	if (binding.cis_benchmark && binding.cis_benchmark.length > 0) {
		controlsWithCisBenchmark++;
	}
}

console.log(
	`\nCIS Benchmark refs in tool-bindings: ${controlsWithCisBenchmark} controls`,
);

// ─── Summary ───────────────────────────────────────────────────────

console.log("\n──────────────────────────────────────────────────────────");
if (errors === 0 && warnings === 0) {
	console.log("PASS — CIS filter is valid");
} else if (errors === 0) {
	console.log(`PASS with ${warnings} warning(s)`);
} else {
	console.log(`FAIL — ${errors} error(s), ${warnings} warning(s)`);
	process.exit(1);
}
