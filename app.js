// ============================================================
// PHYSICAL FILE REGISTER — Core App
// Gretex Group | v1.0
// ============================================================

// ── CONFIGURATION ────────────────────────────────────────────
// IMPORTANT: After deploying Code.gs as a Web App, paste the
// URL here and reload the page.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXS-f5GRNtgwe73OCwVI-Db8_O2YonL4J7_dRFqNSorSdsngNVsodIg8S_oklB7ti2sw/exec';

// ── STATE ─────────────────────────────────────────────────────
const App = {
  user: null,
  config: null,         // { clients, categories, subcategories, lists }
  currentPage: null,
  _configLoading: null, // promise
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  initRouter();
  initSidebar();
  loadConfig();
  initUpdatesUI();
});

// ── USER AUTH & SESSION (localStorage) ─────────────────────────
function initUser() {
  const sessionStr = localStorage.getItem('fr_user_session');
  let session = null;
  if (sessionStr) {
    try { session = JSON.parse(sessionStr); } catch(e) {}
  }

  if (!session || !session.username) {
    showLoginScreen();
  } else {
    App.currentUser = session;
    App.user = session.fullName || session.username;
    updateUserUI();
    // Show smart card on page load / refresh
    setTimeout(showStartupUpdatesCard, 600);
  }
}

function showLoginScreen() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const form      = document.getElementById('login-form');
  const uInput    = document.getElementById('login-username');
  const pInput    = document.getElementById('login-password');
  const btnSubmit = document.getElementById('login-submit-btn');
  const alertEl   = document.getElementById('login-error-alert');
  const eyeBtn    = document.getElementById('btn-toggle-pwd');
  const txtSpan   = btnSubmit?.querySelector('.btn-login-text');
  const spinSpan  = btnSubmit?.querySelector('.btn-login-spinner');

  if (alertEl) { alertEl.style.display = 'none'; alertEl.textContent = ''; }
  if (uInput) {
    setTimeout(() => uInput.focus(), 100);
  }

  // Eye toggle
  if (eyeBtn && pInput) {
    eyeBtn.onclick = (e) => {
      e.preventDefault();
      const isPwd = pInput.type === 'password';
      pInput.type = isPwd ? 'text' : 'password';
      eyeBtn.textContent = isPwd ? '🙈' : '👁️';
    };
  }

  // Submit
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const username = (uInput?.value || '').trim();
      const password = (pInput?.value || '').trim();

      if (!username) {
        showLoginError('Please enter your username or email.');
        uInput?.focus();
        return;
      }
      if (!password) {
        showLoginError('Please enter your password (Default: Test).');
        pInput?.focus();
        return;
      }

      // Set loading state
      if (btnSubmit) btnSubmit.disabled = true;
      if (txtSpan) txtSpan.textContent = 'Signing in…';
      if (spinSpan) spinSpan.style.display = 'inline-block';
      if (alertEl) alertEl.style.display = 'none';

      try {
        let result;
        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
          // Demo fallback
          result = {
            userId: 'USR-DEMO',
            username: username,
            fullName: username.charAt(0).toUpperCase() + username.slice(1).replace('.', ' '),
            role: username.toLowerCase() === 'admin' ? 'Admin' : 'Staff',
            status: 'Active',
            email: `${username}@gretexgroup.com`
          };
        } else {
          result = await api('login', { username, password }, { username, password });
        }

        // Success
        App.currentUser = result;
        App.user = result.fullName || result.username;
        localStorage.setItem('fr_user_session', JSON.stringify(result));
        localStorage.setItem('fr_user_name', App.user);

        modal.style.display = 'none';
        if (btnSubmit) btnSubmit.disabled = false;
        if (txtSpan) txtSpan.textContent = 'Sign In →';
        if (spinSpan) spinSpan.style.display = 'none';

        updateUserUI();
        loadConfig();
        navigate(location.hash || '#dashboard');
        toast(`Welcome back, ${App.user}! 👋`, 'success');
        setTimeout(showStartupUpdatesCard, 500);

      } catch (err) {
        if (btnSubmit) btnSubmit.disabled = false;
        if (txtSpan) txtSpan.textContent = 'Sign In →';
        if (spinSpan) spinSpan.style.display = 'none';
        showLoginError(err.message || 'Login failed. Please verify credentials.');
      }
    };
  }

  function showLoginError(msg) {
    if (alertEl) {
      alertEl.textContent = msg;
      alertEl.style.display = 'block';
    } else {
      toast(msg, 'error');
    }
  }
}

function logout() {
  openConfirmModal(
    'Sign Out',
    'Are you sure you want to sign out from File Register?',
    () => {
      localStorage.removeItem('fr_user_session');
      localStorage.removeItem('fr_user_name');
      App.user = null;
      App.currentUser = null;
      toast('Signed out successfully.', 'info');
      showLoginScreen();
    },
    'Sign Out'
  );
}

