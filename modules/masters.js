// ── MASTERS MODULE (Settings) ───────────────────────────────────
// Handles: Clients, Categories, Sub-Categories, and Lists
// Features: View with Search & Pagination, Add, Edit, Delete, and Bulk Import (Paste / CSV)
const MastersModule = (() => {

  let activeTab = 'clients'; // 'clients' | 'categories' | 'subcategories' | 'lists'
  let activeList = 'Locations'; // for lists tab
  let searchQuery = '';
  let clientPage = 1;
  const CLIENT_PAGE_SIZE = 50;

  function render(container, topbarActions, initialTab) {
    if (initialTab && ['clients', 'categories', 'subcategories', 'lists', 'users'].includes(initialTab.toLowerCase())) {
      activeTab = initialTab.toLowerCase();
    }
    searchQuery = '';
    clientPage = 1;

    loadConfig().then(() => {
      container.innerHTML = buildHTML();
      bindEvents(container);
    });
  }

  function buildHTML() {
    const cfg = App.config || {};
    const clientsCount = (cfg.clients || []).length;
    const catCount = (cfg.categories || []).length;
    const subCount = (cfg.subcategories || []).length;
    const lists = cfg.lists || {};
    const totalListItems = Object.values(lists).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

    return `
      <div class="settings-container" style="max-width:1100px;margin:0 auto">
        <!-- Settings Header & Navigation Tabs -->
        <div class="card" style="margin-bottom:20px;border-bottom:none">
          <div style="padding:16px 20px 0 20px">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">
              <div>
                <h2 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);display:flex;align-items:center;gap:8px">
                  <span>⚙️</span> Master Settings
                </h2>
                <p style="font-size:0.85rem;color:var(--gray-600);margin-top:2px">
                  Manage master data for Clients, Categories, Sub-Categories, and Form Drop-down Lists
                </p>
              </div>
              <div style="display:flex;gap:8px" id="settings-top-actions">
                <button class="btn btn-secondary btn-sm" id="btn-import-master" style="height:36px">
                  📥 Import Data
                </button>
                <button class="btn btn-primary btn-sm" id="btn-add-master-entry" style="height:36px">
                  ➕ Add New
                </button>
              </div>
            </div>

            <div class="tabs" style="margin-bottom:0;border-bottom:1px solid var(--gray-200)">
              <button class="tab-btn ${activeTab==='clients'?'active':''}" data-tab="clients">
                👥 Clients <span class="badge" style="background:var(--gray-100);color:var(--gray-700);margin-left:4px;font-size:0.75rem">${clientsCount}</span>
              </button>
              <button class="tab-btn ${activeTab==='categories'?'active':''}" data-tab="categories">
                📁 Categories <span class="badge" style="background:var(--gray-100);color:var(--gray-700);margin-left:4px;font-size:0.75rem">${catCount}</span>
              </button>
              <button class="tab-btn ${activeTab==='subcategories'?'active':''}" data-tab="subcategories">
                📂 Sub-Categories <span class="badge" style="background:var(--gray-100);color:var(--gray-700);margin-left:4px;font-size:0.75rem">${subCount}</span>
              </button>
              <button class="tab-btn ${activeTab==='lists'?'active':''}" data-tab="lists">
                📋 Drop-down Lists <span class="badge" style="background:var(--gray-100);color:var(--gray-700);margin-left:4px;font-size:0.75rem">${totalListItems}</span>
              </button>
              <button class="tab-btn ${activeTab==='users'?'active':''}" data-tab="users">
                👤 Users & Access
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Content Area -->
        <div id="master-tab-content">
          ${renderTabContent(activeTab)}
        </div>
      </div>`;
  }

  function renderTabContent(tab) {
    const cfg = App.config || {};
    switch (tab) {
      case 'clients':       return renderClientsTab(cfg.clients || []);
      case 'categories':    return renderCategoriesTab(cfg.categories || []);
      case 'subcategories': return renderSubcategoriesTab(cfg.subcategories || []);
      case 'lists':         return renderListsTab(cfg.lists || {});
      case 'users':         return renderUsersTab();
      default:              return renderClientsTab(cfg.clients || []);
    }
  }

  // ── 1. CLIENTS TAB ───────────────────────────────────────────
  function renderClientsTab(items) {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q))
      : items;

    const total = filtered.length;
    const totalPages = Math.ceil(total / CLIENT_PAGE_SIZE) || 1;
    if (clientPage > totalPages) clientPage = totalPages;
    const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + CLIENT_PAGE_SIZE);

    const rows = pageItems.map((item, idx) => `
      <tr data-name="${escH(item.name)}" data-code="${escH(item.code)}" data-type="Clients">
        <td style="color:var(--gray-500);font-size:0.8rem;width:50px">${start + idx + 1}</td>
        <td style="font-weight:500;color:var(--gray-900)">${escH(item.name)}</td>
        <td><code style="background:var(--gray-100);padding:2px 8px;border-radius:4px;font-size:0.85rem">${escH(item.code)}</code></td>
        <td style="text-align:right;width:110px">
          <div class="col-actions" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-client" title="Edit Client">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" data-action="del-client" title="Delete Client" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    const empty = `<tr><td colspan="4" class="table-empty"><div class="empty-icon">👥</div><p>No clients found${q ? ` matching "${escH(q)}"` : ''}.</p></td></tr>`;

    let paginationControls = '';
    if (totalPages > 1) {
      paginationControls = `
        <div class="pagination" style="border-top:1px solid var(--gray-200)">
          <span class="pagination-info">Showing ${total ? `${start + 1}–${Math.min(start + CLIENT_PAGE_SIZE, total)} of ${total}` : 0} clients</span>
          <div class="pagination-controls">
            <button class="page-btn" data-page-action="prev" ${clientPage <= 1 ? 'disabled' : ''}>‹ Prev</button>
            <span style="font-size:0.85rem;color:var(--gray-600);padding:0 8px">Page ${clientPage} of ${totalPages}</span>
            <button class="page-btn" data-page-action="next" ${clientPage >= totalPages ? 'disabled' : ''}>Next ›</button>
          </div>
        </div>`;
    }

    return `
      <div class="card">
        <div class="card-header" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:260px">
            <div class="search-wrap" style="flex:1;max-width:380px">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" id="master-search-input" placeholder="Search clients by name or code…" value="${escH(searchQuery)}" style="height:36px">
            </div>
            ${searchQuery ? `<button class="btn btn-ghost btn-sm" id="btn-clear-search">✕ Clear</button>` : ''}
          </div>
          <div style="font-size:0.85rem;color:var(--gray-600)">
            Total: <strong>${items.length}</strong> clients ${q ? `(found ${total})` : ''}
          </div>
        </div>
        <div class="table-wrap" style="border-radius:0;border:none">
          <table>
            <thead>
              <tr>
                <th style="width:50px">#</th>
                <th>Client Name</th>
                <th style="width:140px">Client Code</th>
                <th style="text-align:right;width:110px">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || empty}</tbody>
          </table>
        </div>
        ${paginationControls}
      </div>`;
  }

  // ── 2. CATEGORIES TAB ─────────────────────────────────────────
  function renderCategoriesTab(items) {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q))
      : items;

    const rows = filtered.map((item, idx) => `
      <tr data-name="${escH(item.name)}" data-code="${escH(item.code)}" data-type="${escH(item.fileType || '')}" data-colour="${escH(item.colour || '')}">
        <td style="color:var(--gray-500);font-size:0.8rem;width:50px">${idx + 1}</td>
        <td style="font-weight:600;color:var(--gray-900)">${escH(item.name)}</td>
        <td><code style="background:var(--gray-100);padding:2px 8px;border-radius:4px;font-size:0.85rem">${escH(item.code)}</code></td>
        <td>${item.fileType ? `<span class="chip" style="margin:0">${escH(item.fileType)}</span>` : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td>${item.colour ? `<span class="chip" style="margin:0;background:var(--gray-50);border-color:var(--gray-300)">🎨 ${escH(item.colour)}</span>` : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td style="text-align:right;width:110px">
          <div class="col-actions" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-category" title="Edit Category">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" data-action="del-category" title="Delete Category" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    const empty = `<tr><td colspan="6" class="table-empty"><div class="empty-icon">📁</div><p>No categories found${q ? ` matching "${escH(q)}"` : ''}.</p></td></tr>`;

    return `
      <div class="card">
        <div class="card-header" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:260px">
            <div class="search-wrap" style="flex:1;max-width:380px">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" id="master-search-input" placeholder="Search categories…" value="${escH(searchQuery)}" style="height:36px">
            </div>
            ${searchQuery ? `<button class="btn btn-ghost btn-sm" id="btn-clear-search">✕ Clear</button>` : ''}
          </div>
          <div style="font-size:0.85rem;color:var(--gray-600)">
            Total: <strong>${items.length}</strong> categories
          </div>
        </div>
        <div class="table-wrap" style="border-radius:0;border:none">
          <table>
            <thead>
              <tr>
                <th style="width:50px">#</th>
                <th>Category Name</th>
                <th style="width:130px">Code</th>
                <th style="width:140px">File Type</th>
                <th style="width:150px">File Colour</th>
                <th style="text-align:right;width:110px">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || empty}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── 3. SUBCATEGORIES TAB ──────────────────────────────────────
  function renderSubcategoriesTab(items) {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q))
      : items;

    const rows = filtered.map((item, idx) => `
      <tr data-name="${escH(item.name)}" data-code="${escH(item.code)}">
        <td style="color:var(--gray-500);font-size:0.8rem;width:50px">${idx + 1}</td>
        <td style="font-weight:600;color:var(--gray-900)">${escH(item.name)}</td>
        <td><code style="background:var(--gray-100);padding:2px 8px;border-radius:4px;font-size:0.85rem">${escH(item.code)}</code></td>
        <td style="text-align:right;width:110px">
          <div class="col-actions" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-subcategory" title="Edit Sub-Category">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" data-action="del-subcategory" title="Delete Sub-Category" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    const empty = `<tr><td colspan="4" class="table-empty"><div class="empty-icon">📂</div><p>No sub-categories found${q ? ` matching "${escH(q)}"` : ''}.</p></td></tr>`;

    return `
      <div class="card">
        <div class="card-header" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:260px">
            <div class="search-wrap" style="flex:1;max-width:380px">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" id="master-search-input" placeholder="Search sub-categories…" value="${escH(searchQuery)}" style="height:36px">
            </div>
            ${searchQuery ? `<button class="btn btn-ghost btn-sm" id="btn-clear-search">✕ Clear</button>` : ''}
          </div>
          <div style="font-size:0.85rem;color:var(--gray-600)">
            Total: <strong>${items.length}</strong> sub-categories
          </div>
        </div>
        <div class="table-wrap" style="border-radius:0;border:none">
          <table>
            <thead>
              <tr>
                <th style="width:50px">#</th>
                <th>Sub-Category Name</th>
                <th style="width:140px">Code</th>
                <th style="text-align:right;width:110px">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || empty}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── 4. LISTS TAB ──────────────────────────────────────────────
  function renderListsTab(lists) {
    const listNames = ['Locations', 'Business Verticals', 'HODs', 'Entities', 'File Types', 'Colours', 'Bin Locations'];
    if (!listNames.includes(activeList)) activeList = 'Locations';

    const pillTabs = listNames.map(name => {
      const count = (lists[name] || []).length;
      return `
        <button class="tab-btn ${activeList === name ? 'active' : ''}" data-list-tab="${escH(name)}" style="padding:8px 14px;font-size:0.85rem">
          ${name} <span class="badge" style="background:${activeList === name ? 'rgba(26,115,232,.15)' : 'var(--gray-100)'};color:${activeList === name ? 'var(--primary)' : 'var(--gray-700)'};font-size:0.72rem;margin-left:4px">${count}</span>
        </button>`;
    }).join('');

    const items = lists[activeList] || [];
    const q = searchQuery.toLowerCase().trim();
    const filtered = q ? items.filter(v => v.toLowerCase().includes(q)) : items;

    const rows = filtered.map((v, idx) => `
      <tr data-list="${escH(activeList)}" data-val="${escH(v)}">
        <td style="color:var(--gray-500);font-size:0.8rem;width:50px">${idx + 1}</td>
        <td style="font-weight:500;color:var(--gray-900)">${escH(v)}</td>
        <td style="text-align:right;width:110px">
          <div class="col-actions" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm btn-icon" data-action="edit-list-item" title="Edit Item">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" data-action="del-list-item" title="Delete Item" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    const empty = `<tr><td colspan="3" class="table-empty"><div class="empty-icon">📋</div><p>No items in ${activeList}${q ? ` matching "${escH(q)}"` : ''}.</p></td></tr>`;

    const fixed = lists['Status (fixed)'] || ['In office', 'Checked out', 'Archived', 'Missing'];

    return `
      <div class="card" style="margin-bottom:16px">
        <div style="padding:12px 16px 0 16px;background:var(--gray-50);border-bottom:1px solid var(--gray-200)">
          <div class="tabs" style="margin-bottom:0;border-bottom:none;overflow-x:auto;flex-wrap:nowrap">
            ${pillTabs}
          </div>
        </div>

        <div class="card-header" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:260px">
            <div class="search-wrap" style="flex:1;max-width:340px">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" id="master-search-input" placeholder="Search in ${activeList}…" value="${escH(searchQuery)}" style="height:36px">
            </div>
            ${searchQuery ? `<button class="btn btn-ghost btn-sm" id="btn-clear-search">✕ Clear</button>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:0.85rem;color:var(--gray-600)">Total: <strong>${items.length}</strong> items</span>
            <button class="btn btn-secondary btn-sm" id="btn-import-list-items" data-list="${escH(activeList)}" style="height:32px">
              📥 Import to ${activeList}
            </button>
          </div>
        </div>

        <div class="table-wrap" style="border-radius:0;border:none">
          <table>
            <thead>
              <tr>
                <th style="width:50px">#</th>
                <th>Item Value</th>
                <th style="text-align:right;width:110px">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || empty}</tbody>
          </table>
        </div>

        <div class="card-body" style="padding:12px 16px;background:var(--gray-50);border-top:1px solid var(--gray-200)">
          <div class="inline-add-form" style="max-width:500px">
            <input type="text" id="quick-add-list-input" placeholder="Add new ${activeList.replace(/s$/,'').toLowerCase()}…" style="height:36px">
            <button class="btn btn-primary btn-sm" id="btn-quick-add-list" data-list="${escH(activeList)}" style="height:36px">
              ➕ Add to ${activeList}
            </button>
          </div>
        </div>
      </div>

      <!-- System Fixed Statuses Notice -->
      <div class="card" style="background:var(--gray-50)">
        <div class="card-header" style="padding:12px 16px">
          <span class="card-title" style="font-size:0.9rem">System Statuses (Fixed, Non-editable)</span>
        </div>
        <div class="card-body" style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap">
          ${fixed.map(s => statusBadge(s)).join('')}
        </div>
      </div>`;
  }

  // ── 5. USERS & ACCESS TAB ────────────────────────────────────
  function renderUsersTab() {
    return `
      <div class="card">
        <div class="card-header" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <span class="card-title" style="font-size:1.05rem;font-weight:700">👥 System Users & Access Control</span>
            <div style="font-size:0.82rem;color:var(--gray-600);margin-top:2px">
              Users configured in the <strong>Users</strong> sheet tab. Default password for all users is <code>Test</code>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${App.currentUser?.role === 'Admin' ? `
              <a href="admin-guide.html" target="_blank" class="btn btn-secondary btn-sm" style="height:34px;color:#b06000;background:#fef7e0;border-color:#feefc3;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
                🛡️ Access Guide ↗
              </a>
            ` : ''}
            <button class="btn btn-secondary btn-sm" id="btn-setup-users-sheet" style="height:34px;" title="Initialize or reset Users sheet with headers and default accounts">
              ⚙️ Setup / Reset Users Sheet
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-refresh-users" style="height:34px;">🔄 Refresh</button>
            <button class="btn btn-primary btn-sm" id="btn-add-user-top" style="height:34px;">➕ Add User</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <div id="users-table-container" style="padding:24px;text-align:center;">
            <div class="spinner"></div><span style="margin-left:8px;font-size:0.9rem;color:var(--gray-600)">Loading users from Google Sheet…</span>
          </div>
        </div>
      </div>
    `;
  }

  function loadAndRenderUsers(container, force = false) {
    const wrap = container.querySelector('#users-table-container');
    if (!wrap) return;

    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      wrap.innerHTML = `
        <div class="card" style="margin:20px 0;">
          <div class="card-body" style="text-align:center;padding:32px;">
            <p style="color:var(--gray-600)">Connect Google Apps Script to manage team users.</p>
          </div>
        </div>
      `;
      return;
    }

    function renderUserTable(users) {
      if (!Array.isArray(users) || !users.length) {
        wrap.innerHTML = `
          <div style="padding:36px 16px;text-align:center;">
            <div style="font-size:2.8rem;margin-bottom:8px">👥</div>
            <p style="color:var(--gray-800);font-weight:600;font-size:1rem;margin-bottom:4px">No users found in "Users" sheet.</p>
            <p style="color:var(--gray-500);font-size:0.85rem;margin-bottom:16px">Click below to setup Row 1 headers and create default seed users with password "Test".</p>
            <button class="btn btn-primary btn-sm" id="btn-setup-users-empty">⚙️ Run Setup Users Sheet</button>
          </div>
        `;
        container.querySelector('#btn-setup-users-empty')?.addEventListener('click', () => triggerSetupUsers(container));
        return;
      }

      wrap.innerHTML = `
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Access & Permissions</th>
                <th>Email</th>
                <th>Last Login</th>
                <th style="text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => {
                const isFullAdmin = u.role === 'Admin' || (u.permissions && u.permissions.includes('*'));
                const permBadge = isFullAdmin
                  ? `<span class="badge" style="background:#e8f0fe;color:#1a73e8;font-weight:700;">👑 Full Access</span>`
                  : `<span class="badge" style="background:var(--gray-100);color:var(--gray-800);font-weight:600;">🔑 ${(u.permissions || []).length} Access Rights</span>`;
                return `
                  <tr>
                    <td style="font-family:monospace;font-weight:700;color:var(--primary);">${escH(u.userId || '—')}</td>
                    <td style="font-weight:600;color:var(--gray-900);"><code>${escH(u.username)}</code></td>
                    <td style="font-weight:500;">${escH(u.fullName || '—')}</td>
                    <td>
                      <span class="badge" style="background:${u.role === 'Admin' ? '#fef7e0' : 'var(--primary-light)'};color:${u.role === 'Admin' ? '#b06000' : 'var(--primary)'};font-weight:700;">
                        ${escH(u.role || 'Staff')}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${u.status === 'Active' ? 'badge-inoffice' : 'badge-checkedout'}">
                        ${escH(u.status || 'Active')}
                      </span>
                    </td>
                    <td>${permBadge}</td>
                    <td style="font-size:0.85rem;color:var(--gray-600);">${escH(u.email || '—')}</td>
                    <td style="font-size:0.8rem;color:var(--gray-500);white-space:nowrap;">${escH(u.lastLogin || 'Never')}</td>
                    <td style="text-align:center;">
                      <button class="btn btn-secondary btn-sm btn-edit-user" data-username="${escH(u.username)}" style="padding:4px 10px;font-size:0.75rem;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                        ✏️ Edit & Access
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Bind Edit User buttons
      wrap.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const uname = btn.dataset.username;
          const target = users.find(x => x.username === uname);
          if (target) openEditUserModal(target, container);
        });
      });
    }

    // 1. Instant Cache Check (0ms)
    if (!force) {
      const cached = AppCache.get('users_list', 'session');
      if (cached) {
        renderUserTable(cached);
        return;
      }
    }

    wrap.innerHTML = '<div class="spinner"></div><span style="margin-left:8px;color:var(--gray-600)">Loading team users from sheet…</span>';

    api('getUsers').then(users => {
      AppCache.set('users_list', users, 3 * 60 * 1000, 'session'); // 3-min cache
      renderUserTable(users);
    }).catch(err => {
      wrap.innerHTML = `<div style="padding:24px;text-align:center;color:var(--danger)">Error loading users: ${err.message}</div>`;
    });

    // Top actions
    const refreshBtn = container.querySelector('#btn-refresh-users');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        AppCache.invalidate('users_list');
        loadAndRenderUsers(container, true);
      };
    }

    const setupBtn = container.querySelector('#btn-setup-users-sheet');
    if (setupBtn) setupBtn.onclick = () => triggerSetupUsers(container);

    const addBtn = container.querySelector('#btn-add-user-top');
    if (addBtn) addBtn.onclick = () => openAddUserModal(container);
  }

  function triggerSetupUsers(container) {
    openConfirmModal(
      'Setup Users Sheet',
      'This will configure Row 1 headers in the "Users" Google Sheet tab and seed default accounts (admin, anup.singh, gretex.staff, viewer) with password "Test". Continue?',
      () => {
        const wrap = container.querySelector('#users-table-container');
        if (wrap) wrap.innerHTML = '<div class="spinner"></div><span style="margin-left:8px;color:var(--gray-600)">Configuring Users sheet in Google Sheets…</span>';
        api('setupUsers', {}, { action: 'setupUsers' })
          .then(res => {
            toast(res.message || 'Users sheet setup completed!', 'success');
            loadAndRenderUsers(container);
          })
          .catch(err => {
            toast(err.message, 'error');
            loadAndRenderUsers(container);
          });
      },
      'Run Setup'
    );
  }

  function buildPermissionsMatrixHTML(currentPerms = [], role = 'Staff') {
    const isFullAdmin = role === 'Admin' || currentPerms.includes('*');
    const catalog = App.getAvailablePermissions ? App.getAvailablePermissions() : [];

    return `
      <div class="perm-presets-bar">
        <span style="font-size:0.75rem;font-weight:700;color:var(--gray-700);text-transform:uppercase;margin-right:4px;">Presets:</span>
        <button type="button" class="perm-preset-btn" data-preset="admin">👑 Full Admin</button>
        <button type="button" class="perm-preset-btn" data-preset="staff">💼 Standard Staff</button>
        <button type="button" class="perm-preset-btn" data-preset="viewer">👁️ Read-Only Viewer</button>
        <button type="button" class="perm-preset-btn" data-preset="clear" style="color:var(--danger)">🧹 Clear All</button>
      </div>

      <div class="perm-matrix-container" id="perm-matrix-wrap">
        ${catalog.map(group => `
          <div class="perm-group-card">
            <div class="perm-group-header">
              <span>${group.icon}</span>
              <span>${group.group}</span>
            </div>
            <div class="perm-group-items">
              ${group.items.map(item => {
                const isChecked = isFullAdmin || currentPerms.includes(item.key);
                return `
                  <label class="perm-item-row">
                    <input type="checkbox" class="perm-cb" value="${item.key}" ${isChecked ? 'checked' : ''}>
                    <div class="perm-item-text">
                      <span class="perm-item-label">${item.label}</span>
                      <div class="perm-item-desc">${item.desc}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindPermissionsPresets(modalEl) {
    modalEl.querySelectorAll('.perm-preset-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const preset = btn.dataset.preset;
        const cbs = modalEl.querySelectorAll('.perm-cb');
        if (preset === 'admin') {
          cbs.forEach(cb => cb.checked = true);
        } else if (preset === 'staff') {
          const staffPerms = ['register.view', 'register.create', 'register.edit', 'register.bulk', 'checkout.manage', 'stickers.print'];
          cbs.forEach(cb => { cb.checked = staffPerms.includes(cb.value); });
        } else if (preset === 'viewer') {
          cbs.forEach(cb => { cb.checked = (cb.value === 'register.view'); });
        } else if (preset === 'clear') {
          cbs.forEach(cb => cb.checked = false);
        }
      };
    });
  }

  function getSelectedPermissions(modalEl, role) {
    if (role === 'Admin') return ['*'];
    const selected = [];
    modalEl.querySelectorAll('.perm-cb:checked').forEach(cb => {
      selected.push(cb.value);
    });
    return selected;
  }

  function openAddUserModal(container) {
    const defaultStaffPerms = ['register.view', 'register.create', 'register.edit', 'register.bulk', 'checkout.manage', 'stickers.print'];
    const overlay = openModal({
      title: '➕ Add New User & Access Setup',
      size: 'modal-lg',
      body: `
        <form id="form-new-user" novalidate style="display:flex;flex-direction:column;gap:14px;padding:4px 0;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Username <span class="required" style="color:var(--danger)">*</span></label>
              <input type="text" class="form-control" id="nu-username" placeholder="e.g. rahul.sharma" required style="font-family:monospace;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Full Name <span class="required" style="color:var(--danger)">*</span></label>
              <input type="text" class="form-control" id="nu-fullname" placeholder="e.g. Rahul Sharma" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Role Profile</label>
              <select class="form-control" id="nu-role">
                <option value="Staff" selected>Staff (Standard Operator)</option>
                <option value="Admin">Admin (Full Access)</option>
                <option value="Viewer">Viewer (Read-Only)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Account Status</label>
              <select class="form-control" id="nu-status">
                <option value="Active" selected>Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Email Address</label>
              <input type="email" class="form-control" id="nu-email" placeholder="e.g. rahul@gretexgroup.com">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Initial Password</label>
              <input type="text" class="form-control" id="nu-password" value="Test" style="background:var(--gray-100);">
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="form-label" style="font-size:0.82rem;font-weight:700;color:var(--gray-900);margin-bottom:0;">
                🛡️ Granular Permissions & Capabilities
              </label>
              <span style="font-size:0.75rem;color:var(--gray-500);">Customize access to specific actions</span>
            </div>
            ${buildPermissionsMatrixHTML(defaultStaffPerms, 'Staff')}
          </div>

          <div id="nu-error" class="login-alert" style="display:none;margin-bottom:0;font-size:0.82rem;"></div>
        </form>
      `,
      footer: `
        <div style="display:flex;justify-content:flex-end;gap:8px;width:100%;">
          <button class="btn btn-secondary" id="btn-cancel-nu">Cancel</button>
          <button class="btn btn-primary" id="btn-submit-nu" style="font-weight:600;">Create User & Assign Access</button>
        </div>
      `
    });

    bindPermissionsPresets(overlay);

    overlay.querySelector('#nu-role')?.addEventListener('change', (e) => {
      const r = e.target.value;
      const cbs = overlay.querySelectorAll('.perm-cb');
      if (r === 'Admin') {
        cbs.forEach(cb => cb.checked = true);
      } else if (r === 'Staff') {
        const staffPerms = ['register.view', 'register.create', 'register.edit', 'register.bulk', 'checkout.manage', 'stickers.print'];
        cbs.forEach(cb => { cb.checked = staffPerms.includes(cb.value); });
      } else if (r === 'Viewer') {
        cbs.forEach(cb => { cb.checked = (cb.value === 'register.view'); });
      }
    });

    const cancelBtn = overlay.querySelector('#btn-cancel-nu');
    const submitBtn = overlay.querySelector('#btn-submit-nu');
    const errEl     = overlay.querySelector('#nu-error');

    cancelBtn?.addEventListener('click', closeModal);

    submitBtn?.addEventListener('click', async () => {
      const username = overlay.querySelector('#nu-username')?.value.trim();
      const fullName = overlay.querySelector('#nu-fullname')?.value.trim();
      const role     = overlay.querySelector('#nu-role')?.value;
      const status   = overlay.querySelector('#nu-status')?.value;
      const email    = overlay.querySelector('#nu-email')?.value.trim();
      const password = overlay.querySelector('#nu-password')?.value.trim() || 'Test';
      const permissions = getSelectedPermissions(overlay, role);

      if (!username || !fullName) {
        errEl.textContent = 'Username and Full Name are required.';
        errEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating…';
      errEl.style.display = 'none';

      try {
        await api('addUser', {}, {
          action: 'addUser',
          username, fullName, role, status, email, password,
          permissions,
          addedBy: App.user || 'Admin'
        });
        closeModal();
        toast(`User "${username}" created successfully with access rights!`, 'success');
        loadAndRenderUsers(container);
      } catch(err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create User & Assign Access';
        errEl.textContent = err.message || 'Failed to create user.';
        errEl.style.display = 'block';
      }
    });
  }

  function openEditUserModal(u, container) {
    const currentPerms = Array.isArray(u.permissions) ? u.permissions : [];
    const overlay = openModal({
      title: `✏️ Edit User & Access Control — ${u.username}`,
      size: 'modal-lg',
      body: `
        <form id="form-edit-user" novalidate style="display:flex;flex-direction:column;gap:14px;padding:4px 0;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Username</label>
              <input type="text" class="form-control" id="eu-username" value="${escH(u.username)}" disabled style="background:var(--gray-100);font-family:monospace;font-weight:700;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Full Name <span class="required" style="color:var(--danger)">*</span></label>
              <input type="text" class="form-control" id="eu-fullname" value="${escH(u.fullName || '')}" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Role Profile</label>
              <select class="form-control" id="eu-role">
                <option value="Staff" ${u.role === 'Staff' ? 'selected' : ''}>Staff (Standard Operator)</option>
                <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin (Full Access)</option>
                <option value="Viewer" ${u.role === 'Viewer' ? 'selected' : ''}>Viewer (Read-Only)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Account Status</label>
              <select class="form-control" id="eu-status">
                <option value="Active" ${u.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Inactive" ${u.status === 'Inactive' ? 'selected' : ''}>Inactive (Deactivated)</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Email Address</label>
              <input type="email" class="form-control" id="eu-email" value="${escH(u.email || '')}" placeholder="user@gretexgroup.com">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.8rem">Reset Password <span style="color:var(--gray-500);font-weight:normal;">(optional)</span></label>
              <input type="text" class="form-control" id="eu-password" placeholder="Leave empty to keep current password">
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="form-label" style="font-size:0.82rem;font-weight:700;color:var(--gray-900);margin-bottom:0;">
                🛡️ Granular Permissions & Capabilities
              </label>
              <span style="font-size:0.75rem;color:var(--gray-500);">Control exactly what this user can do</span>
            </div>
            ${buildPermissionsMatrixHTML(currentPerms, u.role)}
          </div>

          <div id="eu-error" class="login-alert" style="display:none;margin-bottom:0;font-size:0.82rem;"></div>
        </form>
      `,
      footer: `
        <div style="display:flex;justify-content:flex-end;gap:8px;width:100%;">
          <button class="btn btn-secondary" id="btn-cancel-eu">Cancel</button>
          <button class="btn btn-primary" id="btn-submit-eu" style="font-weight:600;">Save User & Access</button>
        </div>
      `
    });

    bindPermissionsPresets(overlay);

    overlay.querySelector('#eu-role')?.addEventListener('change', (e) => {
      const r = e.target.value;
      const cbs = overlay.querySelectorAll('.perm-cb');
      if (r === 'Admin') {
        cbs.forEach(cb => cb.checked = true);
      } else if (r === 'Staff') {
        const staffPerms = ['register.view', 'register.create', 'register.edit', 'register.bulk', 'checkout.manage', 'stickers.print'];
        cbs.forEach(cb => { cb.checked = staffPerms.includes(cb.value); });
      } else if (r === 'Viewer') {
        cbs.forEach(cb => { cb.checked = (cb.value === 'register.view'); });
      }
    });

    const cancelBtn = overlay.querySelector('#btn-cancel-eu');
    const submitBtn = overlay.querySelector('#btn-submit-eu');
    const errEl     = overlay.querySelector('#eu-error');

    cancelBtn?.addEventListener('click', closeModal);

    submitBtn?.addEventListener('click', async () => {
      const fullName = overlay.querySelector('#eu-fullname')?.value.trim();
      const role     = overlay.querySelector('#eu-role')?.value;
      const status   = overlay.querySelector('#eu-status')?.value;
      const email    = overlay.querySelector('#eu-email')?.value.trim();
      const password = overlay.querySelector('#eu-password')?.value.trim();
      const permissions = getSelectedPermissions(overlay, role);

      if (!fullName) {
        errEl.textContent = 'Full Name is required.';
        errEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      errEl.style.display = 'none';

      try {
        await api('updateUser', {}, {
          action: 'updateUser',
          username: u.username,
          fullName,
          role,
          status,
          email,
          password: password || undefined,
          permissions,
          updatedBy: App.user || 'Admin'
        });

        // If current logged-in user edited their own profile, sync session
        if (App.currentUser && App.currentUser.username === u.username) {
          App.currentUser.fullName = fullName;
          App.currentUser.role = role;
          App.currentUser.permissions = permissions;
          localStorage.setItem('fr_user_session', JSON.stringify(App.currentUser));
          updateUserUI();
        }

        closeModal();
        toast(`User "${u.username}" access rights updated successfully!`, 'success');
        loadAndRenderUsers(container);
      } catch(err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save User & Access';
        errEl.textContent = err.message || 'Failed to update user.';
        errEl.style.display = 'block';
      }
    });
  }

  // ── EVENT BINDINGS ───────────────────────────────────────────
  function bindEvents(container) {
    if (activeTab === 'users') {
      loadAndRenderUsers(container);
    }

    // 1. Top tabs switching
    container.querySelectorAll('.tabs .tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        searchQuery = '';
        clientPage = 1;
        location.hash = `#settings/${activeTab}`;
      });
    });

    // 2. List sub-tabs switching
    container.querySelectorAll('[data-list-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeList = btn.dataset.listTab;
        searchQuery = '';
        refreshTabContent(container);
      });
    });

    // 3. Search input live filter
    const searchInput = container.querySelector('#master-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        clientPage = 1;
        refreshTabContent(container);
      });
    }
    container.querySelector('#btn-clear-search')?.addEventListener('click', () => {
      searchQuery = '';
      refreshTabContent(container);
    });

    // 4. Client pagination controls
    container.querySelectorAll('[data-page-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.pageAction;
        if (action === 'prev') clientPage--;
        else if (action === 'next') clientPage++;
        refreshTabContent(container);
      });
    });

    // 5. Header Action: "＋ Add New"
    container.querySelector('#btn-add-master-entry')?.addEventListener('click', () => {
      openAddModal(activeTab, activeList, container);
    });

    // 6. Header Action: "📥 Import Data"
    container.querySelector('#btn-import-master')?.addEventListener('click', () => {
      openImportModal(activeTab, activeList, container);
    });

    // 7. Quick list import button
    container.querySelector('#btn-import-list-items')?.addEventListener('click', e => {
      const list = e.currentTarget.dataset.list || activeList;
      openImportModal('lists', list, container);
    });

    // 8. Quick add list item form
    const quickAddBtn = container.querySelector('#btn-quick-add-list');
    const quickAddInput = container.querySelector('#quick-add-list-input');
    if (quickAddBtn && quickAddInput) {
      const doQuickAdd = () => {
        const val = quickAddInput.value.trim();
        const listName = quickAddBtn.dataset.list;
        if (!val) return;
        quickAddBtn.disabled = true;
        api('addListItem', {}, { action: 'addListItem', listName, value: val })
          .then(() => {
            toast(`"${val}" added to ${listName}`, 'success');
            loadConfig(true).then(() => refreshTabContent(container));
          })
          .catch(err => {
            toast(err.message, 'error');
            quickAddBtn.disabled = false;
          });
      };
      quickAddBtn.addEventListener('click', doQuickAdd);
      quickAddInput.addEventListener('keydown', e => { if (e.key === 'Enter') doQuickAdd(); });
    }

    // 9. Client Row Actions (Edit / Delete)
    container.querySelectorAll('[data-action="edit-client"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        openEditClientModal(row.dataset.name, row.dataset.code, container);
      });
    });
    container.querySelectorAll('[data-action="del-client"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        confirmDeleteMaster('Clients', row.dataset.name, container);
      });
    });

    // 10. Category Row Actions (Edit / Delete)
    container.querySelectorAll('[data-action="edit-category"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        openEditCategoryModal({
          name: row.dataset.name,
          code: row.dataset.code,
          fileType: row.dataset.type,
          colour: row.dataset.colour
        }, container);
      });
    });
    container.querySelectorAll('[data-action="del-category"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        confirmDeleteMaster('Categories', row.dataset.name, container);
      });
    });

    // 11. Subcategory Row Actions (Edit / Delete)
    container.querySelectorAll('[data-action="edit-subcategory"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        openEditSubcategoryModal(row.dataset.name, row.dataset.code, container);
      });
    });
    container.querySelectorAll('[data-action="del-subcategory"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        confirmDeleteMaster('Subcategories', row.dataset.name, container);
      });
    });

    // 12. List Item Row Actions (Edit / Delete)
    container.querySelectorAll('[data-action="edit-list-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        openEditListItemModal(row.dataset.list, row.dataset.val, container);
      });
    });
    container.querySelectorAll('[data-action="del-list-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        confirmDeleteListItem(row.dataset.list, row.dataset.val, container);
      });
    });
  }

  function refreshTabContent(container) {
    const tc = container.querySelector('#master-tab-content');
    if (tc) {
      tc.innerHTML = renderTabContent(activeTab);
      bindEvents(container);
    }
  }

  // ── MODALS: ADD ──────────────────────────────────────────────
  function openAddModal(tab, currentList, container) {
    if (tab === 'clients') {
      openAddClientModal(container);
    } else if (tab === 'categories') {
      openAddCategoryModal(container);
    } else if (tab === 'subcategories') {
      openAddSubcategoryModal(container);
    } else if (tab === 'lists') {
      openAddListItemModal(currentList, container);
    }
  }

  function openAddClientModal(container) {
    const overlay = openModal({
      title: '➕ Add New Client',
      body: `
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Client Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="add-client-name" placeholder="e.g. RELIANCE INDUSTRIES LTD" autofocus>
          <div class="invalid-feedback" id="err-client-name" style="display:none">Client name is required</div>
        </div>
        <div class="form-group">
          <label class="form-label">Client Code <span style="font-weight:400;color:var(--gray-500)">(Optional, 4-digit numeric e.g. 5008)</span></label>
          <input type="text" class="form-control" id="add-client-code" placeholder="Leave empty to auto-generate">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-add-client">Save Client</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-add-client').addEventListener('click', () => {
      const name = overlay.querySelector('#add-client-name').value.trim();
      const code = overlay.querySelector('#add-client-code').value.trim();
      if (!name) {
        overlay.querySelector('#err-client-name').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-add-client');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      api('addMaster', {}, { action: 'addMaster', type: 'Clients', name, code })
        .then(res => {
          closeModal();
          toast(`Client "${name}" added (Code: ${res.code})`, 'success');
          loadConfig(true).then(() => render(container, null, 'clients'));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save Client';
        });
    });
  }

  function openAddCategoryModal(container) {
    const cfg = App.config || {};
    const fileTypes = cfg.lists?.['File Types'] || ['Flat File', 'Box File', 'Cover File'];
    const colours = cfg.lists?.['Colours'] || ['Pink', 'Blue', 'Yellow', 'Green', 'Light Green', 'Light Blue', 'Dark Brown', 'Multi'];

    const overlay = openModal({
      title: '➕ Add New Category',
      body: `
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Category Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="add-cat-name" placeholder="e.g. STATUTORY AUDIT" autofocus>
          <div class="invalid-feedback" id="err-cat-name" style="display:none">Category name is required</div>
        </div>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Category Code <span style="font-weight:400;color:var(--gray-500)">(Optional, 2–5 letters e.g. SAUD)</span></label>
          <input type="text" class="form-control" id="add-cat-code" placeholder="Leave empty to auto-generate">
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Default File Type</label>
            <select class="form-control" id="add-cat-filetype">
              <option value="">-- None / Select --</option>
              ${fileTypes.map(ft => `<option value="${escH(ft)}">${escH(ft)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Default File Colour</label>
            <select class="form-control" id="add-cat-colour">
              <option value="">-- None / Select --</option>
              ${colours.map(c => `<option value="${escH(c)}">${escH(c)}</option>`).join('')}
            </select>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-add-cat">Save Category</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-add-cat').addEventListener('click', () => {
      const name = overlay.querySelector('#add-cat-name').value.trim();
      const code = overlay.querySelector('#add-cat-code').value.trim();
      const fileType = overlay.querySelector('#add-cat-filetype').value.trim();
      const colour = overlay.querySelector('#add-cat-colour').value.trim();
      if (!name) {
        overlay.querySelector('#err-cat-name').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-add-cat');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      api('addMaster', {}, { action: 'addMaster', type: 'Categories', name, code, fileType, colour })
        .then(res => {
          closeModal();
          toast(`Category "${name}" added (Code: ${res.code})`, 'success');
          loadConfig(true).then(() => render(container, null, 'categories'));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save Category';
        });
    });
  }

  function openAddSubcategoryModal(container) {
    const overlay = openModal({
      title: '➕ Add New Sub-Category',
      body: `
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Sub-Category Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="add-sub-name" placeholder="e.g. VALUATION REPORT" autofocus>
          <div class="invalid-feedback" id="err-sub-name" style="display:none">Sub-category name is required</div>
        </div>
        <div class="form-group">
          <label class="form-label">Sub-Category Code <span style="font-weight:400;color:var(--gray-500)">(Optional, 2–5 letters e.g. VAL)</span></label>
          <input type="text" class="form-control" id="add-sub-code" placeholder="Leave empty to auto-generate">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-add-sub">Save Sub-Category</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-add-sub').addEventListener('click', () => {
      const name = overlay.querySelector('#add-sub-name').value.trim();
      const code = overlay.querySelector('#add-sub-code').value.trim();
      if (!name) {
        overlay.querySelector('#err-sub-name').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-add-sub');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      api('addMaster', {}, { action: 'addMaster', type: 'Subcategories', name, code })
        .then(res => {
          closeModal();
          toast(`Sub-category "${name}" added (Code: ${res.code})`, 'success');
          loadConfig(true).then(() => render(container, null, 'subcategories'));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save Sub-Category';
        });
    });
  }

  function openAddListItemModal(listName, container) {
    const overlay = openModal({
      title: `➕ Add Item to ${listName}`,
      body: `
        <div class="form-group">
          <label class="form-label">Item Value <span class="required">*</span></label>
          <input type="text" class="form-control" id="add-list-val" placeholder="e.g. Bangalore" autofocus>
          <div class="invalid-feedback" id="err-list-val" style="display:none">Value is required</div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-add-list">Add Item</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-add-list').addEventListener('click', () => {
      const value = overlay.querySelector('#add-list-val').value.trim();
      if (!value) {
        overlay.querySelector('#err-list-val').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-add-list');
      btn.disabled = true;
      api('addListItem', {}, { action: 'addListItem', listName, value })
        .then(() => {
          closeModal();
          toast(`"${value}" added to ${listName}`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
        });
    });
  }

  // ── MODALS: EDIT ─────────────────────────────────────────────
  function openEditClientModal(oldName, oldCode, container) {
    const overlay = openModal({
      title: '✏️ Edit Client',
      body: `
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Client Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="edit-client-name" value="${escH(oldName)}">
          <div class="invalid-feedback" id="err-edit-client-name" style="display:none">Client name is required</div>
        </div>
        <div class="form-group">
          <label class="form-label">Client Code</label>
          <input type="text" class="form-control" id="edit-client-code" value="${escH(oldCode)}">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-edit-client">Update Client</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-edit-client').addEventListener('click', () => {
      const name = overlay.querySelector('#edit-client-name').value.trim();
      const code = overlay.querySelector('#edit-client-code').value.trim();
      if (!name) {
        overlay.querySelector('#err-edit-client-name').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-edit-client');
      btn.disabled = true;
      btn.textContent = 'Updating…';
      api('updateMaster', {}, { action: 'updateMaster', type: 'Clients', oldName, name, code })
        .then(() => {
          closeModal();
          toast(`Client "${name}" updated`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Update Client';
        });
    });
  }

  function openEditCategoryModal(cat, container) {
    const cfg = App.config || {};
    const fileTypes = cfg.lists?.['File Types'] || ['Flat File', 'Box File', 'Cover File'];
    const colours = cfg.lists?.['Colours'] || ['Pink', 'Blue', 'Yellow', 'Green', 'Light Green', 'Light Blue', 'Dark Brown', 'Multi'];

    const overlay = openModal({
      title: '✏️ Edit Category',
      body: `
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Category Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="edit-cat-name" value="${escH(cat.name)}">
          <div class="invalid-feedback" id="err-edit-cat-name" style="display:none">Category name is required</div>
        </div>
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Category Code</label>
          <input type="text" class="form-control" id="edit-cat-code" value="${escH(cat.code)}">
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Default File Type</label>
            <select class="form-control" id="edit-cat-filetype">
              <option value="">-- None / Select --</option>
              ${fileTypes.map(ft => `<option value="${escH(ft)}" ${ft === cat.fileType ? 'selected' : ''}>${escH(ft)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Default File Colour</label>
            <select class="form-control" id="edit-cat-colour">
              <option value="">-- None / Select --</option>
              ${colours.map(c => `<option value="${escH(c)}" ${c === cat.colour ? 'selected' : ''}>${escH(c)}</option>`).join('')}
            </select>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-edit-cat">Update Category</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-edit-cat').addEventListener('click', () => {
      const name = overlay.querySelector('#edit-cat-name').value.trim();
      const code = overlay.querySelector('#edit-cat-code').value.trim();
      const fileType = overlay.querySelector('#edit-cat-filetype').value.trim();
      const colour = overlay.querySelector('#edit-cat-colour').value.trim();
      if (!name) {
        overlay.querySelector('#err-edit-cat-name').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-edit-cat');
      btn.disabled = true;
      btn.textContent = 'Updating…';
      api('updateMaster', {}, { action: 'updateMaster', type: 'Categories', oldName: cat.name, name, code, fileType, colour })
        .then(() => {
          closeModal();
          toast(`Category "${name}" updated`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Update Category';
        });
    });
  }

  function openEditSubcategoryModal(oldName, oldCode, container) {
    const overlay = openModal({
      title: '✏️ Edit Sub-Category',
      body: `
        <div class="form-group" style="margin-bottom:14px">
          <label class="form-label">Sub-Category Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="edit-sub-name" value="${escH(oldName)}">
          <div class="invalid-feedback" id="err-edit-sub-name" style="display:none">Sub-category name is required</div>
        </div>
        <div class="form-group">
          <label class="form-label">Sub-Category Code</label>
          <input type="text" class="form-control" id="edit-sub-code" value="${escH(oldCode)}">
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-edit-sub">Update Sub-Category</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-edit-sub').addEventListener('click', () => {
      const name = overlay.querySelector('#edit-sub-name').value.trim();
      const code = overlay.querySelector('#edit-sub-code').value.trim();
      if (!name) {
        overlay.querySelector('#err-edit-sub-name').style.display = 'block';
        return;
      }
      const btn = overlay.querySelector('#modal-submit-edit-sub');
      btn.disabled = true;
      btn.textContent = 'Updating…';
      api('updateMaster', {}, { action: 'updateMaster', type: 'Subcategories', oldName, name, code })
        .then(() => {
          closeModal();
          toast(`Sub-category "${name}" updated`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Update Sub-Category';
        });
    });
  }

  function openEditListItemModal(listName, oldValue, container) {
    const overlay = openModal({
      title: `✏️ Edit Item in ${listName}`,
      body: `
        <div class="form-group">
          <label class="form-label">Value <span class="required">*</span></label>
          <input type="text" class="form-control" id="edit-list-val" value="${escH(oldValue)}" autofocus>
          <div class="invalid-feedback" id="err-edit-list-val" style="display:none">Value is required</div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-edit-list">Save Changes</button>`
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#modal-submit-edit-list').addEventListener('click', () => {
      const newValue = overlay.querySelector('#edit-list-val').value.trim();
      if (!newValue) {
        overlay.querySelector('#err-edit-list-val').style.display = 'block';
        return;
      }
      if (newValue === oldValue) {
        closeModal();
        return;
      }
      const btn = overlay.querySelector('#modal-submit-edit-list');
      btn.disabled = true;
      api('updateListItem', {}, { action: 'updateListItem', listName, oldValue, newValue })
        .then(() => {
          closeModal();
          toast(`Updated to "${newValue}"`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => {
          toast(err.message, 'error');
          btn.disabled = false;
        });
    });
  }

  // ── CONFIRM DELETE ───────────────────────────────────────────
  function confirmDeleteMaster(type, name, container) {
    confirmDialog(`Are you sure you want to delete <strong>${escH(name)}</strong> from ${type}?<br><br><span style="font-size:0.85rem;color:var(--gray-600)">Note: Existing file records referencing this will not be broken.</span>`, () => {
      api('deleteMaster', {}, { action: 'deleteMaster', type, name })
        .then(() => {
          toast(`Deleted "${name}"`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => toast(err.message, 'error'));
    }, 'Delete');
  }

  function confirmDeleteListItem(listName, value, container) {
    confirmDialog(`Are you sure you want to remove <strong>${escH(value)}</strong> from ${listName}?`, () => {
      api('deleteListItem', {}, { action: 'deleteListItem', listName, value })
        .then(() => {
          toast(`Removed "${value}" from ${listName}`, 'success');
          loadConfig(true).then(() => refreshTabContent(container));
        })
        .catch(err => toast(err.message, 'error'));
    }, 'Remove');
  }

  // ── BULK IMPORT MODAL ────────────────────────────────────────
  function openImportModal(tab, currentList, container) {
    const isList = tab === 'lists';
    const targetName = isList ? currentList : (tab === 'clients' ? 'Clients' : (tab === 'categories' ? 'Categories' : 'Subcategories'));

    let formatHint = '';
    let placeholder = '';
    if (tab === 'clients') {
      formatHint = 'Paste lines formatted as <code>Client Name, Code</code> OR just <code>Client Name</code> per line.';
      placeholder = 'RELIANCE INDUSTRIES LTD, 5008\nTATA CONSULTANCY SERVICES, 5009\nINFOSYS LTD';
    } else if (tab === 'categories') {
      formatHint = 'Paste lines formatted as <code>Category Name, Code, File Type, File Colour</code> OR <code>Category Name, Code</code>.';
      placeholder = 'TAXATION, TAX, Flat File, Pink\nAUDIT, AUD, Box File, Blue';
    } else if (tab === 'subcategories') {
      formatHint = 'Paste lines formatted as <code>Subcategory Name, Code</code> OR just <code>Subcategory Name</code> per line.';
      placeholder = 'ANNUAL RETURN, AR\nBOARD RESOLUTION, BR';
    } else {
      formatHint = `Paste one <code>${targetName}</code> item per line, or comma-separated values.`;
      placeholder = 'Mumbai\nKolkata\nDelhi\nBangalore';
    }

    const overlay = openModal({
      title: `📥 Import ${targetName}`,
      size: 'modal-lg',
      body: `
        <div style="margin-bottom:14px">
          <p style="font-size:0.875rem;color:var(--gray-700);margin-bottom:6px">${formatHint}</p>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
            <label class="btn btn-secondary btn-sm" style="cursor:pointer">
              📁 Choose CSV File
              <input type="file" id="import-file-input" accept=".csv,.txt" style="display:none">
            </label>
            <span id="import-file-name" style="font-size:0.82rem;color:var(--gray-500)">No file chosen</span>
          </div>
          <textarea class="form-control" id="import-raw-text" rows="6" placeholder="${placeholder}" style="font-family:monospace;font-size:0.85rem;line-height:1.4"></textarea>
        </div>

        <div id="import-preview-box" style="display:none">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <strong style="font-size:0.85rem;color:var(--gray-800)">Preview (<span id="import-parsed-count">0</span> rows detected)</strong>
            <span style="font-size:0.75rem;color:var(--gray-500)">Duplicates against existing records will be skipped</span>
          </div>
          <div class="table-wrap" style="max-height:180px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius)">
            <table style="font-size:0.82rem">
              <thead id="import-preview-thead"></thead>
              <tbody id="import-preview-tbody"></tbody>
            </table>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-import" disabled>Import Data</button>`
    });

    const fileInput = overlay.querySelector('#import-file-input');
    const fileNameSpan = overlay.querySelector('#import-file-name');
    const textarea = overlay.querySelector('#import-raw-text');
    const previewBox = overlay.querySelector('#import-preview-box');
    const parsedCountSpan = overlay.querySelector('#import-parsed-count');
    const thead = overlay.querySelector('#import-preview-thead');
    const tbody = overlay.querySelector('#import-preview-tbody');
    const importBtn = overlay.querySelector('#modal-submit-import');

    let parsedRows = [];

    const updatePreview = () => {
      const text = textarea.value.trim();
      parsedRows = parseImportText(text, tab);
      if (!parsedRows.length) {
        previewBox.style.display = 'none';
        importBtn.disabled = true;
        importBtn.textContent = 'Import Data';
        return;
      }

      previewBox.style.display = 'block';
      parsedCountSpan.textContent = parsedRows.length;
      importBtn.disabled = false;
      importBtn.textContent = `Import ${parsedRows.length} Items`;

      // Build table headers and preview rows (up to first 10)
      if (isList) {
        thead.innerHTML = `<tr><th style="width:40px">#</th><th>Item Value</th></tr>`;
        tbody.innerHTML = parsedRows.slice(0, 10).map((r, i) => `<tr><td>${i+1}</td><td>${escH(r)}</td></tr>`).join('');
      } else if (tab === 'categories') {
        thead.innerHTML = `<tr><th style="width:40px">#</th><th>Name</th><th>Code</th><th>File Type</th><th>Colour</th></tr>`;
        tbody.innerHTML = parsedRows.slice(0, 10).map((r, i) => `
          <tr>
            <td>${i+1}</td>
            <td><strong>${escH(r.name)}</strong></td>
            <td><code>${escH(r.code || '(auto)')}</code></td>
            <td>${escH(r.fileType || '—')}</td>
            <td>${escH(r.colour || '—')}</td>
          </tr>`).join('');
      } else {
        thead.innerHTML = `<tr><th style="width:40px">#</th><th>Name</th><th>Code</th></tr>`;
        tbody.innerHTML = parsedRows.slice(0, 10).map((r, i) => `
          <tr>
            <td>${i+1}</td>
            <td><strong>${escH(r.name)}</strong></td>
            <td><code>${escH(r.code || '(auto)')}</code></td>
          </tr>`).join('');
      }
    };

    textarea.addEventListener('input', updatePreview);

    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      fileNameSpan.textContent = file.name;
      const reader = new FileReader();
      reader.onload = evt => {
        textarea.value = evt.target.result;
        updatePreview();
      };
      reader.readAsText(file);
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', closeModal);

    importBtn.addEventListener('click', () => {
      if (!parsedRows.length) return;
      importBtn.disabled = true;
      importBtn.textContent = 'Importing to Google Sheet…';

      api('bulkImportMaster', {}, {
        action: 'bulkImportMaster',
        target: targetName,
        isList: isList,
        rows: parsedRows
      }).then(res => {
        closeModal();
        toast(`Successfully imported ${res.imported} item(s)! ${res.skipped ? `(${res.skipped} duplicates skipped)` : ''}`, 'success', 4500);
        loadConfig(true).then(() => render(container, null, tab));
      }).catch(err => {
        toast('Import failed: ' + err.message, 'error');
        importBtn.disabled = false;
        importBtn.textContent = `Import ${parsedRows.length} Items`;
      });
    });
  }

  function parseImportText(text, tab) {
    if (!text) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const isList = tab === 'lists';

    if (isList) {
      // Split by newline or comma
      const items = [];
      lines.forEach(line => {
        line.split(',').map(s => s.trim()).filter(Boolean).forEach(v => {
          if (!items.includes(v)) items.push(v);
        });
      });
      return items;
    }

    const rows = [];
    lines.forEach((line, index) => {
      // Skip header row if matches "name,code"
      if (index === 0 && line.toLowerCase().startsWith('name')) return;

      // Handle tab-separated (from Excel) or comma-separated
      let parts = line.includes('\t') ? line.split('\t') : line.split(',');
      parts = parts.map(p => p.trim());

      const name = parts[0] || '';
      if (!name) return;

      if (tab === 'categories') {
        rows.push({
          name: name,
          code: parts[1] || '',
          fileType: parts[2] || '',
          colour: parts[3] || ''
        });
      } else {
        rows.push({
          name: name,
          code: parts[1] || ''
        });
      }
    });

    return rows;
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function escH(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { render };
})();
