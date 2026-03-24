/**
 * Framework loader — reads and validates framework definitions from JSON files.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkDefinition } from './schema';
import { validateFrameworkChecks } from './checks-registry';

const FRAMEWORKS_DIR = path.resolve(import.meta.dir);

/** Load a framework definition by ID */
export function loadFramework(id: string): FrameworkDefinition {
  const filePath = path.join(FRAMEWORKS_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Framework definition not found: ${filePath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    throw new Error(`Failed to read framework definition ${id}: ${err.message}`);
  }

  let def: FrameworkDefinition;
  try {
    def = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Invalid JSON in framework definition ${id}: ${err.message}`);
  }

  // Validate required fields
  const required = ['id', 'name', 'version', 'disclaimer', 'terminology', 'thresholds', 'requirements', 'checklist'] as const;
  for (const field of required) {
    if (!def[field]) {
      throw new Error(`Framework ${id} missing required field: ${field}`);
    }
  }

  if (def.id !== id) {
    throw new Error(`Framework ${id} has mismatched id field: "${def.id}"`);
  }

  // Validate check_ids reference existing checks
  const allCheckIds = def.requirements.flatMap((r) => r.check_ids);
  const { missing } = validateFrameworkChecks(id, allCheckIds);
  if (missing.length > 0) {
    console.warn(`Warning: Framework ${id} references ${missing.length} check IDs not in registry: ${missing.join(', ')}`);
  }

  return def;
}

/** List all available framework IDs */
export function listFrameworks(): string[] {
  return fs
    .readdirSync(FRAMEWORKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

/** Load all available frameworks */
export function loadAllFrameworks(): Map<string, FrameworkDefinition> {
  const map = new Map<string, FrameworkDefinition>();
  for (const id of listFrameworks()) {
    map.set(id, loadFramework(id));
  }
  return map;
}
