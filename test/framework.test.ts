import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { CHECKS, getChecksForFramework, getChecksForProvider, validateFrameworkChecks } from '../frameworks/checks-registry';
import { loadFramework, listFrameworks, loadAllFrameworks } from '../frameworks/index';
import type { FrameworkDefinition } from '../frameworks/schema';

const FRAMEWORKS_DIR = path.resolve(import.meta.dir, '..', 'frameworks');

describe('Framework schema', () => {
  test('hipaa.json loads without errors', () => {
    const fw = loadFramework('hipaa');
    expect(fw.id).toBe('hipaa');
    expect(fw.name).toBe('HIPAA Security Rule');
  });

  test('soc2.json loads without errors', () => {
    const fw = loadFramework('soc2');
    expect(fw.id).toBe('soc2');
    expect(fw.name).toContain('SOC 2');
  });

  test('nonexistent framework throws', () => {
    expect(() => loadFramework('nonexistent')).toThrow('not found');
  });

  test('all framework JSON files are valid', () => {
    const ids = listFrameworks();
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const id of ids) {
      expect(() => loadFramework(id)).not.toThrow();
    }
  });

  test('framework definitions have required fields', () => {
    for (const id of listFrameworks()) {
      const fw = loadFramework(id);
      expect(fw.id).toBe(id);
      expect(fw.name).toBeTruthy();
      expect(fw.version).toBeTruthy();
      expect(fw.disclaimer).toBeTruthy();
      expect(fw.terminology).toBeTruthy();
      expect(fw.terminology.sensitive_data).toBeTruthy();
      expect(fw.thresholds).toBeTruthy();
      expect(fw.thresholds.log_retention_days).toBeGreaterThan(0);
      expect(fw.requirements).toBeInstanceOf(Array);
      expect(fw.requirements.length).toBeGreaterThan(0);
      expect(fw.checklist).toBeInstanceOf(Array);
      expect(fw.checklist.length).toBeGreaterThan(0);
    }
  });

  test('framework id matches filename', () => {
    for (const id of listFrameworks()) {
      const fw = loadFramework(id);
      expect(fw.id).toBe(id);
    }
  });
});

describe('Checks registry', () => {
  test('registry has checks', () => {
    expect(CHECKS.length).toBeGreaterThan(30);
  });

  test('no duplicate check IDs', () => {
    const ids = CHECKS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('every check has required fields', () => {
    for (const check of CHECKS) {
      expect(check.id).toBeTruthy();
      expect(check.category).toBeTruthy();
      expect(check.description).toBeTruthy();
      expect(check.type).toBeTruthy();
      expect(check.severity_default).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW|INFO)$/);
      expect(Object.keys(check.frameworks).length).toBeGreaterThan(0);
    }
  });

  test('every check maps to at least one framework', () => {
    for (const check of CHECKS) {
      const frameworkCount = Object.keys(check.frameworks).length;
      expect(frameworkCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('getChecksForFramework returns correct subset', () => {
    const hipaaChecks = getChecksForFramework('hipaa');
    expect(hipaaChecks.length).toBeGreaterThan(20);
    for (const check of hipaaChecks) {
      expect(check.frameworks.hipaa).toBeTruthy();
    }
  });

  test('getChecksForFramework returns empty for unknown framework', () => {
    expect(getChecksForFramework('nonexistent')).toEqual([]);
  });

  test('getChecksForProvider filters by provider', () => {
    const awsChecks = getChecksForProvider('hipaa', 'aws');
    for (const check of awsChecks) {
      expect(check.provider).toBe('aws');
    }
  });
});

describe('Framework ↔ registry consistency', () => {
  test('HIPAA check_ids all exist in registry', () => {
    const fw = loadFramework('hipaa');
    const allCheckIds = fw.requirements.flatMap((r) => r.check_ids);
    const { missing } = validateFrameworkChecks('hipaa', allCheckIds);
    expect(missing).toEqual([]);
  });

  test('SOC 2 check_ids all exist in registry', () => {
    const fw = loadFramework('soc2');
    const allCheckIds = fw.requirements.flatMap((r) => r.check_ids);
    const { missing } = validateFrameworkChecks('soc2', allCheckIds);
    expect(missing).toEqual([]);
  });

  test('every check referenced by a framework has that framework in its mappings', () => {
    for (const id of listFrameworks()) {
      const fw = loadFramework(id);
      for (const req of fw.requirements) {
        for (const checkId of req.check_ids) {
          const check = CHECKS.find((c) => c.id === checkId);
          if (check) {
            expect(check.frameworks[id]).toBeTruthy();
          }
        }
      }
    }
  });

  test('SOC 2 reuses checks from the same registry as HIPAA', () => {
    const hipaaChecks = new Set(getChecksForFramework('hipaa').map((c) => c.id));
    const soc2Checks = getChecksForFramework('soc2').map((c) => c.id);
    const overlap = soc2Checks.filter((id) => hipaaChecks.has(id));
    // SOC 2 should share many checks with HIPAA
    expect(overlap.length).toBeGreaterThan(10);
  });
});
