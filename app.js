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
    stickers:  'Print Stickers',
    import:    'Bulk Import',
    settings:  'Settings — Master Data',
    'settings/clients':       'Settings — Clients',
    'settings/categories':    'Settings — Categories',
    'settings/subcategories': 'Settings — Sub-Categories',
    'settings/lists':         'Settings — Drop-down Lists',
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

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

// ── ACTIVITY DOT COLOR ─────────────────────────────────────────
function activityDotColor(action) {
  if (action === 'Created') return 'green';
  if (action === 'Deleted') return 'red';
  if (action === 'Checked out') return 'orange';
  return '';
}
