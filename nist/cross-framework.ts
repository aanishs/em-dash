/**
 * Cross-framework compliance matrix.
 *
 * Reads all *-filter.json files from nist/, joins on 800-53 control IDs,
 * and produces a matrix showing which controls are shared across frameworks.
 *
 * Shared by: bin/comply-db (cross-framework subcommand) and
 *            scripts/dashboard-server.ts (/api/cross-framework endpoint).
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ControlFrameworkEntry {
	control_id: string;
	frameworks: string[];
	framework_count: number;
	cis_benchmark_refs: string[];
}

export interface CrossFrameworkMatrix {
	controls: ControlFrameworkEntry[];
	frameworks: string[];
	total_controls: number;
}

const NIST_DIR = path.resolve(import.meta.dir);

/** Load all *-filter.json files from the nist/ directory */
function loadAllFilters(): Map<string, Record<string, string[]>> {
	const filters = new Map<string, Record<string, string[]>>();

	for (const file of fs.readdirSync(NIST_DIR)) {
		if (!file.endsWith("-filter.json")) continue;

		try {
			const data = JSON.parse(
				fs.readFileSync(path.join(NIST_DIR, file), "utf-8"),
			);
			if (!data.mapping || typeof data.mapping !== "object") {
				console.warn(`WARNING: ${file} has no valid mapping — skipping`);
				continue;
			}
			const frameworkId = data.framework || file.replace("-filter.json", "");
			filters.set(frameworkId, data.mapping);
		} catch (err: unknown) {
			console.warn(
				`WARNING: Failed to parse ${file} — ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	return filters;
}

/** Load CIS benchmark refs from tool-bindings.json */
function loadCisBenchmarkRefs(): Map<string, string[]> {
	const bindingsPath = path.join(NIST_DIR, "tool-bindings.json");
	if (!fs.existsSync(bindingsPath)) return new Map();

	const data = JSON.parse(fs.readFileSync(bindingsPath, "utf-8"));
	const map = new Map<string, string[]>();
	for (const [controlId, binding] of Object.entries(data.bindings) as [
		string,
		{ cis_benchmark?: string[] },
	][]) {
		if (binding.cis_benchmark && binding.cis_benchmark.length > 0) {
			map.set(controlId, binding.cis_benchmark);
		}
	}
	return map;
}

/** Build the cross-framework compliance matrix */
export function buildCrossFrameworkMatrix(
	activeFrameworks?: string[],
): CrossFrameworkMatrix {
	const allFilters = loadAllFilters();
	const cisRefs = loadCisBenchmarkRefs();

	// Filter to only active frameworks if specified
	const filters = activeFrameworks
		? new Map([...allFilters].filter(([k]) => activeFrameworks.includes(k)))
		: allFilters;

	// Build reverse index: control_id → Set<framework_id>
	const controlToFrameworks = new Map<string, Set<string>>();

	for (const [frameworkId, mapping] of filters) {
		for (const controlIds of Object.values(mapping)) {
			for (const controlId of controlIds) {
				if (!controlToFrameworks.has(controlId)) {
					controlToFrameworks.set(controlId, new Set());
				}
				controlToFrameworks.get(controlId)!.add(frameworkId);
			}
		}
	}

	// Build sorted entries
	const controls: ControlFrameworkEntry[] = [...controlToFrameworks.entries()]
		.map(([control_id, fws]) => ({
			control_id,
			frameworks: [...fws].sort(),
			framework_count: fws.size,
			cis_benchmark_refs: cisRefs.get(control_id) || [],
		}))
		.sort(
			(a, b) =>
				b.framework_count - a.framework_count ||
				a.control_id.localeCompare(b.control_id),
		);

	return {
		controls,
		frameworks: [...filters.keys()].sort(),
		total_controls: controls.length,
	};
}

/** Format matrix as human-readable table */
export function formatMatrixTable(matrix: CrossFrameworkMatrix): string {
	const lines: string[] = [];
	const fws = matrix.frameworks;
	const header = [
		"Control",
		...fws.map((f) => f.toUpperCase().padEnd(8)),
		"Impact",
	].join("  ");
	const sep = "─".repeat(header.length);

	lines.push("Cross-Framework Compliance Matrix");
	lines.push(sep);
	lines.push(header);
	lines.push(sep);

	for (const entry of matrix.controls) {
		const cols = fws.map((f) =>
			entry.frameworks.includes(f) ? "  ✓     " : "  ·     ",
		);
		const impact = `${entry.framework_count}/${fws.length}`;
		lines.push([entry.control_id.padEnd(9), ...cols, impact].join(""));
	}

	lines.push(sep);
	lines.push(
		`${matrix.total_controls} controls across ${fws.length} frameworks`,
	);

	return lines.join("\n");
}
