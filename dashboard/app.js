/* em-dash compliance dashboard */

(function () {
  'use strict';

  let dashboard = {};
  let activeFilter = 'all';
  let evidencePage = 0;
  let evidenceSearch = '';
  let findingsFilter = 'all';
  let risksView = 'matrix';
  let charts = {};
  const EVIDENCE_PER_PAGE = 10;

  // ─── Init ───────────────────────────────────────────────

  async function init() {
    // Configure Chart.js defaults
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
      Chart.defaults.font.size = 11;
      Chart.defaults.color = getCSSVar('--text-secondary') || '#666';
    }

    await fetchDashboard();
    render();
    setupSidebar();
    setupUpload();
    setupCustomModal();
    setupEvidenceEditModal();
    setupFindingModal();
    setupRiskModal();
    setupVendorModal();
    setupRiskViewToggle();
    setupEvidenceSearch();
    setupOpenFinder();
    connectWebSocket();
  }

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/dashboard');
      dashboard = await res.json();
    } catch {
      dashboard = { version: 2, project: {}, frameworks: {}, evidence: { files: [] }, risk_register: [], vendors: [] };
    }
    // Ensure v2 fields exist
    if (!dashboard.risk_register) dashboard.risk_register = [];
    if (!dashboard.vendors) dashboard.vendors = [];
    for (const fw of Object.values(dashboard.frameworks || {})) {
      if (!fw.findings) fw.findings = [];
    }
  }

  // ─── Sidebar Navigation ──────────────────────────────────

  let activeSection = 'overview';

  function setupSidebar() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchSection(item.dataset.section);
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
      });
    });

    // Mobile toggle
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }

    // Close sidebar on content click (mobile)
    document.getElementById('content').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
    });
  }

  function switchSection(section) {
    activeSection = section;
    // Update nav
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });
    // Show/hide pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === 'page-' + section);
    });
  }

  function updateNavBadges() {
    const fw = dashboard.frameworks?.hipaa || {};
    const findings = (fw.findings || []).filter(f => f.status !== 'resolved');
    const badge = document.getElementById('nav-findings-badge');
    if (badge) badge.textContent = findings.length || '';

    const checklist = fw.checklist || [];
    const complete = checklist.filter(i => i.status === 'complete').length;
    const clBadge = document.getElementById('nav-checklist-badge');
    if (clBadge) clBadge.textContent = complete + '/' + checklist.length;

    const risks = (dashboard.risk_register || []).filter(r => r.status !== 'closed');
    const rBadge = document.getElementById('nav-risks-badge');
    if (rBadge) rBadge.textContent = risks.length || '';
  }

  // ─── Styled Confirm Dialog ──────────────────────────────

  function showConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;

      const okBtn = document.getElementById('confirm-ok');
      const cancelBtn = document.getElementById('confirm-cancel');

      function cleanup() {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modal.close();
      }
      function onOk() { cleanup(); resolve(true); }
      function onCancel() { cleanup(); resolve(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modal.showModal();
    });
  }

  // ─── Open in Finder ─────────────────────────────────────

  function setupOpenFinder() {
    const btn = document.getElementById('open-finder-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        fetch('/api/open', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ target: 'folder' }),
        });
      });
    }
  }

  function revealFile(filename) {
    fetch('/api/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: filename }),
    });
  }

  // ─── Render ───────────────────────────────────────────────

  function render() {
    renderHeader();
    renderNLSummary();
    renderPipeline();
    renderSummaryCharts();
    renderFindings();
    renderChecklist();
    renderEvidence();
    renderRiskRegister();
    renderVendors();
    renderGaps();
    renderActivity();
    updateNavBadges();
  }

  function renderHeader() {
    const el = document.getElementById('project-name');
    const proj = dashboard.project || {};
    const frameworks = Object.keys(dashboard.frameworks || {});
    const lastUpdated = dashboard.frameworks?.hipaa?.last_updated;
    const updatedText = lastUpdated ? ` \u00b7 Updated ${timeAgo(lastUpdated)}` : '';
    el.textContent = proj.name
      ? `${proj.name} \u2014 ${frameworks.map(f => f.toUpperCase()).join(', ') || 'No frameworks'}${updatedText}`
      : 'No project configured. Run /hipaa to get started.';

    // Score
    const score = computeScore();
    document.getElementById('score-text').textContent = score + '%';
    document.getElementById('ring-fill').setAttribute('stroke-dasharray', `${score}, 100`);

    const ring = document.getElementById('ring-fill');
    if (score >= 80) ring.style.stroke = 'var(--green)';
    else if (score >= 50) ring.style.stroke = 'var(--yellow)';
    else ring.style.stroke = 'var(--red)';
  }

  function computeScore() {
    const frameworks = dashboard.frameworks || {};
    let total = 0, checked = 0;
    for (const fw of Object.values(frameworks)) {
      const items = fw.checklist || [];
      total += items.length;
      checked += items.filter(i => i.status === 'complete').length;
    }
    return total === 0 ? 0 : Math.round((checked / total) * 100);
  }

  function renderPipeline() {
    const el = document.getElementById('pipeline');
    const frameworks = dashboard.frameworks || {};
    const fwKeys = Object.keys(frameworks);

    if (fwKeys.length === 0) {
      el.innerHTML = '<div class="empty-state">Run <code>/hipaa</code> to initialize your first compliance framework.</div>';
      return;
    }

    let html = '';
    for (const fwName of fwKeys) {
      const fw = frameworks[fwName];
      const skills = fw.skills || {};
      const steps = ['assess', 'scan', 'remediate', 'report', 'monitor', 'breach'];
      const icons = { complete: '\u2713', 'in-progress': '\u25CB', pending: '\u2013', 'not-needed': '\u2013' };
      const labels = { assess: 'Assess', scan: 'Scan', remediate: 'Remediate', report: 'Report', monitor: 'Monitor', breach: 'Breach' };

      for (const step of steps) {
        const s = skills[step] || { status: 'pending' };
        const cls = s.status === 'complete' ? 'complete' : s.status === 'in-progress' ? 'in-progress' : 'pending';
        const meta = s.findings != null ? `${s.findings} findings` : '';
        const when = s.timestamp ? timeAgo(s.timestamp) : '';
        const summary = s.summary ? escapeHtml(s.summary) : '';
        html += `
          <div class="pipeline-step ${cls}">
            <div class="pipeline-icon">${icons[s.status] || icons.pending}</div>
            <div class="pipeline-name">${labels[step]}</div>
            ${when ? `<div class="pipeline-meta">${when}</div>` : ''}
            ${meta ? `<div class="pipeline-meta">${meta}</div>` : ''}
            ${summary ? `<div class="pipeline-summary">${summary}</div>` : ''}
          </div>`;
      }
    }

    // Next step recommendation
    const nextStep = computeNextStep(frameworks);
    if (nextStep) {
      html += `<div class="next-step">${nextStep}</div>`;
    }

    el.innerHTML = html;
  }

  function computeNextStep(frameworks) {
    const fw = frameworks.hipaa || {};
    const skills = fw.skills || {};
    const findings = (fw.findings || []).filter(f => f.status !== 'resolved');
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const highs = findings.filter(f => f.severity === 'high').length;

    if (!skills.assess || skills.assess.status === 'pending') return 'Next: Run <code>/hipaa-assess</code> to start your compliance assessment.';
    if (!skills.scan || skills.scan.status === 'pending') return 'Next: Run <code>/hipaa-scan</code> to scan your code and infrastructure.';
    if (findings.length > 0 && (!skills.remediate || skills.remediate.status !== 'complete')) {
      return `Next: Run <code>/hipaa-remediate</code> to fix ${findings.length} open findings${criticals ? ` (${criticals} critical)` : ''}.`;
    }
    if (!skills.report || skills.report.status === 'pending') return 'Next: Run <code>/hipaa-report</code> to generate your compliance report.';
    if (!skills.monitor || skills.monitor.status === 'pending') return 'Next: Run <code>/hipaa-monitor</code> to check for compliance drift.';
    return 'All up to date. Run <code>/hipaa-monitor</code> periodically to detect drift.';
  }

  // ─── Natural Language Summary ────────────────────────────

  function renderNLSummary() {
    let el = document.getElementById('nl-summary');
    if (!el) {
      // Create element if not in HTML
      const pipelineSection = document.getElementById('pipeline-section');
      if (!pipelineSection) return;
      el = document.createElement('div');
      el.id = 'nl-summary';
      el.className = 'nl-summary';
      pipelineSection.parentNode.insertBefore(el, pipelineSection);
    }

    const fw = dashboard.frameworks?.hipaa || {};
    const checklist = fw.checklist || [];
    const findings = (fw.findings || []).filter(f => f.status !== 'resolved');
    const vendors = dashboard.vendors || [];
    const risks = dashboard.risk_register || [];
    const evidence = dashboard.evidence?.files || [];

    const total = checklist.length;
    const complete = checklist.filter(i => i.status === 'complete').length;
    const pct = total ? Math.round((complete / total) * 100) : 0;

    const criticals = findings.filter(f => f.severity === 'critical').length;
    const highs = findings.filter(f => f.severity === 'high').length;
    const missingBAA = vendors.filter(v => v.baa_status === 'none' && !v.notes?.includes('not process PHI')).length;
    const topRisk = risks.filter(r => r.status !== 'closed').sort((a, b) => b.score - a.score)[0];

    if (total === 0) {
      el.innerHTML = '<p>No compliance data yet. Run <code>/hipaa</code> to initialize your HIPAA dashboard.</p>';
      return;
    }

    let parts = [];
    parts.push(`Your HIPAA compliance is <strong>${pct}%</strong> (${complete}/${total} requirements).`);

    if (findings.length > 0) {
      let findingText = `${findings.length} open finding${findings.length !== 1 ? 's' : ''}`;
      if (criticals) findingText += ` (${criticals} critical)`;
      else if (highs) findingText += ` (${highs} high)`;
      parts.push(findingText + '.');
    } else {
      parts.push('No open findings.');
    }

    if (missingBAA > 0) {
      const names = vendors.filter(v => v.baa_status === 'none' && !v.notes?.includes('not process PHI')).map(v => v.name);
      parts.push(`${missingBAA} vendor${missingBAA !== 1 ? 's' : ''} missing BAA (${names.slice(0, 2).join(', ')}${names.length > 2 ? '...' : ''}).`);
    }

    if (topRisk && topRisk.score >= 15) {
      parts.push(`Top risk: ${topRisk.description.slice(0, 60)} (score ${topRisk.score}).`);
    }

    parts.push(`${evidence.length} evidence file${evidence.length !== 1 ? 's' : ''} uploaded.`);

    el.innerHTML = `<p>${parts.join(' ')}</p>`;
  }

  // ─── Summary Charts ──────────────────────────────────────

  function renderSummaryCharts() {
    if (typeof Chart === 'undefined') return;
    const canvas1 = document.getElementById('chart-sections');
    const canvas2 = document.getElementById('chart-findings');
    const canvas3 = document.getElementById('chart-evidence');
    if (!canvas1) return;

    // Destroy existing charts
    Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
    charts = {};

    const frameworks = dashboard.frameworks || {};

    // Chart 1: Checklist by Section (horizontal stacked bar)
    const sectionStats = {};
    for (const fw of Object.values(frameworks)) {
      for (const item of (fw.checklist || [])) {
        const sec = item.section || 'General';
        if (!sectionStats[sec]) sectionStats[sec] = { complete: 0, pending: 0 };
        if (item.status === 'complete') sectionStats[sec].complete++;
        else sectionStats[sec].pending++;
      }
    }

    const sectionLabels = Object.keys(sectionStats);
    const shortLabels = sectionLabels.map(s =>
      s.replace(' Safeguards', '').replace(' Requirements', '').replace('Requirements', 'Req.')
    );

    if (sectionLabels.length > 0) {
      charts.sections = new Chart(canvas1, {
        type: 'bar',
        data: {
          labels: shortLabels,
          datasets: [
            { label: 'Complete', data: sectionLabels.map(s => sectionStats[s].complete), backgroundColor: getCSSVar('--green') || '#16a34a' },
            { label: 'Pending', data: sectionLabels.map(s => sectionStats[s].pending), backgroundColor: getCSSVar('--border') || '#e5e5e5' },
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { stacked: true, display: false },
            y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }
          }
        }
      });
    }

    // Chart 2: Findings by Severity (doughnut)
    const findings = getAllFindings();
    const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (sevCounts[f.severity] !== undefined) sevCounts[f.severity]++;
    }

    const hasFindings = findings.length > 0;
    charts.findings = new Chart(canvas2, {
      type: 'doughnut',
      data: {
        labels: hasFindings ? ['Critical', 'High', 'Medium', 'Low'] : ['No findings'],
        datasets: [{
          data: hasFindings ? [sevCounts.critical, sevCounts.high, sevCounts.medium, sevCounts.low] : [1],
          backgroundColor: hasFindings
            ? ['#dc2626', '#ea580c', '#ca8a04', '#2563eb']
            : [getCSSVar('--border') || '#e5e5e5'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } } },
        cutout: '55%'
      }
    });

    // Chart 3: Evidence Coverage (doughnut)
    let withEvidence = 0, withoutEvidence = 0;
    for (const fw of Object.values(frameworks)) {
      for (const item of (fw.checklist || [])) {
        if ((item.evidence || []).length > 0) withEvidence++;
        else withoutEvidence++;
      }
    }

    const hasItems = (withEvidence + withoutEvidence) > 0;
    charts.evidence = new Chart(canvas3, {
      type: 'doughnut',
      data: {
        labels: hasItems ? ['With Evidence', 'No Evidence'] : ['No items'],
        datasets: [{
          data: hasItems ? [withEvidence, withoutEvidence] : [1],
          backgroundColor: hasItems
            ? [getCSSVar('--green') || '#16a34a', getCSSVar('--border') || '#e5e5e5']
            : [getCSSVar('--border') || '#e5e5e5'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } } },
        cutout: '55%'
      }
    });
  }

  function getAllFindings() {
    const findings = [];
    for (const fw of Object.values(dashboard.frameworks || {})) {
      findings.push(...(fw.findings || []));
    }
    return findings;
  }

  // ─── Findings ─────────────────────────────────────────────

  function renderFindings() {
    const el = document.getElementById('findings-list');
    const summaryEl = document.getElementById('findings-summary');
    const filtersEl = document.getElementById('findings-filters');
    if (!el) return;

    const findings = getAllFindings();

    if (findings.length === 0) {
      summaryEl.innerHTML = '';
      filtersEl.innerHTML = '';
      el.innerHTML = '<div class="empty-state">No findings yet. Run <code>/hipaa-scan</code> to detect issues.</div>';
      return;
    }

    // Summary bar
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (counts[f.severity] !== undefined) counts[f.severity]++;
    }
    summaryEl.innerHTML = `
      <span class="severity-count critical">${counts.critical} Critical</span>
      <span class="severity-count high">${counts.high} High</span>
      <span class="severity-count medium">${counts.medium} Medium</span>
      <span class="severity-count low">${counts.low} Low</span>
    `;

    // Severity filter tabs
    const severities = ['all', 'critical', 'high', 'medium', 'low'];
    filtersEl.innerHTML = severities.map(s =>
      `<button class="filter-tab ${s === findingsFilter ? 'active' : ''}" data-severity="${s}">${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>`
    ).join('');

    filtersEl.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        findingsFilter = btn.dataset.severity;
        renderFindings();
      });
    });

    // Filter
    const filtered = findingsFilter === 'all' ? findings : findings.filter(f => f.severity === findingsFilter);

    if (filtered.length === 0) {
      el.innerHTML = '<div class="empty-state">No findings match this filter.</div>';
      return;
    }

    // Find evidence files that match finding requirements
    const evidenceFiles = dashboard.evidence?.files || [];

    el.innerHTML = filtered.map(f => {
      const linkedEvidence = evidenceFiles.filter(e => e.requirement === f.requirement);
      const discoveredDate = f.discovered_at ? formatDate(f.discovered_at) : '';
      const resolvedDate = f.resolved_at ? formatDate(f.resolved_at) : '';

      return `
      <div class="finding-item" data-id="${escapeHtml(f.id)}">
        <span class="severity-badge ${f.severity}">${escapeHtml(f.severity)}</span>
        <div class="finding-content">
          <div class="finding-title finding-toggle">${escapeHtml(f.title)}</div>
          <div class="finding-meta">${escapeHtml(f.requirement || '')}${f.source ? ' \u00b7 ' + escapeHtml(f.source) : ''}${discoveredDate ? ' \u00b7 ' + discoveredDate : ''}</div>
          <div class="finding-details" hidden>
            ${f.description ? `<div class="finding-desc">${escapeHtml(f.description)}</div>` : ''}
            <div class="finding-dates">
              ${discoveredDate ? `<span>Discovered: ${discoveredDate}</span>` : ''}
              ${resolvedDate ? `<span> \u00b7 Resolved: ${resolvedDate}</span>` : ''}
            </div>
            ${linkedEvidence.length ? `<div class="finding-evidence">Evidence: ${linkedEvidence.map(e => `<a href="/api/evidence/${encodeURIComponent(e.filename)}" class="evidence-tag" target="_blank">${escapeHtml(e.filename)}</a>`).join(' ')}</div>` : '<div class="finding-evidence">No evidence linked</div>'}
          </div>
        </div>
        <select class="finding-status" data-id="${escapeHtml(f.id)}">
          <option value="open" ${f.status === 'open' ? 'selected' : ''}>Open</option>
          <option value="in-progress" ${f.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </div>`;
    }).join('');

    // Toggle expand/collapse
    el.querySelectorAll('.finding-toggle').forEach(title => {
      title.addEventListener('click', () => {
        const details = title.closest('.finding-content').querySelector('.finding-details');
        if (details) details.hidden = !details.hidden;
      });
    });

    // Status change handlers
    el.querySelectorAll('.finding-status').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        await updateFindingStatus(id, e.target.value);
      });
    });
  }

  async function updateFindingStatus(id, status) {
    for (const fw of Object.values(dashboard.frameworks || {})) {
      const finding = (fw.findings || []).find(f => f.id === id);
      if (finding) {
        finding.status = status;
        if (status === 'resolved') finding.resolved_at = new Date().toISOString();
        break;
      }
    }
    await saveDashboard();
  }

  // ─── Checklist ────────────────────────────────────────────

  function renderChecklist() {
    const el = document.getElementById('checklist');
    const filtersEl = document.getElementById('checklist-filters');
    const frameworks = dashboard.frameworks || {};
    const fwKeys = Object.keys(frameworks);

    if (fwKeys.length === 0) {
      el.innerHTML = '';
      filtersEl.innerHTML = '';
      return;
    }

    // Collect all checklist items across frameworks
    let items = [];
    for (const fwName of fwKeys) {
      const fw = frameworks[fwName];
      for (const item of (fw.checklist || [])) {
        items.push({ ...item, framework: fwName });
      }
    }

    // Collect sections for filter tabs with progress counts
    const sectionCounts = {};
    for (const item of items) {
      const sec = item.section || 'General';
      if (!sectionCounts[sec]) sectionCounts[sec] = { total: 0, done: 0 };
      sectionCounts[sec].total++;
      if (item.status === 'complete') sectionCounts[sec].done++;
    }

    const sections = ['all', ...new Set(items.map(i => i.section).filter(Boolean))];
    const totalDone = items.filter(i => i.status === 'complete').length;

    filtersEl.innerHTML = sections.map(s => {
      const progress = s === 'all'
        ? `<span class="tab-progress">${totalDone}/${items.length}</span>`
        : sectionCounts[s]
          ? `<span class="tab-progress">${sectionCounts[s].done}/${sectionCounts[s].total}</span>`
          : '';
      return `<button class="filter-tab ${s === activeFilter ? 'active' : ''}" data-section="${s}">${s === 'all' ? 'All' : s}${progress}</button>`;
    }).join('');

    filtersEl.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.section;
        renderChecklist();
      });
    });

    // Filter
    const filtered = activeFilter === 'all' ? items : items.filter(i => i.section === activeFilter);

    // Group by section
    const groups = {};
    for (const item of filtered) {
      const sec = item.section || 'General';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(item);
    }

    let html = '';
    for (const [section, sectionItems] of Object.entries(groups)) {
      if (activeFilter === 'all') {
        html += `<div class="checklist-group-header">${escapeHtml(section)}</div>`;
      }
      for (const item of sectionItems) {
        const checked = item.status === 'complete';
        const evidenceTags = (item.evidence || []).map(e =>
          `<a href="/api/evidence/${encodeURIComponent(e)}" class="evidence-tag" target="_blank">${escapeHtml(e)}<button class="unlink-btn" data-item-id="${escapeHtml(item.id)}" data-fw="${escapeHtml(item.framework)}" data-file="${escapeHtml(e)}">\u00d7</button></a>`
        ).join('');
        html += `
          <div class="checklist-item ${checked ? 'checked' : ''}" data-id="${escapeHtml(item.id)}" data-framework="${escapeHtml(item.framework)}">
            <input type="checkbox" ${checked ? 'checked' : ''}>
            <div class="checklist-item-content">
              <div class="checklist-item-text">
                ${escapeHtml(item.text)}
                ${item.custom ? '<span class="custom-badge">custom</span>' : ''}
              </div>
              <div class="checklist-item-id">${escapeHtml(item.id)}</div>
              <div class="checklist-item-evidence">
                ${evidenceTags}
                <button class="evidence-link-btn" data-item-id="${escapeHtml(item.id)}" data-fw="${escapeHtml(item.framework)}">+</button>
              </div>
              ${item.notes ? `<div class="checklist-item-notes">${escapeHtml(item.notes)}</div>` : ''}
              <div class="checklist-item-actions">
                <button class="notes-btn" data-item-id="${escapeHtml(item.id)}" data-fw="${escapeHtml(item.framework)}">${item.notes ? 'edit note' : 'add note'}</button>
              </div>
            </div>
          </div>`;
      }
    }

    if (filtered.length === 0) {
      html = '<div class="empty-state">No checklist items yet.</div>';
    }

    el.innerHTML = html;

    // Checkbox handlers
    el.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const item = e.target.closest('.checklist-item');
        const id = item.dataset.id;
        const fw = item.dataset.framework;
        await toggleChecklistItem(fw, id, e.target.checked);
      });
    });

    // Evidence unlink handlers
    el.querySelectorAll('.unlink-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const fw = btn.dataset.fw;
        const file = btn.dataset.file;
        await unlinkEvidence(fw, itemId, file);
      });
    });

    // Evidence link handlers
    el.querySelectorAll('.evidence-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEvidenceLinkDropdown(btn, btn.dataset.itemId, btn.dataset.fw);
      });
    });

    // Notes button handlers
    el.querySelectorAll('.notes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleNotesEditor(btn, btn.dataset.itemId, btn.dataset.fw);
      });
    });
  }

  async function toggleChecklistItem(framework, id, checked) {
    const fw = dashboard.frameworks?.[framework];
    if (!fw) return;
    const item = (fw.checklist || []).find(i => i.id === id);
    if (item) {
      item.status = checked ? 'complete' : 'pending';
    }
    await saveDashboard();
    render();
  }

  async function unlinkEvidence(framework, itemId, filename) {
    const fw = dashboard.frameworks?.[framework];
    if (!fw) return;
    const item = (fw.checklist || []).find(i => i.id === itemId);
    if (item && item.evidence) {
      item.evidence = item.evidence.filter(e => e !== filename);
    }
    await saveDashboard();
    render();
  }

  function showEvidenceLinkDropdown(btn, itemId, framework) {
    // Remove any existing dropdown
    const existing = document.querySelector('.evidence-link-select');
    if (existing) existing.remove();

    const files = (dashboard.evidence?.files || []).map(f => f.filename);
    if (files.length === 0) return;

    // Get already linked files
    const fw = dashboard.frameworks?.[framework];
    const item = fw ? (fw.checklist || []).find(i => i.id === itemId) : null;
    const linked = item?.evidence || [];
    const available = files.filter(f => !linked.includes(f));

    if (available.length === 0) return;

    const select = document.createElement('select');
    select.className = 'evidence-link-select';
    select.innerHTML = `<option value="">Link evidence...</option>` +
      available.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

    btn.parentElement.insertBefore(select, btn);

    select.focus();
    select.addEventListener('change', async () => {
      if (select.value) {
        if (item) {
          if (!item.evidence) item.evidence = [];
          item.evidence.push(select.value);
          await saveDashboard();
          render();
        }
      }
      select.remove();
    });
    select.addEventListener('blur', () => select.remove());
  }

  function toggleNotesEditor(btn, itemId, framework) {
    const contentEl = btn.closest('.checklist-item-content');
    const existing = contentEl.querySelector('.notes-edit');
    if (existing) {
      existing.remove();
      return;
    }

    const fw = dashboard.frameworks?.[framework];
    const item = fw ? (fw.checklist || []).find(i => i.id === itemId) : null;
    if (!item) return;

    const textarea = document.createElement('textarea');
    textarea.className = 'notes-edit';
    textarea.value = item.notes || '';
    textarea.placeholder = 'Add a note (justification, N/A reason, follow-up)...';

    contentEl.appendChild(textarea);
    textarea.focus();

    textarea.addEventListener('blur', async () => {
      const newNotes = textarea.value.trim();
      item.notes = newNotes;
      await saveDashboard();
      render();
    });
  }

  // ─── Evidence ─────────────────────────────────────────────

  function renderEvidence() {
    const el = document.getElementById('evidence-list');
    const pagEl = document.getElementById('evidence-pagination');
    let files = dashboard.evidence?.files || [];

    // Apply search filter
    if (evidenceSearch) {
      const q = evidenceSearch.toLowerCase();
      files = files.filter(f =>
        f.filename.toLowerCase().includes(q) ||
        (f.type || '').toLowerCase().includes(q) ||
        (f.requirement || '').toLowerCase().includes(q)
      );
    }

    if (files.length === 0) {
      el.innerHTML = `<div class="empty-state">${evidenceSearch ? 'No evidence matches your search.' : 'No evidence uploaded yet.'}</div>`;
      pagEl.innerHTML = '';
      return;
    }

    // Pagination
    const totalPages = Math.ceil(files.length / EVIDENCE_PER_PAGE);
    if (evidencePage >= totalPages) evidencePage = totalPages - 1;
    if (evidencePage < 0) evidencePage = 0;
    const start = evidencePage * EVIDENCE_PER_PAGE;
    const pageFiles = files.slice(start, start + EVIDENCE_PER_PAGE);

    const typeIcons = {
      baa: 'BAA', policy: 'POL', screenshot: 'IMG', 'scan-result': 'SCN',
      config: 'CFG', training: 'TRN', other: 'DOC'
    };

    el.innerHTML = pageFiles.map(f => `
      <div class="evidence-item" data-filename="${escapeHtml(f.filename)}">
        <div class="evidence-icon">${typeIcons[f.type] || 'DOC'}</div>
        <div class="evidence-item-content">
          <div class="evidence-item-name"><a href="/api/evidence/${encodeURIComponent(f.filename)}" target="_blank">${escapeHtml(f.filename)}</a></div>
          <div class="evidence-item-meta">
            ${escapeHtml(f.requirement || '')} &middot; ${formatDate(f.uploaded_at)} &middot;
            <span class="type-badge ${f.type}">${escapeHtml(f.type)}</span>
            ${f.sha256 ? ` &middot; <span title="${escapeHtml(f.sha256)}">SHA ${escapeHtml(f.sha256.slice(0, 8))}</span>` : ''}
          </div>
        </div>
        <div class="evidence-item-actions">
          <button class="reveal-btn" data-filename="${escapeHtml(f.filename)}">Reveal</button>
          <button class="evidence-action-btn edit" data-filename="${escapeHtml(f.filename)}">Edit</button>
          <button class="evidence-action-btn delete" data-filename="${escapeHtml(f.filename)}">Delete</button>
        </div>
      </div>
    `).join('');

    // Pagination controls
    if (totalPages > 1) {
      pagEl.innerHTML = `
        <button class="page-btn" id="prev-page" ${evidencePage === 0 ? 'disabled' : ''}>\u2190 Prev</button>
        <span class="page-info">${evidencePage + 1} / ${totalPages}</span>
        <button class="page-btn" id="next-page" ${evidencePage >= totalPages - 1 ? 'disabled' : ''}>Next \u2192</button>
      `;
      document.getElementById('prev-page')?.addEventListener('click', () => { evidencePage--; renderEvidence(); });
      document.getElementById('next-page')?.addEventListener('click', () => { evidencePage++; renderEvidence(); });
    } else {
      pagEl.innerHTML = '';
    }

    // Reveal handlers
    el.querySelectorAll('.reveal-btn').forEach(btn => {
      btn.addEventListener('click', () => revealFile(btn.dataset.filename));
    });

    // Edit handlers
    el.querySelectorAll('.evidence-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => openEvidenceEditModal(btn.dataset.filename));
    });

    // Delete handlers
    el.querySelectorAll('.evidence-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await showConfirm('Delete Evidence', `Delete "${btn.dataset.filename}"? This cannot be undone.`);
        if (!ok) return;
        await deleteEvidence(btn.dataset.filename);
      });
    });
  }

  async function deleteEvidence(filename) {
    try {
      await fetch(`/api/evidence/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      await fetchDashboard();
      render();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  function openEvidenceEditModal(filename) {
    const file = (dashboard.evidence?.files || []).find(f => f.filename === filename);
    if (!file) return;

    document.getElementById('evidence-edit-filename').value = filename;
    document.getElementById('evidence-edit-type').value = file.type || 'other';
    document.getElementById('evidence-edit-requirement').value = file.requirement || '';
    document.getElementById('evidence-edit-modal').showModal();
  }

  // ─── Risk Register ───────────────────────────────────────

  function renderRiskRegister() {
    const matrixEl = document.getElementById('risk-matrix');
    const tableEl = document.getElementById('risk-table');
    if (!matrixEl || !tableEl) return;

    const risks = dashboard.risk_register || [];

    if (risks.length === 0) {
      const emptyHtml = '<div class="empty-state">No risks identified. Add risks from your HIPAA risk analysis.</div>';
      matrixEl.innerHTML = risksView === 'matrix' ? emptyHtml : '';
      tableEl.innerHTML = risksView === 'table' ? emptyHtml : '';
      matrixEl.hidden = risksView !== 'matrix';
      tableEl.hidden = risksView !== 'table';
      return;
    }

    // Matrix view
    if (risksView === 'matrix') {
      matrixEl.hidden = false;
      tableEl.hidden = true;
      renderRiskMatrix(matrixEl, risks);
    } else {
      matrixEl.hidden = true;
      tableEl.hidden = false;
      renderRiskTable(tableEl, risks);
    }
  }

  function renderRiskMatrix(el, risks) {
    // Build risk map: "likelihood-impact" -> count
    const riskMap = {};
    for (const r of risks) {
      const key = `${r.likelihood}-${r.impact}`;
      if (!riskMap[key]) riskMap[key] = 0;
      riskMap[key]++;
    }

    let html = '<div class="matrix-container">';
    html += '<div class="matrix-axis-label">Likelihood \u2191</div>';
    html += '<div class="matrix-grid">';

    // Header row: corner + impact labels
    html += '<div class="matrix-corner"></div>';
    for (let i = 1; i <= 5; i++) {
      html += `<div class="matrix-header">${i}</div>`;
    }

    // Rows: likelihood 5 (top) down to 1 (bottom)
    for (let l = 5; l >= 1; l--) {
      html += `<div class="matrix-row-label">${l}</div>`;
      for (let i = 1; i <= 5; i++) {
        const score = l * i;
        const color = score >= 15 ? 'critical' : score >= 8 ? 'high' : score >= 4 ? 'moderate' : 'low';
        const key = `${l}-${i}`;
        const count = riskMap[key] || 0;
        html += `<div class="matrix-cell ${color}">${count > 0 ? count : ''}</div>`;
      }
    }

    html += '</div>';
    html += '<div class="matrix-axis-label">Impact \u2192</div>';
    html += '</div>';

    el.innerHTML = html;
  }

  function renderRiskTable(el, risks) {
    let html = '<div class="risk-table-list">';
    for (const r of risks) {
      const score = (r.likelihood || 1) * (r.impact || 1);
      const color = score >= 15 ? 'critical' : score >= 8 ? 'high' : score >= 4 ? 'moderate' : 'low';
      html += `
        <div class="risk-row" data-id="${escapeHtml(r.id)}">
          <div class="risk-score ${color}">${score}</div>
          <div class="risk-content">
            <div class="risk-desc">${escapeHtml(r.description)}</div>
            <div class="risk-meta">L${r.likelihood} \u00d7 I${r.impact}${r.owner ? ' \u00b7 ' + escapeHtml(r.owner) : ''}${(r.requirement_ids || []).length ? ' \u00b7 ' + escapeHtml(r.requirement_ids.join(', ')) : ''}</div>
          </div>
          <span class="risk-treatment-badge ${r.treatment || 'mitigate'}">${escapeHtml(r.treatment || 'mitigate')}</span>
          <div class="risk-row-actions">
            <button class="evidence-action-btn edit" data-risk-id="${escapeHtml(r.id)}">Edit</button>
            <button class="evidence-action-btn delete" data-risk-id="${escapeHtml(r.id)}">Delete</button>
          </div>
        </div>`;
    }
    html += '</div>';
    el.innerHTML = html;

    // Edit handlers
    el.querySelectorAll('.evidence-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => openRiskEditModal(btn.dataset.riskId));
    });

    // Delete handlers
    el.querySelectorAll('.evidence-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await showConfirm('Delete Risk', 'Remove this risk from the register?');
        if (!ok) return;
        dashboard.risk_register = (dashboard.risk_register || []).filter(r => r.id !== btn.dataset.riskId);
        await saveDashboard();
        render();
      });
    });
  }

  function openRiskEditModal(riskId) {
    const risk = (dashboard.risk_register || []).find(r => r.id === riskId);
    if (!risk) return;

    document.getElementById('risk-modal-title').textContent = 'Edit Risk';
    document.getElementById('risk-submit').textContent = 'Save';
    document.getElementById('risk-edit-id').value = riskId;
    document.getElementById('risk-description').value = risk.description || '';
    document.getElementById('risk-likelihood').value = risk.likelihood || 3;
    document.getElementById('risk-impact').value = risk.impact || 3;
    document.getElementById('risk-treatment').value = risk.treatment || 'mitigate';
    document.getElementById('risk-owner').value = risk.owner || '';
    document.getElementById('risk-requirements').value = (risk.requirement_ids || []).join(', ');
    document.getElementById('risk-modal').showModal();
  }

  // ─── Vendors ──────────────────────────────────────────────

  function renderVendors() {
    const el = document.getElementById('vendor-list');
    if (!el) return;

    const vendors = dashboard.vendors || [];

    if (vendors.length === 0) {
      el.innerHTML = '<div class="empty-state">No business associates tracked. Add vendors who handle PHI.</div>';
      return;
    }

    const now = new Date();

    el.innerHTML = vendors.map(v => {
      let expiryHtml = '';
      if (v.baa_expiry && v.baa_status === 'signed') {
        const expiry = new Date(v.baa_expiry);
        const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          expiryHtml = `<span class="vendor-expiry expired">Expired ${formatDate(v.baa_expiry)}</span>`;
        } else if (daysLeft <= 30) {
          expiryHtml = `<span class="vendor-expiry warning">Expires ${formatDate(v.baa_expiry)}</span>`;
        } else {
          expiryHtml = `<span class="vendor-expiry">Exp. ${formatDate(v.baa_expiry)}</span>`;
        }
      }

      return `
        <div class="vendor-item" data-id="${escapeHtml(v.id)}">
          <div class="vendor-content">
            <div class="vendor-name">${escapeHtml(v.name)}</div>
            <div class="vendor-service">${escapeHtml(v.service || '')}${v.contact ? ' \u00b7 ' + escapeHtml(v.contact) : ''}</div>
            ${v.notes ? `<div class="vendor-notes">${escapeHtml(v.notes)}</div>` : ''}
          </div>
          <span class="baa-badge ${v.baa_status || 'none'}">${escapeHtml((v.baa_status || 'none').toUpperCase())}</span>
          ${expiryHtml}
          <span class="vendor-risk-tier ${v.risk_tier || 'medium'}">${escapeHtml(v.risk_tier || 'medium')}</span>
          <div class="vendor-item-actions">
            <button class="evidence-action-btn edit" data-vendor-id="${escapeHtml(v.id)}">Edit</button>
            <button class="evidence-action-btn delete" data-vendor-id="${escapeHtml(v.id)}">Delete</button>
          </div>
        </div>`;
    }).join('');

    // Edit handlers
    el.querySelectorAll('.evidence-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => openVendorEditModal(btn.dataset.vendorId));
    });

    // Delete handlers
    el.querySelectorAll('.evidence-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await showConfirm('Delete Vendor', 'Remove this vendor from tracking?');
        if (!ok) return;
        dashboard.vendors = (dashboard.vendors || []).filter(v => v.id !== btn.dataset.vendorId);
        await saveDashboard();
        render();
      });
    });
  }

  function openVendorEditModal(vendorId) {
    const vendor = (dashboard.vendors || []).find(v => v.id === vendorId);
    if (!vendor) return;

    document.getElementById('vendor-modal-title').textContent = 'Edit Business Associate';
    document.getElementById('vendor-submit').textContent = 'Save';
    document.getElementById('vendor-edit-id').value = vendorId;
    document.getElementById('vendor-name').value = vendor.name || '';
    document.getElementById('vendor-service').value = vendor.service || '';
    document.getElementById('vendor-baa-status').value = vendor.baa_status || 'none';
    document.getElementById('vendor-baa-expiry').value = vendor.baa_expiry || '';
    document.getElementById('vendor-risk-tier').value = vendor.risk_tier || 'medium';
    document.getElementById('vendor-contact').value = vendor.contact || '';
    document.getElementById('vendor-notes').value = vendor.notes || '';
    document.getElementById('vendor-modal').showModal();
  }

  // ─── Gaps ─────────────────────────────────────────────────

  function renderGaps() {
    const el = document.getElementById('gaps-list');
    const frameworks = dashboard.frameworks || {};
    let gaps = [];
    for (const fw of Object.values(frameworks)) {
      gaps = gaps.concat(fw.evidence_gaps || []);
    }

    if (gaps.length === 0) {
      el.innerHTML = '<div class="no-gaps">No evidence gaps identified.</div>';
      return;
    }

    el.innerHTML = gaps.map(g => `
      <div class="gap-item">
        <div class="gap-icon">!</div>
        <div class="gap-item-content">
          <div class="gap-item-text">${escapeHtml(g.description)}</div>
          <div class="gap-item-req">${escapeHtml(g.requirement || '')}</div>
        </div>
      </div>
    `).join('');
  }

  // ─── Activity Timeline ────────────────────────────────────

  async function renderActivity() {
    const el = document.getElementById('activity-timeline');
    if (!el) return;

    try {
      const res = await fetch('/api/activity');
      const events = await res.json();

      if (!events || events.length === 0) {
        el.innerHTML = '<div class="empty-state">No activity recorded yet.</div>';
        return;
      }

      const displayed = events.slice(0, 20);

      el.innerHTML = displayed.map(ev => `
        <div class="activity-event">
          <div class="activity-dot ${ev.type}"></div>
          <div class="activity-text">${escapeHtml(ev.text)}</div>
          <div class="activity-time">${timeAgo(ev.timestamp)}</div>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div class="empty-state">Could not load activity.</div>';
    }
  }

  // ─── Upload ───────────────────────────────────────────────

  function setupUpload() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    const meta = document.getElementById('upload-meta');

    zone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
        input.click();
      }
    });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      for (const file of files) await uploadFile(file);
    });

    input.addEventListener('change', async () => {
      for (const file of input.files) await uploadFile(file);
      input.value = '';
    });

    // Show metadata inputs on focus
    // Upload metadata always visible (no hover toggle)
  }

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('framework', document.getElementById('upload-framework').value);
    formData.append('requirement', document.getElementById('upload-requirement').value);
    formData.append('type', document.getElementById('upload-type').value);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.ok) {
        await fetchDashboard();
        render();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  }

  // ─── Custom modal ────────────────────────────────────────

  function setupCustomModal() {
    const btn = document.getElementById('add-custom-btn');
    const modal = document.getElementById('custom-modal');
    const form = document.getElementById('custom-form');
    const cancel = document.getElementById('custom-cancel');

    btn.addEventListener('click', () => modal.showModal());
    cancel.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('custom-text').value.trim();
      const section = document.getElementById('custom-section').value.trim() || 'Custom';
      if (!text) return;

      // Add to first framework
      const fwKeys = Object.keys(dashboard.frameworks || {});
      if (fwKeys.length === 0) return;
      const fw = dashboard.frameworks[fwKeys[0]];
      if (!fw.checklist) fw.checklist = [];

      fw.checklist.push({
        id: 'custom-' + Date.now(),
        section,
        text,
        status: 'pending',
        evidence: [],
        notes: '',
        custom: true,
      });

      await saveDashboard();
      render();
      modal.close();
      form.reset();
    });
  }

  // ─── Evidence edit modal ──────────────────────────────────

  function setupEvidenceEditModal() {
    const modal = document.getElementById('evidence-edit-modal');
    const form = document.getElementById('evidence-edit-form');
    const cancel = document.getElementById('evidence-edit-cancel');

    cancel.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const filename = document.getElementById('evidence-edit-filename').value;
      const newType = document.getElementById('evidence-edit-type').value;
      const newReq = document.getElementById('evidence-edit-requirement').value.trim();

      const file = (dashboard.evidence?.files || []).find(f => f.filename === filename);
      if (file) {
        file.type = newType;
        file.requirement = newReq;
        await saveDashboard();
        render();
      }
      modal.close();
    });
  }

  // ─── Finding modal ────────────────────────────────────────

  function setupFindingModal() {
    const btn = document.getElementById('add-finding-btn');
    const modal = document.getElementById('finding-modal');
    const form = document.getElementById('finding-form');
    const cancel = document.getElementById('finding-cancel');

    btn.addEventListener('click', () => {
      form.reset();
      modal.showModal();
    });
    cancel.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('finding-title').value.trim();
      if (!title) return;

      const finding = {
        id: 'F-' + Date.now(),
        title,
        description: document.getElementById('finding-description').value.trim(),
        severity: document.getElementById('finding-severity').value,
        status: 'open',
        requirement: document.getElementById('finding-requirement').value.trim(),
        source: document.getElementById('finding-source').value.trim() || 'manual',
        discovered_at: new Date().toISOString(),
        resolved_at: null,
      };

      // Add to first framework
      const fwKeys = Object.keys(dashboard.frameworks || {});
      if (fwKeys.length === 0) return;
      const fw = dashboard.frameworks[fwKeys[0]];
      if (!fw.findings) fw.findings = [];
      fw.findings.push(finding);

      await saveDashboard();
      render();
      modal.close();
      form.reset();
    });
  }

  // ─── Risk modal ───────────────────────────────────────────

  function setupRiskModal() {
    const btn = document.getElementById('add-risk-btn');
    const modal = document.getElementById('risk-modal');
    const form = document.getElementById('risk-form');
    const cancel = document.getElementById('risk-cancel');

    btn.addEventListener('click', () => {
      document.getElementById('risk-modal-title').textContent = 'Add Risk';
      document.getElementById('risk-submit').textContent = 'Add';
      document.getElementById('risk-edit-id').value = '';
      form.reset();
      modal.showModal();
    });
    cancel.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const description = document.getElementById('risk-description').value.trim();
      if (!description) return;

      const editId = document.getElementById('risk-edit-id').value;
      const likelihood = parseInt(document.getElementById('risk-likelihood').value) || 3;
      const impact = parseInt(document.getElementById('risk-impact').value) || 3;
      const reqText = document.getElementById('risk-requirements').value.trim();
      const requirement_ids = reqText ? reqText.split(',').map(s => s.trim()).filter(Boolean) : [];

      const riskData = {
        description,
        likelihood,
        impact,
        score: likelihood * impact,
        treatment: document.getElementById('risk-treatment').value,
        owner: document.getElementById('risk-owner').value.trim(),
        status: 'open',
        requirement_ids,
        updated_at: new Date().toISOString(),
      };

      if (editId) {
        // Update existing
        const existing = (dashboard.risk_register || []).find(r => r.id === editId);
        if (existing) Object.assign(existing, riskData);
      } else {
        // Create new
        riskData.id = 'R-' + Date.now();
        riskData.created_at = new Date().toISOString();
        if (!dashboard.risk_register) dashboard.risk_register = [];
        dashboard.risk_register.push(riskData);
      }

      await saveDashboard();
      render();
      modal.close();
      form.reset();
    });
  }

  // ─── Vendor modal ─────────────────────────────────────────

  function setupVendorModal() {
    const btn = document.getElementById('add-vendor-btn');
    const modal = document.getElementById('vendor-modal');
    const form = document.getElementById('vendor-form');
    const cancel = document.getElementById('vendor-cancel');

    btn.addEventListener('click', () => {
      document.getElementById('vendor-modal-title').textContent = 'Add Business Associate';
      document.getElementById('vendor-submit').textContent = 'Add';
      document.getElementById('vendor-edit-id').value = '';
      form.reset();
      modal.showModal();
    });
    cancel.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('vendor-name').value.trim();
      if (!name) return;

      const editId = document.getElementById('vendor-edit-id').value;

      const vendorData = {
        name,
        service: document.getElementById('vendor-service').value.trim(),
        baa_status: document.getElementById('vendor-baa-status').value,
        baa_expiry: document.getElementById('vendor-baa-expiry').value || null,
        risk_tier: document.getElementById('vendor-risk-tier').value,
        contact: document.getElementById('vendor-contact').value.trim(),
        notes: document.getElementById('vendor-notes').value.trim(),
      };

      if (editId) {
        const existing = (dashboard.vendors || []).find(v => v.id === editId);
        if (existing) Object.assign(existing, vendorData);
      } else {
        vendorData.id = 'V-' + Date.now();
        vendorData.created_at = new Date().toISOString();
        if (!dashboard.vendors) dashboard.vendors = [];
        dashboard.vendors.push(vendorData);
      }

      await saveDashboard();
      render();
      modal.close();
      form.reset();
    });
  }

  // ─── View toggle & search ─────────────────────────────────

  function setupRiskViewToggle() {
    const matrixBtn = document.getElementById('risk-view-matrix');
    const tableBtn = document.getElementById('risk-view-table');

    if (matrixBtn) {
      matrixBtn.addEventListener('click', () => {
        risksView = 'matrix';
        matrixBtn.classList.add('active');
        tableBtn.classList.remove('active');
        renderRiskRegister();
      });
    }
    if (tableBtn) {
      tableBtn.addEventListener('click', () => {
        risksView = 'table';
        tableBtn.classList.add('active');
        matrixBtn.classList.remove('active');
        renderRiskRegister();
      });
    }
  }

  function setupEvidenceSearch() {
    const input = document.getElementById('evidence-search');
    if (input) {
      input.addEventListener('input', () => {
        evidenceSearch = input.value;
        evidencePage = 0;
        renderEvidence();
      });
    }
  }

  // ─── WebSocket ────────────────────────────────────────────

  function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.onmessage = async () => {
      await fetchDashboard();
      render();
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }

  // ─── API ──────────────────────────────────────────────────

  async function saveDashboard() {
    await fetch('/api/dashboard', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dashboard),
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
  }

  function timeAgo(iso) {
    if (!iso) return '';
    try {
      const now = new Date();
      const then = new Date(iso);
      const diffMs = now - then;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMs / 3600000);
      const diffDay = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDay < 30) return `${diffDay}d ago`;
      return formatDate(iso);
    } catch { return iso; }
  }

  function getCSSVar(name) {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch { return ''; }
  }

  // ─── Start ────────────────────────────────────────────────

  init();
})();
