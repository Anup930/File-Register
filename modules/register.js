// ── REGISTER MODULE ───────────────────────────────────────────
const RegisterModule = (() => {
  let state = {
    page: 1, pageSize: 50, total: 0, pages: 0,
    search: '', category: '', subCategory: '', filesCount: '', location: '', binLocation: '', status: '', heldBy: '',
    files: [], allFiles: [], // allFiles used for CSV export
    stats: null, // cached dashboard stats
  };
  let debounceTimer;

  function render(container, topbarActions) {
    topbarActions.innerHTML = `
      <button class="btn btn-secondary btn-sm no-print" id="btn-export-csv">📥 Export CSV</button>
      <a href="#add" class="btn btn-primary btn-sm no-print">➕ Add File</a>`;

    loadConfig().then(() => {
      container.innerHTML = buildShell();
      bindTopbarActions(container);
      fetchAndRender();
    });
  }

  function updateToolbarStats(s) {
    if (!s) return;
    const elTotal    = document.getElementById('reg-stat-total');
    const elFiles    = document.getElementById('reg-stat-files');
    const elCheckout = document.getElementById('reg-stat-checkout');
    const elOverdue  = document.getElementById('reg-stat-overdue');

    if (elTotal)    elTotal.textContent    = s.total !== undefined ? s.total : 0;
    if (elFiles)    elFiles.textContent    = s.totalFiles !== undefined ? s.totalFiles : 0;
    if (elCheckout) elCheckout.textContent = s.checkedOut !== undefined ? s.checkedOut : 0;
    if (elOverdue)  elOverdue.textContent  = s.overdue !== undefined ? s.overdue : 0;
  }

  function buildShell() {
    const cfg = App.config || {};
    const lsts = cfg.lists || {};
    const categories    = (cfg.categories || []).map(c => c.name);
    const subcategories = (cfg.subcategories || []).map(c => c.name);
    const locations     = lsts['Locations'] || [];
    const bins          = lsts['Bin Locations'] || [];
    const hods          = lsts['HODs'] || [];
    const statuses      = ['In office', 'Checked out', 'Archived', 'Missing'];
    const hasActive = !!(state.search || state.category || state.subCategory || state.filesCount || state.location || state.binLocation || state.status || state.heldBy);

    const s = state.stats || {};
    const totalVal      = s.total !== undefined ? s.total : '…';
    const totalFilesVal = s.totalFiles !== undefined ? s.totalFiles : '…';
    const checkedOutVal = s.checkedOut !== undefined ? s.checkedOut : '…';
    const overdueVal    = s.overdue !== undefined ? s.overdue : '…';

    return `
      <div class="toolbar">
        <!-- Row 1: Search + Reset button + 4 Live Stat Cards in marked space -->
        <div class="toolbar-row1">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="reg-search" placeholder="Search by file number, client, details…" value="${state.search}">
          </div>
          <button class="btn-reset-filters ${hasActive ? 'has-active' : ''}" id="btn-clear-filters" title="Clear all filters & search">
            ✕ Reset Filters
          </button>

          <div class="toolbar-stats-row">
            <div class="stat-mini-card stat-blue clickable-stat-card" data-stat-filter="all" title="Click to view all registers">
              <div class="stat-mini-icon">📁</div>
              <div class="stat-mini-info">
                <span class="stat-mini-val" id="reg-stat-total">${totalVal}</span>
                <span class="stat-mini-lbl">Total Registers</span>
              </div>
            </div>

            <div class="stat-mini-card stat-cyan clickable-stat-card" data-stat-filter="has_files" title="Click to filter registers with files">
              <div class="stat-mini-icon">📄</div>
              <div class="stat-mini-info">
                <span class="stat-mini-val" id="reg-stat-files">${totalFilesVal}</span>
                <span class="stat-mini-lbl">Files Inside</span>
              </div>
            </div>

            <div class="stat-mini-card stat-orange clickable-stat-card" data-stat-filter="Checked out" title="Click to filter Checked Out files">
              <div class="stat-mini-icon">📤</div>
              <div class="stat-mini-info">
                <span class="stat-mini-val" id="reg-stat-checkout">${checkedOutVal}</span>
                <span class="stat-mini-lbl">Checked Out</span>
              </div>
            </div>

            <div class="stat-mini-card stat-red clickable-stat-card" data-stat-filter="Overdue" title="Click to filter Overdue files">
              <div class="stat-mini-icon">🔴</div>
              <div class="stat-mini-info">
                <span class="stat-mini-val" id="reg-stat-overdue">${overdueVal}</span>
                <span class="stat-mini-lbl">Overdue</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2: Filter bar -->
        <div class="filter-bar">
          <span class="filter-bar-label">🔽 Filters</span>

          ${filterPill('Category', 'reg-category', [{ value: '', text: 'All' }, ...categories.map(c => ({ value: c, text: c }))], state.category)}
          ${filterPill('Sub-Cat', 'reg-subcategory', [{ value: '', text: 'All' }, ...subcategories.map(c => ({ value: c, text: c }))], state.subCategory)}
          ${filterPill('Files', 'reg-files-count', [
            { value: '', text: 'Any' },
            { value: 'has_files', text: '📂 Has Files' },
            { value: 'no_files', text: '📭 Empty' }
          ], state.filesCount)}
          ${filterPill('Location', 'reg-location', [{ value: '', text: 'All' }, ...locations.map(l => ({ value: l, text: l }))], state.location)}
          ${filterPill('Bin', 'reg-bin', [{ value: '', text: 'All' }, ...bins.map(b => ({ value: b, text: b }))], state.binLocation)}
          ${filterPill('Status', 'reg-status', [
            { value: '', text: 'All' },
            { value: 'In office', text: '🟢 In Office' },
            { value: 'Checked out', text: '🟡 Checked Out' },
            { value: 'Archived', text: '📦 Archived' },
            { value: 'Missing', text: '🔴 Missing' }
          ], state.status)}
          ${filterPill('Held By', 'reg-heldby', [{ value: '', text: 'Anyone' }, ...hods.map(h => ({ value: h, text: h }))], state.heldBy)}
        </div>
      </div>
      <div id="reg-table-wrap">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>`;
  }

  function filterPill(label, id, options, value) {
    const isActive = !!value;
    return `
      <div class="filter-pill ${isActive ? 'filter-active' : ''}">
        <span class="filter-pill-label">${label}</span>
        <select class="filter-select" id="${id}">
          ${options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.text}</option>`).join('')}
        </select>
      </div>`;
  }

  function bindTopbarActions(container) {
    document.getElementById('btn-export-csv')?.addEventListener('click', exportAll);
    document.getElementById('btn-clear-filters')?.addEventListener('click', () => clearFilters(container));

    // Click on stat cards to filter
    container.querySelectorAll('.clickable-stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const filterType = card.dataset.statFilter;
        if (filterType === 'all') {
          clearFilters(container);
          return;
        }
        if (filterType === 'has_files') {
          const el = document.getElementById('reg-files-count');
          if (el) { el.value = 'has_files'; el.dispatchEvent(new Event('change')); }
          return;
        }
        if (filterType === 'In office' || filterType === 'Checked out' || filterType === 'Archived') {
          const el = document.getElementById('reg-status');
          if (el) { el.value = filterType; el.dispatchEvent(new Event('change')); }
          return;
        }
        if (filterType === 'Overdue') {
          const el = document.getElementById('reg-status');
          if (el) { el.value = 'Checked out'; el.dispatchEvent(new Event('change')); }
          return;
        }
      });
    });

    const searchEl = document.getElementById('reg-search');
    if (searchEl) searchEl.addEventListener('input', e => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; fetchAndRender(); }, 300);
    });

    ['reg-category', 'reg-subcategory', 'reg-files-count', 'reg-location', 'reg-bin', 'reg-status', 'reg-heldby'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const map = {
          'reg-category': 'category',
          'reg-subcategory': 'subCategory',
          'reg-files-count': 'filesCount',
          'reg-location': 'location',
          'reg-bin': 'binLocation',
          'reg-status': 'status',
          'reg-heldby': 'heldBy'
        };
        state[map[id]] = el.value;
        state.page = 1;
        // Toggle pill active state
        const pill = el.closest('.filter-pill');
        if (pill) pill.classList.toggle('filter-active', !!el.value);
        // Toggle reset button state
        const resetBtn = document.getElementById('btn-clear-filters');
        if (resetBtn) {
          const anyActive = !!(state.search || state.category || state.subCategory || state.filesCount || state.location || state.binLocation || state.status || state.heldBy);
          resetBtn.classList.toggle('has-active', anyActive);
        }

        fetchAndRender();
      });
    });
  }

  function clearFilters(container) {
    state.search = '';
    state.category = '';
    state.subCategory = '';
    state.filesCount = '';
    state.location = '';
    state.binLocation = '';
    state.status = '';
    state.heldBy = '';
    state.page = 1;

    if (container) {
      container.innerHTML = buildShell();
      bindTopbarActions(container);
    }
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
      search: state.search,
      category: state.category,
      subCategory: state.subCategory,
      filesCount: state.filesCount,
      location: state.location,
      binLocation: state.binLocation,
      status: state.status,
      heldBy: state.heldBy,
      includeArchived: state.status === 'Archived' ? 'true' : 'false',
    };

    api('getFiles', params).then(data => {
      state.files = data.files || [];
      state.total = data.total || 0;
      state.pages = data.pages || 0;
      state.page  = data.page  || 1;

      // Dynamically update the 4 stat cards according to current filter results!
      let s = data.stats;
      if (!s) {
        let totalFiles = 0, checkedOut = 0, overdue = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        state.files.forEach(f => {
          totalFiles += (f.fileCount || 0);
          if (f.status === 'Checked out') {
            checkedOut++;
            if (f.dueDate) {
              const d = new Date(f.dueDate); d.setHours(0, 0, 0, 0);
              if (d < today) overdue++;
            }
          }
        });
        s = { total: state.total, totalFiles, checkedOut, overdue };
      }
      state.stats = s;
      updateToolbarStats(s);

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
          <td>
            <a href="#file/${encodeURIComponent(f.fileNumber)}" class="badge" style="background:var(--primary-light);color:var(--primary);text-decoration:none;font-size:.78rem;padding:3px 8px;cursor:pointer" title="View files inside this register">
              📂 ${f.fileCount || 0} Files
            </a>
          </td>
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
            <th>Sub-Category</th><th>Files</th><th>Details</th><th>Location</th>
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
        else if (action === 'checkout') CheckoutModule.openCheckout(fn, () => { fetchAndRender(); loadRegisterStats(document.getElementById('content')); });
        else if (action === 'return')   CheckoutModule.openReturn(fn, () => { fetchAndRender(); loadRegisterStats(document.getElementById('content')); });
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
        .then(() => { toast('File deleted', 'success'); fetchAndRender(); loadRegisterStats(document.getElementById('content')); })
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
