/**
 * Framework definition schema.
 *
 * Each compliance framework (HIPAA, SOC 2, GDPR, etc.) is defined as a JSON file
 * conforming to these interfaces. The template engine reads these at build time
 * to generate framework-specific SKILL.md files.
 *
 * IMPORTANT: Compliance relationships (which checks satisfy which requirements)
 * are defined in the NIST 800-53 catalog + filter files (nist/), NOT here.
 * Framework definitions contain display metadata only.
 */

/** A single compliance requirement within a framework (display only) */
export interface Requirement {
  /** Unique ID within the framework (e.g., "164.312(a)(1)" for HIPAA) */
  id: string;
  /** Section grouping (e.g., "Technical Safeguards", "Trust Service Criteria") */
  section: string;
  /** Human-readable name */
  name: string;
  /** What this requirement means */
  description: string;
}

/** A checklist item for tracking compliance progress */
export interface ChecklistItem {
  /** Same as requirement ID */
  id: string;
  /** Section grouping */
  section: string;
  /** Human-readable description */
  text: string;
}

/** Framework-specific terminology */
export interface Terminology {
  /** What regulated data is called (PHI, PII, cardholder data) */
  sensitive_data: string;
  /** Entity that must comply (Covered Entity, Data Controller, Merchant) */
  covered_entity: string;
  /** Third party that processes data (Business Associate, Data Processor, Service Provider) */
  processor: string;
  /** What the agreement with processors is called (BAA, DPA, Service Agreement) */
  processor_agreement: string;
}

/** Framework-specific threshold values */
export interface Thresholds {
  /** Minimum log retention in days */
  log_retention_days: number;
  /** Minimum backup retention in days */
  backup_retention_days: number;
  /** Maximum session timeout in minutes */
  session_timeout_minutes: number;
  /** Maximum key rotation period in days */
  key_rotation_days: number;
  /** Minimum password length */
  password_min_length: number;
  /** Maximum credential age in days before rotation */
  credential_max_age_days: number;
}

/** Complete framework definition (display metadata — OSCAL mapping is the source of truth) */
export interface FrameworkDefinition {
  /** Unique framework identifier (e.g., "hipaa", "soc2", "gdpr") */
  id: string;
  /** Human-readable name (e.g., "HIPAA Security Rule") */
  name: string;
  /** Version of this definition */
  version: string;
  /** Legal disclaimer text */
  disclaimer: string;
  /** Framework-specific terminology */
  terminology: Terminology;
  /** Framework-specific threshold values */
  thresholds: Thresholds;
  /** All requirements in this framework */
  requirements: Requirement[];
  /** Checklist items for progress tracking */
  checklist: ChecklistItem[];
  /** OSCAL profile ID that drives this framework's checks and assessments */
  oscal_profile?: string;
}
