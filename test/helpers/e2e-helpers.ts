/**
 * Shared setup/teardown helpers for em-dash E2E tests.
 *
 * Provides test project scaffolding, bin utility symlinks,
 * and state pre-seeding so E2E tests don't waste turns on setup.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EvalCollector, type EvalTestEntry } from './eval-store';
import type { SkillTestResult } from './session-runner';

const ROOT = path.resolve(import.meta.dir, '..', '..');

/**
 * Create a minimal test project with known HIPAA violations for scanning.
 * Returns the path to the temp directory.
 */
export function setupTestProject(tmpDir: string): string {
  const projectDir = path.join(tmpDir, 'test-project');
  fs.mkdirSync(projectDir, { recursive: true });

  // Initialize as git repo
  const { execSync } = require('child_process');
  execSync('git init', { cwd: projectDir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: projectDir, stdio: 'pipe' });

  // Planted HIPAA violation: PHI in console.log
  fs.writeFileSync(path.join(projectDir, 'server.ts'), `
import express from 'express';
const app = express();

app.get('/patient/:id', async (req, res) => {
  const patient = await db.findPatient(req.params.id);
  console.log("Fetching patient:", patient.name, patient.ssn);  // PHI in log!
  res.json(patient);
});
`);

  // Planted violation: sslmode=disable
  fs.writeFileSync(path.join(projectDir, '.env'), `
DATABASE_URL=postgres://admin:password123@db.example.com:5432/health?sslmode=disable
SECRET_KEY=hardcoded-secret-key-12345
`);

  // Planted violation: no .gitignore for .env
  // (deliberately NOT creating .gitignore)

  // Planted violation: GRANT ALL in SQL
  fs.writeFileSync(path.join(projectDir, 'migrations/001.sql'), `
CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ssn TEXT NOT NULL,
  diagnosis TEXT
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
`);

  // Planted violation: unencrypted S3 in Terraform
  fs.mkdirSync(path.join(projectDir, 'infra'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'infra/main.tf'), `
resource "aws_s3_bucket" "phi_bucket" {
  bucket = "patient-records-bucket"
}

resource "aws_db_instance" "main" {
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  storage_encrypted    = false
  publicly_accessible  = true
}
`);

  return projectDir;
}

/**
 * Symlink em-dash bin utilities into a test directory.
 */
export function setupEmdashBins(targetDir: string): void {
  const binDir = path.join(ROOT, 'bin');
  const targetBinDir = path.join(targetDir, 'bin');
  fs.mkdirSync(targetBinDir, { recursive: true });

  for (const bin of fs.readdirSync(binDir)) {
    const src = path.join(binDir, bin);
    const dest = path.join(targetBinDir, bin);
    try { fs.symlinkSync(src, dest); } catch { /* already exists */ }
  }
}

/**
 * Pre-seed em-dash state files so E2E tests don't waste turns on first-run prompts.
 */
export function preseedState(homeDir: string): void {
  const emdashDir = path.join(homeDir, '.em-dash');
  fs.mkdirSync(path.join(emdashDir, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(emdashDir, 'projects'), { recursive: true });
}

/**
 * Record an E2E test result to the eval collector.
 * DRY wrapper for common fields.
 */
export function recordE2E(
  collector: EvalCollector,
  testName: string,
  result: SkillTestResult,
  passed: boolean,
  extra?: Partial<EvalTestEntry>,
): void {
  collector.addTest({
    name: testName,
    suite: 'em-dash-e2e',
    tier: 'e2e',
    passed,
    duration_ms: result.duration,
    cost_usd: result.costEstimate.estimatedCost,
    transcript: result.transcript,
    output: result.output,
    turns_used: result.costEstimate.turnsUsed,
    compliance_errors: result.complianceErrors,
    exit_reason: result.exitReason,
    model: result.model,
    first_response_ms: result.firstResponseMs,
    max_inter_turn_ms: result.maxInterTurnMs,
    ...extra,
  });
}
