import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const CODEX_SMOKE = process.env.CODEX_SMOKE === "1";
const CODEX_BIN = Bun.which("codex");
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

afterAll(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

if (!CODEX_SMOKE || !CODEX_BIN) {
	describe("codex smoke (skipped)", () => {
		test.skip("set CODEX_SMOKE=1 and ensure codex is installed to run", () => {});
	});
} else {
	describe("codex smoke", () => {
		test("repo-local install is usable by codex exec", () => {
			const home = makeTempDir("emdash-codex-smoke-home-");
			const projectDir = makeTempDir("emdash-codex-smoke-project-");
			const localSkillsDir = path.join(projectDir, ".agents", "skills");
			const outputFile = path.join(projectDir, "codex-last-message.txt");

			fs.mkdirSync(localSkillsDir, { recursive: true });
			fs.symlinkSync(ROOT, path.join(localSkillsDir, "em-dash"));

			const setupProc = Bun.spawnSync(
				[
					"bash",
					path.join(localSkillsDir, "em-dash", "setup"),
					"--host",
					"codex",
				],
				{
					cwd: projectDir,
					env: { ...process.env, HOME: home },
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			expect(setupProc.exitCode).toBe(0);

			const prompt =
				"Use the comply-breach skill. Return only the repo-local Codex refresh command from the skill instructions.";
			const codexProc = Bun.spawnSync(
				[
					CODEX_BIN,
					"exec",
					"--skip-git-repo-check",
					"--sandbox",
					"read-only",
					"--cd",
					projectDir,
					"--output-last-message",
					outputFile,
					prompt,
				],
				{
					cwd: projectDir,
					env: { ...process.env, HOME: home },
					stdout: "pipe",
					stderr: "pipe",
				},
			);

			expect(codexProc.exitCode).toBe(0);
			const message = fs.readFileSync(outputFile, "utf-8").trim();
			expect(message).toContain(
				"cd .agents/skills/em-dash && ./setup --host codex",
			);
		}, 120000);
	});
}
