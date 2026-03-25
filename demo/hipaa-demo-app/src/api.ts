/**
 * API routes — patient endpoints.
 *
 * Secured with RBAC and audit logging per HIPAA §164.312(a)(1) and §164.312(b).
 */

import { getPatient, updatePatient, deletePatient } from './patients';

// Role-based access control middleware — restrict PHI access by role
function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      auditLog(req, 'ACCESS_DENIED', req.params?.id ?? 'N/A');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Audit logging middleware — records who accessed what PHI, when
function auditLog(req: any, action: string, resourceId: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    userId: req.user?.id ?? 'anonymous',
    action,
    resourceType: 'patient',
    resourceId,
    ip: req.ip,
  };
  // Write to structured audit log — never include PHI, only identifiers
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

export function setupRoutes(app: any) {
  // GET patient — requires 'provider' or 'admin' role
  app.get('/api/patients/:id', requireRole('provider', 'admin'), (req: any, res: any) => {
    try {
      auditLog(req, 'READ', req.params.id);
      const patient = getPatient(req.params.id);
      res.json(patient);
    } catch (err: any) {
      // Return generic error — never expose PHI or stack traces to client
      console.error(`[ERROR] GET /api/patients/${req.params.id}: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // UPDATE patient — requires 'provider' or 'admin' role
  app.put('/api/patients/:id', requireRole('provider', 'admin'), (req: any, res: any) => {
    try {
      auditLog(req, 'UPDATE', req.params.id);
      const patient = updatePatient(req.params.id, req.body);
      res.json(patient);
    } catch (err: any) {
      console.error(`[ERROR] PUT /api/patients/${req.params.id}: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE patient — requires 'admin' role only
  app.delete('/api/patients/:id', requireRole('admin'), (req: any, res: any) => {
    try {
      auditLog(req, 'DELETE', req.params.id);
      deletePatient(req.params.id, req.user?.id);
      res.status(204).send();
    } catch (err: any) {
      console.error(`[ERROR] DELETE /api/patients/${req.params.id}: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Bulk export — admin only, with audit trail
  app.get('/api/patients/export/all', requireRole('admin'), (req: any, res: any) => {
    auditLog(req, 'EXPORT_ALL', 'bulk');
    res.json({ patients: [] });
  });
}
