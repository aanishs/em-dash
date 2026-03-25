#!/usr/bin/env bun
/**
 * em-dash compliance dashboard server.
 *
 * Serves the static dashboard site, handles evidence uploads,
 * and pushes live-reload events via WebSocket when .em-dash/ changes.
 *
 * Usage: bun run dashboard [--port 3000] [--project-dir .]
 *        PORT=3001 bun run dashboard  # also works via env var
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(import.meta.dir, '..');
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');

// Parse CLI args
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : parseInt(process.env.PORT || '3000', 10);
const dirIdx = args.indexOf('--project-dir');
const PROJECT_DIR = dirIdx !== -1 ? path.resolve(args[dirIdx + 1]) : process.cwd();
const EMDASH_DIR = path.join(PROJECT_DIR, '.em-dash');
const EVIDENCE_DIR = path.join(EMDASH_DIR, 'evidence');
const DASHBOARD_JSON = path.join(EMDASH_DIR, 'dashboard.json');

// Ensure directories exist
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// ─── WebSocket clients ──────────────────────────────────────

const wsClients = new Set<any>();

function broadcast(event: string, data?: any) {
  const msg = JSON.stringify({ event, data });
  for (const ws of wsClients) {
    try { ws.send(msg); } catch { wsClients.delete(ws); }
  }
}

// ─── File watcher ───────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

fs.watch(EMDASH_DIR, { recursive: true }, (_event, filename) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    broadcast('reload', { file: filename });
  }, 300);
});

// ─── MIME types ─────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

function getMime(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// ─── Server ─────────────────────────────────────────────────

let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // API: active frameworks
    if (url.pathname === '/api/frameworks' && req.method === 'GET') {
      const active = getActiveFrameworks();
      const available = ['hipaa', 'soc2', 'gdpr', 'pci-dss', 'cis', 'iso27001'];
      return Response.json({ active, available });
    }

    // API: cross-framework compliance matrix (scoped to active frameworks)
    if (url.pathname === '/api/cross-framework' && req.method === 'GET') {
      try {
        const { buildCrossFrameworkMatrix } = require(path.join(ROOT, 'nist', 'cross-framework.ts'));
        const active = getActiveFrameworks();
        return Response.json(buildCrossFrameworkMatrix(active.length > 0 ? active : undefined));
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // API: compliance data from SQLite (v2 architecture)
    if (url.pathname === '/api/compliance' && req.method === 'GET') {
      return handleComplianceQuery(url);
    }

    // API: read dashboard config (legacy)
    if (url.pathname === '/api/dashboard' && req.method === 'GET') {
      const data = readDashboard();
      return Response.json(data);
    }

    // API: update dashboard (full state write)
    if (url.pathname === '/api/dashboard' && req.method === 'PUT') {
      return handleDashboardUpdate(req);
    }

    // API: upload evidence
    if (url.pathname === '/api/upload' && req.method === 'POST') {
      return handleUpload(req);
    }

    // API: delete evidence
    if (url.pathname.startsWith('/api/evidence/') && req.method === 'DELETE') {
      const filename = decodeURIComponent(url.pathname.slice('/api/evidence/'.length));
      return handleEvidenceDelete(filename);
    }

    // API: serve evidence files
    if (url.pathname.startsWith('/api/evidence/')) {
      const filename = decodeURIComponent(url.pathname.slice('/api/evidence/'.length));
      const filePath = path.join(EVIDENCE_DIR, filename);
      if (!filePath.startsWith(EVIDENCE_DIR)) return new Response('Forbidden', { status: 403 });
      try {
        const file = Bun.file(filePath);
        return new Response(file, { headers: { 'content-type': getMime(filePath) } });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    // API: activity feed
    if (url.pathname === '/api/activity' && req.method === 'GET') {
      return handleGetActivity();
    }

    // API: open file/folder in system file manager
    if (url.pathname === '/api/open' && req.method === 'POST') {
      return handleOpen(req);
    }

    // API: export as CSV (findings)
    if (url.pathname === '/api/export/csv' && req.method === 'GET') {
      const fw = url.searchParams.get('framework') || 'hipaa';
      return handleExportCsv(fw);
    }

    // API: export as HTML report
    if (url.pathname === '/api/export/report' && req.method === 'GET') {
      const fw = url.searchParams.get('framework') || 'hipaa';
      return handleExportReport(fw);
    }

    // ─── New Orchestration API ─────────────────────────────────

    // API: compliance score with per-family breakdown
    if (url.pathname === '/api/compliance/score' && req.method === 'GET') {
      return handleComplianceScore();
    }

    // API: active findings from all tools
    if (url.pathname === '/api/compliance/findings' && req.method === 'GET') {
      return handleComplianceFindings(url);
    }

    // API: compliance drift since last baseline
    if (url.pathname === '/api/compliance/drift' && req.method === 'GET') {
      return handleComplianceDrift();
    }

    // API: available scanning tools
    if (url.pathname === '/api/tools' && req.method === 'GET') {
      return handleToolsList();
    }

    // API: trigger orchestrator scan
    if (url.pathname === '/api/scan/trigger' && req.method === 'POST') {
      return handleScanTrigger();
    }

    // API: scan status
    if (url.pathname === '/api/scan/status' && req.method === 'GET') {
      return handleScanStatus();
    }

    // Static files from dashboard/
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fullPath = path.join(DASHBOARD_DIR, filePath);
    if (!fullPath.startsWith(DASHBOARD_DIR)) return new Response('Forbidden', { status: 403 });

    try {
      const file = Bun.file(fullPath);
      return new Response(file, { headers: { 'content-type': getMime(fullPath) } });
    } catch {
      // SPA fallback
      const index = Bun.file(path.join(DASHBOARD_DIR, 'index.html'));
      return new Response(index, { headers: { 'content-type': 'text/html' } });
    }
  },

  websocket: {
    open(ws) { wsClients.add(ws); },
    close(ws) { wsClients.delete(ws); },
    message() {},
  },
});
} catch (err: any) {
  if (err?.code === 'EADDRINUSE') {
    const who = spawnSync('lsof', ['-ti', `:${PORT}`], { encoding: 'utf-8' });
    const pid = who.stdout?.trim();
    console.error(`Error: Port ${PORT} is already in use${pid ? ` (PID ${pid})` : ''}.`);
    console.error(`\nOptions:`);
    console.error(`  PORT=${PORT + 1} bun run dashboard     # use a different port`);
    console.error(`  kill ${pid || '<PID>'}                          # stop the existing server`);
    process.exit(1);
  }
  throw err;
}

// ─── Upload handler ─────────────────────────────────────────

async function handleUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const framework = (formData.get('framework') as string) || 'hipaa';
    const requirement = (formData.get('requirement') as string) || '';
    const evidenceType = (formData.get('type') as string) || 'other';

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(EVIDENCE_DIR, safeName);

    // Write file
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Compute SHA-256
    const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

    // Update dashboard.json
    const dashboard = readDashboard();
    if (!dashboard.evidence) dashboard.evidence = { files: [] };

    // Remove existing entry for same filename
    dashboard.evidence.files = dashboard.evidence.files.filter(
      (f: any) => f.filename !== safeName
    );

    dashboard.evidence.files.push({
      filename: safeName,
      type: evidenceType,
      framework,
      requirement,
      uploaded_at: new Date().toISOString(),
      sha256: hash,
    });

    writeDashboard(dashboard);
    broadcast('reload', { file: safeName });

    return Response.json({ ok: true, filename: safeName, sha256: hash });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ─── Evidence delete handler ────────────────────────────────

function handleEvidenceDelete(filename: string): Response {
  try {
    const filePath = path.join(EVIDENCE_DIR, filename);
    if (!filePath.startsWith(EVIDENCE_DIR)) return new Response('Forbidden', { status: 403 });

    // Remove file from disk
    try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }

    // Remove from dashboard.json
    const dashboard = readDashboard();
    if (dashboard.evidence?.files) {
      dashboard.evidence.files = dashboard.evidence.files.filter(
        (f: any) => f.filename !== filename
      );
    }

    // Remove from any checklist item evidence arrays
    for (const fw of Object.values(dashboard.frameworks || {})) {
      for (const item of ((fw as any).checklist || [])) {
        if (item.evidence) {
          item.evidence = item.evidence.filter((e: string) => e !== filename);
        }
      }
    }

    writeDashboard(dashboard);
    broadcast('reload', { source: 'evidence-delete' });

    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ─── Dashboard update handler ───────────────────────────────

async function handleDashboardUpdate(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    // Ensure version is set
    if (!data.version) data.version = 2;
    writeDashboard(data);
    broadcast('reload', { source: 'api' });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ─── Activity handler ───────────────────────────────────────

function handleGetActivity(): Response {
  const dashboard = readDashboard();
  const events: any[] = [];

  // Collect evidence upload events
  for (const f of (dashboard.evidence?.files || [])) {
    if (f.uploaded_at) {
      events.push({
        type: 'evidence-upload',
        text: `Evidence uploaded: ${f.filename}`,
        timestamp: f.uploaded_at,
      });
    }
  }

  // Collect skill run events
  for (const [fwName, fw] of Object.entries(dashboard.frameworks || {} as any)) {
    for (const [skillName, skill] of Object.entries((fw as any).skills || {})) {
      if ((skill as any).timestamp) {
        events.push({
          type: 'skill-run',
          text: `${skillName} ${(skill as any).status}${(skill as any).findings != null ? `: ${(skill as any).findings} findings` : ''}`,
          timestamp: (skill as any).timestamp,
        });
      }
    }

    // Collect finding events
    for (const f of ((fw as any).findings || [])) {
      if (f.discovered_at) {
        events.push({
          type: 'finding',
          text: `Finding [${f.severity}]: ${f.title}`,
          timestamp: f.resolved_at || f.discovered_at,
        });
      }
    }
  }

  // Collect risk events
  for (const r of (dashboard.risk_register || [])) {
    if (r.created_at) {
      events.push({
        type: 'risk-change',
        text: `Risk identified: ${r.description.slice(0, 80)}`,
        timestamp: r.updated_at || r.created_at,
      });
    }
  }

  // Collect vendor events
  for (const v of (dashboard.vendors || [])) {
    if (v.created_at) {
      events.push({
        type: 'vendor',
        text: `Vendor added: ${v.name} (BAA: ${v.baa_status})`,
        timestamp: v.created_at,
      });
    }
  }

  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return Response.json(events.slice(0, 50));
}

// ─── Open in Finder handler ─────────────────────────────────

async function handleOpen(req: Request): Promise<Response> {
  try {
    const { target } = await req.json() as { target: string };

    let openPath: string;
    if (target === 'evidence') {
      openPath = EVIDENCE_DIR;
    } else if (target === 'artifacts') {
      // Open ~/.em-dash/projects/{slug}/ if it exists
      const dashboard = readDashboard();
      const slug = dashboard.project?.slug || 'unknown';
      openPath = path.join(os.homedir(), '.em-dash', 'projects', slug);
      if (!fs.existsSync(openPath)) openPath = EMDASH_DIR;
    } else if (target === 'folder') {
      openPath = EMDASH_DIR;
    } else {
      // Treat as filename in evidence dir
      openPath = path.join(EVIDENCE_DIR, target);
    }

    // Security: only allow paths within .em-dash/ or ~/.em-dash/
    const homeEmDash = path.join(os.homedir(), '.em-dash');
    if (!openPath.startsWith(EMDASH_DIR) && !openPath.startsWith(homeEmDash)) {
      return Response.json({ error: 'Path not allowed' }, { status: 403 });
    }

    if (!fs.existsSync(openPath)) {
      return Response.json({ error: 'Path not found' }, { status: 404 });
    }

    // Cross-platform open
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer' : 'xdg-open';
    spawnSync(cmd, [openPath], { stdio: 'ignore' });

    return Response.json({ ok: true, path: openPath });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ─── Export handlers ────────────────────────────────────────

function handleExportCsv(frameworkId: string = 'hipaa'): Response {
  const dashboard = readDashboard();
  const findings = dashboard.frameworks?.[frameworkId]?.findings || [];

  const header = 'ID,Title,Severity,Status,Requirement,Source,Discovered,Resolved,Description';
  const rows = findings.map((f: any) =>
    [f.id, csvEscape(f.title), f.severity, f.status, f.requirement, f.source,
     f.discovered_at || '', f.resolved_at || '', csvEscape(f.description || '')].join(',')
  );

  const csv = [header, ...rows].join('\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': 'attachment; filename="em-dash-findings.csv"',
    },
  });
}

function csvEscape(s: string): string {
  if (!s) return '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function handleExportReport(frameworkId: string = 'hipaa'): Response {
  const d = readDashboard();
  const fw = d.frameworks?.[frameworkId] || {};
  const checklist = fw.checklist || [];
  const findings = fw.findings || [];
  const vendors = d.vendors || [];
  const risks = d.risk_register || [];
  const evidence = d.evidence?.files || [];
  const gaps = fw.evidence_gaps || [];

  const complete = checklist.filter((i: any) => i.status === 'complete').length;
  const total = checklist.length;
  const pct = total ? Math.round((complete / total) * 100) : 0;

  const openFindings = findings.filter((f: any) => f.status !== 'resolved');
  const critCount = openFindings.filter((f: any) => f.severity === 'critical').length;
  const highCount = openFindings.filter((f: any) => f.severity === 'high').length;

  const sections = new Map<string, any[]>();
  for (const item of checklist) {
    const sec = item.section || 'General';
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(item);
  }

  let checklistHtml = '';
  for (const [section, items] of sections) {
    const secComplete = items.filter((i: any) => i.status === 'complete').length;
    checklistHtml += `<h3>${esc(section)} (${secComplete}/${items.length})</h3><table><tr><th>ID</th><th>Requirement</th><th>Status</th><th>Evidence</th><th>Notes</th></tr>`;
    for (const item of items) {
      const status = item.status === 'complete' ? '<span style="color:green">&#10003;</span>' : '<span style="color:red">&#10007;</span>';
      checklistHtml += `<tr><td><code>${esc(item.id)}</code></td><td>${esc(item.text)}</td><td>${status}</td><td>${(item.evidence||[]).map((e:string) => esc(e)).join(', ') || '—'}</td><td>${esc(item.notes || '')}</td></tr>`;
    }
    checklistHtml += '</table>';
  }

  let findingsHtml = '';
  if (findings.length) {
    findingsHtml = '<table><tr><th>Severity</th><th>Title</th><th>Status</th><th>Requirement</th><th>Source</th></tr>';
    for (const f of findings) {
      const color = f.severity === 'critical' ? '#dc2626' : f.severity === 'high' ? '#ea580c' : f.severity === 'medium' ? '#ca8a04' : '#2563eb';
      findingsHtml += `<tr><td><span style="background:${color};color:white;padding:2px 6px;border-radius:3px;font-size:11px">${esc(f.severity).toUpperCase()}</span></td><td>${esc(f.title)}</td><td>${esc(f.status)}</td><td><code>${esc(f.requirement)}</code></td><td>${esc(f.source)}</td></tr>`;
    }
    findingsHtml += '</table>';
  }

  let vendorsHtml = '';
  if (vendors.length) {
    vendorsHtml = '<table><tr><th>Vendor</th><th>Service</th><th>BAA Status</th><th>Risk Tier</th><th>Expiry</th></tr>';
    for (const v of vendors) {
      const baaColor = v.baa_status === 'signed' ? 'green' : v.baa_status === 'pending' ? '#ca8a04' : '#dc2626';
      vendorsHtml += `<tr><td>${esc(v.name)}</td><td>${esc(v.service)}</td><td><span style="color:${baaColor}">${esc(v.baa_status)}</span></td><td>${esc(v.risk_tier)}</td><td>${esc(v.baa_expiry || '—')}</td></tr>`;
    }
    vendorsHtml += '</table>';
  }

  let risksHtml = '';
  if (risks.length) {
    const sorted = [...risks].sort((a: any, b: any) => b.score - a.score);
    risksHtml = '<table><tr><th>Score</th><th>Risk</th><th>Treatment</th><th>Owner</th></tr>';
    for (const r of sorted) {
      const color = r.score >= 15 ? '#dc2626' : r.score >= 8 ? '#ea580c' : r.score >= 4 ? '#ca8a04' : '#16a34a';
      risksHtml += `<tr><td><span style="background:${color};color:white;padding:2px 8px;border-radius:3px;font-weight:bold">${r.score}</span></td><td>${esc(r.description)}</td><td>${esc(r.treatment)}</td><td>${esc(r.owner)}</td></tr>`;
    }
    risksHtml += '</table>';
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>em-dash Compliance Report</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;max-width:900px;margin:0 auto;padding:2rem;color:#1a1a1a;line-height:1.6}
h1{border-bottom:2px solid #2563eb;padding-bottom:0.5rem}
h2{margin-top:2rem;color:#2563eb}
h3{margin-top:1.5rem;color:#444}
table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.85rem}
th,td{border:1px solid #e5e5e5;padding:0.4rem 0.6rem;text-align:left}
th{background:#f5f5f5;font-weight:600}
code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.85em}
.summary{display:flex;gap:2rem;margin:1rem 0;flex-wrap:wrap}
.stat{text-align:center}
.stat-value{font-size:2rem;font-weight:700}
.stat-label{font-size:0.8rem;color:#666;text-transform:uppercase}
.disclaimer{margin-top:3rem;padding:1rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:0.85rem;color:#92400e}
@media print{body{padding:0.5in}}
</style></head><body>
<h1>em-dash Compliance Report</h1>
<p><strong>Project:</strong> ${esc(d.project?.name || 'Unknown')} &mdash; Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

<div class="summary">
<div class="stat"><div class="stat-value">${pct}%</div><div class="stat-label">Compliant</div></div>
<div class="stat"><div class="stat-value">${complete}/${total}</div><div class="stat-label">Requirements</div></div>
<div class="stat"><div class="stat-value">${openFindings.length}</div><div class="stat-label">Open Findings</div></div>
<div class="stat"><div class="stat-value">${evidence.length}</div><div class="stat-label">Evidence Files</div></div>
<div class="stat"><div class="stat-value">${vendors.length}</div><div class="stat-label">Vendors</div></div>
<div class="stat"><div class="stat-value">${risks.length}</div><div class="stat-label">Risks</div></div>
</div>

${critCount + highCount > 0 ? `<p style="color:#dc2626;font-weight:600">&#9888; ${critCount} critical and ${highCount} high severity findings require immediate attention.</p>` : ''}

<h2>Requirements Checklist</h2>
${checklistHtml}

<h2>Findings (${findings.length})</h2>
${findingsHtml || '<p>No findings recorded.</p>'}

<h2>Business Associates (${vendors.length})</h2>
${vendorsHtml || '<p>No vendors tracked.</p>'}

<h2>Risk Register (${risks.length})</h2>
${risksHtml || '<p>No risks identified.</p>'}

${gaps.length ? `<h2>Evidence Gaps (${gaps.length})</h2><ul>${gaps.map((g:any) => `<li><strong>${esc(g.requirement)}</strong>: ${esc(g.description)}</li>`).join('')}</ul>` : ''}

<h2>Evidence Index (${evidence.length})</h2>
${evidence.length ? `<table><tr><th>File</th><th>Type</th><th>Requirement</th><th>Uploaded</th><th>SHA-256</th></tr>${evidence.map((e:any) => `<tr><td>${esc(e.filename)}</td><td>${esc(e.type)}</td><td><code>${esc(e.requirement)}</code></td><td>${esc(e.uploaded_at?.split('T')[0] || '')}</td><td><code>${esc((e.sha256||'').slice(0,16))}...</code></td></tr>`).join('')}</table>` : '<p>No evidence uploaded.</p>'}

<div class="disclaimer">
<strong>Disclaimer:</strong> This report provides technical guidance for compliance. It is NOT legal advice and does not constitute certification. Consult qualified legal counsel for formal compliance verification.
</div>
</body></html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html',
      'content-disposition': 'attachment; filename="em-dash-compliance-report.html"',
    },
  });
}

function esc(s: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── SQLite compliance API (v2) ─────────────────────────────

function handleComplianceQuery(url: URL): Response {
  try {
    const { Database } = require('bun:sqlite');
    const slug = getProjectSlug();
    const dbPath = path.join(process.env.HOME ?? '', '.em-dash', 'projects', slug, 'compliance.db');

    if (!fs.existsSync(dbPath)) {
      return Response.json({ error: 'No compliance database. Run: bin/comply-db init --framework hipaa', controls: [], summary: null }, { status: 404 });
    }

    const db = new Database(dbPath, { readonly: true });
    const view = url.searchParams.get('view') || 'summary';

    if (view === 'summary') {
      const controls = db.prepare('SELECT oscal_id, title, family, status, framework_refs FROM controls ORDER BY family, oscal_id').all();
      const total = controls.length;
      const complete = controls.filter((c: any) => c.status === 'complete').length;
      const partial = controls.filter((c: any) => c.status === 'partial').length;
      const pending = controls.filter((c: any) => c.status === 'pending').length;
      const checks = db.prepare('SELECT result, COUNT(*) as cnt FROM check_results GROUP BY result').all();
      const evidenceCount = (db.prepare('SELECT COUNT(*) as cnt FROM evidence').get() as any)?.cnt || 0;
      const sigCount = (db.prepare('SELECT COUNT(*) as cnt FROM signatures').get() as any)?.cnt || 0;

      db.close();
      return Response.json({
        controls,
        summary: { total, complete, partial, pending, pct: total > 0 ? Math.round((complete / total) * 100) : 0 },
        checks,
        evidence_count: evidenceCount,
        signature_count: sigCount,
      });
    }

    if (view === 'control') {
      const controlId = url.searchParams.get('id');
      if (!controlId) { db.close(); return Response.json({ error: 'Missing ?id= parameter' }, { status: 400 }); }
      const ctrl = db.prepare('SELECT * FROM controls WHERE oscal_id = ?').get(controlId);
      const checks = db.prepare('SELECT * FROM check_results WHERE control_id = ? ORDER BY created_at DESC').all(controlId);
      const evidence = db.prepare('SELECT * FROM evidence WHERE control_id = ? ORDER BY created_at DESC').all(controlId);
      const sigs = db.prepare('SELECT * FROM signatures WHERE control_id = ? ORDER BY created_at DESC').all(controlId);
      db.close();
      return Response.json({ control: ctrl, checks, evidence, signatures: sigs });
    }

    db.close();
    return Response.json({ error: 'Unknown view. Use ?view=summary or ?view=control&id=AC-2' }, { status: 400 });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// ─── Orchestration API handlers ──────────────────────────────

function getActiveFrameworks(): string[] {
  const db = openComplianceDb();
  if (!db) return [];
  try {
    const row = db.prepare("SELECT value FROM metadata WHERE key = 'active_frameworks'").get() as any;
    if (!row) {
      const legacy = db.prepare("SELECT value FROM metadata WHERE key = 'framework'").get() as any;
      return legacy ? [legacy.value] : [];
    }
    return JSON.parse(row.value);
  } catch {
    return [];
  } finally {
    try { db.close(); } catch {}
  }
}

function openComplianceDb(): any {
  const { Database } = require('bun:sqlite');
  const slug = getProjectSlug();
  const dbPath = path.join(process.env.HOME ?? '', '.em-dash', 'projects', slug, 'compliance.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true });
}

function handleComplianceScore(): Response {
  try {
    const db = openComplianceDb();
    if (!db) return Response.json({ error: 'No compliance database' }, { status: 404 });

    const controls = db.prepare('SELECT oscal_id, family, status FROM controls').all() as any[];
    const total = controls.length;
    const complete = controls.filter((c: any) => c.status === 'complete').length;
    const score = total > 0 ? Math.round((complete / total) * 100) : 0;

    // Per-family breakdown
    const families: Record<string, { total: number; complete: number; partial: number; pending: number }> = {};
    for (const c of controls) {
      if (!families[c.family]) families[c.family] = { total: 0, complete: 0, partial: 0, pending: 0 };
      families[c.family].total++;
      const status = (c.status === 'complete' || c.status === 'partial') ? c.status : 'pending';
      families[c.family][status]++;
    }

    db.close();
    return Response.json({ score, total, complete, families });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function handleComplianceFindings(url: URL): Response {
  try {
    const db = openComplianceDb();
    if (!db) return Response.json({ error: 'No compliance database' }, { status: 404 });

    const tool = url.searchParams.get('tool');
    const result = url.searchParams.get('result') || 'FAIL';
    const limit = parseInt(url.searchParams.get('limit') || '100') || 100;

    let query = 'SELECT cr.*, c.title as control_title, c.family FROM check_results cr JOIN controls c ON cr.control_id = c.oscal_id WHERE cr.result = ?';
    const params: any[] = [result];

    if (tool) {
      query += ' AND cr.tool = ?';
      params.push(tool);
    }

    query += ' ORDER BY cr.created_at DESC LIMIT ?';
    params.push(limit);

    const findings = db.prepare(query).all(...params);
    const totalCount = (db.prepare('SELECT COUNT(*) as cnt FROM check_results WHERE result = ?').get(result) as any)?.cnt || 0;

    db.close();
    return Response.json({ findings, total: totalCount, filter: { tool, result, limit } });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function handleComplianceDrift(): Response {
  try {
    const db = openComplianceDb();
    if (!db) return Response.json({ error: 'No compliance database' }, { status: 404 });

    // Get latest two distinct scan timestamps to compare
    const timestamps = db.prepare(
      'SELECT DISTINCT substr(created_at, 1, 19) as ts FROM check_results ORDER BY created_at DESC LIMIT 2'
    ).all() as any[];

    if (timestamps.length < 2) {
      db.close();
      return Response.json({ drift: [], message: 'Need at least 2 scans to compute drift' });
    }

    const [current, previous] = [timestamps[0].ts, timestamps[1].ts];

    // Get results for each scan period
    const currentResults = db.prepare(
      'SELECT control_id, tool, check_id, result FROM check_results WHERE created_at >= ?'
    ).all(current) as any[];

    const previousResults = db.prepare(
      'SELECT control_id, tool, check_id, result FROM check_results WHERE created_at >= ? AND created_at < ?'
    ).all(previous, current) as any[];

    // Build maps: control_id → result
    const currentMap = new Map<string, string>();
    const previousMap = new Map<string, string>();
    for (const r of currentResults) currentMap.set(`${r.control_id}:${r.check_id}`, r.result);
    for (const r of previousResults) previousMap.set(`${r.control_id}:${r.check_id}`, r.result);

    // Compute drift
    const drift: any[] = [];
    const allKeys = new Set([...currentMap.keys(), ...previousMap.keys()]);
    for (const key of allKeys) {
      const cur = currentMap.get(key);
      const prev = previousMap.get(key);
      const [controlId, checkId] = key.split(':');

      if (!prev && cur) {
        drift.push({ control_id: controlId, check_id: checkId, type: 'NEW', result: cur });
      } else if (prev === 'PASS' && cur === 'FAIL') {
        drift.push({ control_id: controlId, check_id: checkId, type: 'REGRESSION', from: prev, to: cur });
      } else if (prev === 'FAIL' && cur === 'PASS') {
        drift.push({ control_id: controlId, check_id: checkId, type: 'FIXED', from: prev, to: cur });
      }
    }

    // Include cross-framework scores from latest baseline if available
    let crossFrameworkScores = null;
    try {
      const baseline = db.prepare('SELECT cross_framework_scores FROM compliance_baselines ORDER BY snapshot_at DESC LIMIT 1').get() as any;
      if (baseline?.cross_framework_scores) crossFrameworkScores = JSON.parse(baseline.cross_framework_scores);
    } catch {}

    db.close();
    return Response.json({
      drift,
      summary: {
        regressions: drift.filter(d => d.type === 'REGRESSION').length,
        fixed: drift.filter(d => d.type === 'FIXED').length,
        new_findings: drift.filter(d => d.type === 'NEW').length,
      },
      compared: { current, previous },
      cross_framework_scores: crossFrameworkScores,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function handleToolsList(): Response {
  try {
    const tools = ['prowler', 'checkov', 'trivy', 'kics', 'semgrep', 'kube-bench', 'scoutsuite', 'lynis'];
    const results: any[] = [];

    for (const tool of tools) {
      const binary = tool === 'scoutsuite' ? 'python3' : tool;
      const which = spawnSync(binary, ['--version'], { timeout: 5000 });
      const installed = which.status === 0;
      const version = installed ? (which.stdout?.toString().trim().split('\n')[0] || 'unknown') : null;
      results.push({ name: tool, installed, version });
    }

    return Response.json({ tools: results, available: results.filter(t => t.installed).length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Scan state — tracks active scan PID
let activeScan: { pid: number; startedAt: string } | null = null;

function handleScanTrigger(): Response {
  if (activeScan) {
    // Check if scan is still running
    try {
      process.kill(activeScan.pid, 0); // signal 0 = check if process exists
      return Response.json(
        { error: 'Scan already in progress', scan: activeScan },
        { status: 409 }
      );
    } catch {
      // Process no longer running — clear stale state
      activeScan = null;
    }
  }

  try {
    // Set sentinel immediately to prevent TOCTOU race on concurrent requests
    const startedAt = new Date().toISOString();
    activeScan = { pid: -1, startedAt };

    let proc;
    try {
      const orchestratorPath = path.join(ROOT, 'bin', 'comply-orchestrate');
      proc = Bun.spawn(['bun', orchestratorPath, 'scan'], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, NO_COLOR: '1' },
      });
    } catch (spawnErr: any) {
      activeScan = null;
      return Response.json({ error: 'Failed to start scan: ' + spawnErr.message }, { status: 500 });
    }

    activeScan = { pid: proc.pid, startedAt };

    // Clean up when scan finishes
    proc.exited.then(() => {
      broadcast('scan_complete', { pid: proc.pid });
      activeScan = null;
    });

    return Response.json({ status: 'started', scan: activeScan });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function handleScanStatus(): Response {
  if (activeScan) {
    try {
      process.kill(activeScan.pid, 0);
      return Response.json({ status: 'running', scan: activeScan });
    } catch {
      activeScan = null;
    }
  }
  return Response.json({ status: 'idle', scan: null });
}

function getProjectSlug(): string {
  try {
    const proc = spawnSync(path.join(ROOT, 'bin', 'comply-slug'), { cwd: PROJECT_DIR });
    const match = proc.stdout?.toString().match(/SLUG=(\S+)/);
    if (match) return match[1];
  } catch {}
  return path.basename(PROJECT_DIR);
}

// ─── Helpers ────────────────────────────────────────────────

function readDashboard(): any {
  try {
    const data = JSON.parse(fs.readFileSync(DASHBOARD_JSON, 'utf-8'));
    return migrateDashboard(data);
  } catch {
    return { version: 2, project: {}, frameworks: {}, evidence: { files: [] }, risk_register: [], vendors: [] };
  }
}

function migrateDashboard(data: any): any {
  if (!data.version || data.version < 2) {
    data.version = 2;
    if (!data.risk_register) data.risk_register = [];
    if (!data.vendors) data.vendors = [];
    for (const fw of Object.values(data.frameworks || {})) {
      if (!(fw as any).findings) (fw as any).findings = [];
    }
  }
  return data;
}

function writeDashboard(data: any) {
  // Atomic write: temp file → rename (prevents corruption from concurrent writes)
  const tmpPath = DASHBOARD_JSON + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmpPath, DASHBOARD_JSON);
}

// ─── Startup ────────────────────────────────────────────────

console.log(`em-dash dashboard: http://localhost:${server.port}`);
console.log(`  project: ${PROJECT_DIR}`);
console.log(`  config:  ${DASHBOARD_JSON}`);
console.log(`  evidence: ${EVIDENCE_DIR}`);
