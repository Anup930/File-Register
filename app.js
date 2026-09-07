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
});

// ── USER (localStorage) ───────────────────────────────────────
function initUser() {
  const saved = localStorage.getItem('fr_user_name');
  if (!saved) {
    showNamePrompt();
  } else {
    App.user = saved;
    updateUserUI();
  }
}

function showNamePrompt() {
  const prompt = document.getElementById('name-prompt');
  prompt.style.display = 'flex';
  const input = document.getElementById('name-input');
  const btn   = document.getElementById('name-submit-btn');
  input.focus();

  const submit = () => {
    const name = input.value.trim();
    if (!name) { input.classList.add('is-invalid'); return; }
    App.user = name;
    localStorage.setItem('fr_user_name', name);
    prompt.style.display = 'none';
    updateUserUI();
    loadConfig();
    navigate(location.hash || '#dashboard');
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  document.getElementById('btn-change-user').addEventListener('click', () => {
    localStorage.removeItem('fr_user_name');
    App.user = null;
    showNamePrompt();
    input.value = '';
  });
}

function updateUserUI() {
  const name = App.user || '?';
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  document.getElementById('btn-change-user').addEventListener('click', () => {
    localStorage.removeItem('fr_user_name');
    App.user = null;
    showNamePrompt();
  });
}

// ── ROUTER ────────────────────────────────────────────────────
function initRouter() {
  window.addEventListener('hashchange', () => navigate(location.hash));
  navigate(location.hash || '#dashboard');
}

function navigate(hash) {
  if (!App.user) return; // wait for name
  const page = (hash || '#dashboard').replace('#', '') || 'dashboard';
  App.currentPage = page;
  setActiveNav(page);

  const titles = {
    dashboard: 'Dashboard',
    register:  'File Register',
    add:       'Add New File',
    import:    'Bulk Import',
    settings:  'Master Data',
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
    case 'import':        ImportModule.render(content, topbarActions); break;
    case 'settings':      MastersModule.render(content, topbarActions); break;
    default:
      if (page.startsWith('file/')) {
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
    a.classList.toggle('active', a.dataset.page === page || page.startsWith(a.dataset.page + '/'));
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

function confirmDialog(message, onConfirm, dangerLabel = 'Delete') {
  const overlay = openModal({
    title: 'Confirm Action',
    body: `<div class="confirm-icon">⚠️</div><p class="confirm-msg">${message}</p>`,
    footer: `<button class="btn btn-secondary" id="confirm-cancel">Cancel</button><button class="btn btn-danger" id="confirm-ok">${dangerLabel}</button>`
  });
  overlay.querySelector('#confirm-cancel').addEventListener('click', closeModal);
  overlay.querySelector('#confirm-ok').addEventListener('click', () => { closeModal(); onConfirm(); });
}

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

// ── SMART SELECT WITH ADD ──────────────────────────────────────
// Renders a <select> with an add button; calls onAdd(name) -> Promise<{name,code}>
function renderSmartSelect({ id, options, value, placeholder, onAdd, allowCustom = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'select-with-add';
  wrap.innerHTML = `
    <select class="form-control" id="${id}">
      <option value="">— ${placeholder} —</option>
      ${options.map(o => {
        const v = typeof o === 'string' ? o : o.name;
        return `<option value="${v}" ${v === value ? 'selected' : ''}>${v}</option>`;
      }).join('')}
    </select>
    <button type="button" class="btn-add-option" title="Add new ${placeholder}">＋</button>
  `;
  const select = wrap.querySelector('select');
  const addBtn = wrap.querySelector('.btn-add-option');

  addBtn.addEventListener('click', () => {
    promptDialog(
      `Add New ${placeholder}`,
      placeholder,
      (trimmed) => {
        if (onAdd) {
          return onAdd(trimmed).then(result => {
            const newOpt = document.createElement('option');
            newOpt.value = result.name || trimmed;
            newOpt.textContent = result.name || trimmed;
            newOpt.selected = true;
            select.appendChild(newOpt);
            toast(`"${trimmed}" added successfully`, 'success');
            loadConfig(true);
          }).catch(err => { toast(err.message, 'error'); throw err; });
        } else if (allowCustom) {
          const newOpt = document.createElement('option');
          newOpt.value = trimmed;
          newOpt.textContent = trimmed;
          newOpt.selected = true;
          select.appendChild(newOpt);
          return Promise.resolve();
        }
      },
      { placeholder: `Enter ${placeholder} name…` }
    );
  });  // ← closes addBtn.addEventListener

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

// ── ACTIVITY DOT COLOR ─────────────────────────────────────────
function activityDotColor(action) {
  if (action === 'Created') return 'green';
  if (action === 'Deleted') return 'red';
  if (action === 'Checked out') return 'orange';
  return '';
}