function openChangePasswordModal() {
  const u = App.currentUser || { username: 'admin', fullName: App.user || 'User' };

  const overlay = openModal({
    title: '🔑 Change Password',
    body: `
      <form id="form-change-pwd" novalidate style="display:flex;flex-direction:column;gap:14px;padding:4px 0;">
        <div class="form-group">
          <label class="form-label" style="font-size:0.8rem">Username</label>
          <input type="text" class="form-control" value="${u.username} (${u.fullName})" disabled style="background:var(--gray-100);font-weight:600;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.8rem">Current Password <span class="required" style="color:var(--danger)">*</span></label>
          <input type="password" class="form-control" id="cp-old" placeholder="Enter current password (default: Test)" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.8rem">New Password <span class="required" style="color:var(--danger)">*</span></label>
          <input type="password" class="form-control" id="cp-new" placeholder="Enter new password (min 4 characters)" required minlength="4">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.8rem">Confirm New Password <span class="required" style="color:var(--danger)">*</span></label>
          <input type="password" class="form-control" id="cp-confirm" placeholder="Re-enter new password" required>
        </div>
        <div id="cp-error" class="login-alert" style="display:none;margin-bottom:0;font-size:0.82rem;"></div>
      </form>
    `,
    footer: `
      <div style="display:flex;justify-content:flex-end;gap:8px;width:100%;">
        <button class="btn btn-secondary" id="btn-cancel-cp">Cancel</button>
        <button class="btn btn-primary" id="btn-submit-cp">Update Password</button>
      </div>
    `
  });

  const errEl = overlay.querySelector('#cp-error');
  const submitBtn = overlay.querySelector('#btn-submit-cp');
  const cancelBtn = overlay.querySelector('#btn-cancel-cp');

  cancelBtn?.addEventListener('click', closeModal);

  submitBtn?.addEventListener('click', async () => {
    const oldPass = overlay.querySelector('#cp-old')?.value.trim();
    const newPass = overlay.querySelector('#cp-new')?.value.trim();
    const confirm = overlay.querySelector('#cp-confirm')?.value.trim();

    if (!oldPass || !newPass || !confirm) {
      errEl.textContent = 'All fields are required.';
      errEl.style.display = 'block';
      return;
    }
    if (newPass !== confirm) {
      errEl.textContent = 'New passwords do not match.';
      errEl.style.display = 'block';
      return;
    }
    if (newPass.length < 4) {
      errEl.textContent = 'Password must be at least 4 characters.';
      errEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating…';
    errEl.style.display = 'none';

    try {
      await api('changePassword', {
        username: u.username,
        oldPassword: oldPass,
        newPassword: newPass
      });
      closeModal();
      toast('Password changed successfully!', 'success');
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update Password';
      errEl.textContent = err.message || 'Failed to update password.';
      errEl.style.display = 'block';
    }
  });
}

function updateUserUI() {
  const u = App.currentUser || {};
  const name = App.user || u.fullName || u.username || 'User';
  const role = u.role || 'Staff';

  const nameEl = document.getElementById('user-name-display');
  const avatarEl = document.getElementById('user-avatar');
  const roleEl = document.getElementById('user-role-badge');
  const changePwdBtn = document.getElementById('btn-change-pwd');
  const logoutBtn = document.getElementById('btn-logout');

  if (nameEl) nameEl.textContent = name;
  if (avatarEl) avatarEl.textContent = (name[0] || 'U').toUpperCase();
  if (roleEl) {
    roleEl.textContent = role;
    roleEl.style.background = role === 'Admin' ? '#fef7e0' : 'var(--primary-light)';
    roleEl.style.color = role === 'Admin' ? '#b06000' : 'var(--primary)';
  }

  // Bind change password and logout
  const newChangeBtn = changePwdBtn?.cloneNode(true);
  if (changePwdBtn && newChangeBtn) {
    changePwdBtn.parentNode.replaceChild(newChangeBtn, changePwdBtn);
    newChangeBtn.addEventListener('click', openChangePasswordModal);
  }

  const newLogoutBtn = logoutBtn?.cloneNode(true);
  if (logoutBtn && newLogoutBtn) {
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    newLogoutBtn.addEventListener('click', logout);
  }
}

// ── ROUTER ────────────────────────────────────────────────────
function initRouter() {
  window.addEventListener('hashchange', () => navigate(location.hash));
  navigate(location.hash || '#dashboard');
}

function navigate(hash) {
  if (!App.user) {
    showLoginScreen();
    return;
  }
  const page = (hash || '#dashboard').replace('#', '') || 'dashboard';
  App.currentPage = page;
  setActiveNav(page);

  const titles = {
    dashboard: 'Dashboard',
    register:  'File Register',
    add:       'Add New File',
    stickers:  'Print Stickers',
    import:    'Bulk Import',
    settings:  'Settings — Master Data',
    'settings/clients':       'Settings — Clients',
    'settings/categories':    'Settings — Categories',
    'settings/subcategories': 'Settings — Sub-Categories',
    'settings/lists':         'Settings — Drop-down Lists',
    'settings/users':         'Settings — Users & Access',
  };

  const topbarTitle = document.getElementById('topbar-title');
  topbarTitle.textContent = titles[page] || page;

  const topbarActions = document.getElementById('topbar-actions');
  topbarActions.innerHTML = '';

  const content = document.getElementById('content');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Loading…</span></div>';

  switch (page) {
    case 'dashboard':     DashboardModule.render(content, topbarActions); break;
    case 'register':      RegisterModule.render(content, topbarActions); break;
    case 'add':           FileFormModule.renderAdd(content, topbarActions); break;
    case 'stickers':      StickerModule.renderPrintPage(content, topbarActions); break;
    case 'import':        ImportModule.render(content, topbarActions); break;
    case 'settings':      MastersModule.render(content, topbarActions, 'clients'); break;
    default:
      if (page.startsWith('settings/')) {
        const subtab = page.replace('settings/', '');
        MastersModule.render(content, topbarActions, subtab);
      } else if (page.startsWith('file/')) {
        const fn = decodeURIComponent(page.replace('file/', ''));
        FileFormModule.renderDetail(content, topbarActions, fn);
      } else if (page.startsWith('edit/')) {
        const fn = decodeURIComponent(page.replace('edit/', ''));
        FileFormModule.renderEdit(content, topbarActions, fn);
      } else {
        content.innerHTML = '<div class="page-loading"><p>Page not found.</p></div>';
      }
  }
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(a => {
    const p = a.dataset.page;
    if (!p) return;
    const isActive = (p === page) || (p === 'settings' && (page === 'settings' || page.startsWith('settings/')));
    a.classList.toggle('active', isActive);
  });
}

// ── SIDEBAR TOGGLE (mobile) ───────────────────────────────────
function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) toggle.style.display = 'flex';
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.getElementById('main').addEventListener('click', e => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  document.getElementById('btn-toggle-settings')?.addEventListener('click', () => {
    const group = document.getElementById('nav-settings-group');
    if (location.hash.startsWith('#settings')) {
      group?.classList.toggle('collapsed');
    }
  });
}

