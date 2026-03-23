#!/usr/bin/env bun
/**
 * skill:check — Health dashboard for all em-dash skills, bins, policies, and templates.
 *
 * Reports:
 *   - Skill template + generated file validation
 *   - Bin utility existence + executability
 *   - Rego policy structure
 *   - Policy document templates
 *   - Freshness check (generated files match committed files)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(import.meta.dir, '..');

let hasErrors = false;

// ─── Skills ─────────────────────────────────────────────────

const SKILLS_DIR = path.join(ROOT, 'skills');
const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.'))
  .map(e => e.name)
  .sort();

console.log('  Skills:');
for (const dir of skillDirs) {
  const tmpl = path.join(SKILLS_DIR, dir, 'SKILL.md.tmpl');
  const md = path.join(SKILLS_DIR, dir, 'SKILL.md');
  const name = `skills/${dir}`.padEnd(30);

  if (!fs.existsSync(tmpl)) {
    console.log(`  ⚠️  ${name} — no template`);
    continue;
  }

  if (!fs.existsSync(md)) {
    hasErrors = true;
    console.log(`  ❌ ${name} — SKILL.md missing! Run: bun run gen:skill-docs`);
    continue;
  }

  const content = fs.readFileSync(md, 'utf-8');
  const issues: string[] = [];

  // Check AUTO-GENERATED header
  if (!content.includes('AUTO-GENERATED')) issues.push('missing AUTO-GENERATED header');

  // Check no unresolved placeholders
  const unresolved = content.match(/\{\{(\w+)\}\}/g);
  if (unresolved) issues.push(`unresolved: ${unresolved.join(', ')}`);

  // Check frontmatter
  if (!content.startsWith('---')) {
    issues.push('missing frontmatter');
  } else {
    const fmEnd = content.indexOf('---', 3);
    if (fmEnd > 3) {
      const fm = content.slice(3, fmEnd);
      if (!fm.includes('name:')) issues.push('missing name: in frontmatter');
      if (!fm.includes('version:')) issues.push('missing version: in frontmatter');
      if (!fm.includes('allowed-tools:')) issues.push('missing allowed-tools: in frontmatter');
    }
  }

  // Check DISCLAIMER
  if (!content.includes('NOT legal advice')) issues.push('missing DISCLAIMER');

  if (issues.length > 0) {
    hasErrors = true;
    console.log(`  ❌ ${name} — ${issues.join(', ')}`);
  } else {
    console.log(`  ✅ ${name} — OK`);
  }
}

// ─── Bin Utilities ──────────────────────────────────────────

console.log('\n  Bin Utilities:');
const EXPECTED_BINS = ['hipaa-slug', 'hipaa-config', 'hipaa-tool-detect', 'hipaa-evidence-hash', 'hipaa-review-log'];
const binDir = path.join(ROOT, 'bin');

for (const bin of EXPECTED_BINS) {
  const binPath = path.join(binDir, bin);
  const name = `bin/${bin}`.padEnd(30);

  if (!fs.existsSync(binPath)) {
    hasErrors = true;
    console.log(`  ❌ ${name} — missing`);
    continue;
  }

  const stat = fs.statSync(binPath);
  const executable = (stat.mode & 0o111) > 0;
  const content = fs.readFileSync(binPath, 'utf-8');
  const hasShebang = content.startsWith('#!/');

  const issues: string[] = [];
  if (!executable) issues.push('not executable');
  if (!hasShebang) issues.push('missing shebang');

  if (issues.length > 0) {
    hasErrors = true;
    console.log(`  ❌ ${name} — ${issues.join(', ')}`);
  } else {
    console.log(`  ✅ ${name} — OK`);
  }
}

// ─── Rego Policies ──────────────────────────────────────────

console.log('\n  Rego Policies:');
const EXPECTED_REGO = [
  'hipaa-encryption-at-rest.rego',
  'hipaa-transmission-security.rego',
  'hipaa-access-control.rego',
  'hipaa-audit-logging.rego',
  'hipaa-k8s-security.rego',
  'hipaa-secrets.rego',
];
const policyDir = path.join(ROOT, 'policies');

for (const policy of EXPECTED_REGO) {
  const policyPath = path.join(policyDir, policy);
  const name = `policies/${policy}`.padEnd(40);

  if (!fs.existsSync(policyPath)) {
    hasErrors = true;
    console.log(`  ❌ ${name} — missing`);
    continue;
  }

  const content = fs.readFileSync(policyPath, 'utf-8');
  const issues: string[] = [];

  if (!/^package hipaa\.\w+/m.test(content)) issues.push('missing package hipaa.* declaration');
  if (!content.includes('deny[msg]')) issues.push('missing deny[msg] rule');
  if (!content.includes('hipaa_ref')) issues.push('missing hipaa_ref in deny messages');

  if (issues.length > 0) {
    hasErrors = true;
    console.log(`  ❌ ${name} — ${issues.join(', ')}`);
  } else {
    const denyCount = (content.match(/deny\[msg\]/g) || []).length;
    console.log(`  ✅ ${name} — ${denyCount} deny rules`);
  }
}

// ─── Policy Document Templates ──────────────────────────────

console.log('\n  Policy Templates:');
const EXPECTED_TEMPLATES = [
  'access-control.md', 'audit-logging.md', 'encryption.md', 'incident-response.md',
  'risk-assessment.md', 'workforce-security.md', 'contingency-plan.md', 'baa-template.md',
];
const templateDir = path.join(ROOT, 'templates', 'policies');

for (const tmpl of EXPECTED_TEMPLATES) {
  const tmplPath = path.join(templateDir, tmpl);
  const name = `templates/policies/${tmpl}`.padEnd(40);

  if (!fs.existsSync(tmplPath)) {
    hasErrors = true;
    console.log(`  ❌ ${name} — missing`);
    continue;
  }

  const content = fs.readFileSync(tmplPath, 'utf-8');
  const hasPlaceholders = /\{[A-Z_]+\}/.test(content);

  if (!hasPlaceholders) {
    console.log(`  ⚠️  ${name} — no {PLACEHOLDER} tokens`);
  } else {
    console.log(`  ✅ ${name} — OK`);
  }
}

// ─── Freshness ──────────────────────────────────────────────

console.log('\n  Freshness:');
try {
  execSync('bun run scripts/gen-skill-docs.ts --dry-run', { cwd: ROOT, stdio: 'pipe' });
  console.log('  ✅ All generated SKILL.md files are fresh');
} catch (err: any) {
  hasErrors = true;
  const output = err.stdout?.toString() || '';
  console.log('  ❌ Generated files are stale:');
  for (const line of output.split('\n').filter((l: string) => l.startsWith('STALE'))) {
    console.log(`      ${line}`);
  }
  console.log('      Run: bun run gen:skill-docs');
}

console.log('');
process.exit(hasErrors ? 1 : 0);
