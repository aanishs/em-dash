import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function runSetup(
	cwd: string,
	home: string,
	outputRoot: string,
	scriptPath = path.join(ROOT, "setup"),
) {
	return Bun.spawnSync(["bash", scriptPath, "--host", "codex"], {
		cwd,
		env: { ...process.env, HOME: home, EMDASH_CODEX_OUTPUT_ROOT: outputRoot },
		stdout: "pipe",
		stderr: "pipe",
	});
}

function realPath(target: string): string {
	return fs.realpathSync(target);
}

afterAll(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("setup --host codex", () => {
	test("creates a minimal global Codex runtime root and top-level skill links", () => {
		const home = makeTempDir("emdash-codex-home-");
		const outputRoot = makeTempDir("emdash-codex-output-");
		const proc = runSetup(ROOT, home, outputRoot);
		expect(proc.exitCode).toBe(0);

		const codexSkills = path.join(home, ".codex", "skills");
		const runtimeRoot = path.join(codexSkills, "em-dash");

		expect(fs.existsSync(path.join(runtimeRoot, "bin"))).toBe(true);
		expect(fs.existsSync(path.join(runtimeRoot, "dashboard"))).toBe(true);
		expect(fs.existsSync(path.join(runtimeRoot, "frameworks"))).toBe(true);
		expect(fs.existsSync(path.join(runtimeRoot, "nist"))).toBe(true);
		expect(fs.existsSync(path.join(runtimeRoot, "policies"))).toBe(true);
		expect(fs.existsSync(path.join(runtimeRoot, "scripts"))).toBe(true);
		expect(fs.existsSync(path.join(runtimeRoot, "package.json"))).toBe(true);
		expect(
			fs.existsSync(
				path.join(
					runtimeRoot,
					"skills",
					"hipaa-audit",
					"questionnaire-library.json",
				),
			),
		).toBe(true);
		expect(
			fs.existsSync(path.join(runtimeRoot, "skills", "comply", "SKILL.md")),
		).toBe(false);

		expect(fs.existsSync(path.join(codexSkills, "comply", "SKILL.md"))).toBe(
			true,
		);
		expect(realPath(path.join(codexSkills, "comply", "SKILL.md"))).toBe(
			realPath(path.join(outputRoot, "comply", "SKILL.md")),
		);
	});

	test("links Codex skills into a repo-local .agents/skills install without creating a global root", () => {
		const home = makeTempDir("emdash-codex-home-local-");
		const projectDir = makeTempDir("emdash-codex-project-");
		const outputRoot = makeTempDir("emdash-codex-output-local-");
		const localSkillsDir = path.join(projectDir, ".agents", "skills");

		fs.mkdirSync(localSkillsDir, { recursive: true });
		fs.symlinkSync(ROOT, path.join(localSkillsDir, "em-dash"));

		const proc = runSetup(
			projectDir,
			home,
			outputRoot,
			path.join(projectDir, ".agents", "skills", "em-dash", "setup"),
		);
		expect(proc.exitCode).toBe(0);

		expect(fs.existsSync(path.join(localSkillsDir, "comply", "SKILL.md"))).toBe(
			true,
		);
		expect(realPath(path.join(localSkillsDir, "comply", "SKILL.md"))).toBe(
			realPath(path.join(outputRoot, "comply", "SKILL.md")),
		);
		expect(fs.existsSync(path.join(home, ".codex", "skills", "em-dash"))).toBe(
			false,
		);
	});
});