// ── CONFIG LOADER ─────────────────────────────────────────────
function loadConfig(force = false) {
  if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    // Demo mode with empty config
    App.config = { clients: [], categories: [], subcategories: [], lists: { 'Locations': ['Mumbai','Pune','Kolkata'], 'File Types': ['Flat File','Cover File','Box File'], 'Status (fixed)': ['In office','Checked out','Archived','Missing'], 'Business Verticals': [], 'HODs': [], 'Entities': [], 'Colours': [], 'Bin Locations': [] } };
    return Promise.resolve(App.config);
  }
  if (!force && App._configLoading) return App._configLoading;
  App._configLoading = api('getConfig').then(data => {
    App.config = data;
    return data;
  }).catch(err => {
    console.error('Config load failed:', err);
    App.config = App.config || { clients: [], categories: [], subcategories: [], lists: {} };
  });
  return App._configLoading;
}

// ── API LAYER ─────────────────────────────────────────────────
function api(action, params = {}, body = null) {
  if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    return Promise.reject(new Error('Apps Script URL not configured. Please deploy Code.gs and update APPS_SCRIPT_URL in app.js'));
  }

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });

  const opts = body !== null
    ? { method: 'POST', body: JSON.stringify({ action, ...body }) }
    : { method: 'GET' };

  return fetch(url.toString(), opts)
    .then(r => r.json())
    .then(resp => {
      if (!resp.ok) throw new Error(resp.error || 'Server error');
      return resp.data;
    });
}

// ── TOAST NOTIFICATIONS ───────────────────────────────────────
function toast(message, type = 'default', duration = 3500) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', default: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.default}</span><span>${message}</span>`;
  const container = document.getElementById('toast-container');
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function openModal({ title, body, footer, size = '' }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size}" id="active-modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="modal-body" id="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  setTimeout(() => document.querySelector('#active-modal')?.querySelector('input,select,textarea')?.focus(), 50);
  return overlay;
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

function openConfirmModal(title, message, onConfirm, okLabel = 'Confirm', isDanger = true) {
  const overlay = openModal({
    title: title || 'Confirm Action',
    body: `<div class="confirm-icon">${isDanger ? '⚠️' : 'ℹ️'}</div><p class="confirm-msg" style="text-align:center;margin-top:8px;">${message}</p>`,
    footer: `
      <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
      <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${okLabel}</button>
    `
  });
  overlay.querySelector('#confirm-cancel').addEventListener('click', closeModal);
  overlay.querySelector('#confirm-ok').addEventListener('click', () => {
    closeModal();
    if (typeof onConfirm === 'function') onConfirm();
  });
  return overlay;
}

function confirmDialog(message, onConfirm, dangerLabel = 'Delete') {
  return openConfirmModal('Confirm Action', message, onConfirm, dangerLabel, true);
}

window.openConfirmModal = openConfirmModal;
window.confirmDialog = confirmDialog;
App.openConfirmModal = openConfirmModal;
App.confirmDialog = confirmDialog;

