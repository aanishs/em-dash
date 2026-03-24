/**
 * OSCAL bridge API.
 *
 * Provides the integration layer between NIST OSCAL controls and
 * em-dash's framework/check system. This module is the entry point
 * for all OSCAL-related operations.
 */

export {
  loadHipaaMapping,
  getHipaaOscalControlIds,
  getHipaaRequirementIds,
  findControl,
  findControlsForRequirement,
  validateCheckReferences,
} from './parser';

export type {
  OscalControl,
  MappedControl,
  HipaaMapping,
} from './parser';
