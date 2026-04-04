import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const BIN = path.join(ROOT, "bin");

async function run(
	bin: string,
	args: string[] = [],
	opts: { cwd?: string; env?: Record<string, string> } = {},
) {
	const proc = Bun.spawn([path.join(BIN, bin), ...args], {
		cwd: opts.cwd ?? ROOT,
		env: { ...process.env, ...opts.env },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;
	return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe("Bin smoke: comply-slug", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emdash-slug-"));
		Bun.spawnSync(["git", "init"], { cwd: tmpDir });
		Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "init"], {
			cwd: tmpDir,
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "test",
				GIT_AUTHOR_EMAIL: "test@test.com",
				GIT_COMMITTER_NAME: "test",
				GIT_COMMITTER_EMAIL: "test@test.com",
			},
		});
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("falls back to directory name when no git remote", async () => {
		const { stdout, exitCode } = await run("comply-slug", [], { cwd: tmpDir });
		expect(exitCode).toBe(0);
		const dirName = path.basename(tmpDir);
		expect(stdout).toContain(`SLUG=${dirName}`);
		expect(stdout).toContain("BRANCH=");
	});

	test("produces org-repo slug when remote exists", async () => {
		const tmpWithRemote = fs.mkdtempSync(
			path.join(os.tmpdir(), "emdash-slug-remote-"),
		);
		Bun.spawnSync(["git", "init"], { cwd: tmpWithRemote });
		Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "init"], {
			cwd: tmpWithRemote,
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "test",
				GIT_AUTHOR_EMAIL: "test@test.com",
				GIT_COMMITTER_NAME: "test",
				GIT_COMMITTER_EMAIL: "test@test.com",
			},
		});
		Bun.spawnSync(
			["git", "remote", "add", "origin", "https://github.com/acme/my-repo.git"],
			{ cwd: tmpWithRemote },
		);

		const { stdout, exitCode } = await run("comply-slug", [], {
			cwd: tmpWithRemote,
		});
		expect(exitCode).toBe(0);
		expect(stdout).toContain("SLUG=acme-my-repo");

		fs.rmSync(tmpWithRemote, { recursive: true, force: true });
	});
});

describe("Bin smoke: comply-db update-scan", () => {
	let tmpDir: string;
	let _dbPath: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emdash-scan-"));
		const emDashDir = path.join(tmpDir, ".em-dash", "projects", "test-project");
		fs.mkdirSync(emDashDir, { recursive: true });
		_dbPath = path.join(emDashDir, "compliance.db");
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("persists severity, resource, and scan_id", async () => {
		// Init a DB first
		await run("comply-db", ["init", "--framework", "hipaa"], { cwd: tmpDir });

		// Update scan with all new fields
		const { exitCode } = await run(
			"comply-db",
			[
				"update-scan",
				"SC-28",
				"PASS",
				"prowler",
				"s3_bucket_default_encryption",
				"test output data",
				"--severity",
				"HIGH",
				"--resource",
				"arn:aws:s3:::my-bucket",
				"--scan-id",
				"scan-001",
				"--framework",
				"hipaa",
			],
			{ cwd: tmpDir },
		);
		expect(exitCode).toBe(0);

		// Query back via comply-db control
		const { stdout } = await run(
			"comply-db",
			["control", "SC-28", "--framework", "hipaa"],
			{ cwd: tmpDir },
		);
		expect(stdout).toContain("PASS");
		expect(stdout).toContain("prowler:s3_bucket_default_encryption");
		expect(stdout).toContain("[HIGH]");
		expect(stdout).toContain("arn:aws:s3:::my-bucket");
		expect(stdout).toContain("scan:scan-001");
	});

	test("stores output longer than 200 chars", async () => {
		const longOutput = "A".repeat(500);
		const { exitCode } = await run(
			"comply-db",
			[
				"update-scan",
				"SC-28",
				"FAIL",
				"checkov",
				"CKV_AWS_19",
				longOutput,
				"--framework",
				"hipaa",
			],
			{ cwd: tmpDir },
		);
		expect(exitCode).toBe(0);

		// Query raw via comply-db query to verify full output stored
		const { stdout } = await run(
			"comply-db",
			[
				"query",
				`SELECT output FROM check_results WHERE check_id = 'CKV_AWS_19' ORDER BY created_at DESC LIMIT 1`,
				"--framework",
				"hipaa",
			],
			{ cwd: tmpDir },
		);
		expect(stdout.length).toBeGreaterThanOrEqual(500);
	});
});

describe("Bin smoke: hipaa-evidence-hash", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emdash-hash-"));
		fs.writeFileSync(path.join(tmpDir, "a.txt"), "hello");
		fs.writeFileSync(path.join(tmpDir, "b.txt"), "world");
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("hashes a single file", async () => {
		const { stdout, exitCode } = await run("comply-evidence-hash", [
			path.join(tmpDir, "a.txt"),
		]);
		expect(exitCode).toBe(0);
		expect(stdout).toMatch(/[a-f0-9]{64}/);
	});

	test("hashes a directory and creates manifest", async () => {
		const { stdout, exitCode } = await run("comply-evidence-hash", [tmpDir]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Manifest written");
		expect(stdout).toMatch(/\d+ files hashed/);

		const manifest = path.join(tmpDir, "evidence-manifest.sha256");
		expect(fs.existsSync(manifest)).toBe(true);
		const content = fs.readFileSync(manifest, "utf-8");
		expect(content).toContain("a.txt");
		expect(content).toContain("b.txt");
	});

	test("exits 1 for nonexistent target", async () => {
		const { exitCode, stderr } = await run("comply-evidence-hash", [
			"/nonexistent/path",
		]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("not found");
	});
});