// ── CUSTOM PROMPT DIALOG ──────────────────────────────────────
// Replaces the ugly browser prompt() with a proper styled modal card
function promptDialog(title, label, onSubmit, options = {}) {
  const { placeholder = 'Type here…', secondLabel = '', secondPlaceholder = '' } = options;
  const secondField = secondLabel ? `
    <div class="form-group" style="margin-top:12px">
      <label class="form-label">${secondLabel} <span style="font-weight:400;color:var(--gray-500)">(optional)</span></label>
      <input type="text" class="form-control" id="prompt-input-2" placeholder="${secondPlaceholder}" autocomplete="off">
    </div>` : '';

  const overlay = openModal({
    title: title,
    body: `
      <div class="form-group">
        <label class="form-label">${label} <span class="required">*</span></label>
        <input type="text" class="form-control" id="prompt-input-1" placeholder="${placeholder}" autocomplete="off" style="font-size:1rem;padding:10px 14px">
        <div class="invalid-feedback" id="prompt-error" style="display:none">This field is required</div>
      </div>
      ${secondField}`,
    footer: `
      <button class="btn btn-secondary" id="prompt-cancel">Cancel</button>
      <button class="btn btn-primary" id="prompt-ok">✓ Add</button>`,
  });

  const input1 = overlay.querySelector('#prompt-input-1');
  const input2 = overlay.querySelector('#prompt-input-2');
  const errMsg = overlay.querySelector('#prompt-error');

  const submit = async () => {
    const val1 = input1.value.trim();
    if (!val1) {
      input1.classList.add('is-invalid');
      errMsg.style.display = 'block';
      input1.focus();
      return;
    }
    
    const btnOk = overlay.querySelector('#prompt-ok');
    const btnCancel = overlay.querySelector('#prompt-cancel');
    const origText = btnOk.textContent;
    
    btnOk.disabled = true;
    btnCancel.disabled = true;
    btnOk.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Adding...';
    
    try {
      await Promise.resolve(onSubmit(val1, input2 ? input2.value.trim() : ''));
      btnOk.innerHTML = '✓ Added';
      btnOk.classList.remove('btn-primary');
      btnOk.classList.add('btn-success');
      btnCancel.disabled = false;
      btnCancel.textContent = 'Close'; // Allow user to close manually
      setTimeout(() => {
        if (document.body.contains(overlay)) closeModal();
      }, 2000);
    } catch (err) {
      btnOk.disabled = false;
      btnCancel.disabled = false;
      btnOk.textContent = origText;
    }
  };

  overlay.querySelector('#prompt-cancel').addEventListener('click', closeModal);
  overlay.querySelector('#prompt-ok').addEventListener('click', submit);
  input1.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  input1.addEventListener('input', () => { input1.classList.remove('is-invalid'); errMsg.style.display = 'none'; });
  setTimeout(() => input1.focus(), 80);
}

