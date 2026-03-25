#!/usr/bin/env bun
/**
 * validate-hipaa-filter.ts — Validate hipaa-filter.json against SP 800-66r2 mappings.
 *
 * Source: NIST SP 800-66 Revision 2 (Feb 2024), Section 5 tables + CPRT mappings.
 * Each HIPAA Security Rule implementation specification is mapped to 800-53r5 controls
 * based on the guidance in SP 800-66r2 and the NIST Cybersecurity and Privacy Reference Tool.
 *
 * Run: bun scripts/validate-hipaa-filter.ts [--fix]
 */

import * as fs from 'fs';
import * as path from 'path';

const FIX_MODE = process.argv.includes('--fix');
const FILTER_PATH = path.join(import.meta.dir, '..', 'nist', 'hipaa-filter.json');

// ─── Authoritative SP 800-66r2 mapping ──────────────────────────
// Derived from SP 800-66r2 Section 5 tables and NIST CPRT.
// Each key is a HIPAA Security Rule CFR section.
// Values are the NIST 800-53r5 controls that SP 800-66r2 maps to that spec.
//
// Legend:
//   (R) = Required implementation specification
//   (A) = Addressable implementation specification
//   (S) = Standard (parent — no R/A designation)

const AUTHORITATIVE_MAPPING: Record<string, { controls: string[]; name: string }> = {
  // ═══ 164.308 Administrative Safeguards ═══

  // Security Management Process
  "164.308(a)(1)(i)":      { controls: ["PL-1", "PM-1"], name: "Security Management Process (S)" },
  "164.308(a)(1)(ii)(A)":  { controls: ["RA-3", "RA-5"], name: "Risk Analysis (R)" },
  "164.308(a)(1)(ii)(B)":  { controls: ["RA-3", "PM-9"], name: "Risk Management (R)" },
  "164.308(a)(1)(ii)(C)":  { controls: ["PS-8", "PL-4"], name: "Sanction Policy (R)" },
  "164.308(a)(1)(ii)(D)":  { controls: ["AU-6", "CA-7"], name: "Information System Activity Review (R)" },

  // Assigned Security Responsibility
  "164.308(a)(2)":         { controls: ["PM-2"], name: "Assigned Security Responsibility (R)" },

  // Workforce Security
  "164.308(a)(3)(i)":      { controls: ["PS-1", "PS-2"], name: "Workforce Security (S)" },
  "164.308(a)(3)(ii)(A)":  { controls: ["AC-2", "PS-2"], name: "Authorization and/or Supervision (A)" },
  "164.308(a)(3)(ii)(B)":  { controls: ["PS-3"], name: "Workforce Clearance Procedure (A)" },
  "164.308(a)(3)(ii)(C)":  { controls: ["PS-4"], name: "Termination Procedures (A)" },

  // Information Access Management
  "164.308(a)(4)(i)":      { controls: ["AC-1"], name: "Information Access Management (S)" },
  "164.308(a)(4)(ii)(A)":  { controls: ["SC-2", "AC-4"], name: "Isolating Healthcare Clearinghouse Functions (R)" },
  "164.308(a)(4)(ii)(B)":  { controls: ["AC-2", "AC-3"], name: "Access Authorization (A)" },
  "164.308(a)(4)(ii)(C)":  { controls: ["AC-2", "AC-5", "AC-6"], name: "Access Establishment and Modification (A)" },

  // Security Awareness and Training
  "164.308(a)(5)(i)":      { controls: ["AT-2"], name: "Security Awareness and Training (S)" },
  "164.308(a)(5)(ii)(A)":  { controls: ["AT-2"], name: "Security Reminders (A)" },
  "164.308(a)(5)(ii)(B)":  { controls: ["SI-3"], name: "Protection from Malicious Software (A)" },
  "164.308(a)(5)(ii)(C)":  { controls: ["AC-7", "AU-2"], name: "Log-in Monitoring (A)" },
  "164.308(a)(5)(ii)(D)":  { controls: ["IA-5"], name: "Password Management (A)" },

  // Security Incident Procedures
  "164.308(a)(6)(i)":      { controls: ["IR-1", "IR-6"], name: "Security Incident Procedures (S)" },
  "164.308(a)(6)(ii)":     { controls: ["IR-4", "IR-5", "IR-6"], name: "Response and Reporting (R)" },

  // Contingency Plan
  "164.308(a)(7)(i)":      { controls: ["CP-1", "CP-2"], name: "Contingency Plan (S)" },
  "164.308(a)(7)(ii)(A)":  { controls: ["CP-9"], name: "Data Backup Plan (R)" },
  "164.308(a)(7)(ii)(B)":  { controls: ["CP-10"], name: "Disaster Recovery Plan (R)" },
  "164.308(a)(7)(ii)(C)":  { controls: ["CP-2"], name: "Emergency Mode Operation Plan (R)" },
  "164.308(a)(7)(ii)(D)":  { controls: ["CP-4"], name: "Testing and Revision Procedures (A)" },
  "164.308(a)(7)(ii)(E)":  { controls: ["RA-2", "CP-2"], name: "Applications and Data Criticality Analysis (A)" },

  // Evaluation
  "164.308(a)(8)":         { controls: ["CA-2", "CA-7"], name: "Evaluation (R)" },

  // Business Associate Contracts
  "164.308(b)(1)":         { controls: ["SA-9"], name: "Business Associate Contracts (R)" },

  // ═══ 164.310 Physical Safeguards ═══

  // Facility Access Controls
  "164.310(a)(1)":         { controls: ["PE-2", "PE-3"], name: "Facility Access Controls (S)" },
  "164.310(a)(2)(i)":      { controls: ["CP-2", "PE-1"], name: "Contingency Operations (A)" },
  "164.310(a)(2)(ii)":     { controls: ["PE-3"], name: "Facility Security Plan (A)" },
  "164.310(a)(2)(iii)":    { controls: ["PE-2", "PE-3"], name: "Access Control and Validation Procedures (A)" },
  "164.310(a)(2)(iv)":     { controls: ["MA-2", "MA-5"], name: "Maintenance Records (A)" },

  // Workstation Use and Security
  "164.310(b)":            { controls: ["PE-5"], name: "Workstation Use (R)" },
  "164.310(c)":            { controls: ["PE-5"], name: "Workstation Security (R)" },

  // Device and Media Controls
  "164.310(d)(1)":         { controls: ["MP-1", "MP-2"], name: "Device and Media Controls (S)" },
  "164.310(d)(2)(i)":      { controls: ["MP-6"], name: "Disposal (R)" },
  "164.310(d)(2)(ii)":     { controls: ["MP-6"], name: "Media Re-use (R)" },
  "164.310(d)(2)(iii)":    { controls: ["CM-8"], name: "Accountability (A)" },
  "164.310(d)(2)(iv)":     { controls: ["CP-9"], name: "Data Backup and Storage (A)" },

  // ═══ 164.312 Technical Safeguards ═══

  // Access Control
  "164.312(a)(1)":         { controls: ["AC-2", "AC-3", "AC-6"], name: "Access Control (S)" },
  "164.312(a)(2)(i)":      { controls: ["IA-2", "IA-4"], name: "Unique User Identification (R)" },
  "164.312(a)(2)(ii)":     { controls: ["CP-2"], name: "Emergency Access Procedure (R)" },
  "164.312(a)(2)(iii)":    { controls: ["AC-11"], name: "Automatic Logoff (A)" },
  "164.312(a)(2)(iv)":     { controls: ["SC-28"], name: "Encryption and Decryption (A)" },

  // Audit Controls
  "164.312(b)":            { controls: ["AU-2", "AU-3", "AU-6", "AU-12"], name: "Audit Controls (R)" },

  // Integrity
  "164.312(c)(1)":         { controls: ["SI-7"], name: "Integrity (S)" },
  "164.312(c)(2)":         { controls: ["SI-7"], name: "Mechanism to Authenticate ePHI (A)" },

  // Person or Entity Authentication
  "164.312(d)":            { controls: ["IA-2", "IA-5"], name: "Person or Entity Authentication (R)" },

  // Transmission Security
  "164.312(e)(1)":         { controls: ["SC-8"], name: "Transmission Security (S)" },
  "164.312(e)(2)(i)":      { controls: ["SC-8"], name: "Integrity Controls (A)" },
  "164.312(e)(2)(ii)":     { controls: ["SC-8", "SC-13"], name: "Encryption (A)" },

  // ═══ 164.314 Organizational Requirements ═══

  "164.314(a)(1)":         { controls: ["SA-9"], name: "Business Associate Contracts or Other Arrangements (S)" },
  "164.314(a)(2)(i)":      { controls: ["SA-9"], name: "Business Associate Contracts (R)" },
  "164.314(a)(2)(ii)":     { controls: ["SA-9"], name: "Other Arrangements (R)" },

  // ═══ 164.316 Policies and Procedures ═══

  "164.316(a)":            { controls: ["PL-1"], name: "Policies and Procedures (R)" },
  "164.316(b)(1)":         { controls: ["PL-1"], name: "Documentation (R)" },
  "164.316(b)(2)(i)":      { controls: ["PL-1", "AU-11"], name: "Time Limit (R)" },
  "164.316(b)(2)(ii)":     { controls: ["PL-1"], name: "Availability (R)" },
  "164.316(b)(2)(iii)":    { controls: ["PL-1"], name: "Updates (R)" },

  // ═══ Privacy Rule additions (em-dash extension, not in SP 800-66r2) ═══

  "164.502":               { controls: ["AC-3"], name: "Uses and Disclosures (em-dash extension)" },
  "164.514":               { controls: ["SI-12"], name: "Data Minimization (em-dash extension)" },
};

