// ── REGISTER MODULE ───────────────────────────────────────────
const RegisterModule = (() => {
  let state = {
    page: 1, pageSize: 50, total: 0, pages: 0,
    search: '', status: '', location: '', entity: '', businessVertical: '', hod: '', fileType: '',
    files: [], allFiles: [], // allFiles used for CSV export
  };
  let debounceTimer;

  function render(container, topbarActions) {
    topbarActions.innerHTML = `
      <button class="btn btn-secondary btn-sm no-print" id="btn-export-csv">📥 Export CSV</button>
      <a href="#add" class="btn btn-primary btn-sm no-print">➕ Add File</a>`;

    container.innerHTML = buildShell();
    bindTopbarActions();
    fetchAndRender();
  }

  function buildShell() {
    const cfg = App.config || {};
    const lsts = cfg.lists || {};
    const locations = lsts['Locations'] || [];
    const entities  = lsts['Entities'] || [];
    const bvs       = lsts['Business Verticals'] || [];
    const hods      = lsts['HODs'] || [];
    const fts       = lsts['File Types'] || [];
    const statuses  = ['In office', 'Checked out', 'Archived', 'Missing'];

    return `
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="reg-search" placeholder="Search files…" value="${state.search}">
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-toggle-filters">⚙ Filters</button>
      </div>
      <div class="filter-row" id="filter-row" style="display:none">
        ${filterSelect('Status', 'reg-status', statuses, state.status)}
        ${filterSelect('Location', 'reg-location', locations, state.location)}
        ${filterSelect('Entity', 'reg-entity', entities, state.entity)}
        ${filterSelect('Business Vertical', 'reg-bv', bvs, state.businessVertical)}
        ${filterSelect('HOD', 'reg-hod', hods, state.hod)}
        ${filterSelect('File Type', 'reg-ft', fts, state.fileType)}
        <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--gray-700)">
          <input type="checkbox" id="reg-archived" ${state.status === 'Archived' ? 'checked' : ''}> Show Archived
        </label>
        <button class="btn btn-ghost btn-sm" id="btn-clear-filters">✕ Clear</button>
      </div>
      <div id="reg-table-wrap">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>`;
  }

  function filterSelect(label, id, options, value) {
    return `
      <select class="filter-select ${value ? 'filter-active' : ''}" id="${id}" title="${label}">
        <option value="">All ${label}s</option>
        ${options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}
      </select>`;
  }

  function bindTopbarActions() {
    document.getElementById('btn-export-csv')?.addEventListener('click', exportAll);
    document.getElementById('btn-toggle-filters')?.addEventListener('click', () => {
      const fr = document.getElementById('filter-row');
      if (fr) fr.style.display = fr.style.display === 'none' ? 'flex' : 'none';
    });
    document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);

    const searchEl = document.getElementById('reg-search');
    if (searchEl) searchEl.addEventListener('input', e => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; fetchAndRender(); }, 300);
    });

    ['reg-status','reg-location','reg-entity','reg-bv','reg-hod','reg-ft'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const map = {'reg-status':'status','reg-location':'location','reg-entity':'entity','reg-bv':'businessVertical','reg-hod':'hod','reg-ft':'fileType'};
        state[map[id]] = el.value;
        state.page = 1;
        fetchAndRender();
      });
    });
  }

  function clearFilters() {
    state.search = ''; state.status = ''; state.location = '';
    state.entity = ''; state.businessVertical = ''; state.hod = ''; state.fileType = '';
    state.page = 1;
    // reset UI
    ['reg-search','reg-status','reg-location','reg-entity','reg-bv','reg-hod','reg-ft'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    fetchAndRender();
  }

  function fetchAndRender() {
    const wrap = document.getElementById('reg-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      wrap.innerHTML = '<div class="table-empty"><p>Connect Apps Script to see files.</p></div>';
      return;
    }

    const params = {
      page: state.page, pageSize: state.pageSize,
      search: state.search, status: state.status,
      location: state.location, entity: state.entity,
      businessVertical: state.businessVertical, hod: state.hod, fileType: state.fileType,
      includeArchived: state.status === 'Archived' ? 'true' : 'false',
    };

    api('getFiles', params).then(data => {
      state.files = data.files || [];
      state.total = data.total || 0;
      state.pages = data.pages || 0;
      state.page  = data.page  || 1;
      wrap.innerHTML = buildTable(state.files) + buildPagination();
      bindTableActions(wrap);
    }).catch(err => {
      wrap.innerHTML = `<div class="table-empty"><p style="color:var(--danger)">Error: ${err.message}</p></div>`;
    });
  }

  function buildTable(files) {
    if (!files.length) {
      return `<div class="table-empty"><div class="empty-icon">📭</div><p>No files found. <a href="#add">Add the first file →</a></p></div>`;
    }
    const rows = files.map(f => {
      const overdue = f.status === 'Checked out' && f.dueDate && new Date(f.dueDate) < new Date();
      return `
        <tr>
          <td class="col-file-num"><a href="#file/${encodeURIComponent(f.fileNumber)}">${f.fileNumber}</a></td>
          <td>${f.clientName || '—'}</td>
          <td>${f.category || '—'}</td>
          <td>${f.subCategory || '—'}</td>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${f.details}">${f.details || '—'}</td>
          <td>${f.location || '—'}</td>
          <td style="font-family:monospace;font-size:.8rem">${f.binLocation || '—'}</td>
          <td>${statusBadge(f.status)}</td>
          <td>${f.heldBy ? `<span title="Due: ${fmtDate(f.dueDate)}">${f.heldBy}${overdue ? ' ⚠️' : ''}</span>` : '—'}</td>
          <td>
            <div class="col-actions">
              <button class="btn btn-ghost btn-icon btn-sm" data-action="view" data-fn="${f.fileNumber}" title="View">👁</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-fn="${f.fileNumber}" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-action="${f.status === 'Checked out' ? 'return' : 'checkout'}" data-fn="${f.fileNumber}" title="${f.status === 'Checked out' ? 'Return' : 'Check Out'}">
                ${f.status === 'Checked out' ? '↩️' : '📤'}
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" data-action="sticker" data-fn="${f.fileNumber}" title="Print Sticker">🏷️</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-action="delete" data-fn="${f.fileNumber}" title="Delete" style="color:var(--danger)">🗑️</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>File Number</th><th>Client</th><th>Category</th>
            <th>Sub-Category</th><th>Details</th><th>Location</th>
            <th>Bin</th><th>Status</th><th>Held By</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
  }

  function buildPagination() {
    const { page, pages, total, pageSize } = state;
    const start = (page - 1) * pageSize + 1;
    const end   = Math.min(page * pageSize, total);
    let pageLinks = '';
    for (let p = Math.max(1, page-2); p <= Math.min(pages, page+2); p++) {
      pageLinks += `<button class="page-btn ${p===page?'active':''}" data-p="${p}">${p}</button>`;
    }
    return `
      </div>
      <div class="pagination">
        <span class="pagination-info">${total ? `${start}–${end} of ${total} files` : 'No files'}</span>
        <div class="pagination-controls">
          <button class="page-btn" data-p="${page-1}" ${page<=1?'disabled':''}>‹</button>
          ${pageLinks}
          <button class="page-btn" data-p="${page+1}" ${page>=pages?'disabled':''}>›</button>
        </div>
      </div>`;
  }

  function bindTableActions(wrap) {
    wrap.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fn = btn.dataset.fn;
        const action = btn.dataset.action;
        if      (action === 'view')     navigate(`#file/${encodeURIComponent(fn)}`);
        else if (action === 'edit')     navigate(`#edit/${encodeURIComponent(fn)}`);
        else if (action === 'checkout') CheckoutModule.openCheckout(fn, () => fetchAndRender());
        else if (action === 'return')   CheckoutModule.openReturn(fn, () => fetchAndRender());
        else if (action === 'sticker')  StickerModule.openSticker(fn);
        else if (action === 'delete')   doDelete(fn);
      });
    });
    wrap.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => { state.page = parseInt(btn.dataset.p); fetchAndRender(); });
    });
  }

  function doDelete(fn) {
    confirmDialog(`Permanently delete file <strong>${fn}</strong>? This cannot be undone.`, () => {
      api('deleteFile', {}, { action: 'deleteFile', fileNumber: fn, deletedBy: App.user })
        .then(() => { toast('File deleted', 'success'); fetchAndRender(); })
        .catch(err => toast('Delete failed: ' + err.message, 'error'));
    }, 'Delete');
  }

  function exportAll() {
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
    toast('Fetching all files for export…');
    const params = { page: 1, pageSize: 5000, search: state.search, status: state.status, location: state.location, entity: state.entity, businessVertical: state.businessVertical, hod: state.hod, fileType: state.fileType, includeArchived: 'true' };
    api('getFiles', params).then(data => {
      exportToCSV(data.files || [], `file-register-${new Date().toISOString().slice(0,10)}.csv`);
      toast('CSV exported', 'success');
    }).catch(err => toast('Export failed: ' + err.message, 'error'));
  }

  return { render };
})();