// ── DOM HELPERS ───────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    'In office':   'badge-inoffice',
    'Checked out': 'badge-checkedout',
    'Archived':    'badge-archived',
    'Missing':     'badge-missing',
  };
  const cls = map[status] || 'badge-archived';
  const dot = { 'In office': '●', 'Checked out': '◉', 'Archived': '○', 'Missing': '✕' }[status] || '●';
  return `<span class="badge ${cls}">${dot} ${status}</span>`;
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') e.className = v; else e.setAttribute(k, v); });
  children.forEach(c => e.append(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── REUSABLE SEARCHABLE FILTER COMPONENT ────────────────────────
App.renderFilterPill = function(label, id, options, currentValue, defaultLabel = 'All') {
  const curOpt = options.find(o => String(o.value) === String(currentValue)) || options[0] || { value: '', text: defaultLabel };
  const displayText = curOpt ? curOpt.text : defaultLabel;
  const isActive = !!currentValue;

  return `
    <div class="filter-dropdown-wrap" id="wrap-${id}">
      <button type="button" class="filter-pill ${isActive ? 'filter-active' : ''}" id="pill-${id}" aria-haspopup="listbox" title="Filter by ${label}">
        <span class="filter-pill-label">${label}</span>
        <span class="filter-pill-current" id="lbl-${id}">${escapeHTML(displayText)}</span>
        <span class="filter-pill-caret">▾</span>
      </button>
      <select class="filter-select-hidden" id="${id}" style="display:none;">
        ${options.map(o => `<option value="${escapeHTML(o.value)}" ${String(o.value) === String(currentValue) ? 'selected' : ''}>${escapeHTML(o.text)}</option>`).join('')}
      </select>
      <div class="filter-popover" id="popover-${id}" style="display:none;">
        <div class="filter-popover-search">
          <span class="search-icon">🔍</span>
          <input type="text" class="filter-popover-input" id="search-${id}" placeholder="Type to search ${label.toLowerCase()}…" autocomplete="off">
          <button type="button" class="filter-popover-clear" id="clear-${id}" style="display:none;" title="Clear search">✕</button>
        </div>
        <div class="filter-popover-list" id="list-${id}"></div>
      </div>
    </div>`;
};

App.bindFilterPill = function(id, options, onSelect) {
  const wrap      = document.getElementById(`wrap-${id}`);
  const pill      = document.getElementById(`pill-${id}`);
  const popover   = document.getElementById(`popover-${id}`);
  const searchInp = document.getElementById(`search-${id}`);
  const clearBtn  = document.getElementById(`clear-${id}`);
  const listEl    = document.getElementById(`list-${id}`);
  const lblEl     = document.getElementById(`lbl-${id}`);
  const hiddenSel = document.getElementById(id);

  if (!pill || !popover || !listEl) return;

  function renderList(query = '') {
    const q = query.trim().toLowerCase();
    const curVal = hiddenSel ? hiddenSel.value : '';

    const filtered = options.filter(opt => {
      if (!q) return true;
      return String(opt.text).toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="filter-popover-empty">No matching options found</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(opt => {
      const isSelected = String(opt.value) === String(curVal);
      const text = opt.text;
      let displayHtml = escapeHTML(text);
      if (q && q.length > 0) {
        const idx = text.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const b = text.substring(0, idx);
          const m = text.substring(idx, idx + q.length);
          const a = text.substring(idx + q.length);
          displayHtml = `${escapeHTML(b)}<mark style="background:var(--warning-bg);color:var(--gray-900);padding:0 2px;border-radius:2px;font-weight:700">${escapeHTML(m)}</mark>${escapeHTML(a)}`;
        }
      }
      return `
        <div class="filter-popover-item ${isSelected ? 'selected' : ''}" data-val="${escapeHTML(opt.value)}" data-text="${escapeHTML(opt.text)}">
          <span>${displayHtml}</span>
          ${isSelected ? '<span class="item-check">✓</span>' : ''}
        </div>`;
    }).join('');

    listEl.querySelectorAll('.filter-popover-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.dataset.val;
        const txt = item.dataset.text;

        if (lblEl) lblEl.textContent = txt;
        pill.classList.toggle('filter-active', !!val);
        closePopover();

        if (hiddenSel) {
          hiddenSel.value = val;
          hiddenSel.dispatchEvent(new Event('change'));
        } else if (typeof onSelect === 'function') {
          onSelect(val, txt);
        }
      });
    });
  }

  function openPopover() {
    // Close any other open filter popovers first
    document.querySelectorAll('.filter-popover').forEach(p => {
      if (p !== popover) {
        p.style.display = 'none';
        p.closest('.filter-dropdown-wrap')?.classList.remove('is-open');
      }
    });

    // Close Old File popover if open
    const oldFilePopover = document.getElementById('reg-old-file-popover');
    if (oldFilePopover) oldFilePopover.style.display = 'none';

    popover.style.display = 'flex';
    wrap?.classList.add('is-open');
    popover.style.left = '0';
    popover.style.right = 'auto';

    // Position detection to prevent screen overflow
    const rect = popover.getBoundingClientRect();
    if (rect.right > window.innerWidth - 10) {
      popover.style.left = 'auto';
      popover.style.right = '0';
    }

    if (searchInp) {
      searchInp.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      renderList('');
      setTimeout(() => searchInp.focus(), 30);
    } else {
      renderList('');
    }
  }

  function closePopover() {
    popover.style.display = 'none';
    wrap?.classList.remove('is-open');
  }

  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.style.display === 'none' || !popover.style.display) {
      openPopover();
    } else {
      closePopover();
    }
  });

  if (searchInp) {
    searchInp.addEventListener('input', (e) => {
      const q = e.target.value;
      if (clearBtn) clearBtn.style.display = q ? 'inline-block' : 'none';
      renderList(q);
    });
    searchInp.addEventListener('click', e => e.stopPropagation());
    searchInp.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePopover();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInp.value = '';
      clearBtn.style.display = 'none';
      renderList('');
      searchInp.focus();
    });
  }

  // Listen to external changes on hidden select (e.g. from stat cards or reset)
  if (hiddenSel) {
    hiddenSel.addEventListener('change', () => {
      const opt = options.find(o => String(o.value) === String(hiddenSel.value));
      if (opt && lblEl) lblEl.textContent = opt.text;
      pill.classList.toggle('filter-active', !!hiddenSel.value);
    });
  }

  // Global click & esc listener
  if (!window._filterPillGlobalBound) {
    window._filterPillGlobalBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-dropdown-wrap')) {
        document.querySelectorAll('.filter-popover').forEach(p => {
          p.style.display = 'none';
          p.closest('.filter-dropdown-wrap')?.classList.remove('is-open');
        });
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.filter-popover').forEach(p => {
          p.style.display = 'none';
          p.closest('.filter-dropdown-wrap')?.classList.remove('is-open');
        });
      }
    });
  }
};

