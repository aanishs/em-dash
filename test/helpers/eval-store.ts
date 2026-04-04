/**
 * Eval result persistence and comparison.
 *
 * EvalCollector accumulates test results, writes them to
 * ~/.em-dash-dev/evals/{version}-{branch}-{tier}-{timestamp}.json,
 * prints a summary table, and auto-compares with the previous run.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SCHEMA_VERSION = 1;
const DEFAULT_EVAL_DIR = path.join(os.homedir(), ".em-dash-dev", "evals");

// --- Interfaces ---

interface TranscriptEvent {
	type: string;
	message?: {
		content: Array<{ type: string; name?: string; [key: string]: unknown }>;
	};
	[key: string]: unknown;
}

export interface EvalTestEntry {
	name: string;
	suite: string;
	tier: "e2e" | "llm-judge";
	passed: boolean;
	duration_ms: number;
	cost_usd: number;

	// E2E
	transcript?: TranscriptEvent[];
	prompt?: string;
	output?: string;
	turns_used?: number;
	compliance_errors?: string[];

	// LLM judge
	judge_scores?: Record<string, number>;
	judge_reasoning?: string;

	// Machine-readable diagnostics
	exit_reason?: string;
	timeout_at_turn?: number;
	last_tool_call?: string;

	// Model + timing diagnostics
	model?: string;
	first_response_ms?: number;
	max_inter_turn_ms?: number;

	// Compliance-specific fields
	hipaa_sections_covered?: string[];
	findings_count?: number;
	policy_violations?: number;
	evidence_hashed?: boolean;

	// Outcome eval
	detection_rate?: number;
	false_positives?: number;
	evidence_quality?: number;
	detected_bugs?: string[];
	missed_bugs?: string[];

	error?: string;
}

export interface EvalResult {
	schema_version: number;
	version: string;
	branch: string;
	git_sha: string;
	timestamp: string;
	hostname: string;
	tier: "e2e" | "llm-judge";
	total_tests: number;
	passed: number;
	failed: number;
	total_cost_usd: number;
	total_duration_ms: number;
	wall_clock_ms?: number;
	tests: EvalTestEntry[];
	_partial?: boolean;
}

export interface TestDelta {
	name: string;
	before: {
		passed: boolean;
		cost_usd: number;
		turns_used?: number;
		duration_ms?: number;
		detection_rate?: number;
		tool_summary?: Record<string, number>;
	};
	after: {
		passed: boolean;
		cost_usd: number;
		turns_used?: number;
		duration_ms?: number;
		detection_rate?: number;
		tool_summary?: Record<string, number>;
	};
	status_change: "improved" | "regressed" | "unchanged";
}

export interface ComparisonResult {
	before_file: string;
	after_file: string;
	before_branch: string;
	after_branch: string;
	before_timestamp: string;
	after_timestamp: string;
	deltas: TestDelta[];
	total_cost_delta: number;
	total_duration_delta: number;
	improved: number;
	regressed: number;
	unchanged: number;
	tool_count_before: number;
	tool_count_after: number;
}

// --- Shared helpers ---

/**
 * Determine if a compliance eval passed based on judge results vs thresholds.
 */
export function judgePassed(
	judgeResult: {
		detection_rate: number;
		false_positives: number;
		evidence_quality: number;
	},
	groundTruth: { minimum_detection: number; max_false_positives: number },
): boolean {
	return (
		judgeResult.detection_rate >= groundTruth.minimum_detection &&
		judgeResult.false_positives <= groundTruth.max_false_positives &&
		judgeResult.evidence_quality >= 2
	);
}

// --- Comparison functions ---

/**
 * Extract tool call counts from a transcript.
 */
export function extractToolSummary(
	transcript: TranscriptEvent[],
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const event of transcript) {
		if (event.type === "assistant") {
			const content = event.message?.content || [];
			for (const item of content) {
				if (item.type === "tool_use") {
					const name = item.name || "unknown";
					counts[name] = (counts[name] || 0) + 1;
				}
			}
		}
	}
	return counts;
}

/**
 * Find the most recent prior eval file for comparison.
 */
