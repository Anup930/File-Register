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
        .then(() => { toast(`File checked out to ${heldBy}`, 'success'); closeModal(); if (onSuccess) onSuccess(); })
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
        .then(() => { toast('File returned to office', 'success'); closeModal(); if (onSuccess) onSuccess(); })
        .catch(err => { toast('Return failed: ' + err.message, 'error'); btn.disabled = false; btn.textContent = '↩️ Mark as Returned'; });
    });
  }

  return { openCheckout, openReturn };
})();
