// ── MASTERS MODULE ────────────────────────────────────────────
const MastersModule = (() => {

  let activeTab = 'clients';

  function render(container, topbarActions) {
    loadConfig().then(() => {
      container.innerHTML = buildHTML();
      bindEvents(container);
    });
  }

  function buildHTML() {
    return `
      <div style="max-width:900px">
        <div class="tabs">
          <button class="tab-btn ${activeTab==='clients'?'active':''}" data-tab="clients">👥 Clients</button>
          <button class="tab-btn ${activeTab==='categories'?'active':''}" data-tab="categories">📁 Categories</button>
          <button class="tab-btn ${activeTab==='subcategories'?'active':''}" data-tab="subcategories">📂 Sub-Categories</button>
          <button class="tab-btn ${activeTab==='lists'?'active':''}" data-tab="lists">📋 Drop-down Lists</button>
        </div>
        <div id="master-tab-content">${renderTabContent(activeTab)}</div>
      </div>`;
  }

  function renderTabContent(tab) {
    const cfg = App.config || {};
    switch (tab) {
      case 'clients':       return renderMasterTable('Clients',       cfg.clients       || [], 'Clients');
      case 'categories':    return renderMasterTable('Categories',    cfg.categories    || [], 'Categories');
      case 'subcategories': return renderMasterTable('Sub-Categories',cfg.subcategories || [], 'Subcategories');
      case 'lists':         return renderListsPanel(cfg.lists || {});
      default: return '';
    }
  }

  function renderMasterTable(title, items, type) {
    const rows = items.map(item => `
      <tr data-name="${escH(item.name)}" data-type="${type}">
        <td>${escH(item.name)}</td>
        <td><code>${escH(item.code)}</code></td>
        <td>
          <div class="col-actions">
            <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-master" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" data-action="del-master" title="Delete" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('') || `<tr><td colspan="3" class="table-empty">No ${title} yet</td></tr>`;

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${title} <span style="font-weight:400;color:var(--gray-500)">(${items.length})</span></span>
        </div>
        <div class="table-wrap" style="border-radius:0;border:none;border-bottom:1px solid var(--gray-200)">
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Actions</th></tr></thead>
            <tbody id="master-tbody">${rows}</tbody>
          </table>
        </div>
        <div class="card-body" style="padding:12px 16px">
          <div class="inline-add-form">
            <input type="text" id="new-master-name" placeholder="New ${title.replace(/s$/,'')} name…">
            <input type="text" id="new-master-code" placeholder="Code (optional, auto-generated)" style="max-width:160px">
            <button class="btn btn-primary btn-sm" id="btn-add-master" data-type="${type}">＋ Add</button>
          </div>
        </div>
      </div>`;
  }

  function renderListsPanel(lists) {
    const listNames = ['Locations', 'Business Verticals', 'Entities', 'HODs', 'File Types', 'Colours', 'Bin Locations'];
    const panels = listNames.map(name => {
      const items = lists[name] || [];
      const chips = items.map(v => `
        <span class="chip" style="display:inline-flex;align-items:center;gap:4px">
          ${escH(v)}
          <button class="btn" style="padding:0;background:none;border:none;font-size:.7rem;cursor:pointer;color:var(--gray-500)" data-action="del-list" data-list="${escH(name)}" data-val="${escH(v)}" title="Remove">✕</button>
        </span>`).join('');
      return `
        <div class="card" style="margin-bottom:12px">
          <div class="card-header"><span class="card-title">${name}</span></div>
          <div class="card-body">
            <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:4px;min-height:28px">${chips || '<span style="color:var(--gray-500);font-size:.85rem">No items yet</span>'}</div>
            <div class="inline-add-form">
              <input type="text" placeholder="Add new ${name.replace(/s$/,'').toLowerCase()}…" id="list-input-${name.replace(/\s+/g,'-')}">
              <button class="btn btn-primary btn-sm" data-action="add-list" data-list="${escH(name)}">＋ Add</button>
            </div>
          </div>
        </div>`;
    }).join('');

    const fixed = lists['Status (fixed)'] || ['In office','Checked out','Archived','Missing'];
    return `
      ${panels}
      <div class="card" style="background:var(--gray-50)">
        <div class="card-header"><span class="card-title">Status (fixed, not editable)</span></div>
        <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap">
          ${fixed.map(s => statusBadge(s)).join('')}
        </div>
      </div>`;
  }

  function escH(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function bindEvents(container) {
    // Tab switching
    qsa('.tab-btn', container).forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        qsa('.tab-btn', container).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tc = container.querySelector('#master-tab-content');
        if (tc) tc.innerHTML = renderTabContent(activeTab);
        bindEvents(container); // re-bind for new content
      });
    });

    // Add master
    const addMasterBtn = container.querySelector('#btn-add-master');
    if (addMasterBtn) {
      addMasterBtn.addEventListener('click', () => {
        const name = container.querySelector('#new-master-name')?.value.trim();
        const code = container.querySelector('#new-master-code')?.value.trim();
        const type = addMasterBtn.dataset.type;
        if (!name) return;
        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
        addMasterBtn.disabled = true;
        api('addMaster', {}, { action: 'addMaster', type, name, code })
          .then(() => { toast(`"${name}" added`, 'success'); loadConfig(true).then(() => { const tc = container.querySelector('#master-tab-content'); if (tc) tc.innerHTML = renderTabContent(activeTab); bindEvents(container); }); })
          .catch(err => { toast(err.message, 'error'); addMasterBtn.disabled = false; });
      });
    }

    // Edit / delete master rows
    qsa('[data-action="edit-master"]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const oldName = row.dataset.name;
        const type    = row.dataset.type;
        promptDialog(
          `Edit ${type.replace(/s$/, '')}`,
          'Name',
          (newName, newCode) => {
            if (newName === oldName && !newCode) return Promise.resolve();
            if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return Promise.reject(new Error('Connect Apps Script first')); }
            return api('updateMaster', {}, { action: 'updateMaster', type, oldName, name: newName, code: newCode })
              .then(() => { toast('Updated', 'success'); loadConfig(true).then(() => { const tc = container.querySelector('#master-tab-content'); if (tc) tc.innerHTML = renderTabContent(activeTab); bindEvents(container); }); })
              .catch(err => { toast(err.message, 'error'); throw err; });
          },
          { placeholder: oldName, secondLabel: 'Code', secondPlaceholder: 'Leave blank to keep current' }
        );
      });
    });

    qsa('[data-action="del-master"]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const name = row.dataset.name;
        const type = row.dataset.type;
        confirmDialog(`Remove <strong>${name}</strong> from ${type}? Existing file records will not be affected.`, () => {
          if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
          api('deleteMaster', {}, { action: 'deleteMaster', type, name })
            .then(() => { toast('Deleted', 'success'); loadConfig(true).then(() => { const tc = container.querySelector('#master-tab-content'); if (tc) tc.innerHTML = renderTabContent(activeTab); bindEvents(container); }); })
            .catch(err => toast(err.message, 'error'));
        }, 'Remove');
      });
    });

    // Lists: add item
    qsa('[data-action="add-list"]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const listName = btn.dataset.list;
        const inputId  = 'list-input-' + listName.replace(/\s+/g, '-');
        const input    = container.querySelector('#' + inputId);
        const value    = input?.value.trim();
        if (!value) return;
        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
        btn.disabled = true;
        api('addListItem', {}, { action: 'addListItem', listName, value })
          .then(() => { toast(`"${value}" added to ${listName}`, 'success'); loadConfig(true).then(() => { const tc = container.querySelector('#master-tab-content'); if (tc) tc.innerHTML = renderTabContent(activeTab); bindEvents(container); }); })
          .catch(err => { toast(err.message, 'error'); btn.disabled = false; });
      });
    });

    // Lists: delete item
    qsa('[data-action="del-list"]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const listName = btn.dataset.list;
        const value    = btn.dataset.val;
        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { toast('Connect Apps Script first', 'warning'); return; }
        api('deleteListItem', {}, { action: 'deleteListItem', listName, value })
          .then(() => { toast(`"${value}" removed`, 'success'); loadConfig(true).then(() => { const tc = container.querySelector('#master-tab-content'); if (tc) tc.innerHTML = renderTabContent(activeTab); bindEvents(container); }); })
          .catch(err => toast(err.message, 'error'));
      });
    });

    // Enter key for list inputs
    qsa('[id^="list-input-"]', container).forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const listName = input.id.replace('list-input-', '').replace(/-/g, ' ');
          const btn = container.querySelector(`[data-action="add-list"][data-list="${listName}"]`);
          btn?.click();
        }
      });
    });
  }

  return { render };
})();
