/**
 * Frontend dashboard — patient data display.
 *
 * PHI is never stored client-side or exposed in URLs/notifications.
 */

// Cache only non-PHI session metadata — never store SSN, diagnosis, etc. client-side
export function cachePatientSession(patientId: string, sessionExpiry: string): void {
  localStorage.setItem('currentPatientSession', JSON.stringify({
    id: patientId,
    expiresAt: sessionExpiry,
  }));
}

// Use opaque IDs in URLs — never include PHI in query parameters
export function buildPatientUrl(patientId: string): string {
  return `/patients/${patientId}`;
}

// Push notifications must not contain PHI — use generic text
export function sendAppointmentReminder(patientId: string): void {
  new Notification('Appointment Reminder', {
    body: 'You have an upcoming appointment. Open the app for details.',
  });
}
