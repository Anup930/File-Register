// ── IMPORT MODULE ─────────────────────────────────────────────
const ImportModule = (() => {

  let step = 1;
  let parsedHeaders = [];
  let parsedRows = [];
  let mapping = {};
  const FIELD_LABELS = {
    fileNumber: 'File Number (or AUTO)', oldFileNumber: 'Old File Number',
    clientName: 'Client Name', category: 'Category', subCategory: 'Sub-Category',
    details: 'Details', entity: 'Entity', businessVertical: 'Business Vertical',
    location: 'Location', hod: 'HOD', fileType: 'File Type', colour: 'Colour',
    binLocation: 'Bin Location', status: 'Status', heldBy: 'Held By',
    dueDate: 'Due Date', tags: 'Tags', relatedDocs: 'Related Documents', notes: 'Notes'
  };
  const REQUIRED = ['clientName', 'category', 'subCategory'];

  function render(container, topbarActions) {
    step = 1; parsedHeaders = []; parsedRows = []; mapping = {};
    container.innerHTML = buildHTML();
    bindStep1(container);
  }

  function buildHTML() {
    return `
      <div style="max-width:800px">
        <div class="card">
          <div class="card-header"><span class="card-title">📥 Bulk Import Files</span></div>
          <div class="card-body">
            <div class="step-indicator">
              <div class="step-dot ${step>=1?'active':''}" data-num="1">Upload CSV</div>
              <div class="step-dot ${step>=2?'active':''}" data-num="2">Map Columns</div>
              <div class="step-dot ${step>=3?'active':''}" data-num="3">Preview</div>
              <div class="step-dot ${step>=4?'active':''}" data-num="4">Import</div>
            </div>
            <div id="import-step-content">${buildStep1()}</div>
          </div>
        </div>
      </div>`;
  }

  function buildStep1() {
    return `
      <div class="import-step active" id="step-1">
        <div class="drop-zone" id="drop-zone">
          <div class="dz-icon">📄</div>
          <p><strong>Drop a CSV file here</strong> or click to browse</p>
          <p style="margin-top:6px;font-size:.8rem;color:var(--gray-500)">Supports .csv files (UTF-8). First row must be headers.</p>
          <input type="file" id="file-input" accept=".csv,text/csv" style="display:none">
        </div>
        <p style="text-align:center;color:var(--gray-500);margin:8px 0">— or paste CSV text below —</p>
        <textarea class="form-control" id="csv-paste" rows="6" placeholder="Paste CSV content here…"></textarea>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">
          <a href="#" id="btn-download-sample" style="font-size:0.85rem">↓ Download Sample CSV</a>
          <button class="btn btn-primary" id="btn-parse-csv">Parse CSV →</button>
        </div>
      </div>`;
  }

  function buildStep2() {
    const fieldOptions = Object.entries(FIELD_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
    const rows = parsedHeaders.map((h, i) => {
      const autoGuess = autoMap(h);
      return `
        <tr>
          <td>${h}</td>
          <td><small style="color:var(--gray-500)">${String(parsedRows[0]?.[i]||'').substring(0,40)}</small></td>
          <td>
            <select class="filter-select" data-col="${i}" id="map-${i}">
              <option value="">— Skip this column —</option>
              ${fieldOptions}
            </select>
          </td>
        </tr>`;
    }).join('');
    return `
      <div>
        <p style="margin-bottom:16px;color:var(--gray-600)">
          Match each column from your CSV to a field in the register. 
          <strong>${parsedRows.length}</strong> data rows found.
        </p>
        <div style="overflow-x:auto;border-radius:var(--radius);border:1px solid var(--gray-200);margin-bottom:16px">
          <table class="mapping-table">
            <thead><tr><th>Your Column</th><th>Sample Value</th><th>Maps To</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:space-between">
          <button class="btn btn-secondary" id="btn-back-1">← Back</button>
          <button class="btn btn-primary" id="btn-to-preview">Preview →</button>
        </div>
      </div>`;
  }

  function buildStep3(mappedRows) {
    const first10 = mappedRows.slice(0, 10);
    const colFields = ['clientName','category','subCategory','details','location','status','oldFileNumber'];
    const headers = colFields.map(k => FIELD_LABELS[k] || k);
    const previewRows = first10.map(r => `
      <tr>${colFields.map(k => `<td>${String(r[k]||'').substring(0,40)}</td>`).join('')}</tr>`).join('');
    return `
      <div>
        <p style="margin-bottom:12px;color:var(--gray-600)">
          Showing first 10 of <strong>${mappedRows.length}</strong> rows. Required fields marked with *.
        </p>
        <div class="import-preview-table">
          <table style="font-size:.8rem;width:100%">
            <thead style="position:sticky;top:0;background:var(--gray-100)">
              <tr>${headers.map(h=>`<th style="padding:8px 10px">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${previewRows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:16px">
          <button class="btn btn-secondary" id="btn-back-2">← Back</button>
          <button class="btn btn-primary" id="btn-start-import">📥 Import ${mappedRows.length} Records</button>
        </div>
      </div>`;
  }

  function buildStep4(result) {
    const hasErrors = result.errors && result.errors.length > 0;
    const mappingRows = (result.mapping || []).slice(0, 20).map(m =>
      `<tr><td>${m.oldFileNumber||'—'}</td><td><strong style="font-family:monospace;color:var(--primary)">${m.newFileNumber}</strong></td></tr>`
    ).join('');
    const errorRows = (result.errors || []).slice(0, 10).map(e =>
      `<tr style="color:var(--danger)"><td>${e.row}</td><td>${e.error}</td></tr>`
    ).join('');

    return `
      <div>
        <div style="text-align:center;padding:24px 0">
          <div style="font-size:3rem;margin-bottom:12px">${hasErrors && result.imported===0 ? '❌' : '✅'}</div>
          <h3 style="margin-bottom:8px">${result.imported} files imported${result.skipped ? `, ${result.skipped} skipped` : ''}</h3>
          ${hasErrors ? `<p style="color:var(--danger)">${result.errors.length} error(s) occurred</p>` : ''}
        </div>
        ${mappingRows ? `
          <div style="margin-bottom:16px">
            <strong>Old → New File Number Mapping (first 20):</strong>
            <div style="max-height:200px;overflow-y:auto;margin-top:8px;border:1px solid var(--gray-200);border-radius:var(--radius)">
              <table style="width:100%;font-size:.85rem"><thead><tr><th style="padding:6px 10px">Old Number</th><th style="padding:6px 10px">New Number</th></tr></thead>
              <tbody>${mappingRows}</tbody></table>
            </div>
          </div>` : ''}
        ${errorRows ? `
          <div>
            <strong style="color:var(--danger)">Errors (first 10):</strong>
            <div style="max-height:200px;overflow-y:auto;margin-top:8px;border:1px solid var(--danger-bg);border-radius:var(--radius);background:var(--danger-bg)">
              <table style="width:100%;font-size:.8rem"><thead><tr><th style="padding:6px 10px">Row</th><th style="padding:6px 10px">Error</th></tr></thead>
              <tbody>${errorRows}</tbody></table>
            </div>
          </div>` : ''}
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center">
          <a href="#register" class="btn btn-primary">View Register →</a>
          <button class="btn btn-secondary" id="btn-import-again">Import More</button>
        </div>
      </div>`;
  }

  function autoMap(header) {
    const h = header.toLowerCase().replace(/[\s_-]+/g,'');
    const hints = {
      clientName: ['client','clientname'], category: ['category','cat'],
      subCategory: ['subcategory','subcat','sub'], details: ['details','description','desc'],
      entity: ['entity'], businessVertical: ['businessvertical','vertical','bv'],
      location: ['location','loc','office'], hod: ['hod','head'],
      fileType: ['filetype','type'], colour: ['colour','color'],
      binLocation: ['binlocation','bin','rack'], status: ['status'],
      oldFileNumber: ['oldfilenumber','oldfile','legacynumber','legacy'],
      tags: ['tags','tag'], notes: ['notes','remarks'],
      relatedDocs: ['relateddocs','related','documents'],
    };
    for (const [field, keywords] of Object.entries(hints)) {
      if (keywords.some(k => h.includes(k))) return field;
    }
    return '';
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const parse = line => {
      const result = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      result.push(cur.trim());
      return result;
    };
    const headers = parse(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(parse);
    return { headers, rows };
  }

  function bindStep1(container) {
    const dropZone = container.querySelector('#drop-zone');
    const fileInput = container.querySelector('#file-input');
    const paste = container.querySelector('#csv-paste');

    if (dropZone) {
      dropZone.addEventListener('click', () => fileInput?.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      });
    }
    if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files[0]) readFile(fileInput.files[0]); });

    container.querySelector('#btn-parse-csv')?.addEventListener('click', () => {
      const text = paste?.value.trim();
      if (!text) { toast('Please paste CSV content or upload a file', 'warning'); return; }
      processCSVText(text, container);
    });

    container.querySelector('#btn-download-sample')?.addEventListener('click', (e) => {
      e.preventDefault();
      const headers = ['Client Name', 'Category', 'Sub-Category', 'Details', 'Location', 'Entity', 'Business Vertical', 'File Type', 'Colour', 'Bin Location', 'Notes'];
      const sampleRow = ['Gretex', 'Legal', 'Agreements', 'NDA 2026', 'Mumbai', 'GCSL', 'Merchant Banker', 'Flat File', 'Red', 'Rack 1', 'Urgent'];
      const csv = headers.join(',') + '\n' + sampleRow.map(v => '"' + v + '"').join(',');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sample-import.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = e => processCSVText(e.target.result, document.getElementById('content'));
    reader.readAsText(file, 'UTF-8');
  }

  function processCSVText(text, container) {
    const parsed = parseCSV(text);
    if (!parsed) { toast('Could not parse CSV. Make sure the first row is headers.', 'error'); return; }
    parsedHeaders = parsed.headers;
    parsedRows    = parsed.rows;
    step = 2;
    const sc = container.querySelector('#import-step-content');
    if (sc) { sc.innerHTML = buildStep2(); autoSelectMappings(sc); bindStep2(container, sc); }
  }

  function autoSelectMappings(stepContent) {
    parsedHeaders.forEach((h, i) => {
      const guess = autoMap(h);
      const sel = stepContent.querySelector(`#map-${i}`);
      if (sel && guess) sel.value = guess;
    });
  }

  function bindStep2(container, sc) {
    sc.querySelector('#btn-back-1')?.addEventListener('click', () => { step=1; const c=container.querySelector('#import-step-content'); if(c) { c.innerHTML=buildStep1(); bindStep1(container); } });
    sc.querySelector('#btn-to-preview')?.addEventListener('click', () => {
      mapping = {};
      sc.querySelectorAll('[data-col]').forEach(sel => { if (sel.value) mapping[parseInt(sel.dataset.col)] = sel.value; });
      const missing = REQUIRED.filter(r => !Object.values(mapping).includes(r));
      if (missing.length) { toast('Please map required fields: ' + missing.map(r => FIELD_LABELS[r]).join(', '), 'warning'); return; }
      const mapped = buildMappedRows();
      step = 3;
      const c = container.querySelector('#import-step-content');
      if (c) { c.innerHTML = buildStep3(mapped); bindStep3(container, mapped); }
    });
  }

  function bindStep3(container, mappedRows) {
    const sc = container.querySelector('#import-step-content');
    sc?.querySelector('#btn-back-2')?.addEventListener('click', () => { step=2; const c=container.querySelector('#import-step-content'); if(c) { c.innerHTML=buildStep2(); autoSelectMappings(c); bindStep2(container,c); } });
    sc?.querySelector('#btn-start-import')?.addEventListener('click', () => doImport(container, mappedRows));
  }

  function buildMappedRows() {
    return parsedRows.map(row => {
      const obj = {};
      Object.entries(mapping).forEach(([colIdx, field]) => { obj[field] = row[parseInt(colIdx)] || ''; });
      return obj;
    });
  }

  function doImport(container, rows) {
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
    const btn = container.querySelector('#btn-start-import');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></div> Importing…'; }
    api('bulkImport', {}, { action: 'bulkImport', rows, importedBy: App.user }).then(result => {
      step = 4;
      const c = container.querySelector('#import-step-content');
      if (c) { c.innerHTML = buildStep4(result); c.querySelector('#btn-import-again')?.addEventListener('click', () => { step=1; const cc=container.querySelector('#import-step-content'); if(cc){cc.innerHTML=buildStep1();bindStep1(container);} }); }
    }).catch(err => { toast('Import failed: ' + err.message, 'error'); if(btn){btn.disabled=false;btn.textContent='📥 Import';} });
  }

  return { render };
})();
