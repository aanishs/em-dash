#!/usr/bin/env bun
/**
 * eval:list — Show all eval runs from ~/.em-dash-dev/evals/
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const evalDir = path.join(os.homedir(), ".em-dash-dev", "evals");

let files: string[];
try {
	files = fs
		.readdirSync(evalDir)
		.filter((f) => f.endsWith(".json") && !f.startsWith("_"));
} catch {
	console.log("No eval runs found. Run: bun run test:evals");
	process.exit(0);
}

if (files.length === 0) {
	console.log("No eval runs found. Run: bun run test:evals");
	process.exit(0);
}

files.sort().reverse();

console.log(`  Eval runs (${files.length} total):\n`);
console.log(
	`  ${"File".padEnd(55)} ${"Tests".padStart(6)} ${"Pass".padStart(5)} ${"Cost".padStart(7)} ${"Duration".padStart(10)}`,
);
console.log(`  ${"─".repeat(85)}`);

for (const file of files) {
	try {
		const data = JSON.parse(fs.readFileSync(path.join(evalDir, file), "utf-8"));
		const name = file.replace(".json", "");
		const tests = String(data.total_tests || 0);
		const passed = String(data.passed || 0);
		const cost = `$${(data.total_cost_usd || 0).toFixed(2)}`;
		const dur = `${Math.round((data.total_duration_ms || 0) / 1000)}s`;

		console.log(
			`  ${name.padEnd(55)} ${tests.padStart(6)} ${passed.padStart(5)} ${cost.padStart(7)} ${dur.padStart(10)}`,
		);
	} catch {
		console.log(`  ${file.padEnd(55)} (parse error)`);
	}
}