// ─── Validation ──────────────────────────────────────────────────

const filter = JSON.parse(fs.readFileSync(FILTER_PATH, 'utf8'));
const currentMapping: Record<string, string[]> = filter.mapping;

let missingSpecs: string[] = [];
let extraSpecs: string[] = [];
let missingControls: { spec: string; missing: string[] }[] = [];
let extraControls: { spec: string; extra: string[] }[] = [];

// Check for missing specs (in authoritative but not in filter)
for (const [spec, { controls, name }] of Object.entries(AUTHORITATIVE_MAPPING)) {
  if (!currentMapping[spec]) {
    missingSpecs.push(`${spec} — ${name} → [${controls.join(', ')}]`);
  } else {
    // Check control accuracy
    const currentControls = new Set(currentMapping[spec]);
    const authControls = new Set(controls);

    const missing = controls.filter(c => !currentControls.has(c));
    const extra = currentMapping[spec].filter(c => !authControls.has(c));

    if (missing.length > 0) {
      missingControls.push({ spec: `${spec} (${name})`, missing });
    }
    if (extra.length > 0) {
      extraControls.push({ spec: `${spec} (${name})`, extra });
    }
  }
}

// Check for extra specs (in filter but not in authoritative)
for (const spec of Object.keys(currentMapping)) {
  if (!AUTHORITATIVE_MAPPING[spec]) {
    extraSpecs.push(spec);
  }
}

