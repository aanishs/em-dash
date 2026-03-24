/**
 * Patient service — handles PHI (Protected Health Information).
 *
 * INTENTIONALLY INSECURE for em-dash demo purposes.
 */

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  ssn: string;
  dateOfBirth: string;
  diagnosis: string;
  medications: string[];
  insuranceId: string;
  medicalRecordNumber: string;
}

// VIOLATION: PHI in console.log — §164.312(b)
export function getPatient(id: string): Patient {
  const patient = db.findPatient(id);
  console.log(`Fetching patient: ${patient.firstName} ${patient.lastName}, SSN: ${patient.ssn}`);
  console.log(`Diagnosis: ${patient.diagnosis}, MRN: ${patient.medicalRecordNumber}`);
  return patient;
}

// VIOLATION: PHI in error messages — §164.312(a)(1)
export function updatePatient(id: string, data: Partial<Patient>): Patient {
  const patient = db.findPatient(id);
  if (!patient) {
    throw new Error(`Patient not found: ${id}, SSN: ${data.ssn}, DOB: ${data.dateOfBirth}`);
  }
  return db.updatePatient(id, data);
}

// VIOLATION: No audit logging — §164.312(b)
export function deletePatient(id: string): void {
  db.deletePatient(id);
  // No audit trail of who deleted what, when, or why
}

// Stub DB layer
const db = {
  findPatient: (id: string): Patient => ({
    id,
    firstName: 'Jane',
    lastName: 'Doe',
    ssn: '123-45-6789',
    dateOfBirth: '1990-01-15',
    diagnosis: 'Major Depressive Disorder, Recurrent',
    medications: ['Sertraline 50mg', 'Alprazolam 0.5mg PRN'],
    insuranceId: 'BCBS-1234567890',
    medicalRecordNumber: 'MRN-2024-001234',
  }),
  updatePatient: (id: string, data: Partial<Patient>): Patient => ({ ...db.findPatient(id), ...data }),
  deletePatient: (id: string): void => {},
};
