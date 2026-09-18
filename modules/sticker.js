// ── STICKER MODULE ────────────────────────────────────────────
const StickerModule = (() => {

  function openSticker(fileNumber) {
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      toast('Connect Apps Script to print stickers', 'warning'); return;
    }
    api('getFile', { fileNumber }).then(file => openStickerFromFile(file)).catch(err => toast(err.message, 'error'));
  }

  function openStickerFromFile(file) {
    const overlay = openModal({
      title: `🏷️ Print Stickers — ${file.fileNumber}`,
      body: buildStickerHTML(file),
      footer: `
        <button class="btn btn-secondary" id="stk-close">Close</button>
        <button class="btn btn-primary" id="stk-print-spine">🖨️ Print Spine Label</button>
        <button class="btn btn-primary" id="stk-print-cover">🖨️ Print Cover Label</button>
        <button class="btn btn-success" id="stk-print-both">🖨️ Print Both</button>`,
      size: 'modal-lg',
    });

    // Generate barcodes after modal renders
    setTimeout(() => {
      try {
        if (typeof JsBarcode !== 'undefined') {
          // Use CODE128 (denser than CODE39) and slightly thinner lines so it fits
          JsBarcode('#barcode-spine', file.fileNumber, { format: 'CODE128', width: 1.2, height: 26, displayValue: false, margin: 0 });
          JsBarcode('#barcode-cover', file.fileNumber, { format: 'CODE128', width: 1.3, height: 35, displayValue: false, margin: 0 });
        }
      } catch(e) { console.warn('Barcode generation failed', e); }
    }, 100);

    overlay.querySelector('#stk-close').addEventListener('click', closeModal);
    overlay.querySelector('#stk-print-spine').addEventListener('click', () => {
      printLabel('spine-label');
      recordPrintHistory([file], 'Spine Label');
    });
    overlay.querySelector('#stk-print-cover').addEventListener('click', () => {
      printLabel('cover-label');
      recordPrintHistory([file], 'Cover Label');
    });
    overlay.querySelector('#stk-print-both').addEventListener('click', () => {
      printLabel('both-labels');
      recordPrintHistory([file], 'Both (Spine & Cover)');
    });
  }

  function buildStickerHTML(file) {
    const fn = file.fileNumber || '';
    const client  = file.clientName  || '';
    const cat     = file.category    || '';
    const subcat  = file.subCategory || '';
    const details = file.details     || '';
    const notes   = file.notes       || '';

    return `
      <p style="color:var(--gray-600);font-size:.85rem;margin-bottom:16px">
        Preview below. Use the print buttons to open the browser print dialog.
      </p>
      <div class="sticker-preview">

        <!-- Spine Label -->
        <div>
          <p style="text-align:center;font-size:.75rem;color:var(--gray-500);margin-bottom:8px">Spine Label (1.8 cm × 25 cm)</p>
          <div class="sticker-spine" id="spine-label">
            <div class="s-filenum">${fn}</div>
            <div class="s-client">${client}</div>
            <div class="s-details">${details}</div>
            <div style="height: 260px; width: 100%; display: flex; align-items: center; justify-content: center;">
              <div style="transform: rotate(-90deg); transform-origin: center; display: flex; align-items: center; justify-content: center;">
                <svg id="barcode-spine"></svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Cover Label -->
        <div>
          <p style="text-align:center;font-size:.75rem;color:var(--gray-500);margin-bottom:8px">Cover Label (10 cm × 7 cm)</p>
          <div class="sticker-cover" id="cover-label">
            <div class="c-filenum">${fn}</div>
            <div class="c-row"><span class="c-key">Client:</span><span class="c-val">${client}</span></div>
            <div class="c-row"><span class="c-key">Category:</span><span class="c-val">${cat} / ${subcat}</span></div>
            <div class="c-row"><span class="c-key">Details:</span><span class="c-val">${details}</span></div>
            ${notes ? `<div class="c-row"><span class="c-key">Remarks:</span><span class="c-val">${notes}</span></div>` : ''}
            <div style="margin-top:auto; display:flex; justify-content:center;">
              <svg id="barcode-cover"></svg>
            </div>
          </div>
        </div>

      </div>
      <!-- Hidden both-labels container for combined print -->
      <div id="both-labels" style="display:none">
        <div id="spine-label-copy"></div>
        <div id="cover-label-copy"></div>
      </div>`;
  }

  function printLabel(labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;
    const win = window.open('', '_blank', 'width=600,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="UTF-8">
        <title>Print Sticker</title>
        <style>
          body { margin: 0; padding: 16px; font-family: Arial, sans-serif; }
          @page { margin: 5mm; }
          .sticker-spine {
            background: white; border: 1px solid #333;
            width: 68px; height: 378px;
            padding: 8px 4px;
            display: flex; flex-direction: column; align-items: center;
            gap: 6px; font-size: 7px;
          }
          .s-filenum { font-family: monospace; font-weight: 700; font-size: 8px; text-align: center; word-break: break-all; }
          .s-client  { font-weight: 600; text-align: center; }
          .s-details { text-align: center; color: #444; flex: 1; }
          .sticker-cover {
            background: white; border: 2px solid #333;
            width: 378px; height: 265px; padding: 12px;
            display: flex; flex-direction: column; gap: 6px; font-size: 10px;
          }
          .c-filenum { font-family: monospace; font-size: 16px; font-weight: 700; border-bottom: 1px solid #333; padding-bottom: 6px; }
          .c-row { display: flex; gap: 4px; }
          .c-key { font-weight: 600; min-width: 80px; color: #444; }
          .c-val { flex: 1; }
        </style>
      </head><body>
        ${label.outerHTML}
        <script>
          var svgs = document.querySelectorAll('svg');
          svgs.forEach(function(s) {
            var orig = document.getElementById(s.id);
            if (orig && document.getElementById(s.id + '-src')) return;
          });
          setTimeout(function() { window.print(); }, 300);
        <\/script>
      </body></html>`);
    win.document.close();
  }

  let allFiles = [];
  let currentFormat = 'card';
  let currentPage = 1;
  let currentTotalPages = 1;
  let currentPageSize = 15;
  let currentAlign = 'flex-start';
  let debounceTimer = null;

  let filterState = {
    search: '',
    client: '',
    category: '',
    subCategory: '',
    location: '',
    binLocation: '',
    status: '',
    oldFileNumber: '',
    printQueue: 'queued'
  };

  // ── AUDIT LOG HELPER: RECORD STICKER PRINT ────────────────────
  function recordPrintHistory(fileList, formatLabel) {
    if (!fileList || fileList.length === 0) return;
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') return;

    api('logStickerPrint', {}, {
      action: 'logStickerPrint',
      items: fileList.map(f => ({
        fileNumber: f.fileNumber,
        oldFileNumber: f.oldFileNumber || '',
        clientName: f.clientName || '',
        category: f.category || '',
        subCategory: f.subCategory || '',
        location: f.location || '',
        binLocation: f.binLocation || '',
        remarks: 'Printed ' + formatLabel
      })),
      format: formatLabel,
      printedBy: App.user || 'System'
    }).then(res => {
      toast(`Logged ${fileList.length} sticker(s) to Print Sticker sheet`, 'success');
    }).catch(err => {
      console.warn('Failed to log sticker print:', err);
    });

    // Mark Column Y as Printed in Register sheet
    api('markStickersPrinted', {}, {
      fileNumbers: fileList.map(f => f.fileNumber),
      printedBy: App.user || 'System'
    }).then(() => {
      setTimeout(fetchStickerFiles, 800);
    }).catch(() => {});
  }

  // ── PRINT HISTORY MODAL ───────────────────────────────────────
  function openPrintHistoryModal() {
    const overlay = openModal({
      title: `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.3rem;">📜</span>
          <div>
            <div style="font-size:1.05rem;font-weight:700;color:var(--gray-900);">Sticker Print Audit History</div>
            <div style="font-size:0.75rem;color:var(--gray-600);font-weight:normal;">Live log of stickers printed with Date, Time, Format & Operator</div>
          </div>
        </div>`,
      size: 'modal-xl',
      body: `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;flex-wrap:wrap;">
          <div class="search-wrap" style="max-width:320px;flex:1;">
            <span class="search-icon">🔍</span>
            <input type="text" id="hist-search-input" class="search-input" placeholder="Search by file, client, person...">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-history">🔄 Refresh</button>
        </div>
        <div id="stk-history-table-wrap">
          <div class="page-loading"><div class="spinner"></div><span>Loading print history…</span></div>
        </div>
      `,
      footer: `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span style="font-size:0.8rem;color:var(--gray-500);">Stored in 'Print Sticker' sheet</span>
          <button class="btn btn-secondary" id="btn-close-history">Close</button>
        </div>
      `
    });

    overlay.querySelector('#btn-close-history').addEventListener('click', closeModal);

    let histSearchTimer = null;
    overlay.querySelector('#hist-search-input').addEventListener('input', (e) => {
      clearTimeout(histSearchTimer);
      histSearchTimer = setTimeout(() => {
        loadHistoryData(e.target.value);
      }, 300);
    });

    overlay.querySelector('#btn-refresh-history').addEventListener('click', () => {
      const q = overlay.querySelector('#hist-search-input').value;
      loadHistoryData(q);
    });

    function loadHistoryData(search = '') {
      const wrap = overlay.querySelector('#stk-history-table-wrap');
      if (!wrap) return;
      wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading…</span></div>';

      if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
        wrap.innerHTML = '<div class="table-empty"><p>Connect Apps Script to view print history.</p></div>';
        return;
      }

      api('getStickerHistory', { search, page: 1, pageSize: 50 }).then(res => {
        const list = res.history || [];
        if (list.length === 0) {
          wrap.innerHTML = `<div class="table-empty"><div class="empty-icon">📭</div><p>No sticker printing records found.</p></div>`;
          return;
        }

        wrap.innerHTML = `
          <div class="table-wrap" style="max-height:420px;overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>File Number</th>
                  <th>Old File No.</th>
                  <th>Client</th>
                  <th>Format</th>
                  <th>Printed By</th>
                  <th>Location / Bin</th>
                  <th>Print ID</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(r => `
                  <tr>
                    <td style="white-space:nowrap;font-size:0.8rem;font-weight:600;color:var(--gray-700);">${escapeHTML(r.printDateTime)}</td>
                    <td class="col-file-num"><a href="#file/${encodeURIComponent(r.fileNumber)}" target="_blank">${escapeHTML(r.fileNumber)}</a></td>
                    <td style="font-size:0.8rem;color:var(--gray-600);">${escapeHTML(r.oldFileNumber || '—')}</td>
                    <td style="font-size:0.85rem;color:var(--gray-800);">${escapeHTML(r.clientName || '—')}</td>
                    <td><span class="badge" style="background:#e8f0fe;color:#1a73e8;font-weight:600;">${escapeHTML(r.stickerFormat)}</span></td>
                    <td style="white-space:nowrap;font-size:0.85rem;font-weight:600;color:var(--gray-900);">${escapeHTML(r.printedBy || '—')}</td>
                    <td style="font-size:0.8rem;color:var(--gray-600);">${escapeHTML(r.location || '—')} ${r.binLocation ? `(${escapeHTML(r.binLocation)})` : ''}</td>
                    <td style="font-family:monospace;font-size:0.75rem;color:var(--gray-500);">${escapeHTML(r.printId)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="font-size:0.78rem;color:var(--gray-500);padding:8px 4px;">Showing latest ${list.length} print records</div>
        `;
      }).catch(err => {
        wrap.innerHTML = `<div class="table-empty"><p style="color:var(--danger)">Error: ${err.message}</p></div>`;
      });
    }

    loadHistoryData('');
  }

  // ── MAIN PRINT PAGE WITH FILTER DATA CONTROLS ─────────────────
  function renderPrintPage(container, topbarActions) {
    topbarActions.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="sticker-format" class="form-control" style="width:160px; padding:6px 10px; font-size:0.85rem;">
          <option value="card" ${currentFormat==='card'?'selected':''}>Card View (Cover)</option>
          <option value="tabular" ${currentFormat==='tabular'?'selected':''}>Tabular Form (Spine)</option>
        </select>
        <select id="sticker-align" class="form-control" style="width:90px; padding:6px 10px; font-size:0.85rem;">
          <option value="flex-start" ${currentAlign==='flex-start'?'selected':''}>Left</option>
          <option value="center" ${currentAlign==='center'?'selected':''}>Center</option>
          <option value="flex-end" ${currentAlign==='flex-end'?'selected':''}>Right</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-stk-history-top" style="display:flex;align-items:center;gap:5px;">
          📜 Print History
        </button>
        <button class="btn btn-primary btn-sm" id="btn-print-sheet" style="font-weight:600;display:flex;align-items:center;gap:6px;">
          🖨️ Print Selected (<span id="stk-selected-count">0</span>)
        </button>
      </div>
    `;

    // Dropdown list data from App.config
    const clients = App.config?.clients || [];
    const categories = App.config?.categories || [];
    const locations = (App.config?.lists?.['Location'] || []).filter(Boolean);
    const bins = (App.config?.lists?.['Bin Location'] || []).filter(Boolean);
    const statuses = ['In office', 'Checked out', 'Archived', 'Missing', 'Closed'];

    container.innerHTML = `
      <div class="toolbar" style="margin-bottom:16px;">
        <!-- Row 1: Search & Action Controls -->
        <div class="toolbar-row1" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div class="search-wrap" style="flex:1;min-width:240px;max-width:320px;">
            <span class="search-icon">🔍</span>
            <input type="text" id="stk-search" class="search-input" placeholder="Search file, client, details..." value="${escapeHTML(filterState.search)}">
          </div>

          <div id="stk-counter-pill" style="display:inline-flex;align-items:center;gap:8px;background:white;padding:6px 14px;border:1px solid var(--gray-300);border-radius:20px;font-size:0.85rem;">
            <span id="stk-files-found-txt" style="color:var(--gray-700);">Loading files…</span>
            <span style="color:var(--gray-300)">|</span>
            <strong id="stk-badge-selected-txt" style="color:var(--primary);">0 selected</strong>
          </div>

          <div style="display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-stk-select-all-btn">☑️ Select All</button>
            <button class="btn btn-secondary btn-sm" id="btn-stk-deselect-all-btn">⬜ Clear Selection</button>
            <button class="btn btn-ghost btn-sm" id="btn-stk-clear-filters" style="color:var(--danger);">↺ Reset Filters</button>
          </div>
        </div>

        <!-- Row 2: Filter Data Controls -->
        <div class="filter-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          ${App.renderFilterPill ? App.renderFilterPill('Queue', 'stk-filter-queue', [{ value: 'queued', text: '📋 Queued for Print' }, { value: 'all', text: '🌐 All Files' }, { value: 'printed', text: '✅ Already Printed' }], filterState.printQueue || 'queued', 'Queued for Print') : ''}
          ${App.renderFilterPill ? App.renderFilterPill('Client', 'stk-filter-client', [{ value: '', text: 'All Clients' }, ...clients.map(c => ({ value: c.name, text: c.name }))], filterState.client, 'All Clients') : ''}
          ${App.renderFilterPill ? App.renderFilterPill('Category', 'stk-filter-category', [{ value: '', text: 'All Categories' }, ...categories.map(c => ({ value: c.name, text: c.name }))], filterState.category, 'All Categories') : ''}
          ${App.renderFilterPill ? App.renderFilterPill('Location', 'stk-filter-location', [{ value: '', text: 'All Locations' }, ...locations.map(l => ({ value: l, text: l }))], filterState.location, 'All Locations') : ''}
          ${App.renderFilterPill ? App.renderFilterPill('Bin', 'stk-filter-bin', [{ value: '', text: 'All Bins' }, ...bins.map(b => ({ value: b, text: b }))], filterState.binLocation, 'All Bins') : ''}
          ${App.renderFilterPill ? App.renderFilterPill('Status', 'stk-filter-status', [{ value: '', text: 'All Statuses' }, ...statuses.map(s => ({ value: s, text: s }))], filterState.status, 'All Statuses') : ''}
        </div>

        <!-- Row 3: Pagination & Per Page -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:8px 0; border-top:1px solid var(--gray-200);">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="stk-select-all" style="width:18px;height:18px;cursor:pointer;">
            <label for="stk-select-all" style="font-weight:600;cursor:pointer;font-size:0.88rem;">Select All on Page</label>
          </div>

          <div style="display:flex; gap:8px; align-items:center;">
            <span style="font-size:0.85rem; color:var(--gray-600)">Per Page:</span>
            <select id="sticker-pagesize" class="form-control" style="width:80px; padding:4px 8px; font-size:0.85rem;">
              <option value="15" ${currentPageSize===15?'selected':''}>15</option>
              <option value="30" ${currentPageSize===30?'selected':''}>30</option>
              <option value="50" ${currentPageSize===50?'selected':''}>50</option>
              <option value="100" ${currentPageSize===100?'selected':''}>100</option>
            </select>
            <button class="btn btn-secondary btn-sm" id="btn-stk-prev">◀ Prev</button>
            <span style="font-size:0.85rem; padding:0 8px;" id="stk-page-info">Page 1 of 1</span>
            <button class="btn btn-secondary btn-sm" id="btn-stk-next">Next ▶</button>
          </div>
        </div>
      </div>

      <!-- Sticker Cards Container -->
      <div id="sticker-content-wrap"></div>

      <!-- Print Layout Settings Modal -->
      <div id="stk-print-modal" class="stk-custom-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:22px 24px; border-radius:12px; width:440px; max-width:92%; box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--gray-200);padding-bottom:12px;margin-bottom:16px;">
            <h4 style="margin:0;font-size:1.1rem;font-weight:700;color:var(--gray-900);">🖨️ Print Layout & Sheet Tracking</h4>
            <button id="btn-stk-modal-close-icon" class="modal-close">✕</button>
          </div>
          
          <div style="background:#e8f0fe;border:1px solid #c2e7ff;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:0.82rem;color:#1a73e8;">
            ✓ <strong id="stk-confirm-count">0</strong> stickers selected.<br>
            ✓ Print history will be recorded to <strong>'Print Sticker'</strong> sheet with operator: <strong>${escapeHTML(App.user || 'System')}</strong>.
          </div>

          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1"><label style="font-size:12px; font-weight:bold;">Row Gap (mm)</label><input type="number" id="stk-rowGap" class="form-control" value="2" step="1"></div>
            <div style="flex:1"><label style="font-size:12px; font-weight:bold;">Col Gap (mm)</label><input type="number" id="stk-colGap" class="form-control" value="2" step="1"></div>
          </div>
          
          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1"><label style="font-size:12px; font-weight:bold;">Page Margin (mm)</label><input type="number" id="stk-pageMargin" class="form-control" value="5" step="1"></div>
            <div style="flex:1"><label style="font-size:12px; font-weight:bold;">Padding (mm)</label><input type="number" id="stk-padding" class="form-control" value="4" step="1"></div>
          </div>

          <div style="margin-bottom:10px;">
            <label style="font-size:12px; font-weight:bold;">Columns per Page</label>
            <input type="number" id="stk-cols" class="form-control" value="2" min="1" max="6">
          </div>
          
          <div style="border-top:1px dashed #ccc; margin:15px 0; padding-top:10px;">
            <p style="font-size:13px; font-weight:bold; margin-bottom:8px;">Skip Used Stickers:</p>
            <div style="display:flex; gap:10px;">
              <div style="flex:1"><label style="font-size:12px;">Start Row</label><input type="number" id="stk-startRow" class="form-control" value="1" min="1"></div>
              <div style="flex:1"><label style="font-size:12px;">Start Col</label><input type="number" id="stk-startCol" class="form-control" value="1" min="1"></div>
            </div>
          </div>

          <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn btn-secondary" id="btn-stk-modal-cancel" style="flex:1;">Cancel</button>
            <button class="btn btn-primary" id="btn-stk-modal-print" style="flex:1;font-weight:600;">Print & Record Now</button>
          </div>
        </div>
      </div>
    `;

    // ── Event Listeners ──────────────────────────────────────────
    document.getElementById('sticker-format').addEventListener('change', (e) => {
      currentFormat = e.target.value;
      renderSheet(document.getElementById('sticker-content-wrap'));
    });
    
    document.getElementById('sticker-align').addEventListener('change', (e) => {
      currentAlign = e.target.value;
      renderSheet(document.getElementById('sticker-content-wrap'));
    });

    document.getElementById('btn-stk-history-top').addEventListener('click', openPrintHistoryModal);

    // Search filter input
    const searchEl = document.getElementById('stk-search');
    searchEl?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filterState.search = e.target.value.trim();
        currentPage = 1;
        fetchStickerFiles();
      }, 300);
    });

    // Dropdown filters
    const filterMap = [
      { id: 'stk-filter-queue',    key: 'printQueue',  options: [{ value: 'queued', text: '📋 Queued for Print' }, { value: 'all', text: '🌐 All Files' }, { value: 'printed', text: '✅ Already Printed' }] },
      { id: 'stk-filter-client',   key: 'client',      options: [{ value: '', text: 'All Clients' }, ...clients.map(c => ({ value: c.name, text: c.name }))] },
      { id: 'stk-filter-category', key: 'category',    options: [{ value: '', text: 'All Categories' }, ...categories.map(c => ({ value: c.name, text: c.name }))] },
      { id: 'stk-filter-location', key: 'location',    options: [{ value: '', text: 'All Locations' }, ...locations.map(l => ({ value: l, text: l }))] },
      { id: 'stk-filter-bin',      key: 'binLocation', options: [{ value: '', text: 'All Bins' }, ...bins.map(b => ({ value: b, text: b }))] },
      { id: 'stk-filter-status',   key: 'status',      options: [{ value: '', text: 'All Statuses' }, ...statuses.map(s => ({ value: s, text: s }))] }
    ];

    filterMap.forEach(item => {
      if (App.bindFilterPill) {
        App.bindFilterPill(item.id, item.options);
      }
      const el = document.getElementById(item.id);
      if (!el) return;
      el.addEventListener('change', () => {
        filterState[item.key] = el.value;
        currentPage = 1;
        const pill = document.getElementById(`pill-${item.id}`) || el.closest('.filter-pill');
        if (pill) pill.classList.toggle('filter-active', item.key === 'printQueue' ? el.value !== 'all' : !!el.value);
        fetchStickerFiles();
      });
    });

    // Clear Filters
    document.getElementById('btn-stk-clear-filters')?.addEventListener('click', () => {
      filterState = { search: '', client: '', category: '', subCategory: '', location: '', binLocation: '', status: '', oldFileNumber: '', printQueue: 'queued' };
      currentPage = 1;
      renderPrintPage(container, topbarActions);
    });

    // Select All / Deselect All
    document.getElementById('stk-select-all')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.sticker-select-cb').forEach(cb => cb.checked = isChecked);
      updateSelectedCount();
    });

    document.getElementById('btn-stk-select-all-btn')?.addEventListener('click', () => {
      document.querySelectorAll('.sticker-select-cb').forEach(cb => cb.checked = true);
      const masterCb = document.getElementById('stk-select-all');
      if (masterCb) masterCb.checked = true;
      updateSelectedCount();
    });

    document.getElementById('btn-stk-deselect-all-btn')?.addEventListener('click', () => {
      document.querySelectorAll('.sticker-select-cb').forEach(cb => cb.checked = false);
      const masterCb = document.getElementById('stk-select-all');
      if (masterCb) masterCb.checked = false;
      updateSelectedCount();
    });

    // Print Modal Triggers
    document.getElementById('btn-print-sheet')?.addEventListener('click', () => {
      const selected = document.querySelectorAll('.sticker-select-cb:checked');
      if (selected.length === 0) {
        toast("Please select at least one sticker to print.", "warning");
        return;
      }
      const countEl = document.getElementById('stk-confirm-count');
      if (countEl) countEl.textContent = selected.length;
      document.getElementById('stk-print-modal').style.display = 'flex';
    });

    const closeModalHandler = () => {
      document.getElementById('stk-print-modal').style.display = 'none';
    };
    document.getElementById('btn-stk-modal-cancel')?.addEventListener('click', closeModalHandler);
    document.getElementById('btn-stk-modal-close-icon')?.addEventListener('click', closeModalHandler);

    document.getElementById('btn-stk-modal-print')?.addEventListener('click', () => {
      document.getElementById('stk-print-modal').style.display = 'none';
      applyPrintSettingsAndPrint();
    });

    document.getElementById('sticker-pagesize')?.addEventListener('change', (e) => {
      currentPageSize = parseInt(e.target.value, 10);
      currentPage = 1;
      fetchStickerFiles();
    });
    document.getElementById('btn-stk-prev')?.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; fetchStickerFiles(); }
    });
    document.getElementById('btn-stk-next')?.addEventListener('click', () => {
      if (currentPage < currentTotalPages) { currentPage++; fetchStickerFiles(); }
    });

    fetchStickerFiles();
  }

  function updateSelectedCount() {
    const selected = document.querySelectorAll('.sticker-select-cb:checked');
    const count = selected.length;
    const topCount = document.getElementById('stk-selected-count');
    if (topCount) topCount.textContent = count;
    const badgeSelected = document.getElementById('stk-badge-selected-txt');
    if (badgeSelected) badgeSelected.textContent = `${count} selected`;
  }

  function fetchStickerFiles() {
    const wrap = document.getElementById('sticker-content-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Filtering & loading files…</span></div>';
    
    document.getElementById('btn-stk-prev').disabled = true;
    document.getElementById('btn-stk-next').disabled = true;

    const params = {
      page: currentPage,
      pageSize: currentPageSize,
      search: filterState.search,
      client: filterState.client,
      category: filterState.category,
      subCategory: filterState.subCategory,
      location: filterState.location,
      binLocation: filterState.binLocation,
      status: filterState.status,
      oldFileNumber: filterState.oldFileNumber,
      printQueue: filterState.printQueue || 'queued',
      includeArchived: filterState.status === 'Archived' ? 'true' : 'false'
    };
    
    api('getFiles', params).then(res => {
      allFiles = Array.isArray(res) ? res : (res.files || []);
      currentTotalPages = res.pages || 1;
      const totalCount = res.total !== undefined ? res.total : allFiles.length;
      
      const foundTxt = document.getElementById('stk-files-found-txt');
      if (foundTxt) foundTxt.textContent = `${totalCount} files found`;

      const pageInfo = document.getElementById('stk-page-info');
      if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${currentTotalPages}`;

      document.getElementById('btn-stk-prev').disabled = currentPage <= 1;
      document.getElementById('btn-stk-next').disabled = currentPage >= currentTotalPages;
      
      renderSheet(wrap);
      updateSelectedCount();
    }).catch(err => {
      wrap.innerHTML = `<div class="table-empty"><p style="color:var(--danger)">Error loading files: ${err.message}</p></div>`;
    });
  }

  function renderSheet(container) {
    const isCard = currentFormat === 'card';
    let html = `<div id="print-sheet-container" class="${isCard ? 'sheet-card' : 'sheet-tabular'}">`;
    
    if (allFiles.length === 0) {
      html += `<div style="padding:40px 20px; text-align:center; color:var(--gray-500); grid-column:1/-1;">No matching files found for the current filters.</div>`;
    }

    allFiles.forEach((f, i) => {
      const fn = f.fileNumber || '';
      const client = f.clientName || '';
      const cat = f.category || '';
      const sub = f.subCategory || '';
      const details = f.details || '';
      const notes = f.notes || '';
      const bcId = 'bc-bulk-' + i;
      
      if (isCard) {
        html += `
          <div class="sheet-item-card" id="stk-wrapper-${i}" style="align-items: ${currentAlign}; text-align: ${currentAlign === 'flex-start' ? 'left' : currentAlign === 'center' ? 'center' : 'right'};">
            <input type="checkbox" class="card-checkbox sticker-select-cb" data-index="${i}">
            <div class="sc-header">
              <div class="sc-fn" style="text-align: inherit;">${escapeHTML(fn)}</div>
            </div>
            <div class="sc-barcode"><svg id="${bcId}"></svg></div>
            <div class="sc-body" style="display: flex; flex-direction: column; align-items: ${currentAlign};">
              <div style="text-align: left;">
                <div class="sc-row"><span class="sc-key">Client:</span><span class="sc-val">${escapeHTML(client)}</span></div>
                <div class="sc-row"><span class="sc-key">Category:</span><span class="sc-val">${escapeHTML(cat)}</span></div>
                <div class="sc-row"><span class="sc-key">Sub Category:</span><span class="sc-val">${escapeHTML(sub)}</span></div>
                <div class="sc-row"><span class="sc-key">Details:</span><span class="sc-val">${escapeHTML(details)}</span></div>
                ${notes ? `<div class="sc-row"><span class="sc-key">Remarks:</span><span class="sc-val">${escapeHTML(notes)}</span></div>` : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="sheet-item-tabular" id="stk-wrapper-${i}" style="position:relative;">
            <input type="checkbox" class="card-checkbox sticker-select-cb" data-index="${i}" style="top:50%; transform:translateY(-50%);">
            <div class="st-col st-barcode">
              <div class="st-fn" style="text-align: left; margin-bottom: 4px;">${escapeHTML(fn)}</div>
              <svg id="${bcId}"></svg>
            </div>
            <div class="st-col st-mid">
              <div class="st-client">${escapeHTML(client)}</div>
            </div>
            <div class="st-col st-details">${escapeHTML(details)}</div>
          </div>
        `;
      }
    });
    
    html += `</div>`;
    container.innerHTML = `<div class="sheet-preview-wrap">${html}</div>`;

    // Bind individual checkboxes to update count
    container.querySelectorAll('.sticker-select-cb').forEach(cb => {
      cb.addEventListener('change', updateSelectedCount);
    });
    
    // Generate barcodes
    setTimeout(() => {
      if (typeof JsBarcode === 'undefined') return;
      allFiles.forEach((f, i) => {
        try {
          if (isCard) {
            JsBarcode('#bc-bulk-' + i, f.fileNumber, { format: 'CODE128', width: 1.5, height: 45, displayValue: false, margin: 0 });
          } else {
            JsBarcode('#bc-bulk-' + i, f.fileNumber, { format: 'CODE128', width: 1.2, height: 35, displayValue: false, margin: 0 });
          }
        } catch(e) {}
      });
    }, 150);
  }

  function applyPrintSettingsAndPrint() {
    const isCard = currentFormat === 'card';
    const formatLabel = isCard ? 'Card View (Cover)' : 'Tabular Form (Spine)';
    
    // Get modal values
    const cols = parseInt(document.getElementById('stk-cols').value) || 2;
    const rowGap = parseFloat(document.getElementById('stk-rowGap').value) || 2;
    const colGap = parseFloat(document.getElementById('stk-colGap').value) || 2;
    const pageMargin = parseFloat(document.getElementById('stk-pageMargin').value) || 5;
    const padding = parseFloat(document.getElementById('stk-padding').value) || 4;
    const startRow = parseInt(document.getElementById('stk-startRow').value) || 1;
    const startCol = parseInt(document.getElementById('stk-startCol').value) || 1;

    // Get selected cards and corresponding file objects
    const selectedIndices = [];
    const selectedFiles = [];
    document.querySelectorAll('.sticker-select-cb:checked').forEach(cb => {
      const idx = parseInt(cb.getAttribute('data-index'), 10);
      selectedIndices.push(idx);
      if (allFiles[idx]) selectedFiles.push(allFiles[idx]);
    });

    if (selectedIndices.length === 0) return;

    // Record print history to Google Sheets in background
    recordPrintHistory(selectedFiles, formatLabel);

    // Calculate blank offset
    const blankCount = ((startRow - 1) * cols) + (startCol - 1);
    let htmlContent = '';
    
    // Inject blanks
    for (let i = 0; i < blankCount; i++) {
      htmlContent += `<div class="${isCard ? 'sheet-item-card' : 'sheet-item-tabular'}" style="visibility:hidden; border:none; box-shadow:none;"></div>`;
    }

    // Add selected items
    selectedIndices.forEach(idx => {
      const el = document.getElementById('stk-wrapper-' + idx);
      if (el) {
        const clone = el.cloneNode(true);
        const cb = clone.querySelector('.card-checkbox');
        if (cb) cb.remove();
        htmlContent += clone.outerHTML;
      }
    });

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    
    const printCSS = `
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      @page { margin: ${pageMargin}mm; size: A4; }
      
      .sheet-card { 
        display: grid; 
        grid-template-columns: repeat(${cols}, 1fr); 
        gap: ${rowGap}mm ${colGap}mm; 
      }
      .sheet-item-card { 
        border: 1px dashed #ccc; 
        padding: ${padding}mm; 
        page-break-inside: avoid; 
        height: 130mm; 
        box-sizing: border-box; 
        display: flex; flex-direction: column;
        align-items: ${currentAlign};
        text-align: ${currentAlign === 'flex-start' ? 'left' : currentAlign === 'center' ? 'center' : 'right'};
      }
      .sc-header { text-align: inherit; }
      .sc-fn { font-family: monospace; font-weight: bold; font-size: 18px; margin-bottom: 8px; text-align: inherit; }
      .sc-barcode { margin-bottom: 12px; }
      .sc-barcode svg { max-width: 100%; height: auto; }
      .sc-body { display: flex; flex-direction: column; align-items: ${currentAlign}; width: 100%; }
      .sc-row { display: flex; font-size: 13px; margin-bottom: 6px; }
      .sc-key { width: 110px; font-weight: bold; }
      .sc-val { flex: 1; }
      
      .sheet-tabular { 
        display: grid; 
        grid-template-columns: repeat(${cols}, 1fr); 
        gap: ${rowGap}mm ${colGap}mm; 
        width: 100%; 
      }
      .sheet-item-tabular { 
        display: flex; 
        border: 1px dashed #ccc; 
        padding: ${padding}mm; 
        page-break-inside: avoid; 
        align-items: center; 
        min-height: 35mm; 
      }
      .st-col { padding: 4px; }
      .st-barcode { width: 35%; border-right: 1px dashed #eee; text-align: left; }
      .st-barcode svg { max-width: 100%; height: auto; }
      .st-mid { width: 35%; border-right: 1px dashed #eee; padding-left: 10px; }
      .st-fn { font-family: monospace; font-weight: bold; font-size: 16px; margin-bottom: 6px; }
      .st-client { font-size: 13px; }
      .st-details { width: 30%; font-size: 13px; padding-left: 10px; }
    `;
    
    const wrapperClass = isCard ? 'sheet-card' : 'sheet-tabular';

    printWin.document.write(`
      <html>
      <head>
        <title>Print Stickers</title>
        <style>${printCSS}</style>
      </head>
      <body>
        <div class="${wrapperClass}">${htmlContent}</div>
        <script>
          setTimeout(() => { window.print(); }, 800);
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  return { openSticker, openStickerFromFile, renderPrintPage, openPrintHistoryModal };
})();

