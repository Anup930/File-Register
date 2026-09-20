// ── REGISTER MODULE ───────────────────────────────────────────
const RegisterModule = (() => {
  let state = {
    page: 1, pageSize: 50, total: 0, pages: 0,
    search: '', category: '', subCategory: '', filesCount: '', location: '', binLocation: '', status: '', heldBy: '',
    oldFileNumber: '',
    files: [], allFiles: [], // allFiles used for CSV export
    stats: null, // cached dashboard stats
    selectedFiles: new Set(),
  };
  let debounceTimer;

  function render(container, topbarActions) {
    const canCreate = App.can ? App.can('register.create') : true;
    topbarActions.innerHTML = `
      <span id="reg-sync-indicator" class="badge" style="background:#e8f0fe;color:#1a73e8;font-size:0.75rem;padding:4px 8px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
        🔒 Encrypted Local DB
      </span>
      <button class="btn btn-secondary btn-sm no-print" id="btn-refresh-register" title="Live sync all registers from Google Sheets">🔄 Cloud Sync</button>
      <button class="btn btn-secondary btn-sm no-print" id="btn-export-csv">📥 Export CSV</button>
      ${canCreate ? '<a href="#add" class="btn btn-primary btn-sm no-print">➕ Add File</a>' : ''}`;

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
    const hasActive = !!(state.search || state.category || state.subCategory || state.filesCount || state.location || state.binLocation || state.status || state.heldBy || state.oldFileNumber);

    const s = state.stats || {};
    const totalVal      = s.total !== undefined ? s.total : '…';
    const totalFilesVal = s.totalFiles !== undefined ? s.totalFiles : '…';
    const checkedOutVal = s.checkedOut !== undefined ? s.checkedOut : '…';
    const overdueVal    = s.overdue !== undefined ? s.overdue : '…';

    return `
      <div class="toolbar">
        <!-- Row 1: Search + Reset button + 4 Live Stat Cards + Old File Dropdown in marked space -->
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

          <!-- Old File Number Dropdown (Red Marked Space) -->
          <div class="old-file-dropdown-wrap" id="reg-old-file-wrap">
            <button type="button" class="old-file-trigger ${state.oldFileNumber ? 'filter-active' : ''}" id="reg-old-file-btn" title="Search & filter by Old File Number">
              <span class="old-file-tag">Old File:</span>
              <span class="old-file-current" id="reg-old-file-label">${state.oldFileNumber || 'All'}</span>
              <span class="old-file-caret">▾</span>
            </button>
            <div class="old-file-popover" id="reg-old-file-popover" style="display:none;">
              <div class="old-file-search-row">
                <span class="search-icon">🔍</span>
                <input type="text" class="old-file-search-input" id="reg-old-file-search" placeholder="Type to search old file no…">
              </div>
              <div class="old-file-list" id="reg-old-file-list">
                <!-- Rendered dynamically -->
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
          ], state.filesCount, 'Any')}
          ${filterPill('Location', 'reg-location', [{ value: '', text: 'All' }, ...locations.map(l => ({ value: l, text: l }))], state.location)}
          ${filterPill('Bin', 'reg-bin', [{ value: '', text: 'All' }, ...bins.map(b => ({ value: b, text: b }))], state.binLocation)}
          ${filterPill('Status', 'reg-status', [
            { value: '', text: 'All' },
            { value: 'In office', text: '🟢 In Office' },
            { value: 'Checked out', text: '🟡 Checked Out' },
            { value: 'Archived', text: '📦 Archived' },
            { value: 'Missing', text: '🔴 Missing' }
          ], state.status)}
          ${filterPill('Held By', 'reg-heldby', [{ value: '', text: 'Anyone' }, ...hods.map(h => ({ value: h, text: h }))], state.heldBy, 'Anyone')}
        </div>
      </div>
      <div id="reg-table-wrap">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
      ${(App.can ? App.can('register.bulk') : true) ? `
      <div class="bulk-actions-toolbar" id="reg-bulk-toolbar">
        <span class="bulk-toolbar-count" id="reg-bulk-count">0 files selected</span>
        <button type="button" class="btn-bulk-action btn-bulk-update" id="btn-bulk-update-action" title="Change Location, Category, Bin, Status, Held By for selected files">⚡ Bulk Update</button>
        <button type="button" class="btn-bulk-action btn-bulk-print" id="btn-bulk-print-action" title="Mark selected files for sticker printing">🏷️ Add to Print</button>
        <button type="button" class="btn-bulk-action btn-bulk-clear" id="btn-bulk-clear-action" title="Clear current selection">✕ Deselect</button>
      </div>` : ''}`;
  }

  function filterPill(label, id, options, value, defaultLabel = 'All') {
    if (App.renderFilterPill) {
      return App.renderFilterPill(label, id, options, value, defaultLabel);
    }
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
    document.getElementById('btn-refresh-register')?.addEventListener('click', () => {
      fetchAndRender(true);
    });
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

    // Setup Old File Number Searchable Dropdown with local caching
    let oldFilesList = App.config?.oldFileNumbers || AppCache.get('oldFiles', 'local') || [];
    if ((!oldFilesList || !oldFilesList.length) && typeof AppDataStore !== 'undefined' && AppDataStore.registers.length) {
      oldFilesList = Array.from(new Set(AppDataStore.registers.map(f => f.oldFileNumber).filter(Boolean))).sort();
    }

    const oldFileBtn     = document.getElementById('reg-old-file-btn');
    const oldFilePopover = document.getElementById('reg-old-file-popover');
    const oldFileSearch  = document.getElementById('reg-old-file-search');
    const oldFileListEl  = document.getElementById('reg-old-file-list');

    function renderOldFileOptions(filterText = '') {
      if (!oldFileListEl) return;
      const q = filterText.trim().toLowerCase();
      let matched = oldFilesList.filter(n => !q || String(n).toLowerCase().includes(q));

      let html = `
        <div class="old-file-item ${!state.oldFileNumber ? 'selected' : ''}" data-val="">
          <span>— All Old Files —</span>
          ${!state.oldFileNumber ? '<span>✓</span>' : ''}
        </div>`;

      if (matched.length === 0) {
        html += `<div class="old-file-empty">No matching old file no.</div>`;
      } else {
        html += matched.map(num => `
          <div class="old-file-item ${state.oldFileNumber === num ? 'selected' : ''}" data-val="${num}">
            <span>${num}</span>
            ${state.oldFileNumber === num ? '<span>✓</span>' : ''}
          </div>
        `).join('');
      }
      oldFileListEl.innerHTML = html;

      oldFileListEl.querySelectorAll('.old-file-item').forEach(item => {
        item.addEventListener('click', () => {
          const val = item.dataset.val;
          state.oldFileNumber = val;
          state.page = 1;
          const lbl = document.getElementById('reg-old-file-label');
          if (lbl) lbl.textContent = val || 'All';
          oldFileBtn?.classList.toggle('filter-active', !!val);
          if (oldFilePopover) oldFilePopover.style.display = 'none';

          const resetBtn = document.getElementById('btn-clear-filters');
          if (resetBtn) {
            const anyActive = !!(state.search || state.category || state.subCategory || state.filesCount || state.location || state.binLocation || state.status || state.heldBy || state.oldFileNumber);
            resetBtn.classList.toggle('has-active', anyActive);
          }

          fetchAndRender();
        });
      });
    }

    renderOldFileOptions();

    // Auto-fetch if not already present in App.config or cache
    if (!oldFilesList.length && APPS_SCRIPT_URL !== 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      api('getOldFileNumbers').then(list => {
        if (Array.isArray(list) && list.length) {
          oldFilesList = list;
          if (!App.config) App.config = {};
          App.config.oldFileNumbers = list;
          AppCache.set('oldFiles', list, 60 * 60 * 1000, 'local'); // 1-hour cache
          renderOldFileOptions(oldFileSearch ? oldFileSearch.value : '');
        }
      }).catch(() => {});
    }

    if (oldFileBtn && oldFilePopover) {
      oldFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = oldFilePopover.style.display !== 'none';
        oldFilePopover.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen && oldFileSearch) {
          oldFileSearch.value = '';
          renderOldFileOptions('');
          setTimeout(() => oldFileSearch.focus(), 50);
        }
      });

      oldFileSearch?.addEventListener('input', (e) => {
        renderOldFileOptions(e.target.value);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#reg-old-file-wrap')) {
          if (oldFilePopover) oldFilePopover.style.display = 'none';
        }
      });
    }

    const searchEl = document.getElementById('reg-search');
    if (searchEl) searchEl.addEventListener('input', e => {
      clearTimeout(debounceTimer);
      state.search = e.target.value.trim();
      state.page = 1;
      if (typeof AppDataStore !== 'undefined' && AppDataStore.isLoaded) {
        fetchAndRender();
      } else {
        debounceTimer = setTimeout(() => { fetchAndRender(); }, 150);
      }
    });

    const cfg = App.config || {};
    const lsts = cfg.lists || {};
    const categories    = (cfg.categories || []).map(c => c.name);
    const subcategories = (cfg.subcategories || []).map(c => c.name);
    const locations     = lsts['Locations'] || [];
    const bins          = lsts['Bin Locations'] || [];
    const hods          = lsts['HODs'] || [];

    const filterDefs = [
      { id: 'reg-category', key: 'category', options: [{ value: '', text: 'All' }, ...categories.map(c => ({ value: c, text: c }))] },
      { id: 'reg-subcategory', key: 'subCategory', options: [{ value: '', text: 'All' }, ...subcategories.map(c => ({ value: c, text: c }))] },
      { id: 'reg-files-count', key: 'filesCount', options: [
        { value: '', text: 'Any' },
        { value: 'has_files', text: '📂 Has Files' },
        { value: 'no_files', text: '📭 Empty' }
      ] },
      { id: 'reg-location', key: 'location', options: [{ value: '', text: 'All' }, ...locations.map(l => ({ value: l, text: l }))] },
      { id: 'reg-bin', key: 'binLocation', options: [{ value: '', text: 'All' }, ...bins.map(b => ({ value: b, text: b }))] },
      { id: 'reg-status', key: 'status', options: [
        { value: '', text: 'All' },
        { value: 'In office', text: '🟢 In Office' },
        { value: 'Checked out', text: '🟡 Checked Out' },
        { value: 'Archived', text: '📦 Archived' },
        { value: 'Missing', text: '🔴 Missing' }
      ] },
      { id: 'reg-heldby', key: 'heldBy', options: [{ value: '', text: 'Anyone' }, ...hods.map(h => ({ value: h, text: h }))] }
    ];

    filterDefs.forEach(fd => {
      if (App.bindFilterPill) {
        App.bindFilterPill(fd.id, fd.options);
      }
      const el = document.getElementById(fd.id);
      if (!el) return;
      el.addEventListener('change', () => {
        state[fd.key] = el.value;
        state.page = 1;
        // Toggle pill active state
        const pill = document.getElementById(`pill-${fd.id}`) || el.closest('.filter-pill');
        if (pill) pill.classList.toggle('filter-active', !!el.value);
        // Toggle reset button state
        const resetBtn = document.getElementById('btn-clear-filters');
        if (resetBtn) {
          const anyActive = !!(state.search || state.category || state.subCategory || state.filesCount || state.location || state.binLocation || state.status || state.heldBy || state.oldFileNumber);
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
    state.oldFileNumber = '';
    state.page = 1;
    if (state.selectedFiles) state.selectedFiles.clear();

    if (container) {
      container.innerHTML = buildShell();
      bindTopbarActions(container);
    }
    fetchAndRender();
  }

  function updateSyncBadge() {
    const badge = document.getElementById('reg-sync-indicator');
    if (!badge) return;
    const count = (typeof AppDataStore !== 'undefined' && AppDataStore.registers) ? AppDataStore.registers.length : (state.total || 0);
    const lastSync = typeof AppDataStore !== 'undefined' ? AppDataStore.lastSynced : null;
    let timeStr = '';
    if (lastSync) {
      const diffSec = Math.round((Date.now() - lastSync) / 1000);
      if (diffSec < 60) timeStr = 'Just now';
      else if (diffSec < 3600) timeStr = `${Math.floor(diffSec / 60)}m ago`;
      else timeStr = `${Math.floor(diffSec / 3600)}h ago`;
    }
    badge.innerHTML = `🔒 Encrypted (${count} files)${timeStr ? ` · 🔄 ${timeStr}` : ''}`;
  }

  function fetchAndRender(force = false) {
    const wrap = document.getElementById('reg-table-wrap');
    if (!wrap) return;

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
      oldFileNumber: state.oldFileNumber,
      includeArchived: state.status === 'Archived' ? 'true' : 'false',
    };

    function applyData(data) {
      state.files = data.files || [];
      state.total = data.total || 0;
      state.pages = data.pages || 0;
      state.page  = data.page  || 1;

      // Dynamically update the 4 stat cards according to current filter results!
      let s = Object.assign({}, data.stats || {});
      let pageTotalFiles = 0;
      let pageCheckedOut = 0;
      let pageOverdue = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);

      state.files.forEach(f => {
        const cnt = Number(f.fileCount || f.filesCount || 0);
        pageTotalFiles += cnt;
        if (f.status === 'Checked out') {
          pageCheckedOut++;
          if (f.dueDate) {
            const d = new Date(f.dueDate); d.setHours(0, 0, 0, 0);
            if (d < today) pageOverdue++;
          }
        }
      });

      if (s.total === undefined) s.total = state.total;
      if (s.totalFiles === undefined || (s.totalFiles === 0 && pageTotalFiles > 0)) {
        s.totalFiles = pageTotalFiles;
      }
      if (s.checkedOut === undefined) s.checkedOut = pageCheckedOut;
      if (s.overdue === undefined) s.overdue = pageOverdue;

      state.stats = s;
      updateToolbarStats(s);

      wrap.innerHTML = buildTable(state.files) + buildPagination();
      bindTableActions(wrap);
      updateSyncBadge();
    }

    // 1. If force cloud sync requested via Cloud Sync button
    if (force) {
      const syncBtn = document.getElementById('btn-refresh-register');
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = '🔄 Syncing…';
      }
      toast('Syncing all registers from Google Sheets…', 'info');

      AppDataStore.syncFromCloud(true)
        .then(() => {
          if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Cloud Sync';
          }
          toast('✅ Synchronized with Google Sheets!', 'success');
          const data = AppDataStore.query(params, state.page, state.pageSize);
          applyData(data);
        })
        .catch(err => {
          if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Cloud Sync';
          }
          toast('Cloud sync failed: ' + err.message, 'error');
          const data = AppDataStore.query(params, state.page, state.pageSize);
          applyData(data);
        });
      return;
    }

    // 2. Instant Query if encrypted store is already in-memory (0ms execution!)
    if (typeof AppDataStore !== 'undefined' && AppDataStore.isLoaded && AppDataStore.registers.length > 0) {
      const data = AppDataStore.query(params, state.page, state.pageSize);
      applyData(data);
      return;
    }

    // 3. Otherwise, initialize from Encrypted Storage or Cloud
    wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading encrypted register…</span></div>';

    AppDataStore.ensureLoaded()
      .then(() => {
        const data = AppDataStore.query(params, state.page, state.pageSize);
        applyData(data);
      })
      .catch(err => {
        // Fallback to direct API call if local crypto store has an issue
        api('getFiles', params)
          .then(data => applyData(data))
          .catch(e => {
            wrap.innerHTML = `<div class="table-empty"><p style="color:var(--danger)">Error: ${e.message}</p></div>`;
          });
      });
  }

  function buildTable(files) {
    if (!files.length) {
      return `<div class="table-empty"><div class="empty-icon">📭</div><p>No files found. <a href="#add">Add the first file →</a></p></div>`;
    }
    const canEdit = App.can ? App.can('register.edit') : true;
    const canDelete = App.can ? App.can('register.delete') : true;
    const canCheckout = App.can ? App.can('checkout.manage') : true;
    const canSticker = App.can ? App.can('stickers.print') : true;
    const canBulk = App.can ? App.can('register.bulk') : true;

    const rows = files.map(f => {
      const overdue = f.status === 'Checked out' && f.dueDate && new Date(f.dueDate) < new Date();
      const isSelected = state.selectedFiles && state.selectedFiles.has(f.fileNumber);
      return `
        <tr class="${isSelected ? 'row-selected' : ''}" data-fn="${escapeHTML(f.fileNumber)}">
          ${canBulk ? `
          <td class="col-cb">
            <input type="checkbox" class="reg-row-cb" data-fn="${escapeHTML(f.fileNumber)}" ${isSelected ? 'checked' : ''} aria-label="Select file ${escapeHTML(f.fileNumber)}">
          </td>` : ''}
          <td class="col-file-num"><a href="#file/${encodeURIComponent(f.fileNumber)}">${f.fileNumber}</a></td>
          <td>${f.clientName || '—'}</td>
          <td>${f.category || '—'}</td>
          <td>${f.subCategory || '—'}</td>
          <td>
            <a href="#file/${encodeURIComponent(f.fileNumber)}" class="badge" style="background:${(f.fileCount || f.filesCount) ? '#fef7e0' : 'var(--primary-light)'};color:${(f.fileCount || f.filesCount) ? '#b06000' : 'var(--primary)'};border:1px solid ${(f.fileCount || f.filesCount) ? '#feefc3' : 'transparent'};text-decoration:none;font-size:.78rem;padding:3px 8px;cursor:pointer" title="View files inside this register">
              📂 ${f.fileCount || f.filesCount || 0} Files
            </a>
          </td>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${f.details}">${f.details || '—'}</td>
          <td class="${canEdit ? 'col-location-cell' : ''}" ${canEdit ? `data-action="quick-update" data-fn="${f.fileNumber}" style="cursor:pointer;" title="Click to change location"` : ''}>
            ${f.location || '—'} ${canEdit ? '<span class="quick-edit-hint">✏️</span>' : ''}
          </td>
          <td class="${canEdit ? 'col-bin-cell' : ''}" ${canEdit ? `data-action="quick-update" data-fn="${f.fileNumber}" style="font-family:monospace;font-size:.8rem;cursor:pointer;" title="Click to change bin location"` : 'style="font-family:monospace;font-size:.8rem;"'}>
            ${f.binLocation || '—'} ${canEdit ? '<span class="quick-edit-hint">✏️</span>' : ''}
          </td>
          <td class="${canEdit ? 'col-status-cell' : ''}" ${canEdit ? `data-action="quick-update" data-fn="${f.fileNumber}" style="cursor:pointer;" title="Click to quickly change status or location"` : ''}>
            ${statusBadge(f.status)} ${canEdit ? '<span class="quick-edit-hint">⚡</span>' : ''}
          </td>
          <td>${f.heldBy ? `<span title="Due: ${fmtDate(f.dueDate)}">${f.heldBy}${overdue ? ' ⚠️' : ''}</span>` : '—'}</td>
          <td>
            <div class="col-actions">
              <button class="btn btn-ghost btn-icon btn-sm" data-action="view" data-fn="${f.fileNumber}" title="View Details">👁</button>
              ${canEdit ? `<button class="btn btn-sm btn-icon" data-action="quick-update" data-fn="${f.fileNumber}" title="⚡ Change Status, Location & Bin" style="color:#b06000;background:#fef7e0;border:1px solid #feefc3;font-weight:bold;">⚡</button>` : ''}
              ${canEdit ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-fn="${f.fileNumber}" title="Full Edit">✏️</button>` : ''}
              ${canCheckout ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="${f.status === 'Checked out' ? 'return' : 'checkout'}" data-fn="${f.fileNumber}" title="${f.status === 'Checked out' ? 'Return' : 'Check Out'}">
                ${f.status === 'Checked out' ? '↩️' : '📤'}
              </button>` : ''}
              ${canSticker ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="sticker" data-fn="${f.fileNumber}" title="Print Sticker">🏷️</button>` : ''}
              ${canDelete ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="delete" data-fn="${f.fileNumber}" title="Delete" style="color:var(--danger)">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${canBulk ? '<th class="col-cb"><input type="checkbox" id="reg-select-all" title="Select all on this page"></th>' : ''}
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

  function updateBulkToolbar() {
    const toolbar = document.getElementById('reg-bulk-toolbar');
    const countEl = document.getElementById('reg-bulk-count');
    const selectAllEl = document.getElementById('reg-select-all');
    if (!toolbar) return;

    const count = state.selectedFiles ? state.selectedFiles.size : 0;
    if (countEl) {
      countEl.textContent = `${count} file${count === 1 ? '' : 's'} selected`;
    }

    toolbar.classList.toggle('visible', count > 0);

    // Update select-all checkbox state on current page
    if (selectAllEl && state.files && state.files.length) {
      const pageFns = state.files.map(f => f.fileNumber);
      const selectedOnPage = pageFns.filter(fn => state.selectedFiles.has(fn)).length;
      if (selectedOnPage === 0) {
        selectAllEl.checked = false;
        selectAllEl.indeterminate = false;
      } else if (selectedOnPage === pageFns.length) {
        selectAllEl.checked = true;
        selectAllEl.indeterminate = false;
      } else {
        selectAllEl.checked = false;
        selectAllEl.indeterminate = true;
      }
    }
  }

  function bindTableActions(wrap) {
    // Select-all checkbox
    const selectAllCb = wrap.querySelector('#reg-select-all');
    selectAllCb?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      (state.files || []).forEach(f => {
        if (isChecked) {
          state.selectedFiles.add(f.fileNumber);
        } else {
          state.selectedFiles.delete(f.fileNumber);
        }
      });
      wrap.querySelectorAll('.reg-row-cb').forEach(cb => {
        cb.checked = isChecked;
        cb.closest('tr')?.classList.toggle('row-selected', isChecked);
      });
      updateBulkToolbar();
    });

    // Individual row checkboxes
    wrap.querySelectorAll('.reg-row-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const fn = cb.dataset.fn;
        if (cb.checked) {
          state.selectedFiles.add(fn);
        } else {
          state.selectedFiles.delete(fn);
        }
        cb.closest('tr')?.classList.toggle('row-selected', cb.checked);
        updateBulkToolbar();
      });
    });

    // Bulk toolbar action buttons
    document.getElementById('btn-bulk-clear-action')?.addEventListener('click', () => {
      state.selectedFiles.clear();
      wrap.querySelectorAll('.reg-row-cb').forEach(cb => {
        cb.checked = false;
        cb.closest('tr')?.classList.remove('row-selected');
      });
      updateBulkToolbar();
    });

    document.getElementById('btn-bulk-update-action')?.addEventListener('click', openBulkUpdateModal);
    document.getElementById('btn-bulk-print-action')?.addEventListener('click', handleBulkAddToPrint);

    // Initial update of toolbar & select-all state
    updateBulkToolbar();

    wrap.querySelectorAll('.col-actions button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = btn.dataset.fn;
        const action = btn.dataset.action;
        if      (action === 'view')         navigate(`#file/${encodeURIComponent(fn)}`);
        else if (action === 'quick-update') {
          const file = state.files.find(x => x.fileNumber === fn) || fn;
          CheckoutModule.openQuickStatusLocation(file, () => fetchAndRender());
        }
        else if (action === 'edit')         navigate(`#edit/${encodeURIComponent(fn)}`);
        else if (action === 'checkout')     CheckoutModule.openCheckout(fn, () => fetchAndRender());
        else if (action === 'return')       CheckoutModule.openReturn(fn, () => fetchAndRender());
        else if (action === 'sticker')      StickerModule.openSticker(fn);
        else if (action === 'delete')       doDelete(fn);
      });
    });

    wrap.querySelectorAll('td[data-action="quick-update"]').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = cell.dataset.fn;
        const file = state.files.find(x => x.fileNumber === fn) || fn;
        CheckoutModule.openQuickStatusLocation(file, () => fetchAndRender());
      });
    });

    wrap.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => { state.page = parseInt(btn.dataset.p); fetchAndRender(); });
    });
  }

  function openBulkUpdateModal() {
    const selectedList = Array.from(state.selectedFiles);
    if (!selectedList.length) {
      toast('Please select at least one file to update.', 'warning');
      return;
    }

    const cfg = App.config || {};
    const lsts = cfg.lists || {};
    const categories = (cfg.categories || []).map(c => c.name);
    const subcategories = (cfg.subcategories || []).map(c => c.name);
    const locations = lsts['Locations'] || [];
    const bins = lsts['Bin Locations'] || [];
    const hods = lsts['HODs'] || [];
    const statuses = ['In office', 'Checked out', 'Archived', 'Missing'];

    const modalBody = `
      <div class="bulk-modal-header">
        <div style="font-weight:700;font-size:0.95rem;color:var(--gray-900);margin-bottom:4px;">
          Updating ${selectedList.length} Selected File${selectedList.length > 1 ? 's' : ''}
        </div>
        <div style="font-size:0.8rem;color:var(--gray-600);">
          💡 Check the box next to any field you wish to update. Unchecked fields will remain untouched for all selected files.
        </div>
      </div>

      <form id="form-bulk-update">
        <div class="bulk-modal-grid">
          <!-- Location -->
          <div class="bulk-field-card" id="card-blk-location">
            <div class="bulk-field-top">
              <input type="checkbox" class="bulk-field-toggle" id="chk-blk-location">
              <label for="chk-blk-location" class="bulk-field-label">📍 Location</label>
            </div>
            <select class="form-control" id="val-blk-location">
              <option value="">— Select Location —</option>
              ${locations.map(l => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`).join('')}
            </select>
          </div>

          <!-- Category -->
          <div class="bulk-field-card" id="card-blk-category">
            <div class="bulk-field-top">
              <input type="checkbox" class="bulk-field-toggle" id="chk-blk-category">
              <label for="chk-blk-category" class="bulk-field-label">📁 Category</label>
            </div>
            <select class="form-control" id="val-blk-category">
              <option value="">— Select Category —</option>
              ${categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}
            </select>
          </div>

          <!-- Sub-Category -->
          <div class="bulk-field-card" id="card-blk-subcat">
            <div class="bulk-field-top">
              <input type="checkbox" class="bulk-field-toggle" id="chk-blk-subcat">
              <label for="chk-blk-subcat" class="bulk-field-label">📂 Sub-Category</label>
            </div>
            <select class="form-control" id="val-blk-subcat">
              <option value="">— Select Sub-Category —</option>
              ${subcategories.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('')}
            </select>
          </div>

          <!-- Bin Location -->
          <div class="bulk-field-card" id="card-blk-bin">
            <div class="bulk-field-top">
              <input type="checkbox" class="bulk-field-toggle" id="chk-blk-bin">
              <label for="chk-blk-bin" class="bulk-field-label">📦 Bin Location No.</label>
            </div>
            <input type="text" class="form-control" id="val-blk-bin" list="blk-bin-list" placeholder="e.g. Rack A-101">
            <datalist id="blk-bin-list">
              ${bins.map(b => `<option value="${escapeHTML(b)}">`).join('')}
            </datalist>
          </div>

          <!-- Status -->
          <div class="bulk-field-card" id="card-blk-status">
            <div class="bulk-field-top">
              <input type="checkbox" class="bulk-field-toggle" id="chk-blk-status">
              <label for="chk-blk-status" class="bulk-field-label">🚦 Status</label>
            </div>
            <select class="form-control" id="val-blk-status">
              <option value="">— Select Status —</option>
              ${statuses.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('')}
            </select>
          </div>

          <!-- Held By -->
          <div class="bulk-field-card" id="card-blk-heldby">
            <div class="bulk-field-top">
              <input type="checkbox" class="bulk-field-toggle" id="chk-blk-heldby">
              <label for="chk-blk-heldby" class="bulk-field-label">👤 Held By</label>
            </div>
            <input type="text" class="form-control" id="val-blk-heldby" list="blk-heldby-list" placeholder="Custodian / Department">
            <datalist id="blk-heldby-list">
              ${hods.map(h => `<option value="${escapeHTML(h)}">`).join('')}
            </datalist>
          </div>
        </div>
      </form>`;

    openModal({
      title: `⚡ Bulk Update (${selectedList.length} Files)`,
      size: 'modal-lg',
      body: modalBody,
      footer: `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-submit-bulk-update" style="font-weight:600;">
          Apply to ${selectedList.length} Files
        </button>`
    });

    // Toggle active styles on cards
    ['location', 'category', 'subcat', 'bin', 'status', 'heldby'].forEach(f => {
      const chk = document.getElementById(`chk-blk-${f}`);
      const card = document.getElementById(`card-blk-${f}`);
      chk?.addEventListener('change', () => {
        card?.classList.toggle('active', chk.checked);
      });
    });

    document.getElementById('btn-submit-bulk-update')?.addEventListener('click', () => {
      const updates = {};
      let anySelected = false;

      if (document.getElementById('chk-blk-location')?.checked) {
        updates.location = document.getElementById('val-blk-location')?.value || '';
        anySelected = true;
      }
      if (document.getElementById('chk-blk-category')?.checked) {
        updates.category = document.getElementById('val-blk-category')?.value || '';
        anySelected = true;
      }
      if (document.getElementById('chk-blk-subcat')?.checked) {
        updates.subCategory = document.getElementById('val-blk-subcat')?.value || '';
        anySelected = true;
      }
      if (document.getElementById('chk-blk-bin')?.checked) {
        updates.binLocation = document.getElementById('val-blk-bin')?.value || '';
        anySelected = true;
      }
      if (document.getElementById('chk-blk-status')?.checked) {
        updates.status = document.getElementById('val-blk-status')?.value || '';
        anySelected = true;
      }
      if (document.getElementById('chk-blk-heldby')?.checked) {
        updates.heldBy = document.getElementById('val-blk-heldby')?.value || '';
        anySelected = true;
      }

      if (!anySelected) {
        toast('Please check at least one field to update.', 'warning');
        return;
      }

      const btn = document.getElementById('btn-submit-bulk-update');
      if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }

      api('bulkUpdateFiles', {}, {
        fileNumbers: selectedList,
        updates: updates,
        updatedBy: App.user || 'System'
      }).then(res => {
        if (typeof AppDataStore !== 'undefined') {
          selectedList.forEach(fn => AppDataStore.updateItem(fn, updates));
        }
        closeModal();
        toast(`✅ Successfully updated ${res.count || selectedList.length} files!`, 'success');
        state.selectedFiles.clear();
        fetchAndRender();
      }).catch(err => {
        if (btn) { btn.disabled = false; btn.textContent = `Apply to ${selectedList.length} Files`; }
        toast(`Update failed: ${err.message}`, 'error');
      });
    });
  }

  function handleBulkAddToPrint() {
    const selectedList = Array.from(state.selectedFiles);
    if (!selectedList.length) {
      toast('Please select at least one file to add to print queue.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-bulk-print-action');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

    api('bulkAddToPrint', {}, {
      fileNumbers: selectedList,
      addedBy: App.user || 'System'
    }).then(res => {
      if (btn) { btn.disabled = false; btn.textContent = '🏷️ Add to Print'; }
      state.selectedFiles.clear();
      updateBulkToolbar();

      openModal({
        title: '🏷️ Added to Sticker Print Queue',
        body: `
          <div style="text-align:center;padding:16px 0;">
            <div style="font-size:2.5rem;margin-bottom:12px;">✅</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--gray-900);margin-bottom:6px;">
              ${res.count || selectedList.length} Files Added to Print Queue!
            </div>
            <p style="color:var(--gray-600);font-size:0.88rem;max-width:420px;margin:0 auto 16px;line-height:1.4;">
              These files have been marked in your <strong>Sticker Sheet</strong> and are ready for printing in the Print Stickers section.
            </p>
          </div>`,
        footer: `
          <button class="btn btn-secondary" onclick="closeModal()">Stay on Register</button>
          <a href="#stickers" class="btn btn-primary" onclick="closeModal()" style="font-weight:600;">
            Go to Print Stickers →
          </a>`
      });
    }).catch(err => {
      if (btn) { btn.disabled = false; btn.textContent = '🏷️ Add to Print'; }
      toast(`Failed to add to print queue: ${err.message}`, 'error');
    });
  }

  function doDelete(fn) {
    confirmDialog(`Permanently delete file <strong>${fn}</strong>? This cannot be undone.`, () => {
      api('deleteFile', {}, { action: 'deleteFile', fileNumber: fn, deletedBy: App.user })
        .then(() => {
          if (typeof AppDataStore !== 'undefined') {
            AppDataStore.deleteItem(fn);
          }
          toast('File deleted', 'success');
          fetchAndRender();
        })
        .catch(err => toast('Delete failed: ' + err.message, 'error'));
    }, 'Delete');
  }

  function exportAll() {
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
    const params = {
      search: state.search,
      category: state.category,
      subCategory: state.subCategory,
      filesCount: state.filesCount,
      location: state.location,
      binLocation: state.binLocation,
      status: state.status,
      heldBy: state.heldBy,
      oldFileNumber: state.oldFileNumber,
      includeArchived: 'true'
    };

    if (typeof AppDataStore !== 'undefined' && AppDataStore.isLoaded && AppDataStore.registers.length) {
      const result = AppDataStore.query(params, 1, 'all');
      exportToCSV(result.files || [], `file-register-${new Date().toISOString().slice(0,10)}.csv`);
      toast(`✅ Exported ${result.files.length} files to CSV`, 'success');
      return;
    }

    toast('Fetching all files for export…');
    api('getFiles', Object.assign({ page: 1, pageSize: 5000 }, params)).then(data => {
      exportToCSV(data.files || [], `file-register-${new Date().toISOString().slice(0,10)}.csv`);
      toast('CSV exported', 'success');
    }).catch(err => toast('Export failed: ' + err.message, 'error'));
  }

  return { render };
})();
