#!/usr/bin/env bun
/**
 * validate-tool-bindings.ts — Cross-reference tool-bindings.json against Prowler's
 * CIS compliance JSON to verify our Prowler check ID mappings are correct.
 *
 * What it does:
 * 1. Reads our tool-bindings.json (NIST 800-53 control → Prowler check IDs)
 * 2. Reads Prowler's cis_3.0_aws.json (CIS Benchmark → Prowler check IDs)
 * 3. For each Prowler check ID we reference: does it exist in Prowler's CIS data?
 * 4. For each CIS Benchmark ID we reference: do our Prowler checks match what Prowler maps?
 *
 * Run: bun scripts/validate-tool-bindings.ts
 *      bun scripts/validate-tool-bindings.ts --prowler-path /path/to/prowler/compliance/aws
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const BINDINGS_PATH = path.join(import.meta.dir, '..', 'nist', 'tool-bindings.json');

// Find Prowler compliance directory
function findProwlerComplianceDir(): string | null {
  // Check --prowler-path flag
  const flagIdx = process.argv.indexOf('--prowler-path');
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) return process.argv[flagIdx + 1];

  // Try pip show
  try {
    const pipOut = execSync('pip show prowler 2>/dev/null', { encoding: 'utf-8' });
    const match = pipOut.match(/Location:\s*(.+)/);
    if (match) {
      const dir = path.join(match[1].trim(), 'prowler', 'compliance', 'aws');
      if (fs.existsSync(dir)) return dir;
    }
  } catch {}

  // Try common paths
  for (const p of [
    '/usr/local/lib/python3.12/site-packages/prowler/compliance/aws',
    '/usr/lib/python3/dist-packages/prowler/compliance/aws',
  ]) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

// Load Prowler CIS compliance data
function loadProwlerCIS(complianceDir: string): {
  checkToCIS: Map<string, string[]>;  // prowler_check_id → [CIS benchmark IDs]
  cisToChecks: Map<string, string[]>; // CIS benchmark ID → [prowler_check_ids]
  allChecks: Set<string>;
} {
  const checkToCIS = new Map<string, string[]>();
  const cisToChecks = new Map<string, string[]>();
  const allChecks = new Set<string>();

  // Prefer latest CIS version available
  const cisFiles = fs.readdirSync(complianceDir)
    .filter(f => f.startsWith('cis_') && f.endsWith('_aws.json'))
    .sort()
    .reverse();

  if (cisFiles.length === 0) {
    console.error('No CIS AWS compliance files found in ' + complianceDir);
    process.exit(1);
  }

  const cisFile = cisFiles[0]; // Latest version
  const data = JSON.parse(fs.readFileSync(path.join(complianceDir, cisFile), 'utf-8'));

  console.log(`Prowler CIS source: ${cisFile} (${data.Requirements?.length || 0} requirements)`);

  for (const req of data.Requirements || []) {
    const cisId = req.Id;
    const checks = req.Checks || [];

    for (const check of checks) {
      allChecks.add(check);

      if (!checkToCIS.has(check)) checkToCIS.set(check, []);
      checkToCIS.get(check)!.push(cisId);

      if (!cisToChecks.has(cisId)) cisToChecks.set(cisId, []);
      cisToChecks.get(cisId)!.push(check);
    }
  }

  return { checkToCIS, cisToChecks, allChecks };
}

// Main
const prowlerDir = findProwlerComplianceDir();
if (!prowlerDir) {
  console.error('Prowler not found. Install: pip install prowler');
  console.error('Or specify: bun scripts/validate-tool-bindings.ts --prowler-path /path/to/compliance/aws');
  process.exit(1);
}

const bindings = JSON.parse(fs.readFileSync(BINDINGS_PATH, 'utf-8'));
const { checkToCIS, cisToChecks, allChecks } = loadProwlerCIS(prowlerDir);

console.log(`\nTool Bindings Validation Report`);
console.log('══════════════════════════════════════════════════════════');
console.log(`tool-bindings.json: v${bindings.version}`);
console.log(`Prowler CIS checks: ${allChecks.size}`);
console.log();

let errors = 0;
let warnings = 0;
let verified = 0;

// 1. Check every Prowler ID in our bindings exists in Prowler
console.log('1. Prowler check ID verification');
console.log('────────────────────────────────');

const ourProwlerChecks = new Set<string>();
for (const [controlId, binding] of Object.entries(bindings.bindings) as [string, any][]) {
  for (const checkId of binding.prowler || []) {
    ourProwlerChecks.add(checkId);
    if (allChecks.has(checkId)) {
      verified++;
    } else {
      console.log(`  ✗ ${controlId} → ${checkId} — NOT FOUND in Prowler CIS data`);
      warnings++;
    }
  }
}

console.log(`  ${verified} verified, ${warnings} not found in CIS data (may be HIPAA/PCI-only checks)`);
console.log();

// 2. Cross-reference CIS Benchmark IDs
console.log('2. CIS Benchmark cross-reference');
console.log('────────────────────────────────');

let cisVerified = 0;
let cisMismatch = 0;

for (const [controlId, binding] of Object.entries(bindings.bindings) as [string, any][]) {
  const cisBenchmarks = binding.cis_benchmark || [];
  const ourProwler = binding.prowler || [];

  for (const cisId of cisBenchmarks) {
    const prowlerForCIS = cisToChecks.get(cisId) || [];
    if (prowlerForCIS.length === 0) {
      console.log(`  ? ${controlId} cis_benchmark ${cisId} — no Prowler checks found for this CIS ID`);
      warnings++;
      continue;
    }

    // Check overlap: do any of our Prowler checks match what Prowler says implements this CIS ID?
    const overlap = ourProwler.filter((p: string) => prowlerForCIS.includes(p));
    if (overlap.length > 0) {
      cisVerified++;
    } else {
      const missing = prowlerForCIS.filter((p: string) => !ourProwler.includes(p));
      if (missing.length > 0) {
        console.log(`  ✗ ${controlId} cis_benchmark ${cisId} — Prowler maps these checks but we don't have them:`);
        for (const m of missing) console.log(`      + ${m}`);
        cisMismatch++;
      }
    }
  }
}

console.log(`  ${cisVerified} CIS refs verified, ${cisMismatch} mismatches`);
console.log();

// 3. Find Prowler checks we're missing
console.log('3. Missing Prowler checks (in CIS but not in our bindings)');
console.log('────────────────────────────────');

const missingChecks: Array<{ check: string; cisIds: string[] }> = [];
for (const [check, cisIds] of checkToCIS) {
  if (!ourProwlerChecks.has(check)) {
    missingChecks.push({ check, cisIds });
  }
}

if (missingChecks.length > 0) {
  console.log(`  ${missingChecks.length} Prowler CIS checks not in our bindings:`);
  for (const { check, cisIds } of missingChecks.slice(0, 20)) {
    console.log(`    ${check} (CIS ${cisIds.join(', ')})`);
  }
  if (missingChecks.length > 20) console.log(`    ... and ${missingChecks.length - 20} more`);
} else {
  console.log('  None — all Prowler CIS checks are in our bindings');
}

console.log();

// Summary
console.log('──────────────────────────────────────────────────────────');
const totalIssues = errors + cisMismatch;
if (totalIssues === 0 && warnings === 0) {
  console.log('PASS — All Prowler mappings verified against CIS compliance data');
} else if (totalIssues === 0) {
  console.log(`PASS with ${warnings} warning(s) — some checks may be framework-specific (not CIS)`);
} else {
  console.log(`${cisMismatch} mismatch(es) found — consider adding missing Prowler checks to tool-bindings.json`);
}
