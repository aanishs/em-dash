#!/usr/bin/env bun
/**
 * eval:summary — Aggregate stats across all eval runs.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { EvalResult } from "../test/helpers/eval-store";

const evalDir = path.join(os.homedir(), ".em-dash-dev", "evals");

let files: string[];
try {
	files = fs
		.readdirSync(evalDir)
		.filter((f) => f.endsWith(".json") && !f.startsWith("_"))
		.sort();
} catch {
	console.log("No eval runs found.");
	process.exit(0);
}

if (files.length === 0) {
	console.log("No eval runs found.");
	process.exit(0);
}

let totalRuns = 0;
let totalTests = 0;
let totalPassed = 0;
let totalCost = 0;
let totalDuration = 0;

const byTier: Record<
	string,
	{ runs: number; tests: number; passed: number; cost: number }
> = {};

for (const file of files) {
	try {
		const data: EvalResult = JSON.parse(
			fs.readFileSync(path.join(evalDir, file), "utf-8"),
		);
		totalRuns++;
		totalTests += data.total_tests;
		totalPassed += data.passed;
		totalCost += data.total_cost_usd;
		totalDuration += data.total_duration_ms;

		const tier = data.tier || "unknown";
		if (!byTier[tier]) byTier[tier] = { runs: 0, tests: 0, passed: 0, cost: 0 };
		byTier[tier].runs++;
		byTier[tier].tests += data.total_tests;
		byTier[tier].passed += data.passed;
		byTier[tier].cost += data.total_cost_usd;
	} catch {}
}

console.log(`  em-dash Eval Summary\n`);
console.log(`  Total runs:     ${totalRuns}`);
console.log(`  Total tests:    ${totalTests}`);
console.log(
	`  Total passed:   ${totalPassed} (${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%)`,
);
console.log(`  Total cost:     $${totalCost.toFixed(2)}`);
console.log(`  Total duration: ${Math.round(totalDuration / 1000)}s`);
console.log(
	`  Avg cost/run:   $${totalRuns > 0 ? (totalCost / totalRuns).toFixed(2) : "0.00"}`,
);

console.log("\n  By tier:");
for (const [tier, stats] of Object.entries(byTier)) {
	const passRate =
		stats.tests > 0 ? Math.round((stats.passed / stats.tests) * 100) : 0;
	console.log(
		`    ${tier}: ${stats.runs} runs, ${stats.tests} tests (${passRate}% pass), $${stats.cost.toFixed(2)}`,
	);
}
