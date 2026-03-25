/**
 * Patient service tests.
 *
 * Uses obviously fake test data — never use real PHI or realistic SSN patterns.
 */

const testPatients = [
  { id: '1', ssn: 'FAKE-SSN-001', name: 'Test User Alpha', diagnosis: 'Test Condition A' },
  { id: '2', ssn: 'FAKE-SSN-002', name: 'Test User Beta', diagnosis: 'Test Condition B' },
  { id: '3', ssn: 'FAKE-SSN-003', name: 'Test User Gamma', diagnosis: 'Test Condition C', insurance: 'TEST-INS-001' },
];

describe('PatientService', () => {
  it('should return patient with all PHI fields', () => {
    const patient = getPatient('1');
    expect(patient.ssn).toBe('FAKE-SSN-001');
    expect(patient.diagnosis).toBe('Test Condition A');
  });

  it('should update patient diagnosis', () => {
    const updated = updatePatient('1', { diagnosis: 'Test Condition A-Updated' });
    expect(updated.diagnosis).toBe('Test Condition A-Updated');
  });
});

function getPatient(id: string) { return testPatients.find(p => p.id === id); }
function updatePatient(id: string, data: any) { return { ...getPatient(id), ...data }; }
