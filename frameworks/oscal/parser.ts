/**
 * OSCAL catalog parser.
 *
 * Parses NIST 800-53 OSCAL catalogs (JSON format) and the em-dash
 * SP 800-66r2 HIPAA mapping into em-dash's internal format.
 *
 * Data flow:
 *   NIST 800-53 catalog (JSON) ──▶ parse ──▶ filter via HIPAA mapping ──▶ internal controls
 *                                                                          │
 *   SP 800-66r2 mapping (JSON) ──────────────────────────────────────────┘
 */

import * as fs from 'fs';
import * as path from 'path';

/** A control from the NIST 800-53 OSCAL catalog */
export interface OscalControl {
  id: string;
  title: string;
  class?: string;
}

/** em-dash's internal representation of a mapped OSCAL control */
export interface MappedControl {
  oscal_id: string;
  title: string;
  family: string;
  hipaa_refs: string[];
  description: string;
  plain_english: string;
  automated_checks: string[];
  evidence_types: string[];
}

/** The SP 800-66r2 mapping file structure */
export interface HipaaMapping {
  profile_id: string;
  profile_name: string;
  description: string;
  source: string;
  version: string;
  phase: number;
  note: string;
  controls: MappedControl[];
}

/**
 * Load the SP 800-66r2 HIPAA mapping from disk.
 */
export function loadHipaaMapping(mappingPath?: string): HipaaMapping {
  const defaultPath = path.join(import.meta.dir, 'mappings', 'hipaa-sp800-66r2.json');
  const filePath = mappingPath || defaultPath;

  if (!fs.existsSync(filePath)) {
    throw new Error(`HIPAA mapping file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  let mapping: HipaaMapping;

  try {
    mapping = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse HIPAA mapping JSON: ${filePath}`);
  }

  if (!mapping.controls || !Array.isArray(mapping.controls)) {
    throw new Error('HIPAA mapping has no controls array');
  }

  if (mapping.controls.length === 0) {
    throw new Error('HIPAA mapping has 0 controls');
  }

  return mapping;
}

/**
 * Get the list of OSCAL control IDs from the HIPAA mapping.
 */
export function getHipaaOscalControlIds(mapping: HipaaMapping): string[] {
  return mapping.controls.map((c) => c.oscal_id);
}

/**
 * Get all unique HIPAA requirement IDs referenced by the mapping.
 */
export function getHipaaRequirementIds(mapping: HipaaMapping): string[] {
  const ids = new Set<string>();
  for (const control of mapping.controls) {
    for (const ref of control.hipaa_refs) {
      ids.add(ref);
    }
  }
  return Array.from(ids).sort();
}

/**
 * Find the mapped control for a given OSCAL control ID.
 */
export function findControl(mapping: HipaaMapping, oscalId: string): MappedControl | undefined {
  return mapping.controls.find((c) => c.oscal_id === oscalId);
}

/**
 * Find all mapped controls for a given HIPAA requirement ID.
 */
export function findControlsForRequirement(mapping: HipaaMapping, hipaaRef: string): MappedControl[] {
  return mapping.controls.filter((c) => c.hipaa_refs.includes(hipaaRef));
}

/**
 * Validate that all automated_checks in the mapping exist in the checks registry.
 * Returns a list of invalid check IDs.
 */
export function validateCheckReferences(
  mapping: HipaaMapping,
  validCheckIds: string[],
): string[] {
  const invalid: string[] = [];
  const validSet = new Set(validCheckIds);

  for (const control of mapping.controls) {
    for (const checkId of control.automated_checks) {
      if (!validSet.has(checkId)) {
        invalid.push(`${control.oscal_id}: references unknown check '${checkId}'`);
      }
    }
  }

  return invalid;
}