export function findPreviousRun(
	evalDir: string,
	tier: string,
	branch: string,
	excludeFile: string,
): string | null {
	let files: string[];
	try {
		files = fs.readdirSync(evalDir).filter((f) => f.endsWith(".json"));
	} catch {
		return null;
	}

	const entries: Array<{ file: string; branch: string; timestamp: string }> =
		[];
	for (const file of files) {
		if (file === path.basename(excludeFile)) continue;
		const fullPath = path.join(evalDir, file);
		try {
			const raw = fs.readFileSync(fullPath, "utf-8");
			const data = JSON.parse(raw);
			if (data.tier !== tier) continue;
			entries.push({
				file: fullPath,
				branch: data.branch || "",
				timestamp: data.timestamp || "",
			});
		} catch {}
	}

	if (entries.length === 0) return null;
	entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

	const sameBranch = entries.find((e) => e.branch === branch);
	if (sameBranch) return sameBranch.file;
	return entries[0].file;
}

/**
 * Compare two eval results. Matches tests by name.
 */
export function compareEvalResults(
	before: EvalResult,
	after: EvalResult,
	beforeFile: string,
	afterFile: string,
): ComparisonResult {
	const deltas: TestDelta[] = [];
	let improved = 0,
		regressed = 0,
		unchanged = 0;
	let toolCountBefore = 0,
		toolCountAfter = 0;

	const beforeMap = new Map<string, EvalTestEntry>();
	for (const t of before.tests) beforeMap.set(t.name, t);

	for (const afterTest of after.tests) {
		const beforeTest = beforeMap.get(afterTest.name);
		const beforeToolSummary = beforeTest?.transcript
			? extractToolSummary(beforeTest.transcript)
			: {};
		const afterToolSummary = afterTest.transcript
			? extractToolSummary(afterTest.transcript)
			: {};

		toolCountBefore += Object.values(beforeToolSummary).reduce(
			(a, b) => a + b,
			0,
		);
		toolCountAfter += Object.values(afterToolSummary).reduce(
			(a, b) => a + b,
			0,
		);

		let statusChange: TestDelta["status_change"] = "unchanged";
		if (beforeTest) {
			if (!beforeTest.passed && afterTest.passed) {
				statusChange = "improved";
				improved++;
			} else if (beforeTest.passed && !afterTest.passed) {
				statusChange = "regressed";
				regressed++;
			} else {
				unchanged++;
			}
		} else {
			unchanged++;
		}

		deltas.push({
			name: afterTest.name,
			before: {
				passed: beforeTest?.passed ?? false,
				cost_usd: beforeTest?.cost_usd ?? 0,
				turns_used: beforeTest?.turns_used,
				duration_ms: beforeTest?.duration_ms,
				detection_rate: beforeTest?.detection_rate,
				tool_summary: beforeToolSummary,
			},
			after: {
				passed: afterTest.passed,
				cost_usd: afterTest.cost_usd,
				turns_used: afterTest.turns_used,
				duration_ms: afterTest.duration_ms,
				detection_rate: afterTest.detection_rate,
				tool_summary: afterToolSummary,
			},
			status_change: statusChange,
		});

		beforeMap.delete(afterTest.name);
	}

	// Removed tests
	for (const [name, beforeTest] of beforeMap) {
		const beforeToolSummary = beforeTest.transcript
			? extractToolSummary(beforeTest.transcript)
			: {};
		toolCountBefore += Object.values(beforeToolSummary).reduce(
			(a, b) => a + b,
			0,
		);
		unchanged++;
		deltas.push({
			name: `${name} (removed)`,
			before: {
				passed: beforeTest.passed,
				cost_usd: beforeTest.cost_usd,
				turns_used: beforeTest.turns_used,
				duration_ms: beforeTest.duration_ms,
				detection_rate: beforeTest.detection_rate,
				tool_summary: beforeToolSummary,
			},
			after: { passed: false, cost_usd: 0, tool_summary: {} },
			status_change: "unchanged",
		});
	}

	return {
		before_file: beforeFile,
		after_file: afterFile,
		before_branch: before.branch,
		after_branch: after.branch,
		before_timestamp: before.timestamp,
		after_timestamp: after.timestamp,
		deltas,
		total_cost_delta: after.total_cost_usd - before.total_cost_usd,
		total_duration_delta: after.total_duration_ms - before.total_duration_ms,
		improved,
		regressed,
		unchanged,
		tool_count_before: toolCountBefore,
		tool_count_after: toolCountAfter,
	};
}

/**
 * Format a ComparisonResult as a readable string.
 */
