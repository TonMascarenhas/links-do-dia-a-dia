// =============================================
//  LinkHub — app.js  (versão completa)
// =============================================

// ---- STATE ----
const STATE = {
  links: [],
  currentView: 'dashboard',
  currentCategory: null,
  searchQuery: '',
  filterCategory: 'all',
  sortMode: 'manual',
  editingId: null,
  deletingId: null,
  theme: 'light',
};

// ---- CATEGORY DEFINITIONS ----
const CATEGORY_MAP = {
  trabalho: { label: 'Trabalho', emoji: '💼', color: '#3b82f6' },
  estudos: { label: 'Estudos', emoji: '📚', color: '#8b5cf6' },
  entretenimento: { label: 'Entretenimento', emoji: '🎮', color: '#f59e0b' },
  bancos: { label: 'Bancos', emoji: '🏦', color: '#10b981' },
  compras: { label: 'Compras', emoji: '🛒', color: '#ef4444' },
  'redes-sociais': { label: 'Redes Sociais', emoji: '📱', color: '#6366f1' },
  noticias: { label: 'Notícias', emoji: '📰', color: '#64748b' },
  outros: { label: 'Outros', emoji: '📎', color: '#94a3b8' },
};

// ---- STORAGE ----
function save() {
  localStorage.setItem('linkhub_links', JSON.stringify(STATE.links));
  localStorage.setItem('linkhub_theme', STATE.theme);
}

function load() {
  const raw = localStorage.getItem('linkhub_links');
  if (raw) STATE.links = JSON.parse(raw);
  STATE.theme = localStorage.getItem('linkhub_theme') || 'light';
  applyTheme(STATE.theme);
}

