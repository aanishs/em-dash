import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const bunPath = Bun.which("bun") ?? process.argv[0];
const skillDirs = fs
	.readdirSync(path.join(ROOT, "skills"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
	.map((entry) => entry.name)
	.sort();

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function runGenerator(outputRoot: string, args: string[] = []) {
	return Bun.spawnSync([bunPath, "run", "scripts/gen-skill-docs.ts", ...args], {
		cwd: ROOT,
		env: { ...process.env, EMDASH_CODEX_OUTPUT_ROOT: outputRoot },
		stdout: "pipe",
		stderr: "pipe",
	});
}

function text(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes).trim();
}

afterAll(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("Codex skill generation", () => {
	test("writes Codex wrappers and metadata into the configured output root", () => {
		const outputRoot = makeTempDir("emdash-codex-gen-");
		const proc = runGenerator(outputRoot, ["--host", "codex"]);
		expect(proc.exitCode).toBe(0);

		for (const skillDir of skillDirs) {
			expect(fs.existsSync(path.join(outputRoot, skillDir, "SKILL.md"))).toBe(
				true,
			);
			expect(
				fs.existsSync(path.join(outputRoot, skillDir, "agents", "openai.yaml")),
			).toBe(true);
		}
	});

	test("strips Claude-only frontmatter fields from Codex output", () => {
		const outputRoot = makeTempDir("emdash-codex-frontmatter-");
		const proc = runGenerator(outputRoot, ["--host", "codex"]);
		expect(proc.exitCode).toBe(0);

		const content = fs.readFileSync(
			path.join(outputRoot, "hipaa-audit", "SKILL.md"),
			"utf-8",
		);
		const fmEnd = content.indexOf("\n---", 4);
		const fm = content.slice(4, fmEnd);

		expect(fm).toContain("name: hipaa-audit");
		expect(fm).toContain("description:");
		expect(fm).not.toContain("version:");
		expect(fm).not.toContain("allowed-tools:");
		expect(content).not.toContain(".claude/skills/em-dash");
	});

	test("dry-run is clean after Codex generation", () => {
		const outputRoot = makeTempDir("emdash-codex-dryrun-");
		expect(runGenerator(outputRoot, ["--host", "codex"]).exitCode).toBe(0);

		const dryRun = runGenerator(outputRoot, ["--host", "codex", "--dry-run"]);
		expect(dryRun.exitCode).toBe(0);
	});

	test("dry-run does not create files in an empty output root", () => {
		const outputRoot = makeTempDir("emdash-codex-empty-");
		const dryRun = runGenerator(outputRoot, ["--host", "codex", "--dry-run"]);

		expect(dryRun.exitCode).toBe(1);
		expect(text(dryRun.stdout)).toContain("STALE:");
		expect(fs.readdirSync(outputRoot).length).toBe(0);
	});
});
