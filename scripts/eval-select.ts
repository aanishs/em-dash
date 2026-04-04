#!/usr/bin/env bun
/**
 * eval:select — Preview which tests would run based on current diff.
 */

import * as path from "node:path";
import {
	detectBaseBranch,
	E2E_TOUCHFILES,
	GLOBAL_TOUCHFILES,
	getChangedFiles,
	LLM_JUDGE_TOUCHFILES,
	selectTests,
} from "../test/helpers/touchfiles";

const ROOT = path.resolve(import.meta.dir, "..");

const baseBranch = process.env.EVALS_BASE || detectBaseBranch(ROOT);
if (!baseBranch) {
	console.log("  No base branch found. All tests would run.");
	process.exit(0);
}

const changedFiles = getChangedFiles(baseBranch, ROOT);
console.log(`  Base: ${baseBranch}`);
console.log(`  Changed files: ${changedFiles.length}\n`);

if (changedFiles.length > 0 && changedFiles.length <= 20) {
	for (const f of changedFiles) {
		console.log(`    ${f}`);
	}
	console.log("");
}

// E2E selection
const e2e = selectTests(changedFiles, E2E_TOUCHFILES, GLOBAL_TOUCHFILES);
console.log(
	`  E2E selection (${e2e.reason}): ${e2e.selected.length}/${Object.keys(E2E_TOUCHFILES).length} tests`,
);
if (e2e.selected.length > 0) {
	for (const t of e2e.selected) console.log(`    ✅ ${t}`);
}
if (e2e.skipped.length > 0) {
	for (const t of e2e.skipped) console.log(`    ⏭️  ${t}`);
}

console.log("");

// LLM-judge selection
const llm = selectTests(changedFiles, LLM_JUDGE_TOUCHFILES, GLOBAL_TOUCHFILES);
console.log(
	`  LLM-judge selection (${llm.reason}): ${llm.selected.length}/${Object.keys(LLM_JUDGE_TOUCHFILES).length} tests`,
);
if (llm.selected.length > 0) {
	for (const t of llm.selected) console.log(`    ✅ ${t}`);
}
if (llm.skipped.length > 0) {
	for (const t of llm.skipped) console.log(`    ⏭️  ${t}`);
}