// ── SMART SELECT WITH ADD & SEARCH ─────────────────────────────
// Renders a custom searchable select with sticky search filter at top + add button
function renderSmartSelect({ id, options, value, placeholder, onAdd, allowCustom = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'select-with-add';

  // Underlying <select id="${id}"> ensures backward compatibility with all form handlers & validation
  const select = document.createElement('select');
  select.id = id;
  select.style.display = 'none';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = `— ${placeholder} —`;
  select.appendChild(defaultOpt);

  options.forEach(o => {
    const v = typeof o === 'string' ? o : o.name;
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (v === value) opt.selected = true;
    select.appendChild(opt);
  });

  // Custom Searchable Dropdown Wrapper
  const dropdownWrap = document.createElement('div');
  dropdownWrap.className = 'custom-searchable-select';

  // Trigger button
  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.tabIndex = 0;

  const selectedSpan = document.createElement('span');
  selectedSpan.className = 'custom-select-label';
  selectedSpan.textContent = value || `— ${placeholder} —`;
  if (!value) selectedSpan.classList.add('is-placeholder');

  const arrow = document.createElement('span');
  arrow.className = 'custom-select-arrow';
  arrow.textContent = '▾';

  trigger.appendChild(selectedSpan);
  trigger.appendChild(arrow);

  // Dropdown Panel
  const panel = document.createElement('div');
  panel.className = 'custom-select-panel';
  panel.style.display = 'none';

  // Search Input Header
  const searchWrap = document.createElement('div');
  searchWrap.className = 'custom-select-search-wrap';
  searchWrap.innerHTML = `
    <span class="custom-select-search-icon">🔍</span>
    <input type="text" class="custom-select-search-input" placeholder="Search ${placeholder}…">
    <button type="button" class="custom-select-search-clear" style="display:none">✕</button>
  `;
  const searchInput = searchWrap.querySelector('.custom-select-search-input');
  const searchClear = searchWrap.querySelector('.custom-select-search-clear');

  // Options List
  const optionsList = document.createElement('div');
  optionsList.className = 'custom-select-options';

  function renderOptions(filterText = '') {
    optionsList.innerHTML = '';
    const q = filterText.toLowerCase().trim();

    // Default option (clear choice)
    if (!q) {
      const defItem = document.createElement('div');
      defItem.className = 'custom-select-option' + (!select.value ? ' selected' : '');
      defItem.dataset.value = '';
      defItem.textContent = `— ${placeholder} —`;
      defItem.addEventListener('click', () => chooseOption(''));
      optionsList.appendChild(defItem);
    }

    let matchCount = 0;
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;
      const text = opt.textContent;
      if (q && text.toLowerCase().indexOf(q) === -1) return;
      matchCount++;

      const item = document.createElement('div');
      item.className = 'custom-select-option' + (select.value === opt.value ? ' selected' : '');
      item.dataset.value = opt.value;

      if (q) {
        const idx = text.toLowerCase().indexOf(q);
        const before = text.substring(0, idx);
        const match = text.substring(idx, idx + q.length);
        const after = text.substring(idx + q.length);
        item.innerHTML = `${escapeHTML(before)}<mark style="background:var(--warning-bg);color:var(--gray-900);padding:0 2px;border-radius:2px;font-weight:700">${escapeHTML(match)}</mark>${escapeHTML(after)}`;
      } else {
        item.textContent = text;
      }

      item.addEventListener('click', () => chooseOption(opt.value));
      optionsList.appendChild(item);
    });

    if (matchCount === 0 && q) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'custom-select-empty';
      emptyItem.textContent = `No ${placeholder.toLowerCase()}s found matching "${filterText}"`;
      optionsList.appendChild(emptyItem);
    }
  }

  function chooseOption(val) {
    select.value = val;
    const chosen = Array.from(select.options).find(o => o.value === val);
    const displayText = chosen && chosen.value ? chosen.textContent : `— ${placeholder} —`;
    selectedSpan.textContent = displayText;
    if (val) {
      selectedSpan.classList.remove('is-placeholder');
      trigger.classList.remove('is-invalid');
    } else {
      selectedSpan.classList.add('is-placeholder');
    }

    closeDropdown();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function openDropdown() {
    document.querySelectorAll('.custom-select-panel').forEach(p => {
      if (p !== panel) {
        p.style.display = 'none';
        p.parentElement.querySelector('.custom-select-trigger')?.classList.remove('active');
      }
    });
    panel.style.display = 'flex';
    trigger.classList.add('active');
    searchInput.value = '';
    searchClear.style.display = 'none';
    renderOptions('');
    setTimeout(() => searchInput.focus(), 60);
  }

  function closeDropdown() {
    panel.style.display = 'none';
    trigger.classList.remove('active');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.style.display === 'none') openDropdown();
    else closeDropdown();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
    }
  });

  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    searchClear.style.display = val ? 'block' : 'none';
    renderOptions(val);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown();
      trigger.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const firstOpt = optionsList.querySelector('.custom-select-option');
      if (firstOpt) chooseOption(firstOpt.dataset.value);
    }
  });

  searchClear.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchInput.focus();
    renderOptions('');
  });

  panel.addEventListener('click', e => e.stopPropagation());

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!dropdownWrap.contains(e.target)) closeDropdown();
  });

  // Mirror validation classes from select to trigger
  const observer = new MutationObserver(() => {
    if (select.classList.contains('is-invalid')) trigger.classList.add('is-invalid');
    else trigger.classList.remove('is-invalid');
  });
  observer.observe(select, { attributes: true, attributeFilter: ['class'] });

  // Sync external select changes
  select.addEventListener('change', () => {
    const chosen = Array.from(select.options).find(o => o.value === select.value);
    if (chosen && chosen.value) {
      selectedSpan.textContent = chosen.textContent;
      selectedSpan.classList.remove('is-placeholder');
      trigger.classList.remove('is-invalid');
    } else {
      selectedSpan.textContent = `— ${placeholder} —`;
      selectedSpan.classList.add('is-placeholder');
    }
  });

  panel.appendChild(searchWrap);
  panel.appendChild(optionsList);

  dropdownWrap.appendChild(select);
  dropdownWrap.appendChild(trigger);
  dropdownWrap.appendChild(panel);
  wrap.appendChild(dropdownWrap);

  // Add button (+)
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-add-option';
  addBtn.title = `Add new ${placeholder}`;
  addBtn.textContent = '＋';

  addBtn.addEventListener('click', () => {
    promptDialog(
      `Add New ${placeholder}`,
      placeholder,
      (trimmed) => {
        if (onAdd) {
          return onAdd(trimmed).then(result => {
            const newName = result.name || trimmed;
            const newOpt = document.createElement('option');
            newOpt.value = newName;
            newOpt.textContent = newName;
            newOpt.selected = true;
            select.appendChild(newOpt);
            chooseOption(newName);
            toast(`"${trimmed}" added successfully`, 'success');
            loadConfig(true);
          }).catch(err => { toast(err.message, 'error'); throw err; });
        } else if (allowCustom) {
          const newOpt = document.createElement('option');
          newOpt.value = trimmed;
          newOpt.textContent = trimmed;
          newOpt.selected = true;
          select.appendChild(newOpt);
          chooseOption(trimmed);
          return Promise.resolve();
        }
      },
      { placeholder: `Enter ${placeholder} name…` }
    );
  });
  wrap.appendChild(addBtn);

  return wrap;
}


