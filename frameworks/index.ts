/**
 * Framework loader — reads and validates framework definitions from JSON files.
 *
 * Framework definitions are display metadata only. Compliance relationships
 * (which checks satisfy which requirements) live in the OSCAL mapping.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { FrameworkDefinition } from "./schema";

const FRAMEWORKS_DIR = path.resolve(import.meta.dir);

/** Load a framework definition by ID */
export function loadFramework(id: string): FrameworkDefinition {
	const filePath = path.join(FRAMEWORKS_DIR, `${id}.json`);

	if (!fs.existsSync(filePath)) {
		throw new Error(`Framework definition not found: ${filePath}`);
	}

	let raw: string;
	try {
		raw = fs.readFileSync(filePath, "utf-8");
	} catch (err: unknown) {
		throw new Error(
			`Failed to read framework definition ${id}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	let def: FrameworkDefinition;
	try {
		def = JSON.parse(raw);
	} catch (err: unknown) {
		throw new Error(
			`Invalid JSON in framework definition ${id}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Validate required fields
	const required = [
		"id",
		"name",
		"version",
		"disclaimer",
		"terminology",
		"thresholds",
		"requirements",
		"checklist",
	] as const;
	for (const field of required) {
		if (!def[field]) {
			throw new Error(`Framework ${id} missing required field: ${field}`);
		}
	}

	if (def.id !== id) {
		throw new Error(`Framework ${id} has mismatched id field: "${def.id}"`);
	}

	return def;
}

/** List all available framework IDs */
export function listFrameworks(): string[] {
	return fs
		.readdirSync(FRAMEWORKS_DIR)
		.filter((f) => f.endsWith(".json"))
		.map((f) => f.replace(".json", ""));
}

/** Load all available frameworks */
export function loadAllFrameworks(): Map<string, FrameworkDefinition> {
	const map = new Map<string, FrameworkDefinition>();
	for (const id of listFrameworks()) {
		map.set(id, loadFramework(id));
	}
	return map;
}
