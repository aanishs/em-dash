#!/usr/bin/env bun
/**
 * eval:compare — Compare two eval runs (auto-picks most recent).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { compareEvalResults, formatComparison, type EvalResult } from '../test/helpers/eval-store';

const evalDir = path.join(os.homedir(), '.em-dash-dev', 'evals');

let files: string[];
try {
  files = fs.readdirSync(evalDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .reverse();
} catch {
  console.log('No eval runs found.');
  process.exit(0);
}

if (files.length < 2) {
  console.log('Need at least 2 eval runs to compare.');
  process.exit(0);
}

const afterPath = path.join(evalDir, files[0]);
const beforePath = path.join(evalDir, files[1]);

const after: EvalResult = JSON.parse(fs.readFileSync(afterPath, 'utf-8'));
const before: EvalResult = JSON.parse(fs.readFileSync(beforePath, 'utf-8'));

const comparison = compareEvalResults(before, after, beforePath, afterPath);
console.log(formatComparison(comparison));
