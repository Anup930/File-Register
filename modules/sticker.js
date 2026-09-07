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

  return { openSticker, openStickerFromFile };
})();
