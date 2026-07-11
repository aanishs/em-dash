/**
 * API routes — patient endpoints.
 *
 * INTENTIONALLY INSECURE for em-dash demo purposes.
 */

import { getPatient, updatePatient, deletePatient } from './patients';

// VIOLATION: No RBAC — any authenticated user can access any patient — §164.312(a)(1)
// VIOLATION: No audit logging on PHI endpoints — §164.312(b)
export function setupRoutes(app: any) {
  // No role check — receptionist can see therapy notes
  app.get('/api/patients/:id', (req: any, res: any) => {
    try {
      const patient = getPatient(req.params.id);
      res.json(patient);
    } catch (err: any) {
      // VIOLATION: PHI leaks in error responses — §164.312(a)(1)
      res.status(500).json({
        error: err.message, // Contains SSN, DOB from the error thrown in patients.ts
        stack: err.stack,   // Stack trace in production
      });
    }
  });

  app.put('/api/patients/:id', (req: any, res: any) => {
    const patient = updatePatient(req.params.id, req.body);
    res.json(patient);
  });

  app.delete('/api/patients/:id', (req: any, res: any) => {
    deletePatient(req.params.id);
    res.status(204).send();
  });

  // VIOLATION: Bulk export with no access control — §164.308(a)(4)
  app.get('/api/patients/export/all', (req: any, res: any) => {
    // No pagination, no RBAC, no audit trail
    res.json({ patients: [] });
  });
}
