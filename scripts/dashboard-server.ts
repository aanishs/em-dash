#!/usr/bin/env bun
/**
 * em-dash compliance dashboard server.
 *
 * Serves the static dashboard site, handles evidence uploads,
 * and pushes live-reload events via WebSocket when .em-dash/ changes.
 *
 * Usage: bun run dashboard [--port 3000] [--project-dir .]
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
const PORT = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3000;
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

const server = Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // API: read dashboard config
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
      return handleExportCsv();
    }

    // API: export as HTML report
    if (url.pathname === '/api/export/report' && req.method === 'GET') {
      return handleExportReport();
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

function handleExportCsv(): Response {
  const dashboard = readDashboard();
  const findings = dashboard.frameworks?.hipaa?.findings || [];

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

function handleExportReport(): Response {
  const d = readDashboard();
  const fw = d.frameworks?.hipaa || {};
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
<strong>Disclaimer:</strong> This report provides technical guidance for HIPAA compliance. It is NOT legal advice and does not constitute HIPAA certification. Consult qualified legal counsel for formal compliance verification.
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
  fs.writeFileSync(DASHBOARD_JSON, JSON.stringify(data, null, 2) + '\n');
}

// ─── Startup ────────────────────────────────────────────────

console.log(`em-dash dashboard: http://localhost:${server.port}`);
console.log(`  project: ${PROJECT_DIR}`);
console.log(`  config:  ${DASHBOARD_JSON}`);
console.log(`  evidence: ${EVIDENCE_DIR}`);
