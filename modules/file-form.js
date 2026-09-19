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
  // ── DETAIL VIEW ───────────────────────────────────────────────
  function renderDetail(container, topbarActions, fileNumber) {
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading…</span></div>';
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      container.innerHTML = '<div class="page-loading"><p>Connect Apps Script to view files.</p></div>'; return;
    }
    Promise.all([
      api('getFile', { fileNumber }),
      api('getActivityLog', { fileNumber }),
      api('getRegisterFiles', { registerNumber: fileNumber }).catch(() => [])
    ]).then(([file, log, subFiles]) => {
      const regFiles = (subFiles && subFiles.length) ? subFiles : (file.files || []);

      const canEdit = App.can ? App.can('register.edit') : true;
      const canDelete = App.can ? App.can('register.delete') : true;
      const canCheckout = App.can ? App.can('checkout.manage') : true;
      const canSticker = App.can ? App.can('stickers.print') : true;

      topbarActions.innerHTML = `
        <button class="btn btn-secondary btn-sm" id="d-btn-back">← Register</button>
        ${canEdit ? '<button class="btn btn-warning btn-sm" id="d-btn-quick-status" style="font-weight:600;">⚡ Change Status / Location</button>' : ''}
        ${canEdit ? '<button class="btn btn-secondary btn-sm" id="d-btn-edit">✏️ Edit</button>' : ''}
        ${canCheckout ? `<button class="btn btn-${file.status === 'Checked out' ? 'success' : 'warning'} btn-sm" id="d-btn-checkout">
          ${file.status === 'Checked out' ? '↩️ Return' : '📤 Check Out'}
        </button>` : ''}
        ${canSticker ? '<button class="btn btn-secondary btn-sm" id="d-btn-sticker">🏷️ Sticker</button>' : ''}
        ${canDelete ? '<button class="btn btn-danger btn-sm" id="d-btn-delete">🗑️</button>' : ''}`;

      container.innerHTML = buildDetailHTML(file, log, regFiles);

      qs('#d-btn-back')?.addEventListener('click', () => navigate('#register'));
      qs('#d-btn-quick-status')?.addEventListener('click', () => {
        CheckoutModule.openQuickStatusLocation(file, () => renderDetail(container, topbarActions, fileNumber));
      });
      qs('#d-btn-card-quick-status')?.addEventListener('click', () => {
        CheckoutModule.openQuickStatusLocation(file, () => renderDetail(container, topbarActions, fileNumber));
      });
      qs('#d-badge-status-trigger')?.addEventListener('click', () => {
        CheckoutModule.openQuickStatusLocation(file, () => renderDetail(container, topbarActions, fileNumber));
      });
      qs('#d-btn-edit')?.addEventListener('click', () => navigate(`#edit/${encodeURIComponent(fileNumber)}`));
      qs('#d-btn-sticker')?.addEventListener('click', () => StickerModule.openStickerFromFile(file));
      qs('#d-btn-delete')?.addEventListener('click', () => {
        confirmDialog(`Permanently delete Register <strong>${fileNumber}</strong>?`, () => {
          api('deleteFile', {}, { action: 'deleteFile', fileNumber, deletedBy: App.user })
            .then(() => { toast('Register deleted', 'success'); navigate('#register'); })
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

      // Bind Add File button
      qs('#btn-add-reg-file')?.addEventListener('click', () => {
        openAddRegisterFileModal(fileNumber, null, () => renderDetail(container, topbarActions, fileNumber));
      });
      qs('#btn-add-reg-file-empty')?.addEventListener('click', () => {
        openAddRegisterFileModal(fileNumber, null, () => renderDetail(container, topbarActions, fileNumber));
      });

      // Bind Empty / Clean Register button
      qs('#btn-clean-reg-files')?.addEventListener('click', () => {
        openConfirmModal(
          'Empty / Clean Register',
          `Are you sure you want to remove all <strong>${regFiles.length}</strong> file(s) from Register <strong>${fileNumber}</strong>?<br><br><span style="font-size:0.85rem;color:var(--gray-600);">Note: Files will be marked as deleted in the sheet (Column L: Delete = Yes), and complete Activity History will remain preserved in the Activity Log.</span>`,
          () => {
            api('cleanRegisterFiles', {}, { action: 'cleanRegisterFiles', registerNumber: fileNumber, deletedBy: App.user || 'System' })
              .then(res => {
                toast(`Register cleaned! ${res.cleanedCount !== undefined ? res.cleanedCount : regFiles.length} file(s) marked as deleted.`, 'success');
                renderDetail(container, topbarActions, fileNumber);
              })
              .catch(err => toast(err.message, 'error'));
          },
          'Empty Register',
          true
        );
      });

      // Bind Edit & Delete on Subfiles
      qsa('.btn-edit-subfile', container).forEach(b => {
        b.addEventListener('click', () => {
          const fid = b.dataset.fileId;
          const target = regFiles.find(x => x.fileId === fid);
          if (target) openAddRegisterFileModal(fileNumber, target, () => renderDetail(container, topbarActions, fileNumber));
        });
      });

      qsa('.btn-del-subfile', container).forEach(b => {
        b.addEventListener('click', () => {
          const fid = b.dataset.fileId;
          const target = regFiles.find(x => x.fileId === fid);
          const fname = target ? target.fileName : fid;
          openConfirmModal(
            'Delete File',
            `Remove file <strong>${fid}</strong> (${escapeHTML(fname)}) from this register?<br><br><span style="font-size:0.85rem;color:var(--gray-600);">Note: File will be marked as deleted in the sheet, keeping Activity Log intact.</span>`,
            () => {
              api('deleteRegisterFile', {}, { action: 'deleteRegisterFile', fileId: fid, deletedBy: App.user || 'System' })
                .then(() => {
                  toast('File deleted from register', 'success');
                  renderDetail(container, topbarActions, fileNumber);
                })
                .catch(err => toast(err.message, 'error'));
            },
            'Delete',
            true
          );
        });
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

  function buildDetailHTML(file, log, regFiles = []) {
    const canEdit = App.can ? App.can('register.edit') : true;
    const canDelete = App.can ? App.can('register.delete') : true;
    const canCreate = App.can ? App.can('register.create') : true;

    const overdue = file.status === 'Checked out' && file.dueDate && new Date(file.dueDate) < new Date();
    const tags = (file.tags || '').split(',').filter(t => t.trim()).map(t => `<span class="chip">${t.trim()}</span>`).join('');

    const activityHTML = (log || []).map(a => `
      <div class="activity-item">
        <div class="activity-dot ${activityDotColor(a.action)}"></div>
        <div class="activity-body">
          <div class="activity-action">${escapeHTML(a.action)}</div>
          <div class="activity-detail">${formatActivityDetail(a.details || '')}</div>
          <div class="activity-meta">by <strong>${escapeHTML(a.actor || '—')}</strong> · ${fmtDateTime(a.timestamp)}</div>
        </div>
      </div>`).join('') || '<p style="color:var(--gray-500);text-align:center;padding:24px">No activity recorded</p>';

    const filesTableHTML = regFiles.length > 0
      ? `
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr>
              <th>File ID</th>
              <th>File Name / Title</th>
              <th>Description / Particular</th>
              <th>File Date</th>
              <th>Status</th>
              <th>Added By</th>
              <th style="text-align:center">Actions</th>
            </tr></thead>
            <tbody>
              ${regFiles.map(f => `
                <tr>
                  <td style="font-family:monospace;font-weight:700;color:var(--primary);white-space:nowrap">${f.fileId}</td>
                  <td style="font-weight:600;color:var(--gray-900)">${f.fileName}</td>
                  <td style="color:var(--gray-700);font-size:.85rem;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${f.description || ''}">${f.description || '—'}</td>
                  <td style="white-space:nowrap;font-size:.85rem">${f.fileDate ? fmtDate(f.fileDate) : '—'}</td>
                  <td><span class="badge ${f.status === 'Active' ? 'badge-inoffice' : f.status === 'Archived' ? 'badge-archived' : 'badge-checkedout'}">${f.status || 'Active'}</span></td>
                  <td style="font-size:.8rem;color:var(--gray-500);white-space:nowrap">${f.createdBy || '—'}</td>
                  <td style="text-align:center">
                    <div class="col-actions" style="justify-content:center">
                      ${canEdit ? `<button class="btn btn-ghost btn-icon btn-sm btn-edit-subfile" data-file-id="${f.fileId}" title="Edit File">✏️</button>` : ''}
                      ${canDelete ? `<button class="btn btn-ghost btn-icon btn-sm btn-del-subfile" data-file-id="${f.fileId}" title="Delete File" style="color:var(--danger)">🗑️</button>` : ''}
                      ${(!canEdit && !canDelete) ? '<span style="color:var(--gray-400);font-size:0.8rem;">—</span>' : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : `
        <div class="table-empty" style="padding:36px 16px;border:1px dashed var(--gray-300);border-radius:var(--radius);margin-top:10px;">
          <div class="empty-icon" style="font-size:2.2rem">📂</div>
          <p style="font-size:0.95rem;color:var(--gray-600);margin-bottom:12px">No files added to this register yet.</p>
          ${canCreate ? '<button class="btn btn-primary btn-sm" id="btn-add-reg-file-empty">➕ Add First File</button>' : ''}
        </div>`;

    return `
      <div style="max-width:950px">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <div style="font-family:monospace;font-size:1.4rem;font-weight:700;color:var(--primary)">${file.fileNumber}</div>
              ${file.oldFileNumber ? `<div style="font-size:.8rem;color:var(--gray-500)">Old: ${file.oldFileNumber}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="badge" style="background:var(--primary-light);color:var(--primary);font-size:.85rem;padding:4px 10px;">📂 ${regFiles.length} Files Inside</span>
              ${canEdit ? `
                <span id="d-badge-status-trigger" style="cursor:pointer;" title="Click to change status or location">
                  ${statusBadge(file.status)} <span class="quick-edit-hint" style="opacity:1;">✏️</span>
                </span>
                <button class="btn btn-sm" id="d-btn-card-quick-status" style="font-size:0.75rem;padding:3px 10px;font-weight:600;background:#fef7e0;color:#b06000;border:1px solid #feefc3;" title="Change Status, Location, Bin">⚡ Change</button>
              ` : `
                <span>${statusBadge(file.status)}</span>
              `}
            </div>
          </div>
          ${overdue ? `<div style="background:var(--danger-bg);color:var(--danger);padding:8px 20px;font-size:.85rem;font-weight:600">⚠️ Overdue — Due ${fmtDate(file.dueDate)}, held by ${file.heldBy}</div>` : ''}
          <div class="card-body">
            <div class="tabs">
              <button class="tab-btn active" data-tab="files">📁 Files in this Register (${regFiles.length})</button>
              <button class="tab-btn" data-tab="details">Register Details</button>
              <button class="tab-btn" data-tab="activity">Activity Log</button>
            </div>

            <!-- Tab 1: Files inside Register -->
            <div id="tab-files" class="tab-content active">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
                <div>
                  <h4 style="margin:0;font-size:1rem;color:var(--gray-900);font-weight:700">All Files in Register ${file.fileNumber}</h4>
                  <span style="font-size:0.8rem;color:var(--gray-500)">Manage individual documents & files stored inside this master folder/register</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  ${(canDelete && regFiles.length > 0) ? `
                    <button class="btn btn-secondary btn-sm" id="btn-clean-reg-files" style="color:var(--danger);border-color:#fca5a5;background:#fff5f5;display:inline-flex;align-items:center;gap:6px;font-weight:600;" title="Mark all files in this register as deleted">
                      🧹 Empty Register (${regFiles.length})
                    </button>
                  ` : ''}
                  ${canCreate ? '<button class="btn btn-primary btn-sm" id="btn-add-reg-file">➕ Add File to Register</button>' : ''}
                </div>
              </div>
              ${filesTableHTML}
            </div>

            <!-- Tab 2: Details -->
            <div id="tab-details" class="tab-content">
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

            <!-- Tab 3: Activity Log -->
            <div id="tab-activity" class="tab-content">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div style="font-size:0.9rem;font-weight:700;color:var(--gray-900);display:flex;align-items:center;gap:6px;">
                  <span>📜</span>
                  <span>Activity History & Audit Trail</span>
                  <span class="badge" style="background:var(--primary-light);color:var(--primary);font-size:0.75rem;padding:2px 8px;">${(log || []).length} logs</span>
                </div>
                <div style="font-size:0.75rem;color:var(--gray-600);background:var(--gray-100);padding:3px 10px;border-radius:12px;border:1px solid var(--gray-300);">
                  ↕ Scroll inside panel
                </div>
              </div>
              <div class="activity-scroll-panel">
                <div class="activity-list">${activityHTML}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function openAddRegisterFileModal(registerNumber, fileToEdit, onDone) {
    const isEdit = !!fileToEdit;
    const f = fileToEdit || {};
    const statuses = ['Active', 'In file', 'Checked out', 'Archived', 'Missing'];

    const modalBody = `
      <form id="reg-subfile-form" novalidate>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label" style="font-size:.78rem">Register Number</label>
          <input type="text" class="form-control" value="${registerNumber}" disabled style="background:var(--gray-100);font-family:monospace;font-weight:700;">
        </div>

        <div class="form-grid" style="margin-bottom:14px">
          <div class="form-group">
            <label class="form-label" style="font-size:.78rem">File ID <span class="required">*</span></label>
            <input type="text" class="form-control" id="m-file-id" value="${f.fileId || ''}" placeholder="Generating ID…" style="font-family:monospace;font-weight:600">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:.78rem">Status</label>
            <select class="form-control" id="m-file-status">
              ${statuses.map(s => `<option ${(f.status || 'Active') === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label" style="font-size:.78rem">File Name / Title <span class="required">*</span></label>
          <input type="text" class="form-control" id="m-file-name" value="${f.fileName || ''}" placeholder="e.g. Board Resolution, Form 3CD, Invoices" required>
        </div>

        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label" style="font-size:.78rem">Description / Particular</label>
          <textarea class="form-control" id="m-file-desc" rows="2" placeholder="Details about this document/file…">${f.description || ''}</textarea>
        </div>

        <div class="form-grid" style="margin-bottom:14px">
          <div class="form-group">
            <label class="form-label" style="font-size:.78rem">File Date</label>
            <input type="date" class="form-control" id="m-file-date" value="${f.fileDate ? new Date(f.fileDate).toISOString().split('T')[0] : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:.78rem">Notes / Remarks</label>
            <input type="text" class="form-control" id="m-file-notes" value="${f.notes || ''}" placeholder="Optional notes…">
          </div>
        </div>
      </form>
    `;

    openModal({
      title: isEdit ? `✏️ Edit File: ${f.fileId}` : `➕ Add File to Register: ${registerNumber}`,
      body: modalBody,
      footer: `
        <button class="btn btn-secondary btn-sm" id="m-subfile-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="m-subfile-save">${isEdit ? '💾 Save Changes' : '➕ Add File'}</button>
      `
    });

    if (!isEdit) {
      api('generateRegisterFileId', { registerNumber }).then(res => {
        const idInput = qs('#m-file-id');
        if (idInput && !idInput.value) idInput.value = res.fileId;
      }).catch(() => {
        const idInput = qs('#m-file-id');
        if (idInput && !idInput.value) idInput.value = registerNumber + '-F01';
      });
    }

    qs('#m-subfile-cancel')?.addEventListener('click', closeModal);

    qs('#m-subfile-save')?.addEventListener('click', () => {
      const fileId   = qs('#m-file-id')?.value.trim();
      const fileName = qs('#m-file-name')?.value.trim();
      const status   = qs('#m-file-status')?.value;
      const desc     = qs('#m-file-desc')?.value.trim();
      const fileDate = qs('#m-file-date')?.value;
      const notes    = qs('#m-file-notes')?.value.trim();

      if (!fileName) {
        toast('File Name / Title is required', 'warning');
        qs('#m-file-name')?.focus();
        return;
      }
      if (!fileId) {
        toast('File ID is required', 'warning');
        qs('#m-file-id')?.focus();
        return;
      }

      const saveBtn = qs('#m-subfile-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      const payload = {
        fileId,
        registerNumber,
        fileName,
        description: desc,
        fileDate,
        status,
        notes
      };

      const action = isEdit ? 'updateRegisterFile' : 'addRegisterFile';
      if (isEdit) payload.updatedBy = App.user;
      else payload.createdBy = App.user;

      api(action, {}, { action, ...payload })
        .then(() => {
          toast(isEdit ? 'File updated' : 'File added to register', 'success');
          closeModal();
          if (onDone) onDone();
        })
        .catch(err => {
          toast(err.message, 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? '💾 Save Changes' : '➕ Add File';
        });
    });
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
