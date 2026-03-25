/**
 * Framework tests — v2 architecture.
 *
 * NIST catalog is the source of truth. hipaa.json is display metadata.
 * Checks registry is pure execution. Tool bindings map controls to tools.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { CHECKS, getCheck, getChecksByType, getAllCheckIds } from '../frameworks/checks-registry';

const ROOT = path.resolve(import.meta.dir, '..');
const NIST = path.join(ROOT, 'nist');

describe('HIPAA framework definition', () => {
  const hipaa = JSON.parse(fs.readFileSync(path.join(ROOT, 'frameworks', 'hipaa.json'), 'utf-8'));

  test('loads with correct id', () => {
    expect(hipaa.id).toBe('hipaa');
  });

  test('has required display fields', () => {
    expect(hipaa.name).toBeTruthy();
    expect(hipaa.version).toBeTruthy();
    expect(hipaa.disclaimer).toBeTruthy();
    expect(hipaa.terminology).toBeTruthy();
    expect(hipaa.thresholds).toBeTruthy();
    expect(hipaa.requirements).toBeArray();
    expect(hipaa.checklist).toBeArray();
  });

  test('requirements are display-only (no check_ids)', () => {
    for (const req of hipaa.requirements) {
      expect(req.check_ids).toBeUndefined();
      expect(req.oscal_refs).toBeUndefined();
      expect(req.applicability).toBeUndefined();
    }
  });

  test('has oscal_profile reference', () => {
    expect(hipaa.oscal_profile).toBeDefined();
  });
});

describe('Checks registry', () => {
  test('has 50 checks', () => {
    expect(CHECKS.length).toBe(50);
  });

  test('no duplicate IDs', () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every check has required fields', () => {
    for (const check of CHECKS) {
      expect(check.id).toBeTruthy();
      expect(check.category).toBeTruthy();
      expect(check.description).toBeTruthy();
      expect(check.type).toBeTruthy();
      expect(check.severity_default).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW|INFO)$/);
    }
  });

  test('no framework mappings on checks', () => {
    for (const check of CHECKS) {
      expect((check as any).frameworks).toBeUndefined();
    }
  });

  test('code checks have patterns', () => {
    for (const c of getChecksByType('code_grep')) {
      expect(c.pattern).toBeTruthy();
    }
  });

  test('cloud checks have commands', () => {
    for (const c of getChecksByType('cloud_cli')) {
      expect(c.command).toBeTruthy();
    }
  });
});

describe('NIST ↔ Tool binding consistency', () => {
  const bindings = JSON.parse(fs.readFileSync(path.join(NIST, 'tool-bindings.json'), 'utf-8'));
  const regIds = new Set(getAllCheckIds());

  test('all emdash checks in bindings exist in registry', () => {
    for (const [, tools] of Object.entries(bindings.bindings)) {
      for (const checkId of (tools as any).emdash || []) {
        expect(regIds.has(checkId)).toBe(true);
      }
    }
  });

  test('binding control IDs exist in HIPAA filter', () => {
    const filter = JSON.parse(fs.readFileSync(path.join(NIST, 'hipaa-filter.json'), 'utf-8'));
    const filterControls = new Set<string>();
    for (const ids of Object.values(filter.mapping)) {
      for (const id of ids as string[]) filterControls.add(id);
    }
    for (const id of Object.keys(bindings.bindings)) {
      expect(filterControls.has(id)).toBe(true);
    }
  });
});