// ─── Report ──────────────────────────────────────────────────────

console.log('HIPAA Filter Validation Report');
console.log('══════════════════════════════════════════════════════════');
console.log(`Source: SP 800-66r2 + NIST CPRT`);
console.log(`Current filter: ${Object.keys(currentMapping).length} specs`);
console.log(`Authoritative:  ${Object.keys(AUTHORITATIVE_MAPPING).length} specs`);
console.log();

if (missingSpecs.length > 0) {
  console.log(`MISSING SPECS (${missingSpecs.length}):`);
  for (const s of missingSpecs) console.log(`  + ${s}`);
  console.log();
}

if (extraSpecs.length > 0) {
  console.log(`EXTRA SPECS (${extraSpecs.length}) — in filter but not in authoritative:`);
  for (const s of extraSpecs) console.log(`  ? ${s}`);
  console.log();
}

if (missingControls.length > 0) {
  console.log(`MISSING CONTROLS (${missingControls.length} specs affected):`);
  for (const { spec, missing } of missingControls) {
    console.log(`  ${spec}: +${missing.join(', ')}`);
  }
  console.log();
}

if (extraControls.length > 0) {
  console.log(`EXTRA CONTROLS (${extraControls.length} specs — in filter but not in authoritative):`);
  for (const { spec, extra } of extraControls) {
    console.log(`  ${spec}: -${extra.join(', ')}`);
  }
  console.log();
}

// Count unique controls
const allAuthControls = new Set<string>();
for (const { controls } of Object.values(AUTHORITATIVE_MAPPING)) {
  for (const c of controls) allAuthControls.add(c);
}

const allCurrentControls = new Set<string>();
for (const controls of Object.values(currentMapping)) {
  for (const c of controls) allCurrentControls.add(c);
}

const newControls = [...allAuthControls].filter(c => !allCurrentControls.has(c));
if (newControls.length > 0) {
  console.log(`NEW CONTROLS that would be added: ${newControls.join(', ')}`);
  console.log();
}

const totalIssues = missingSpecs.length + missingControls.length;
if (totalIssues === 0) {
  console.log('✓ Filter is complete — no gaps found.');
} else {
  console.log(`TOTAL: ${missingSpecs.length} missing specs, ${missingControls.length} specs with missing controls`);
}

// ─── Fix mode ────────────────────────────────────────────────────

if (FIX_MODE && totalIssues > 0) {
  console.log('\n── Applying fixes ──');

  const newMapping: Record<string, string[]> = {};

  // Build from authoritative, preserving any em-dash extensions
  for (const [spec, { controls }] of Object.entries(AUTHORITATIVE_MAPPING)) {
    // Merge: authoritative controls + any extra controls already in filter
    const existing = currentMapping[spec] || [];
    const merged = [...new Set([...controls, ...existing])];
    newMapping[spec] = merged;
  }

  // Preserve any extra specs from current filter (em-dash extensions)
  for (const spec of extraSpecs) {
    newMapping[spec] = currentMapping[spec];
  }

  const updated = {
    ...filter,
    version: "2.0",
    note: "Validated against SP 800-66r2 Section 5 + NIST CPRT. Includes all HIPAA Security Rule standards and implementation specifications.",
    mapping: newMapping,
  };

  fs.writeFileSync(FILTER_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`Updated ${FILTER_PATH}`);
  console.log(`  Specs: ${Object.keys(currentMapping).length} → ${Object.keys(newMapping).length}`);
  console.log(`  Controls: ${allCurrentControls.size} → ${new Set([...allAuthControls, ...allCurrentControls]).size}`);
}
