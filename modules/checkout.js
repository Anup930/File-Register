// ── CHECKOUT MODULE ───────────────────────────────────────────
const CheckoutModule = (() => {

  function openCheckout(fileNumber, onSuccess) {
    const overlay = openModal({
      title: `📤 Check Out File`,
      body: `
        <p style="color:var(--gray-600);margin-bottom:16px">
          Checking out <strong style="font-family:monospace">${fileNumber}</strong>
        </p>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Held By <span class="required">*</span></label>
          <input type="text" class="form-control" id="co-heldby" placeholder="Name of person taking the file" value="${App.user || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Due Back Date <span style="font-weight:400;color:var(--gray-500)">(optional)</span></label>
          <input type="date" class="form-control" id="co-duedate">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="co-cancel">Cancel</button>
        <button class="btn btn-warning" id="co-submit">📤 Check Out</button>`,
    });

    overlay.querySelector('#co-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#co-submit').addEventListener('click', () => {
      const heldBy  = overlay.querySelector('#co-heldby').value.trim();
      const dueDate = overlay.querySelector('#co-duedate').value;
      if (!heldBy) { overlay.querySelector('#co-heldby').classList.add('is-invalid'); return; }
      if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); closeModal(); return; }
      const btn = overlay.querySelector('#co-submit');
      btn.disabled = true; btn.textContent = 'Saving…';
      api('checkoutFile', {}, { action: 'checkoutFile', fileNumber, heldBy, dueDate })
        .then(() => {
          if (typeof AppDataStore !== 'undefined') {
            AppDataStore.updateItem(fileNumber, { status: 'Checked out', heldBy, dueDate });
          }
          toast(`File checked out to ${heldBy}`, 'success'); closeModal(); if (onSuccess) onSuccess();
        })
        .catch(err => { toast('Checkout failed: ' + err.message, 'error'); btn.disabled = false; btn.textContent = '📤 Check Out'; });
    });

    overlay.querySelector('#co-heldby').focus();
  }

  function openReturn(fileNumber, onSuccess) {
    const overlay = openModal({
      title: `↩️ Return File`,
      body: `
        <p style="color:var(--gray-600);margin-bottom:16px">
          Returning <strong style="font-family:monospace">${fileNumber}</strong> to office.
        </p>
        <div class="form-group">
          <label class="form-label">Returned By</label>
          <input type="text" class="form-control" id="ret-by" value="${App.user || ''}" placeholder="Your name">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="ret-cancel">Cancel</button>
        <button class="btn btn-success" id="ret-submit">↩️ Mark as Returned</button>`,
    });

    overlay.querySelector('#ret-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#ret-submit').addEventListener('click', () => {
      const returnedBy = overlay.querySelector('#ret-by').value.trim() || App.user || 'System';
      if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); closeModal(); return; }
      const btn = overlay.querySelector('#ret-submit');
      btn.disabled = true; btn.textContent = 'Saving…';
      api('returnFile', {}, { action: 'returnFile', fileNumber, returnedBy })
        .then(() => {
          if (typeof AppDataStore !== 'undefined') {
            AppDataStore.updateItem(fileNumber, { status: 'In office', heldBy: '', dueDate: '' });
          }
          toast('File returned to office', 'success'); closeModal(); if (onSuccess) onSuccess();
        })
        .catch(err => { toast('Return failed: ' + err.message, 'error'); btn.disabled = false; btn.textContent = '↩️ Mark as Returned'; });
    });
  }

  // ── QUICK UPDATE STATUS & LOCATION ─────────────────────────────
  function openQuickStatusLocation(fileOrNumber, onSuccess) {
    if (!fileOrNumber) return;

    if (typeof fileOrNumber === 'string') {
      const fn = fileOrNumber;
      if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
        renderModalWithData({ fileNumber: fn, status: 'In office', location: '', binLocation: '', heldBy: '', dueDate: '' });
        return;
      }
      api('getFile', { fileNumber: fn })
        .then(f => renderModalWithData(f))
        .catch(err => toast('Failed to load file: ' + err.message, 'error'));
    } else {
      renderModalWithData(fileOrNumber);
    }

    function renderModalWithData(file) {
      const fn = file.fileNumber;
      const curStatus = file.status || 'In office';
      const curLocation = file.location || '';
      const curBin = file.binLocation || '';
      const curHeldBy = file.heldBy || '';
      const curDueDate = file.dueDate || '';

      const locations = (App.config?.lists?.['Location'] || ['Office 1', 'Office 2']).filter(Boolean);
      const bins = (App.config?.lists?.['Bin Location'] || []).filter(Boolean);
      const rawStatuses = App.config?.lists?.['Status'] || [];
      const statusList = Array.from(new Set(['In office', 'Checked out', 'Archived', 'Missing', 'Closed', ...rawStatuses]));

      const overlay = openModal({
        title: `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">⚡</span>
            <div>
              <div style="font-size:1.05rem;font-weight:700;color:var(--gray-900);">Quick Update — Status & Location</div>
              <div style="font-size:0.8rem;color:var(--gray-600);font-weight:normal;">Register: <strong style="font-family:monospace;color:var(--primary);">${fn}</strong>${file.clientName ? ` · ${file.clientName}` : ''}</div>
            </div>
          </div>`,
        size: 'modal-lg',
        body: `
          <p style="color:var(--gray-600);font-size:0.85rem;margin-bottom:16px;">
            Fast update of status, location, bin, and custody. Changes will be recorded in the Activity Log with exact before/after details.
          </p>

          <div class="form-grid" style="row-gap:16px;">
            <!-- Status -->
            <div class="form-group">
              <label class="form-label">Status <span class="required">*</span></label>
              <select class="form-control" id="qu-status">
                ${statusList.map(s => `<option value="${escapeHTML(s)}" ${s === curStatus ? 'selected' : ''}>${escapeHTML(s)}</option>`).join('')}
              </select>
            </div>

            <!-- Location -->
            <div class="form-group">
              <label class="form-label">Location</label>
              <input type="text" class="form-control" id="qu-location" list="qu-loc-list" value="${escapeHTML(curLocation)}" placeholder="Select or type location">
              <datalist id="qu-loc-list">
                ${locations.map(l => `<option value="${escapeHTML(l)}">`).join('')}
              </datalist>
            </div>

            <!-- Bin Location -->
            <div class="form-group">
              <label class="form-label">Bin Location</label>
              <input type="text" class="form-control" id="qu-bin" list="qu-bin-list" value="${escapeHTML(curBin)}" placeholder="e.g. Rack A-101">
              <datalist id="qu-bin-list">
                ${bins.map(b => `<option value="${escapeHTML(b)}">`).join('')}
              </datalist>
            </div>

            <!-- Held By -->
            <div class="form-group" id="qu-heldby-group">
              <label class="form-label" id="qu-heldby-label">Held By / Custody ${curStatus === 'Checked out' ? '<span class="required">*</span>' : '<span style="font-weight:400;color:var(--gray-500)">(optional)</span>'}</label>
              <input type="text" class="form-control" id="qu-heldby" value="${escapeHTML(curHeldBy)}" placeholder="Name of person or department holding file">
            </div>

            <!-- Due Date -->
            <div class="form-group" id="qu-duedate-group">
              <label class="form-label">Due Date <span style="font-weight:400;color:var(--gray-500)">(optional)</span></label>
              <input type="date" class="form-control" id="qu-duedate" value="${escapeHTML(curDueDate)}">
            </div>

            <!-- Change Note / Reason -->
            <div class="form-group">
              <label class="form-label">Reason / Remarks for Change <span style="font-weight:400;color:var(--gray-500)">(recommended)</span></label>
              <input type="text" class="form-control" id="qu-note" placeholder="e.g. Shifted to accounts, Routine audit, Shelf reorganization...">
            </div>
          </div>
        `,
        footer: `
          <button class="btn btn-secondary" id="qu-cancel">Cancel</button>
          <button class="btn btn-warning" id="qu-submit" style="font-weight:600;">⚡ Update Status & Location</button>
        `
      });

      const statusEl   = overlay.querySelector('#qu-status');
      const heldByEl   = overlay.querySelector('#qu-heldby');
      const dueDateEl  = overlay.querySelector('#qu-duedate');
      const heldByLbl  = overlay.querySelector('#qu-heldby-label');
      const submitBtn  = overlay.querySelector('#qu-submit');
      const cancelBtn  = overlay.querySelector('#qu-cancel');

      // Dynamically toggle requirement when Status is changed
      statusEl.addEventListener('change', () => {
        const val = statusEl.value;
        if (val === 'Checked out') {
          heldByLbl.innerHTML = 'Held By <span class="required">*</span>';
          if (!heldByEl.value) heldByEl.value = App.user || '';
          heldByEl.focus();
        } else {
          heldByLbl.innerHTML = 'Held By / Custody <span style="font-weight:400;color:var(--gray-500)">(optional)</span>';
          if (curStatus === 'Checked out' && val === 'In office') {
            heldByEl.value = '';
            dueDateEl.value = '';
          }
        }
      });

      cancelBtn.addEventListener('click', closeModal);

      submitBtn.addEventListener('click', () => {
        const newStatus   = statusEl.value;
        const newLocation = overlay.querySelector('#qu-location').value.trim();
        const newBin      = overlay.querySelector('#qu-bin').value.trim();
        const newHeldBy   = heldByEl.value.trim();
        const newDueDate  = dueDateEl.value;
        const note        = overlay.querySelector('#qu-note').value.trim();

        if (newStatus === 'Checked out' && !newHeldBy) {
          heldByEl.classList.add('is-invalid');
          heldByEl.focus();
          toast('Please specify who is taking the file', 'warning');
          return;
        }

        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
          toast('Connect Apps Script first', 'warning');
          closeModal();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving changes…';

        api('updateFile', {}, {
          action: 'updateFile',
          fileNumber: fn,
          status: newStatus,
          location: newLocation,
          binLocation: newBin,
          heldBy: newHeldBy,
          dueDate: newDueDate,
          changeNote: note || 'Quick status & location change',
          updatedBy: App.user || 'System'
        })
        .then(res => {
          if (typeof AppDataStore !== 'undefined') {
            AppDataStore.updateItem(fn, {
              status: newStatus,
              location: newLocation,
              binLocation: newBin,
              heldBy: newHeldBy,
              dueDate: newDueDate
            });
          }
          toast(`Status & location updated for ${fn}`, 'success');
          closeModal();
          if (onSuccess) onSuccess(res);
        })
        .catch(err => {
          toast('Update failed: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = '⚡ Update Status & Location';
        });
      });
    }
  }

  return { openCheckout, openReturn, openQuickStatusLocation };
})();

// Alias for global convenience
const QuickActionModule = CheckoutModule;

