// ── DASHBOARD MODULE ──────────────────────────────────────────
const DashboardModule = (() => {

  function render(container, topbarActions) {
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      container.innerHTML = renderOfflineWarning();
      return;
    }
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading dashboard…</span></div>';
    api('getDashboard').then(data => {
      container.innerHTML = buildHTML(data);
    }).catch(err => {
      container.innerHTML = `<div class="page-loading"><p style="color:var(--danger)">Failed to load dashboard: ${err.message}</p></div>`;
    });
  }

  function renderOfflineWarning() {
    return `
      <div class="card" style="max-width:600px;margin:40px auto">
        <div class="card-body" style="text-align:center;padding:40px">
          <div style="font-size:3rem;margin-bottom:16px">⚙️</div>
          <h2 style="margin-bottom:12px">Apps Script Not Configured</h2>
          <p style="color:var(--gray-600);line-height:1.6;margin-bottom:20px">
            The app is running in demo mode. To connect to Google Sheets:
          </p>
          <ol style="text-align:left;line-height:2;color:var(--gray-700);margin-bottom:24px;padding-left:24px">
            <li>Open your Google Sheet → <strong>Extensions → Apps Script</strong></li>
            <li>Paste the content of <code>Code.gs</code> and save</li>
            <li>Click <strong>Deploy → New deployment → Web App</strong></li>
            <li>Set <em>Execute as: Me</em> and <em>Access: Anyone</em></li>
            <li>Copy the Web App URL</li>
            <li>Open <code>app.js</code> and replace <code>YOUR_APPS_SCRIPT_WEB_APP_URL_HERE</code> with the URL</li>
            <li>Reload this page</li>
          </ol>
          <a href="#settings" class="btn btn-primary">Go to Master Data →</a>
        </div>
      </div>`;
  }

  function buildHTML(data) {
    const s = data.stats || {};
    const today = new Date(); today.setHours(0,0,0,0);

    const statsGrid = `
      <div class="stats-grid">
        ${statCard('📁', s.total || 0, 'Total Files', 'blue')}
        ${statCard('✅', s.inOffice || 0, 'In Office', 'green')}
        ${statCard('📤', s.checkedOut || 0, 'Checked Out', 'orange')}
        ${statCard('🔴', s.overdue || 0, 'Overdue', 'red')}
        ${statCard('🗄️', s.archived || 0, 'Archived', 'gray')}
        ${statCard('❓', s.missing || 0, 'Missing', 'red')}
      </div>`;

    const byLoc = data.byLocation || {};
    const locRows = Object.entries(byLoc).sort((a,b) => b[1]-a[1]).map(([loc, count]) => `
      <tr>
        <td>${loc || 'Unknown'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--gray-200);border-radius:100px;height:6px;overflow:hidden">
              <div style="background:var(--primary);width:${Math.min(100, Math.round(count/(s.total||1)*100))}%;height:100%"></div>
            </div>
            <strong>${count}</strong>
          </div>
        </td>
      </tr>`).join('');

    const byStatus = data.byStatus || {};
    const statusColors = { 'In office': 'var(--success)', 'Checked out': 'var(--warning)', 'Archived': 'var(--gray-400)', 'Missing': 'var(--danger)' };
    const statusRows = Object.entries(byStatus).map(([st, cnt]) => `
      <tr>
        <td>${statusBadge(st)}</td>
        <td><strong>${cnt}</strong></td>
        <td style="color:var(--gray-500)">${s.total ? Math.round(cnt/s.total*100) : 0}%</td>
      </tr>`).join('');

    const activity = (data.recentActivity || []).map(a => `
      <div class="activity-item">
        <div class="activity-dot ${activityDotColor(a.action)}"></div>
        <div class="activity-body">
          <div class="activity-action">${a.action} — <a href="#file/${encodeURIComponent(a.fileNumber)}">${a.fileNumber}</a></div>
          <div class="activity-detail">${a.details || ''}</div>
          <div class="activity-meta">by ${a.actor || '—'} · ${fmtDateTime(a.timestamp)}</div>
        </div>
      </div>`).join('') || '<p style="color:var(--gray-500);text-align:center;padding:24px">No activity yet</p>';

    return `
      ${statsGrid}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div class="card-header"><span class="card-title">📍 Files by Location</span></div>
          <div style="overflow-x:auto">
            <table><thead><tr><th>Location</th><th>Count</th></tr></thead>
            <tbody>${locRows || '<tr><td colspan="2" class="table-empty">No data</td></tr>'}</tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📊 Status Breakdown</span></div>
          <div style="overflow-x:auto">
            <table><thead><tr><th>Status</th><th>Count</th><th>%</th></tr></thead>
            <tbody>${statusRows || '<tr><td colspan="3" class="table-empty">No data</td></tr>'}</tbody></table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">🕑 Recent Activity</span>
          <a href="#register" class="btn btn-ghost btn-sm">View All Files →</a>
        </div>
        <div class="card-body">
          <div class="activity-list">${activity}</div>
        </div>
      </div>`;
  }

  function statCard(icon, value, label, color) {
    return `
      <div class="stat-card">
        <div class="stat-icon ${color}">${icon}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>`;
  }

  return { render };
})();