export function formatComparison(c: ComparisonResult): string {
	const lines: string[] = [];
	const ts = c.before_timestamp
		? c.before_timestamp.replace("T", " ").slice(0, 16)
		: "unknown";
	lines.push(`\nvs previous: ${c.before_branch} (${ts})`);
	lines.push("─".repeat(70));

	for (const d of c.deltas) {
		const arrow =
			d.status_change === "improved"
				? "↑"
				: d.status_change === "regressed"
					? "↓"
					: "=";
		const beforeStatus = d.before.passed ? "PASS" : "FAIL";
		const afterStatus = d.after.passed ? "PASS" : "FAIL";

		let turnsDelta = "";
		if (d.before.turns_used !== undefined && d.after.turns_used !== undefined) {
			const td = d.after.turns_used - d.before.turns_used;
			turnsDelta = ` ${d.before.turns_used}→${d.after.turns_used}t`;
			if (td !== 0) turnsDelta += `(${td > 0 ? "+" : ""}${td})`;
		} else if (d.after.turns_used !== undefined) {
			turnsDelta = ` ${d.after.turns_used}t`;
		}

		let detail = "";
		if (
			d.before.detection_rate !== undefined ||
			d.after.detection_rate !== undefined
		) {
			detail = ` ${d.before.detection_rate ?? "?"}→${d.after.detection_rate ?? "?"} det`;
		} else {
			detail = ` $${d.before.cost_usd.toFixed(2)}→$${d.after.cost_usd.toFixed(2)}`;
		}

		const name =
			d.name.length > 30 ? `${d.name.slice(0, 27)}...` : d.name.padEnd(30);
		lines.push(
			`  ${name}  ${beforeStatus.padEnd(5)} → ${afterStatus.padEnd(5)}  ${arrow}${detail}${turnsDelta}`,
		);
	}

	lines.push("─".repeat(70));

	const parts: string[] = [];
	if (c.improved > 0) parts.push(`${c.improved} improved`);
	if (c.regressed > 0) parts.push(`${c.regressed} regressed`);
	if (c.unchanged > 0) parts.push(`${c.unchanged} unchanged`);
	lines.push(`  Status: ${parts.join(", ")}`);

	const costSign = c.total_cost_delta >= 0 ? "+" : "";
	lines.push(`  Cost:   ${costSign}$${c.total_cost_delta.toFixed(2)}`);

	const durDelta = Math.round(c.total_duration_delta / 1000);
	const durSign = durDelta >= 0 ? "+" : "";
	lines.push(`  Duration: ${durSign}${durDelta}s`);

	return lines.join("\n");
}

// --- EvalCollector ---

function getGitInfo(): { branch: string; sha: string } {
	try {
		const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			stdio: "pipe",
			timeout: 5000,
		});
		const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
			stdio: "pipe",
			timeout: 5000,
		});
		return {
			branch: branch.stdout?.toString().trim() || "unknown",
			sha: sha.stdout?.toString().trim() || "unknown",
		};
	} catch {
		return { branch: "unknown", sha: "unknown" };
	}
}

function getVersion(): string {
	try {
		const pkgPath = path.resolve(import.meta.dir, "..", "..", "package.json");
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		return pkg.version || "unknown";
	} catch {
		return "unknown";
	}
}

export class EvalCollector {
	private tier: "e2e" | "llm-judge";
	private tests: EvalTestEntry[] = [];
	private finalized = false;
	private evalDir: string;
	private createdAt = Date.now();

	constructor(tier: "e2e" | "llm-judge", evalDir?: string) {
		this.tier = tier;
		this.evalDir = evalDir || DEFAULT_EVAL_DIR;
	}

	addTest(entry: EvalTestEntry): void {
		this.tests.push(entry);
		this.savePartial();
	}

	savePartial(): void {
		try {
			const git = getGitInfo();
			const version = getVersion();
			const totalCost = this.tests.reduce((s, t) => s + t.cost_usd, 0);
			const totalDuration = this.tests.reduce((s, t) => s + t.duration_ms, 0);
			const passed = this.tests.filter((t) => t.passed).length;

			const partial: EvalResult = {
				schema_version: SCHEMA_VERSION,
				version,
				branch: git.branch,
				git_sha: git.sha,
				timestamp: new Date().toISOString(),
				hostname: os.hostname(),
				tier: this.tier,
				total_tests: this.tests.length,
				passed,
				failed: this.tests.length - passed,
				total_cost_usd: Math.round(totalCost * 100) / 100,
				total_duration_ms: totalDuration,
				tests: this.tests,
				_partial: true,
			};

			fs.mkdirSync(this.evalDir, { recursive: true });
			const partialPath = path.join(this.evalDir, "_partial-e2e.json");
			const tmp = `${partialPath}.tmp`;
			fs.writeFileSync(tmp, `${JSON.stringify(partial, null, 2)}\n`);
			fs.renameSync(tmp, partialPath);
		} catch {
			/* non-fatal */
		}
	}