// ---- THEME ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.querySelector('#themeToggle i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// ---- TOAST ----
function toast(message, type = 'success', duration = 3000) {
  const icons = { success: 'circle-check', error: 'circle-xmark', info: 'circle-info', warning: 'triangle-exclamation' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid fa-${icons[type] || 'circle-check'}"></i> ${message}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ---- ID GENERATOR ----
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---- URL VALIDATION ----
function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function sanitizeUrl(str) {
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    return 'https://' + str;
  }
  return str;
}

// ---- FAVICON ----
function getFaviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=64`;
  } catch { return null; }
}

// ---- RENDER ICON ----
function renderIcon(link) {
  if (!link.icon) {
    const favicon = getFaviconUrl(link.url);
    if (favicon) return `<img src="${favicon}" alt="" onerror="this.parentElement.innerHTML='🔗'" />`;
    return '🔗';
  }
  if (link.icon.startsWith('http') || link.icon.startsWith('/')) {
    return `<img src="${link.icon}" alt="" onerror="this.parentElement.innerHTML='🔗'" />`;
  }
  return link.icon;
}

// ---- GET CATEGORY LABEL ----
function getCatInfo(catKey) {
  if (CATEGORY_MAP[catKey]) return CATEGORY_MAP[catKey];
  // custom categories
  return { label: catKey, emoji: '📌', color: '#64748b' };
}

// ---- CREATE LINK CARD ----
function createCard(link) {
  const catInfo = getCatInfo(link.category);
  const card = document.createElement('div');
  card.className = 'link-card';
  card.dataset.id = link.id;
  card.innerHTML = `
    <div class="link-card-top">
      <div class="link-icon-wrap">${renderIcon(link)}</div>
      <div class="link-card-actions">
        <button class="card-action-btn favorite-btn ${link.favorite ? 'active' : ''}" data-id="${link.id}" title="${link.favorite ? 'Desfavoritar' : 'Favoritar'}">
          <i class="fa-${link.favorite ? 'solid' : 'regular'} fa-star"></i>
        </button>
        <button class="card-action-btn edit-btn" data-id="${link.id}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="card-action-btn delete-btn" data-id="${link.id}" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
    <div class="link-card-body">
      <p class="link-title" title="${link.title}">${link.title}</p>
      <p class="link-url" title="${link.url}">${link.url.replace(/
^
https?:\/\//, '')}</p>
    </div>
    <div class="link-card-footer">
      <span class="link-tag" style="border-color:${catInfo.color}22;background:${catInfo.color}11;color:${catInfo.color}">
        ${catInfo.emoji} ${catInfo.label}
      </span>
      <span class="link-freq"><i class="fa-solid fa-arrow-pointer"></i> ${link.clicks || 0}</span>
    </div>
  `;

  // Click on card body → open link
  card.addEventListener('click', (e) => {
    if (e.target.closest('.link-card-actions')) return;
    link.clicks = (link.clicks || 0) + 1;
    link.lastUsed = Date.now();
    save();
    renderDashboardStats();
    window.open(link.url, '_blank', 'noopener');
  });

  // Actions
  card.querySelector('.favorite-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(link.id);
  });
  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(link.id);
  });
  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(link.id);
  });

  return card;
}

// ---- GET SORTED + FILTERED LINKS ----
function getFilteredLinks(forCategory = null) {
  let list = [...STATE.links];

  // category filter
  if (forCategory) list = list.filter(l => l.category === forCategory);
  else if (STATE.filterCategory !== 'all') {
    list = list.filter(l => l.category === STATE.filterCategory);
  }

  // search
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    list = list.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q)
    );
  }

  // sort
  switch (STATE.sortMode) {
    case 'frequency': list.sort((a, b) => (b.clicks || 0) - (a.clicks || 0)); break;
    case 'name': list.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'newest': list.sort((a, b) => b.createdAt - a.createdAt); break;
    default: break; // manual = insertion order
  }

  return list;
}

// ---- RENDER ALL LINKS VIEW ----
function renderAllLinks() {
  const container = document.getElementById('allLinks');
  const empty = document.getElementById('allEmpty');
  const list = getFilteredLinks();
  container.innerHTML = '';
  if (!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.forEach(l => container.appendChild(createCard(l)));
}

// ---- RENDER FAVORITES VIEW ----
function renderFavorites() {
  const container = document.getElementById('favoritesLinks');
  const empty = document.getElementById('favEmpty');
  const list = STATE.links.filter(l => l.favorite);
  container.innerHTML = '';
  if (!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.forEach(l => container.appendChild(createCard(l)));
}

// ---- RENDER CATEGORY VIEW ----
function renderCategoryView(cat) {
  const container = document.getElementById('categoryLinks');
  const empty = document.getElementById('catEmpty');
  let list = getFilteredLinks(cat);
  container.innerHTML = '';
  if (!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.forEach(l => container.appendChild(createCard(l)));
}

// ---- RENDER DASHBOARD ----
function renderDashboard() {
  renderDashboardStats();

  // Top 6 most clicked
  const topContainer = document.getElementById('topLinks');
  topContainer.innerHTML = '';
  const top = [...STATE.links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 6);
  top.forEach(l => topContainer.appendChild(createCard(l)));

  // Recent 6
  const recentContainer = document.getElementById('recentLinks');
  recentContainer.innerHTML = '';
  const recent = [...STATE.links].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  recent.forEach(l => recentContainer.appendChild(createCard(l)));

  // Favorites preview
  const favContainer = document.getElementById('favoritesPreview');
  favContainer.innerHTML = '';
  const favs = STATE.links.filter(l => l.favorite).slice(0, 6);
  favs.forEach(l => favContainer.appendChild(createCard(l)));
}

function renderDashboardStats() {
  document.getElementById('statTotal').textContent = STATE.links.length;
  document.getElementById('statFavorites').textContent = STATE.links.filter(l => l.favorite).length;
  const cats = [...new Set(STATE.links.map(l => l.category))];
  document.getElementById('statCategories').textContent = cats.length;
  const top = [...STATE.links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
  document.getElementById('statMostUsed').textContent = top ? top.title.slice(0, 12) : '—';
}

// ---- RENDER SIDEBAR CATEGORIES ----
function renderSidebarCategories() {
  const el = document.getElementById('categoriesList');
  el.innerHTML = '';
  const cats = [...new Set(STATE.links.map(l => l.category))];
  cats.forEach(cat => {
    const info = getCatInfo(cat);
    const count = STATE.links.filter(l => l.category === cat).length;
    const btn = document.createElement('button');
    btn.className = `category-nav-item${STATE.currentCategory === cat ? ' active' : ''}`;
    btn.innerHTML = `<span>${info.emoji} ${info.label}</span><span class="cat-count">${count}</span>`;
    btn.addEventListener('click', () => navigateToCategory(cat));
    el.appendChild(btn);
  });
}

// ---- RENDER FILTER CHIPS ----
function renderFilterChips() {
  const el = document.getElementById('filterChips');
  el.innerHTML = '';
  const cats = [...new Set(STATE.links.map(l => l.category))];
  ['all', ...cats].forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `chip${STATE.filterCategory === cat ? ' active' : ''}`;
    if (cat === 'all') {
      chip.textContent = '🌐 Todos';
    } else {
      const info = getCatInfo(cat);
      chip.textContent = `${info.emoji} ${info.label}`;
    }
    chip.addEventListener('click', () => {
      STATE.filterCategory = cat;
      renderFilterChips();
      renderAllLinks();
    });
    el.appendChild(chip);
  });
}

// ---- POPULATE CATEGORY SELECT IN MODAL ----
function populateCategorySelect() {
  const sel = document.getElementById('fieldCategory');
  const defaultOpts = [
    '', 'trabalho', 'estudos', 'entretenimento', 'bancos',
    'compras', 'redes-sociais', 'noticias', 'outros'
  ];
  const customCats = STATE.links
    .map(l => l.category)
    .filter(c => !defaultOpts.includes(c));
  const uniqueCustom = [...new Set(customCats)];

  // Remove existing custom options (keep defaults)
  while (sel.options.length > 9) sel.remove(9);

  uniqueCustom.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `📌 ${cat}`;
    sel.appendChild(opt);
  });
}

// ---- NAVIGATE VIEWS ----
function navigateTo(view) {
  STATE.currentView = view;
  STATE.currentCategory = null;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.category-nav-item').forEach(c => c.classList.remove('active'));

  const titles = { dashboard: 'Dashboard', all: 'Todos os Links', favorites: 'Favoritos' };
  document.getElementById('pageTitle').textContent = titles[view] || view;

  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  document.getElementById(`${view}View`)?.classList.add('active');

  if (view === 'dashboard') renderDashboard();
  if (view === 'all') { renderFilterChips(); renderAllLinks(); }
  if (view === 'favorites') renderFavorites();

  renderSidebarCategories();
  closeSidebar();
}

function navigateToCategory(cat) {
  STATE.currentView = 'category';
  STATE.currentCategory = cat;
  const info = getCatInfo(cat);

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.category-nav-item').forEach(c => c.classList.remove('active'));

  document.getElementById('pageTitle').textContent = `${info.emoji} ${info.label}`;
  document.getElementById('categoryView').classList.add('active');
  renderCategoryView(cat);
  renderSidebarCategories();
  closeSidebar();
}

// ---- SIDEBAR TOGGLE ----
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

// ---- MODAL LOGIC ----
function openAddModal() {
  STATE.editingId = null;
  document.getElementById('modalTitle').textContent = 'Adicionar Link';
  document.getElementById('saveBtn').textContent = 'Salvar Link';
  document.getElementById('linkForm').reset();
  document.getElementById('newCategoryGroup').style.display = 'none';
  populateCategorySelect();
  document.getElementById('linkModal').classList.add('open');
}

function openEditModal(id) {
  const link = STATE.links.find(l => l.id === id);
  if (!link) return;
  STATE.editingId = id;
  document.getElementById('modalTitle').textContent = 'Editar Link';
  document.getElementById('saveBtn').textContent = 'Atualizar Link';
  document.getElementById('fieldTitle').value = link.title;
  document.getElementById('fieldUrl').value = link.url;
  document.getElementById('fieldIcon').value = link.icon || '';
  document.getElementById('fieldFavorite').checked = link.favorite || false;
  document.getElementById('newCategoryGroup').style.display = 'none';
  populateCategorySelect();
  document.getElementById('fieldCategory').value = link.category;
  document.getElementById('linkModal').classList.add('open');
}

function closeModal() {
  document.getElementById('linkModal').classList.remove('open');
  STATE.editingId = null;
}

function openDeleteModal(id) {
  STATE.deletingId = id;
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  STATE

