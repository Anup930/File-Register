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
    overlay.querySelector('#stk-print-spine').addEventListener('click', () => printLabel('spine-label'));
    overlay.querySelector('#stk-print-cover').addEventListener('click', () => printLabel('cover-label'));
    overlay.querySelector('#stk-print-both').addEventListener('click', () => printLabel('both-labels'));
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

  function renderPrintPage(container, topbarActions) {
    topbarActions.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center;">
        <select id="sticker-format" class="form-control" style="width:180px; padding:6px 10px;">
          <option value="card" selected>Card View (Cover)</option>
          <option value="tabular">Tabular Form (Spine)</option>
        </select>
        <button class="btn btn-primary" id="btn-print-sheet">🖨️ Print Sheet</button>
      </div>
    `;
    
    // Add pagination controls and container
    container.innerHTML = `
      <div class="toolbar" style="justify-content: flex-end; margin-bottom:16px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:0.85rem; color:var(--gray-600)">Per Page:</span>
          <select id="sticker-pagesize" class="form-control" style="width:80px; padding:4px 8px; font-size:0.85rem;">
            <option value="15" selected>15</option>
            <option value="30">30</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-stk-prev">◀ Prev</button>
          <span style="font-size:0.85rem; padding:0 8px;" id="stk-page-info">Page 1 of 1</span>
          <button class="btn btn-secondary btn-sm" id="btn-stk-next">Next ▶</button>
        </div>
      </div>
      <div id="sticker-content-wrap"></div>
    `;

    document.getElementById('sticker-format').addEventListener('change', (e) => {
      currentFormat = e.target.value;
      renderSheet(document.getElementById('sticker-content-wrap'));
    });
    document.getElementById('btn-print-sheet').addEventListener('click', () => printSheet());

    document.getElementById('sticker-pagesize').addEventListener('change', (e) => {
      currentPageSize = parseInt(e.target.value, 10);
      currentPage = 1;
      fetchStickerFiles();
    });
    document.getElementById('btn-stk-prev').addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; fetchStickerFiles(); }
    });
    document.getElementById('btn-stk-next').addEventListener('click', () => {
      if (currentPage < currentTotalPages) { currentPage++; fetchStickerFiles(); }
    });

    fetchStickerFiles();
  }

  function fetchStickerFiles() {
    const wrap = document.getElementById('sticker-content-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading files…</span></div>';
    
    document.getElementById('btn-stk-prev').disabled = true;
    document.getElementById('btn-stk-next').disabled = true;
    
    api('getFiles', { page: currentPage, pageSize: currentPageSize }).then(res => {
      allFiles = Array.isArray(res) ? res : (res.files || []);
      currentTotalPages = res.pages || 1;
      
      document.getElementById('stk-page-info').textContent = `Page ${currentPage} of ${currentTotalPages}`;
      document.getElementById('btn-stk-prev').disabled = currentPage <= 1;
      document.getElementById('btn-stk-next').disabled = currentPage >= currentTotalPages;
      
      renderSheet(wrap);
    }).catch(err => {
      wrap.innerHTML = `<div class="error-msg">${err.message}</div>`;
    });
  }

  function renderSheet(container) {
    const isCard = currentFormat === 'card';
    let html = `<div id="print-sheet-container" class="${isCard ? 'sheet-card' : 'sheet-tabular'}">`;
    
    if (allFiles.length === 0) {
      html += `<div style="padding:20px; text-align:center; color:var(--gray-500); grid-column:1/-1;">No files found.</div>`;
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
          <div class="sheet-item-card">
            <div class="sc-header">
              <div class="sc-fn">${fn}</div>
            </div>
            <div class="sc-barcode"><svg id="${bcId}"></svg></div>
            <div class="sc-body">
              <div class="sc-row"><span class="sc-key">Client:</span><span class="sc-val">${client}</span></div>
              <div class="sc-row"><span class="sc-key">Category:</span><span class="sc-val">${cat}</span></div>
              <div class="sc-row"><span class="sc-key">Sub Category:</span><span class="sc-val">${sub}</span></div>
              <div class="sc-row"><span class="sc-key">Details:</span><span class="sc-val">${details}</span></div>
              <div class="sc-row"><span class="sc-key">Remarks:</span><span class="sc-val">${notes}</span></div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="sheet-item-tabular">
            <div class="st-col st-barcode">
              <div class="st-fn" style="text-align: left; margin-bottom: 4px;">${fn}</div>
              <svg id="${bcId}"></svg>
            </div>
            <div class="st-col st-mid">
              <div class="st-client">${client}</div>
            </div>
            <div class="st-col st-details">${details}</div>
          </div>
        `;
      }
    });
    
    html += `</div>`;
    container.innerHTML = `<div class="sheet-preview-wrap">${html}</div>`;
    
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

  function printSheet() {
    const el = document.getElementById('print-sheet-container');
    if (!el) return;
    const win = window.open('', '_blank', 'width=1000,height=800');
    
    const printCSS = `
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      @page { margin: 10mm; size: A4; }
      .sheet-card { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
      .sheet-item-card { border: 1px dashed #ccc; padding: 15px; page-break-inside: avoid; height: 130mm; box-sizing: border-box; }
      .sc-fn { font-family: monospace; font-weight: bold; font-size: 18px; margin-bottom: 8px; }
      .sc-barcode { margin-bottom: 12px; }
      .sc-barcode svg { max-width: 100%; height: auto; }
      .sc-row { display: flex; font-size: 13px; margin-bottom: 6px; }
      .sc-key { width: 110px; font-weight: bold; }
      .sc-val { flex: 1; }
      
      .sheet-tabular { display: flex; flex-direction: column; width: 100%; }
      .sheet-item-tabular { display: flex; border: 1px dashed #ccc; margin-bottom: -1px; page-break-inside: avoid; align-items: center; min-height: 35mm; }
      .st-col { padding: 12px; }
      .st-barcode { width: 35%; border-right: 1px dashed #eee; text-align: left; }
      .st-barcode svg { max-width: 100%; height: auto; }
      .st-mid { width: 35%; border-right: 1px dashed #eee; }
      .st-fn { font-family: monospace; font-weight: bold; font-size: 16px; margin-bottom: 6px; }
      .st-client { font-size: 13px; }
      .st-details { width: 30%; font-size: 13px; }
    `;
    
    win.document.write(`<html><head><title>Print Stickers</title><style>${printCSS}</style></head><body>${el.outerHTML}
      <script>setTimeout(()=>window.print(), 800);</script></body></html>`);
    win.document.close();
  }

  return { openSticker, openStickerFromFile, renderPrintPage };
})();
