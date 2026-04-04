/**
 * E2E skill tests — spawns Claude CLI and validates skill behavior.
 *
 * Gated behind EVALS=1 (diff-based selection) or EVALS_ALL=1 (run all).
 * Run via:  bun run test:evals        (diff-based)
 *           bun run test:evals:all    (all tests)
 */

import { afterAll, beforeAll, describe, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EvalCollector } from "./helpers/eval-store";
import {
	detectBaseBranch,
	E2E_TOUCHFILES,
	GLOBAL_TOUCHFILES,
	getChangedFiles,
	selectTests,
} from "./helpers/touchfiles";

const ROOT = path.resolve(import.meta.dir, "..");
const EVALS = process.env.EVALS === "1";
const EVALS_ALL = process.env.EVALS_ALL === "1";

if (!EVALS && !EVALS_ALL) {
	describe("skill e2e (skipped)", () => {
		test.skip("set EVALS=1 or EVALS_ALL=1 to run", () => {});
	});
} else {
	// Diff-based test selection
	let selectedTests: string[];

	if (EVALS_ALL) {
		selectedTests = Object.keys(E2E_TOUCHFILES);
	} else {
		const baseBranch = detectBaseBranch(ROOT);
		const changedFiles = baseBranch ? getChangedFiles(baseBranch, ROOT) : [];
		const selection = selectTests(
			changedFiles,
			E2E_TOUCHFILES,
			GLOBAL_TOUCHFILES,
		);
		selectedTests = selection.selected;
		if (selection.skipped.length > 0) {
			console.log(
				`Touchfile skip: ${selection.skipped.join(", ")} (${selection.reason})`,
			);
		}
	}

	describe("skill e2e", () => {
		let collector: EvalCollector;
		let tmpDir: string;

		beforeAll(() => {
			collector = new EvalCollector("e2e");
			tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emdash-e2e-"));
		});

		afterAll(async () => {
			await collector.finalize();
			fs.rmSync(tmpDir, { recursive: true, force: true });
		});

		for (const testName of Object.keys(E2E_TOUCHFILES)) {
			const shouldRun = selectedTests.includes(testName);

			if (!shouldRun) {
				test.skip(`${testName} (no matching changes)`, () => {});
				continue;
			}

			test.skip(`${testName} (not yet implemented)`, () => {});
		}
	});
}
