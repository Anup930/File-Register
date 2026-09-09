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

  let currentAlign = 'flex-start';

  function renderPrintPage(container, topbarActions) {
    topbarActions.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center;">
        <select id="sticker-format" class="form-control" style="width:180px; padding:6px 10px;">
          <option value="card" selected>Card View (Cover)</option>
          <option value="tabular">Tabular Form (Spine)</option>
        </select>
        <select id="sticker-align" class="form-control" style="width:100px; padding:6px 10px;">
          <option value="flex-start" selected>Left</option>
          <option value="center">Center</option>
          <option value="flex-end">Right</option>
        </select>
        <button class="btn btn-primary" id="btn-print-sheet">🖨️ Print Selected</button>
      </div>
    `;
    
    // Add pagination controls, Select All, and Modal container
    container.innerHTML = `
      <div class="toolbar" style="justify-content: space-between; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="stk-select-all" style="width:18px;height:18px;cursor:pointer;">
          <label for="stk-select-all" style="font-weight:600;cursor:pointer;">Select All on Page</label>
        </div>
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

      <!-- Print Settings Modal -->
      <div id="stk-print-modal" class="stk-custom-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:20px; border-radius:8px; width:400px; max-width:90%; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
          <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">Print Layout Settings</h4>
          
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
            <input type="number" id="stk-cols" class="form-control" value="2" min="1">
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
            <button class="btn btn-primary" id="btn-stk-modal-print" style="flex:1;">Print Now</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('sticker-format').addEventListener('change', (e) => {
      currentFormat = e.target.value;
      renderSheet(document.getElementById('sticker-content-wrap'));
    });
    
    document.getElementById('sticker-align').addEventListener('change', (e) => {
      currentAlign = e.target.value;
      renderSheet(document.getElementById('sticker-content-wrap'));
    });
    
    // Checkbox interaction
    document.getElementById('stk-select-all').addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.sticker-select-cb').forEach(cb => cb.checked = isChecked);
    });

    // Print Modal Triggers
    document.getElementById('btn-print-sheet').addEventListener('click', () => {
      const selected = document.querySelectorAll('.sticker-select-cb:checked');
      if(selected.length === 0) {
        alert("Please select at least one sticker to print.");
        return;
      }
      document.getElementById('stk-print-modal').style.display = 'flex';
    });

    document.getElementById('btn-stk-modal-cancel').addEventListener('click', () => {
      document.getElementById('stk-print-modal').style.display = 'none';
    });

    document.getElementById('btn-stk-modal-print').addEventListener('click', () => {
      document.getElementById('stk-print-modal').style.display = 'none';
      applyPrintSettingsAndPrint();
    });

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
          <div class="sheet-item-card" id="stk-wrapper-${i}" style="align-items: ${currentAlign}; text-align: ${currentAlign === 'flex-start' ? 'left' : currentAlign === 'center' ? 'center' : 'right'};">
            <input type="checkbox" class="card-checkbox sticker-select-cb" data-index="${i}">
            <div class="sc-header">
              <div class="sc-fn" style="text-align: inherit;">${fn}</div>
            </div>
            <div class="sc-barcode"><svg id="${bcId}"></svg></div>
            <div class="sc-body" style="display: flex; flex-direction: column; align-items: ${currentAlign};">
              <div style="text-align: left;">
                <div class="sc-row"><span class="sc-key">Client:</span><span class="sc-val">${client}</span></div>
                <div class="sc-row"><span class="sc-key">Category:</span><span class="sc-val">${cat}</span></div>
                <div class="sc-row"><span class="sc-key">Sub Category:</span><span class="sc-val">${sub}</span></div>
                <div class="sc-row"><span class="sc-key">Details:</span><span class="sc-val">${details}</span></div>
                <div class="sc-row"><span class="sc-key">Remarks:</span><span class="sc-val">${notes}</span></div>
              </div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="sheet-item-tabular" id="stk-wrapper-${i}" style="position:relative;">
            <input type="checkbox" class="card-checkbox sticker-select-cb" data-index="${i}" style="top:50%; transform:translateY(-50%);">
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

  function applyPrintSettingsAndPrint() {
    const isCard = currentFormat === 'card';
    
    // Get modal values
    const cols = parseInt(document.getElementById('stk-cols').value) || 2;
    const rowGap = parseFloat(document.getElementById('stk-rowGap').value) || 2;
    const colGap = parseFloat(document.getElementById('stk-colGap').value) || 2;
    const pageMargin = parseFloat(document.getElementById('stk-pageMargin').value) || 5;
    const padding = parseFloat(document.getElementById('stk-padding').value) || 4;
    const startRow = parseInt(document.getElementById('stk-startRow').value) || 1;
    const startCol = parseInt(document.getElementById('stk-startCol').value) || 1;

    // Get selected cards
    const selectedIndices = [];
    document.querySelectorAll('.sticker-select-cb:checked').forEach(cb => {
      selectedIndices.push(cb.getAttribute('data-index'));
    });

    if(selectedIndices.length === 0) return;

    // Calculate blank offset
    const blankCount = ((startRow - 1) * cols) + (startCol - 1);
    let htmlContent = '';
    
    // Inject blanks
    for(let i=0; i<blankCount; i++) {
      htmlContent += `<div class="${isCard ? 'sheet-item-card' : 'sheet-item-tabular'}" style="visibility:hidden; border:none; box-shadow:none;"></div>`;
    }

    // Add selected items
    selectedIndices.forEach(idx => {
      const el = document.getElementById('stk-wrapper-' + idx);
      if(el) {
        // Clone to remove checkboxes for print
        const clone = el.cloneNode(true);
        const cb = clone.querySelector('.card-checkbox');
        if(cb) cb.remove();
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
          // Give SVG some time to render, then print
          setTimeout(() => { window.print(); }, 800);
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  return { openSticker, openStickerFromFile, renderPrintPage };
})();
