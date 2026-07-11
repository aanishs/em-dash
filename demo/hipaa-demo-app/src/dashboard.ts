/**
 * Frontend dashboard — patient data display.
 *
 * INTENTIONALLY INSECURE for em-dash demo purposes.
 */

// VIOLATION: PHI stored in localStorage — §164.312(a)(1)
export function cachePatientData(patient: any): void {
  localStorage.setItem('currentPatient', JSON.stringify(patient));
  localStorage.setItem(`patient_${patient.id}`, JSON.stringify({
    ssn: patient.ssn,
    diagnosis: patient.diagnosis,
    medications: patient.medications,
  }));
}

// VIOLATION: PHI in URL parameters — §164.312(a)(1)
export function buildPatientUrl(patient: any): string {
  return `/patients?name=${patient.firstName}+${patient.lastName}&ssn=${patient.ssn}&mrn=${patient.medicalRecordNumber}`;
}

// VIOLATION: PHI in push notifications — §164.312(a)(1)
export function sendAppointmentReminder(patient: any): void {
  new Notification(`Appointment: ${patient.firstName} ${patient.lastName}`, {
    body: `Diagnosis: ${patient.diagnosis}. Meds: ${patient.medications.join(', ')}`,
  });
}
