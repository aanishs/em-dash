/**
 * Patient service tests.
 *
 * INTENTIONALLY INSECURE for em-dash demo purposes.
 */

// VIOLATION: Real SSN patterns in test fixtures — §164.502
const testPatients = [
  { id: '1', ssn: '123-45-6789', name: 'John Smith', diagnosis: 'Bipolar I Disorder' },
  { id: '2', ssn: '987-65-4321', name: 'Jane Doe', diagnosis: 'PTSD' },
  { id: '3', ssn: '456-78-9012', name: 'Bob Johnson', diagnosis: 'OCD', insurance: 'BCBS-9876543210' },
];

describe('PatientService', () => {
  it('should return patient with all PHI fields', () => {
    const patient = getPatient('1');
    expect(patient.ssn).toBe('123-45-6789');
    expect(patient.diagnosis).toBe('Bipolar I Disorder');
  });

  it('should update patient diagnosis', () => {
    const updated = updatePatient('1', { diagnosis: 'Bipolar II Disorder' });
    expect(updated.diagnosis).toBe('Bipolar II Disorder');
  });
});

function getPatient(id: string) { return testPatients.find(p => p.id === id); }
function updatePatient(id: string, data: any) { return { ...getPatient(id), ...data }; }