// ── CSV EXPORT ────────────────────────────────────────────────
function exportToCSV(files, filename = 'file-register.csv') {
  const headers = ['File Number','Old File Number','Client Name','Category','Sub-Category','Details','Entity','Business Vertical','Location','HOD','File Type','Colour','Bin Location','Status','Held By','Due Date','Tags','Related Docs','Notes','Created At','Created By','Updated At','Updated By'];
  const keys    = ['fileNumber','oldFileNumber','clientName','category','subCategory','details','entity','businessVertical','location','hod','fileType','colour','binLocation','status','heldBy','dueDate','tags','relatedDocs','notes','createdAt','createdBy','updatedAt','updatedBy'];
  const rows = [headers, ...files.map(f => keys.map(k => `"${String(f[k] || '').replace(/"/g, '""')}"` ))];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── STRING & ACTIVITY FORMATTING ─────────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatActivityDetail(details) {
  if (!details) return '';
  const str = String(details).trim();

  // If details contain field diff indicator ' → ' or '→'
  if (str.includes(' → ') || str.includes('→')) {
    let notePrefix = '';
    let diffPortion = str;
    if (str.includes(' — ') && str.split(' — ')[1].includes('→')) {
      const parts = str.split(' — ');
      notePrefix = parts[0];
      diffPortion = parts.slice(1).join(' — ');
    }

    const items = diffPortion.split(' | ');
    const pillsHTML = items.map(item => {
      // Regex matches: Field Name: "old" → "new" or Field Name: old → new
      const m = item.match(/^([^:]+):\s*"?(.*?)"?\s*→\s*"?(.*?)"?$/);
      if (m) {
        const fieldName = m[1].trim();
        const oldVal = m[2].trim();
        const newVal = m[3].trim();
        return `
          <span class="activity-diff-pill">
            <span class="diff-field-name">${escapeHTML(fieldName)}:</span>
            <span class="diff-old-val">${escapeHTML(oldVal)}</span>
            <span class="diff-arrow">➔</span>
            <span class="diff-new-val">${escapeHTML(newVal)}</span>
          </span>`;
      }
      return `<span class="activity-diff-pill">${escapeHTML(item)}</span>`;
    }).join('');

    return `
      ${notePrefix ? `<div style="font-weight:600;color:var(--gray-800);margin-bottom:3px;">${escapeHTML(notePrefix)}</div>` : ''}
      <div class="activity-change-grid">${pillsHTML}</div>`;
  }

  return escapeHTML(str);
}

// ── ACTIVITY DOT COLOR ─────────────────────────────────────────
function activityDotColor(action) {
  if (action === 'Created') return 'green';
  if (action === 'Deleted') return 'red';
  if (action === 'Checked out') return 'orange';
  if (action === 'Updated' || action === 'File Updated') return 'orange';
  return '';
}

// ── UPDATES & ROADMAP SMART CARD MODAL ─────────────────────────
function initUpdatesUI() {
  document.getElementById('topbar-updates-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    showStartupUpdatesCard();
  });
}

