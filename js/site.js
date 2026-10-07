/* GundamWorld 站点共享层：登录态、目录渲染、编辑入口 */
const GW = {
  api: null,
  user: null,
  isAdmin: false,
  esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  async request(action, options = {}) {
    const params = new URLSearchParams({ action, ...options.query });
    const init = { method: options.method ?? 'GET', credentials: 'same-origin', headers: {} };
    if (options.body) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    let response;
    try {
      response = await fetch(`/functions/v1/app?${params}`, init);
    } catch {
      throw new Error('站点服务暂时不可用，请稍后重试。');
    }
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) throw new Error(`服务返回了非预期内容（HTTP ${response.status}）。`);
    const data = await response.json();
    if (!response.ok) {
      const codes = {
        login_required: '需要先用 Qoder 账号登录。',
        forbidden: '当前账号没有该操作权限。',
        too_many_pending: '你已有较多待审投稿，请先等审核完成。',
        database_request_failed: '数据库暂时不可用。',
        already_reviewed: '这条投稿已经被处理过了。',
      };
      const error = new Error(codes[data.error] ?? `请求失败（${data.error ?? response.status}）。`);
      error.code = data.error;
      error.status = response.status;
      throw error;
    }
    return data;
  },
};

GW.signInHref = '/__qoder_auth/start?return_path=%2F';

GW.renderSeries = (items) => items.map((row) => `
  <div class="model-card" data-id="${GW.esc(row.id)}">
    <img src="${GW.esc(row.image ?? 'images/bg_ms1.jpg')}" alt="${GW.esc(row.title)}">
    <h3>${GW.esc(row.title)}</h3>
    <p>${GW.esc(row.subtitle ?? row.era ?? '')}</p>
    <a href="${GW.esc(row.page_path ?? 'products.html')}" class="details-btn">查看详情</a>
    ${GW.user ? `<button class="edit-card-btn" data-kind="series" data-id="${GW.esc(row.id)}" data-title="${GW.esc(row.title)}">编辑</button>` : ''}
  </div>`).join('');

GW.renderProducts = (items) => items.map((row) => `
  <div class="product-card" data-series="${GW.esc(row.series ?? '')}" data-grade="${GW.esc(row.grade ?? '')}" data-id="${GW.esc(row.id)}" style="display:block">
    <img src="${GW.esc(row.image ?? '')}" alt="${GW.esc(row.name)}">
    <div class="product-info">
      <h3>${GW.esc(row.name)}</h3>
      <p class="grade">${GW.esc([row.grade, row.scale].filter(Boolean).join(' '))}</p>
      <p class="price">${GW.esc(row.price_text ?? '')}</p>
      <div class="product-tags">${(row.features ?? []).slice(0, 2).map((f) => `<span class="tag">${GW.esc(f)}</span>`).join('')}</div>
      <a href="${GW.esc(row.page_path ?? 'detail.html')}" class="details-btn">查看详情</a>
      ${GW.user ? `<button class="edit-card-btn" data-kind="product" data-id="${GW.esc(row.id)}" data-title="${GW.esc(row.name)}">编辑</button>` : ''}
    </div>
  </div>`).join('');

async function paintNav() {
  const links = document.querySelector('.nav-links');
  if (!links) return;
  links.querySelectorAll('[data-gw-auth]').forEach((n) => n.remove());
  const group = document.createElement('div');
  group.className = 'gw-auth';
  group.dataset.gwAuth = '1';
  if (!GW.user) {
    group.innerHTML = `<a href="${GW.signInHref}" class="register-btn">Qoder 登录</a>`;
  } else {
    const items = [
      `<a href="editor.html" title="投稿新内容">投稿</a>`,
      GW.isAdmin ? `<a href="admin.html">审核台</a>` : '',
      `<span class="gw-user">${GW.esc(GW.user.name || GW.user.user_id.slice(0, 8))}</span>`,
    ].filter(Boolean).join('');
    group.innerHTML = items;
  }
  links.appendChild(group);
}

async function hydrateCatalog() {
  const grid = document.querySelector('[data-gw-catalog]');
  if (!grid) return;
  const kind = grid.dataset.gwCatalog;
  try {
    const pages = [];
    let offset = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await GW.request('catalog', { query: { kind, offset: String(offset) } });
      pages.push(...page.items);
      if (!page.hasMore) break;
      offset = page.nextOffset;
    }
    if (pages.length) {
      grid.innerHTML = kind === 'series' ? GW.renderSeries(pages) : GW.renderProducts(pages);
      grid.dispatchEvent(new Event('gw:catalog', { bubbles: true }));
    }
  } catch (error) {
    console.info('[GundamWorld] 目录仍使用页面内置内容：', error.message);
  }
}

async function hydrateEditorLinks() {
  const buttons = document.querySelectorAll('.edit-card-btn');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const params = new URLSearchParams({ kind: button.dataset.kind, id: button.dataset.id, title: button.dataset.title ?? '' });
      window.location.href = `editor.html?${params}`;
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await GW.request('me');
    GW.user = me.user;
    GW.isAdmin = !!me.isAdmin;
  } catch (error) {
    console.info('[GundamWorld] 登录状态不可用：', error.message);
  }
  await paintNav();
  document.dispatchEvent(new Event('gw:ready'));
  await hydrateCatalog();
  await hydrateEditorLinks();
});

window.GW = GW;
