#!/usr/bin/env bun
/**
 * dev:skill — Watch mode for SKILL.md template development.
 *
 * Watches .tmpl files and gen-skill-docs.ts, regenerates SKILL.md files
 * on change, validates immediately.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const SKILLS_DIR = path.join(ROOT, "skills");

function findTemplates(): string[] {
	const templates: string[] = [];
	for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const tmpl = path.join(SKILLS_DIR, entry.name, "SKILL.md.tmpl");
		if (fs.existsSync(tmpl)) templates.push(tmpl);
	}
	return templates;
}

function regenerateAndValidate() {
	const timestamp = new Date().toLocaleTimeString();

	// Regenerate
	try {
		execSync("bun run scripts/gen-skill-docs.ts", { cwd: ROOT, stdio: "pipe" });
		console.log(
			`  [${timestamp}] ✅ gen-skill-docs — all templates regenerated`,
		);
	} catch (err: unknown) {
		const errMsg = err instanceof Error ? err.message : String(err);
		const stderr = (err as { stderr?: Buffer })?.stderr?.toString().trim();
		console.log(`  [${timestamp}] ❌ gen-skill-docs — ${stderr || errMsg}`);
		return;
	}

	// Validate: no unresolved placeholders, frontmatter present
	for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const md = path.join(SKILLS_DIR, entry.name, "SKILL.md");
		if (!fs.existsSync(md)) continue;

		const content = fs.readFileSync(md, "utf-8");
		const issues: string[] = [];

		const unresolved = content.match(/\{\{(\w+)\}\}/g);
		if (unresolved) issues.push(`unresolved: ${unresolved.join(", ")}`);
		if (!content.includes("AUTO-GENERATED")) issues.push("missing header");
		if (!content.includes("NOT legal advice"))
			issues.push("missing disclaimer");

		const name = `skills/${entry.name}/SKILL.md`;
		if (issues.length > 0) {
			console.log(`  [check] ❌ ${name} — ${issues.join(", ")}`);
		} else {
			console.log(`  [check] ✅ ${name}`);
		}
	}
}

// Initial run
console.log("  [watch] Watching *.md.tmpl files + gen-skill-docs.ts...");
regenerateAndValidate();

// Watch all templates
for (const tmpl of findTemplates()) {
	fs.watch(tmpl, () => {
		console.log(`\n  [watch] ${path.relative(ROOT, tmpl)} changed`);
		regenerateAndValidate();
	});
}

// Watch the generator itself
const genScript = path.join(ROOT, "scripts", "gen-skill-docs.ts");
if (fs.existsSync(genScript)) {
	fs.watch(genScript, () => {
		console.log(`\n  [watch] scripts/gen-skill-docs.ts changed`);
		regenerateAndValidate();
	});
}

console.log("  [watch] Press Ctrl+C to stop\n");