function showStartupUpdatesCard() {
  // Prevent duplicate if already open
  if (document.getElementById('updates-smart-card-modal')) return;

  const overlay = openModal({
    title: `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.35rem;">🚀</span>
        <div>
          <div style="font-size:1.05rem;font-weight:700;color:var(--gray-900);line-height:1.2;">System Updates & Roadmap</div>
          <div style="font-size:0.75rem;color:var(--gray-600);font-weight:normal;">Gretex Group • Physical File Register v1.1</div>
        </div>
      </div>`,
    size: 'modal-lg',
    body: `
      <div id="updates-smart-card-modal" class="updates-smart-card-wrap">
        <!-- Banner Card -->
        <div style="background:linear-gradient(135deg,#0d47a1 0%,#1976d2 100%);color:white;border-radius:12px;padding:16px 20px;margin-bottom:18px;box-shadow:0 4px 14px rgba(25,118,210,0.25);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div>
              <strong style="font-size:1.02rem;display:block;">Development & Feature Status</strong>
              <span style="font-size:0.82rem;opacity:0.9;">Track which features are completed, in progress, or pending.</span>
            </div>
            <span style="background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);padding:4px 12px;border-radius:20px;font-size:0.82rem;font-weight:700;">
              6 of 8 Done (75%)
            </span>
          </div>
          <div style="width:100%;height:8px;background:rgba(255,255,255,0.25);border-radius:8px;overflow:hidden;">
            <div style="width:75%;height:100%;background:#34a853;border-radius:8px;"></div>
          </div>
        </div>

        <!-- Requested Tasks List -->
        <div style="display:flex;flex-direction:column;gap:10px;">

          <!-- Task 1: Done -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8fafd;border:1px solid #ceead6;border-left:5px solid #188038;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">🔍</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">need to search file by old file number also</strong>
                <span class="badge" style="background:#e6f4ea;color:#137333;font-weight:700;border:1px solid #ceead6;padding:3px 10px;">✅ Done</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Integrated dedicated searchable Old File Number dropdown in Toolbar Row 1 with live table synchronization.</p>
            </div>
          </div>

          <!-- Task 2: Done -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8fafd;border:1px solid #ceead6;border-left:5px solid #188038;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">⚡</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">Change of status , location, etc. option not showing</strong>
                <span class="badge" style="background:#e6f4ea;color:#137333;font-weight:700;border:1px solid #ceead6;padding:3px 10px;">✅ Done</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Implemented Quick Update modal across Register rows & File Details with granular audit diff tracking (previous vs new value & user attribution).</p>
            </div>
          </div>

          <!-- Task 3: Done -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8fafd;border:1px solid #ceead6;border-left:5px solid #188038;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">🏷️</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">Need Filter Data option for printing Stickers and then keep a track of printing stickers with date, time and person who had printed</strong>
                <span class="badge" style="background:#e6f4ea;color:#137333;font-weight:700;border:1px solid #ceead6;padding:3px 10px;">✅ Done</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Added multi-field filter toolbar (Client, Category, Location, Bin, Status), batch selection, Print History modal, and automated sheet logging with date, time, and operator name.</p>
            </div>
          </div>

          <!-- Task 4: Done -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8fafd;border:1px solid #ceead6;border-left:5px solid #188038;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">🗂️</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">sub categories not created as discussed</strong>
                <span class="badge" style="background:#e6f4ea;color:#137333;font-weight:700;border:1px solid #ceead6;padding:3px 10px;">✅ Done</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Configured complete subcategories catalog in settings with automated code generation, dynamic dropdown population, and category mapping.</p>
            </div>
          </div>

          <!-- Task 5: Done (Login Module) -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8fafd;border:1px solid #ceead6;border-left:5px solid #188038;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">🔐</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">Role-based User Authentication & Access Control (Login System)</strong>
                <span class="badge" style="background:#e6f4ea;color:#137333;font-weight:700;border:1px solid #ceead6;padding:3px 10px;">✅ Done</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Secure login modal, Users sheet setup in Google Sheets, default password Test, session persistence, and user administration menu.</p>
            </div>
          </div>

          <!-- Task 6: Done (Searchable Dropdowns) -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8fafd;border:1px solid #ceead6;border-left:5px solid #188038;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">🔍</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">Searchable filter dropdowns with top search bar (like Old File)</strong>
                <span class="badge" style="background:#e6f4ea;color:#137333;font-weight:700;border:1px solid #ceead6;padding:3px 10px;">✅ Done</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Equipped Category, Sub-Cat, Files, Location, Bin, Status, and Held By with top search bar, live keyword highlight, and checkmarks.</p>
            </div>
          </div>

          <!-- Task 7: Pending -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8f9fa;border:1px solid #dadce0;border-left:5px solid #80868b;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">📦</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">Allott Bin No. to multiple files in bulk</strong>
                <span class="badge" style="background:#f1f3f4;color:#5f6368;font-weight:700;border:1px solid #dadce0;padding:3px 10px;">⏳ Pending</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Multi-select checkbox workflow with bulk action modal to assign or reassign Bin Numbers across multiple files simultaneously.</p>
            </div>
          </div>

          <!-- Task 8: Pending -->
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#f8f9fa;border:1px solid #dadce0;border-left:5px solid #80868b;border-radius:8px;">
            <div style="font-size:1.25rem;line-height:1;margin-top:2px;">📂</div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="color:#202124;font-size:0.92rem;">Option to close the file - making it empty is also required</strong>
                <span class="badge" style="background:#f1f3f4;color:#5f6368;font-weight:700;border:1px solid #dadce0;padding:3px 10px;">⏳ Pending</span>
              </div>
              <p style="font-size:0.8rem;color:#5f6368;margin-top:4px;margin-bottom:0;">Provide dedicated workflow to close active files, empty assigned register contents, and transition records to archived state while preserving complete audit history.</p>
            </div>
          </div>

        </div>
      </div>
    `,
    footer: `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <a href="updates.html" class="btn btn-secondary" style="font-size:0.85rem;" target="_blank">
          View Full Updates Page ↗
        </a>
        <button class="btn btn-primary" id="btn-close-updates-modal" style="font-size:0.85rem;padding:8px 22px;">
          Got it 👍
        </button>
      </div>
    `
  });

  overlay.querySelector('#btn-close-updates-modal')?.addEventListener('click', closeModal);
}