	async finalize(): Promise<string> {
		if (this.finalized) return "";
		this.finalized = true;

		const git = getGitInfo();
		const version = getVersion();
		const timestamp = new Date().toISOString();
		const totalCost = this.tests.reduce((s, t) => s + t.cost_usd, 0);
		const totalDuration = this.tests.reduce((s, t) => s + t.duration_ms, 0);
		const passed = this.tests.filter((t) => t.passed).length;

		const result: EvalResult = {
			schema_version: SCHEMA_VERSION,
			version,
			branch: git.branch,
			git_sha: git.sha,
			timestamp,
			hostname: os.hostname(),
			tier: this.tier,
			total_tests: this.tests.length,
			passed,
			failed: this.tests.length - passed,
			total_cost_usd: Math.round(totalCost * 100) / 100,
			total_duration_ms: totalDuration,
			wall_clock_ms: Date.now() - this.createdAt,
			tests: this.tests,
		};

		fs.mkdirSync(this.evalDir, { recursive: true });
		const dateStr = timestamp
			.replace(/[:.]/g, "")
			.replace("T", "-")
			.slice(0, 15);
		const safeBranch = git.branch.replace(/[^a-zA-Z0-9._-]/g, "-");
		const filename = `${version}-${safeBranch}-${this.tier}-${dateStr}.json`;
		const filepath = path.join(this.evalDir, filename);
		fs.writeFileSync(filepath, `${JSON.stringify(result, null, 2)}\n`);

		this.printSummary(result, filepath, git);

		// Auto-compare
		try {
			const prevFile = findPreviousRun(
				this.evalDir,
				this.tier,
				git.branch,
				filepath,
			);
			if (prevFile) {
				const prevResult: EvalResult = JSON.parse(
					fs.readFileSync(prevFile, "utf-8"),
				);
				const comparison = compareEvalResults(
					prevResult,
					result,
					prevFile,
					filepath,
				);
				process.stderr.write(`${formatComparison(comparison)}\n`);
			} else {
				process.stderr.write("\nFirst run — no comparison available.\n");
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			process.stderr.write(`\nCompare error: ${message}\n`);
		}

		return filepath;
	}

	private printSummary(
		result: EvalResult,
		filepath: string,
		git: { branch: string; sha: string },
	): void {
		const lines: string[] = [];
		lines.push("");
		lines.push(
			`Eval Results — v${result.version} @ ${git.branch} (${git.sha}) — ${this.tier}`,
		);
		lines.push("═".repeat(70));

		for (const t of this.tests) {
			const status = t.passed ? " PASS " : " FAIL ";
			const cost = `$${t.cost_usd.toFixed(2)}`;
			const dur = t.duration_ms ? `${Math.round(t.duration_ms / 1000)}s` : "";
			const turns = t.turns_used !== undefined ? `${t.turns_used}t` : "";

			let detail = "";
			if (t.findings_count !== undefined) {
				detail = `${t.findings_count} findings`;
			} else if (t.judge_scores) {
				const scores = Object.entries(t.judge_scores)
					.map(([k, v]) => `${k[0]}:${v}`)
					.join(" ");
				detail = scores;
			}

			const name =
				t.name.length > 35 ? `${t.name.slice(0, 32)}...` : t.name.padEnd(35);
			lines.push(
				`  ${name}  ${status}  ${cost.padStart(6)}  ${turns.padStart(4)}  ${dur.padStart(5)}  ${detail}`,
			);
		}

		lines.push("─".repeat(70));
		const totalCost = `$${result.total_cost_usd.toFixed(2)}`;
		const totalDur = `${Math.round(result.total_duration_ms / 1000)}s`;
		lines.push(
			`  Total: ${result.passed}/${result.total_tests} passed${" ".repeat(20)}${totalCost.padStart(6)}  ${totalDur}`,
		);
		lines.push(`Saved: ${filepath}`);

		process.stderr.write(`${lines.join("\n")}\n`);
	}
}
