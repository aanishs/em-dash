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

export function getPatient(id: string): Patient {
  const patient = db.findPatient(id);
  // Log only non-PHI identifiers — never log SSN, diagnosis, or other PHI
  console.log(`Fetching patient id=${id}`);
  return patient;
}

export function updatePatient(id: string, data: Partial<Patient>): Patient {
  const patient = db.findPatient(id);
  if (!patient) {
    // Never include PHI in error messages — use only the opaque ID
    throw new Error(`Patient not found: ${id}`);
  }
  return db.updatePatient(id, data);
}

export function deletePatient(id: string, userId?: string): void {
  auditLog({ userId: userId ?? 'unknown', action: 'DELETE', resourceType: 'patient', resourceId: id });
  db.deletePatient(id);
}

// Audit log stub — replace with a real audit service in production
function auditLog(entry: { userId: string; action: string; resourceType: string; resourceId: string }) {
  const record = { ...entry, timestamp: new Date().toISOString() };
  // Write to structured audit log — never include PHI, only identifiers
  console.log(`[AUDIT] ${JSON.stringify(record)}`);
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
