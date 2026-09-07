// ── FILE FORM MODULE ──────────────────────────────────────────
// Handles: Add new file, Edit file, View file detail
const FileFormModule = (() => {

  // ── ADD ──────────────────────────────────────────────────────
  function renderAdd(container, topbarActions) {
    topbarActions.innerHTML = `<a href="#register" class="btn btn-secondary btn-sm">← Back to Register</a>`;
    loadConfig().then(() => {
      container.innerHTML = buildForm(null);
      bindForm(container, null);
    });
  }

  // ── EDIT ─────────────────────────────────────────────────────
  function renderEdit(container, topbarActions, fileNumber) {
    topbarActions.innerHTML = `<a href="#file/${encodeURIComponent(fileNumber)}" class="btn btn-secondary btn-sm">← Back to Detail</a>`;
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading…</span></div>';
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      container.innerHTML = '<div class="page-loading"><p>Connect Apps Script to edit files.</p></div>'; return;
    }
    Promise.all([api('getFile', { fileNumber }), loadConfig()]).then(([file]) => {
      container.innerHTML = buildForm(file);
      bindForm(container, file);
    }).catch(err => {
      container.innerHTML = `<div class="page-loading"><p style="color:var(--danger)">${err.message}</p></div>`;
    });
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────
  function renderDetail(container, topbarActions, fileNumber) {
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading…</span></div>';
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      container.innerHTML = '<div class="page-loading"><p>Connect Apps Script to view files.</p></div>'; return;
    }
    Promise.all([api('getFile', { fileNumber }), api('getActivityLog', { fileNumber })]).then(([file, log]) => {
      topbarActions.innerHTML = `
        <button class="btn btn-secondary btn-sm" id="d-btn-back">← Register</button>
        <button class="btn btn-secondary btn-sm" id="d-btn-edit">✏️ Edit</button>
        <button class="btn btn-${file.status === 'Checked out' ? 'success' : 'warning'} btn-sm" id="d-btn-checkout">
          ${file.status === 'Checked out' ? '↩️ Return' : '📤 Check Out'}
        </button>
        <button class="btn btn-secondary btn-sm" id="d-btn-sticker">🏷️ Sticker</button>
        <button class="btn btn-danger btn-sm" id="d-btn-delete">🗑️</button>`;

      container.innerHTML = buildDetailHTML(file, log);

      qs('#d-btn-back')?.addEventListener('click', () => navigate('#register'));
      qs('#d-btn-edit')?.addEventListener('click', () => navigate(`#edit/${encodeURIComponent(fileNumber)}`));
      qs('#d-btn-sticker')?.addEventListener('click', () => StickerModule.openStickerFromFile(file));
      qs('#d-btn-delete')?.addEventListener('click', () => {
        confirmDialog(`Permanently delete <strong>${fileNumber}</strong>?`, () => {
          api('deleteFile', {}, { action: 'deleteFile', fileNumber, deletedBy: App.user })
            .then(() => { toast('File deleted', 'success'); navigate('#register'); })
            .catch(err => toast(err.message, 'error'));
        }, 'Delete');
      });
      qs('#d-btn-checkout')?.addEventListener('click', () => {
        if (file.status === 'Checked out') {
          CheckoutModule.openReturn(fileNumber, () => renderDetail(container, topbarActions, fileNumber));
        } else {
          CheckoutModule.openCheckout(fileNumber, () => renderDetail(container, topbarActions, fileNumber));
        }
      });

      // Tabs
      qsa('.tab-btn', container).forEach(btn => {
        btn.addEventListener('click', () => {
          qsa('.tab-btn', container).forEach(b => b.classList.remove('active'));
          qsa('.tab-content', container).forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          container.querySelector(`#tab-${btn.dataset.tab}`)?.classList.add('active');
        });
      });
    }).catch(err => {
      container.innerHTML = `<div class="page-loading"><p style="color:var(--danger)">${err.message}</p></div>`;
    });
  }

  function buildDetailHTML(file, log) {
    const overdue = file.status === 'Checked out' && file.dueDate && new Date(file.dueDate) < new Date();
    const tags = (file.tags || '').split(',').filter(t => t.trim()).map(t => `<span class="chip">${t.trim()}</span>`).join('');

    const activityHTML = (log || []).map(a => `
      <div class="activity-item">
        <div class="activity-dot ${activityDotColor(a.action)}"></div>
        <div class="activity-body">
          <div class="activity-action">${a.action}</div>
          <div class="activity-detail">${a.details || ''}</div>
          <div class="activity-meta">by ${a.actor || '—'} · ${fmtDateTime(a.timestamp)}</div>
        </div>
      </div>`).join('') || '<p style="color:var(--gray-500);text-align:center;padding:24px">No activity recorded</p>';

    return `
      <div style="max-width:900px">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <div style="font-family:monospace;font-size:1.4rem;font-weight:700;color:var(--primary)">${file.fileNumber}</div>
              ${file.oldFileNumber ? `<div style="font-size:.8rem;color:var(--gray-500)">Old: ${file.oldFileNumber}</div>` : ''}
            </div>
            ${statusBadge(file.status)}
          </div>
          ${overdue ? `<div style="background:var(--danger-bg);color:var(--danger);padding:8px 20px;font-size:.85rem;font-weight:600">⚠️ Overdue — Due ${fmtDate(file.dueDate)}, held by ${file.heldBy}</div>` : ''}
          <div class="card-body">
            <div class="tabs">
              <button class="tab-btn active" data-tab="details">Details</button>
              <button class="tab-btn" data-tab="activity">Activity Log</button>
            </div>
            <div id="tab-details" class="tab-content active">
              <div class="detail-grid">
                ${df('Client', file.clientName)}
                ${df('Category', file.category)}
                ${df('Sub-Category', file.subCategory)}
                ${df('Details', file.details, true)}
                ${df('Entity', file.entity)}
                ${df('Business Vertical', file.businessVertical)}
                ${df('Location', file.location)}
                ${df('HOD', file.hod)}
                ${df('File Type', file.fileType)}
                ${df('Colour', file.colour)}
                ${df('Bin Location', file.binLocation)}
                ${file.heldBy ? df('Held By', file.heldBy) : ''}
                ${file.dueDate ? df('Due Date', fmtDate(file.dueDate)) : ''}
                ${tags ? `<div class="detail-field" style="grid-column:1/-1"><div class="detail-label">Tags</div><div class="detail-value">${tags}</div></div>` : ''}
                ${file.relatedDocs ? df('Related Documents', file.relatedDocs, true) : ''}
                ${file.notes ? `<div class="detail-field" style="grid-column:1/-1"><div class="detail-label">Notes / Remarks</div><div class="detail-value">${file.notes}</div></div>` : ''}
              </div>
              <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-200);display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.8rem;color:var(--gray-500)">
                <span>Created by ${file.createdBy || '—'} on ${fmtDate(file.createdAt)}</span>
                <span>Updated by ${file.updatedBy || '—'} on ${fmtDate(file.updatedAt)}</span>
              </div>
            </div>
            <div id="tab-activity" class="tab-content">
              <div class="activity-list">${activityHTML}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function df(label, value, full = false) {
    if (!value) return '';
    return `<div class="detail-field${full ? ' style="grid-column:1/-1"' : ''}"><div class="detail-label">${label}</div><div class="detail-value">${value}</div></div>`;
  }

  // ── FORM BUILDER ──────────────────────────────────────────────
  function buildForm(file) {
    const cfg = App.config || {};
    const lsts = cfg.lists || {};
    const isEdit = !!file;

    const clients  = (cfg.clients  || []).map(c => c.name);
    const cats     = (cfg.categories || []).map(c => c.name);
    const subcats  = (cfg.subcategories || []).map(c => c.name);
    const locs     = lsts['Locations'] || [];
    const entities = lsts['Entities']  || [];
    const bvs      = lsts['Business Verticals'] || [];
    const hods     = lsts['HODs'] || [];
    const fts      = lsts['File Types'] || [];
    const colours  = lsts['Colours'] || [];
    const bins     = lsts['Bin Locations'] || [];
    const statuses = ['In office', 'Checked out', 'Archived', 'Missing'];

    const f = file || {};
    const v = (k, def='') => f[k] !== undefined ? f[k] : def;

    return `
      <div style="max-width:800px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">${isEdit ? '✏️ Edit File' : '➕ Add New File'}</span>
          </div>
          <div class="card-body">
            <form id="file-form" novalidate>

              <!-- File Number -->
              <div class="form-group" style="margin-bottom:20px">
                <label class="form-label">File Number (auto-generated)</label>
                <div class="file-number-preview ${isEdit ? '' : 'generating'}" id="fn-preview">
                  ${isEdit ? file.fileNumber : 'Select Client, Category & Sub-Category…'}
                </div>
                ${isEdit ? `<input type="hidden" id="field-fileNumber" value="${file.fileNumber}">` : ''}
              </div>

              <div class="form-grid" style="margin-bottom:16px">
                <!-- Old File Number -->
                <div class="form-group">
                  <label class="form-label">Old File Number</label>
                  <input type="text" class="form-control" id="field-oldFileNumber" value="${v('oldFileNumber')}">
                </div>
                <!-- Status -->
                <div class="form-group">
                  <label class="form-label">Status <span class="required">*</span></label>
                  <select class="form-control" id="field-status">
                    ${statuses.map(s => `<option ${v('status','In office')===s?'selected':''}>${s}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-grid">
                <!-- Client -->
                <div class="form-group">
                  <label class="form-label">Client Name <span class="required">*</span></label>
                  <div id="wrap-client"></div>
                </div>
                <!-- Category -->
                <div class="form-group">
                  <label class="form-label">Category <span class="required">*</span></label>
                  <div id="wrap-category"></div>
                </div>
                <!-- Sub-Category -->
                <div class="form-group">
                  <label class="form-label">Sub-Category <span class="required">*</span></label>
                  <div id="wrap-subcategory"></div>
                </div>
                <!-- Details -->
                <div class="form-group">
                  <label class="form-label">Details of File</label>
                  <input type="text" class="form-control" id="field-details" value="${v('details')}">
                </div>
                <!-- Entity -->
                <div class="form-group">
                  <label class="form-label">Entity</label>
                  <div id="wrap-entity"></div>
                </div>
                <!-- Business Vertical -->
                <div class="form-group">
                  <label class="form-label">Business Vertical</label>
                  <div id="wrap-bv"></div>
                </div>
                <!-- Location -->
                <div class="form-group">
                  <label class="form-label">Location</label>
                  <div id="wrap-location"></div>
                </div>
                <!-- HOD -->
                <div class="form-group">
                  <label class="form-label">HOD</label>
                  <div id="wrap-hod"></div>
                </div>
                <!-- File Type -->
                <div class="form-group">
                  <label class="form-label">File Type</label>
                  <div id="wrap-fileType"></div>
                </div>
                <!-- Colour -->
                <div class="form-group">
                  <label class="form-label">Colour</label>
                  <div id="wrap-colour"></div>
                </div>
                <!-- Bin Location -->
                <div class="form-group">
                  <label class="form-label">Bin Location No.</label>
                  <div id="wrap-binLocation"></div>
                </div>
                <!-- Held By -->
                <div class="form-group">
                  <label class="form-label">Held By</label>
                  <input type="text" class="form-control" id="field-heldBy" value="${v('heldBy')}" placeholder="Person holding the file (if checked out)">
                </div>
                <!-- Due Date -->
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" class="form-control" id="field-dueDate" value="${f.dueDate ? new Date(f.dueDate).toISOString().split('T')[0] : ''}">
                </div>
                <!-- Tags -->
                <div class="form-group">
                  <label class="form-label">Tags <span style="font-weight:400;color:var(--gray-500)">(comma-separated)</span></label>
                  <input type="text" class="form-control" id="field-tags" value="${v('tags')}" placeholder="e.g. urgent, original">
                </div>
                <!-- Related Documents -->
                <div class="form-group full">
                  <label class="form-label">Related Documents</label>
                  <input type="text" class="form-control" id="field-relatedDocs" value="${v('relatedDocs')}">
                </div>
                <!-- Notes -->
                <div class="form-group full">
                  <label class="form-label">Notes / Remarks</label>
                  <textarea class="form-control" id="field-notes" rows="3">${v('notes')}</textarea>
                </div>
              </div>

              <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">
                <a href="${isEdit ? '#file/' + encodeURIComponent(file.fileNumber) : '#register'}" class="btn btn-secondary">Cancel</a>
                <button type="submit" class="btn btn-primary" id="form-submit-btn">
                  ${isEdit ? '💾 Save Changes' : '➕ Register File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`;
  }

  function bindForm(container, file) {
    const isEdit = !!file;
    const cfg = App.config || {};
    const lsts = cfg.lists || {};
    const f = file || {};

    // Render smart selects
    const masters = [
      { id: 'wrap-client',      options: (cfg.clients||[]).map(c=>c.name),      value: f.clientName,       ph: 'Client',            type: 'Clients' },
      { id: 'wrap-category',    options: (cfg.categories||[]).map(c=>c.name),   value: f.category,         ph: 'Category',          type: 'Categories' },
      { id: 'wrap-subcategory', options: (cfg.subcategories||[]).map(c=>c.name),value: f.subCategory,      ph: 'Sub-Category',      type: 'Subcategories' },
      { id: 'wrap-entity',      options: lsts['Entities']||[],                  value: f.entity,           ph: 'Entity',            listName: 'Entities' },
      { id: 'wrap-bv',          options: lsts['Business Verticals']||[],        value: f.businessVertical, ph: 'Business Vertical', listName: 'Business Verticals' },
      { id: 'wrap-location',    options: lsts['Locations']||[],                 value: f.location,         ph: 'Location',          listName: 'Locations' },
      { id: 'wrap-hod',         options: lsts['HODs']||[],                      value: f.hod,              ph: 'HOD',               listName: 'HODs' },
      { id: 'wrap-fileType',    options: lsts['File Types']||[],                value: f.fileType,         ph: 'File Type',         listName: 'File Types' },
      { id: 'wrap-colour',      options: lsts['Colours']||[],                   value: f.colour,           ph: 'Colour',            listName: 'Colours' },
      { id: 'wrap-binLocation', options: lsts['Bin Locations']||[],             value: f.binLocation,      ph: 'Bin Location',      listName: 'Bin Locations' },
    ];

    masters.forEach(m => {
      const wrap = container.querySelector('#' + m.id);
      if (!wrap) return;
      const fieldId = m.id.replace('wrap-', 'field-');
      const onAdd = m.type
        ? (name) => api('addMaster', {}, { action: 'addMaster', type: m.type, name }).then(r => { App.config = null; loadConfig(true); return r; })
        : (name) => api('addListItem', {}, { action: 'addListItem', listName: m.listName, value: name }).then(() => { App.config = null; loadConfig(true); return { name }; });
      const sel = renderSmartSelect({ id: fieldId, options: m.options, value: m.value, placeholder: m.ph, onAdd });
      wrap.appendChild(sel);
    });

    // Auto file number generation (only for add mode)
    if (!isEdit) {
      const triggerIds = ['field-clientName', 'field-category', 'field-subCategory'];
      // clientName maps to wrap-client → field-clientName etc.
      const actualIds  = ['field-client', 'field-category', 'field-subcategory'];
      actualIds.forEach(id => {
        const el = container.querySelector('#' + id);
        if (el) el.addEventListener('change', () => updateFileNumberPreview(container));
      });
    }

    // Form submit
    container.querySelector('#file-form')?.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(container)) return;
      submitForm(container, file);
    });
  }

  function updateFileNumberPreview(container) {
    const clientEl = container.querySelector('#field-client');
    const catEl    = container.querySelector('#field-category');
    const subEl    = container.querySelector('#field-subcategory');
    const preview  = container.querySelector('#fn-preview');
    if (!preview || !clientEl || !catEl || !subEl) return;
    const cn = clientEl.value, ca = catEl.value, sc = subEl.value;
    if (!cn || !ca || !sc) { preview.textContent = 'Select Client, Category & Sub-Category…'; preview.className = 'file-number-preview generating'; return; }
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      preview.textContent = '????-?????-?????-???'; preview.className = 'file-number-preview'; return;
    }
    preview.textContent = 'Generating…'; preview.className = 'file-number-preview generating';
    api('generateFileNumber', {}, { action: 'generateFileNumber', clientName: cn, category: ca, subCategory: sc })
      .then(r => { preview.textContent = r.fileNumber; preview.className = 'file-number-preview'; preview.dataset.fn = r.fileNumber; })
      .catch(() => { preview.textContent = 'Could not generate'; preview.className = 'file-number-preview generating'; });
  }

  function validateForm(container) {
    let valid = true;
    ['field-client', 'field-category', 'field-subcategory'].forEach(id => {
      const el = container.querySelector('#' + id);
      if (el && !el.value) { el.classList.add('is-invalid'); valid = false; }
      else el?.classList.remove('is-invalid');
    });
    return valid;
  }

  function submitForm(container, file) {
    const isEdit = !!file;
    const get = id => { const el = container.querySelector('#' + id); return el ? el.value : ''; };
    const body = {
      action:           isEdit ? 'updateFile' : 'addFile',
      fileNumber:       isEdit ? file.fileNumber : (container.querySelector('#fn-preview')?.dataset.fn || 'AUTO'),
      oldFileNumber:    get('field-oldFileNumber'),
      clientName:       get('field-client'),
      category:         get('field-category'),
      subCategory:      get('field-subcategory'),
      details:          get('field-details'),
      entity:           get('field-entity'),
      businessVertical: get('field-bv'),
      location:         get('field-location'),
      hod:              get('field-hod'),
      fileType:         get('field-fileType'),
      colour:           get('field-colour'),
      binLocation:      get('field-binLocation'),
      status:           get('field-status'),
      heldBy:           get('field-heldBy'),
      dueDate:          get('field-dueDate'),
      tags:             get('field-tags'),
      relatedDocs:      get('field-relatedDocs'),
      notes:            get('field-notes'),
    };
    if (isEdit) { body.updatedBy = App.user; body.changeNote = 'File edited'; }
    else { body.createdBy = App.user; }

    const btn = container.querySelector('#form-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Saving…'; }

    const action = isEdit ? 'updateFile' : 'addFile';
    api(action, {}, body).then(r => {
      toast(isEdit ? 'File updated!' : `File registered: ${r.fileNumber}`, 'success');
      navigate(isEdit ? `#file/${encodeURIComponent(file.fileNumber)}` : '#register');
    }).catch(err => {
      toast('Save failed: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = isEdit ? '💾 Save Changes' : '➕ Register File'; }
    });
  }

  return { renderAdd, renderEdit, renderDetail };
})();
