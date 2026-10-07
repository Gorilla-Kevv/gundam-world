/* 编辑器：按内容类型生成表单，提交进待审队列 */
const SCHEMA = {
  product: [
    ['code', '商品编号', 'text', true, '例如 RG144-RX78'],
    ['name', '商品名称', 'text', true, '例如 RX-78-2 高达'],
    ['series', '所属系列', 'text', false, 'UC / SEED / 00 / IBO'],
    ['grade', '等级', 'text', false, 'HG / RG / MG / PG / MB'],
    ['scale', '比例', 'text', false, '1/144'],
    ['price_text', '价格显示文本', 'text', false, '3,850日元'],
    ['price_value', '价格数值', 'number', false, '用于价格筛选'],
    ['release_date', '发售信息', 'text', false, '2025年6月预定'],
    ['image', '主图路径', 'text', false, 'images/xxx.jpg（仅站内图片）'],
    ['page_path', '详情页链接', 'text', false, 'detail.html'],
    ['features', '标签/特征', 'list', false, '英文逗号分隔'],
    ['gallery', '图集路径', 'list', false, '英文逗号分隔'],
    ['detail', '商品说明', 'area', false, '成型色、可动性、配件等'],
  ],
  series: [
    ['slug', 'URL 标识', 'text', true, '例如 uc、seed-ce'],
    ['era', '纪元', 'text', true, 'U.C.纪元'],
    ['title', '作品名', 'text', true, '机动战士高达'],
    ['subtitle', '一句话简介', 'text', false, '经典初代高达'],
    ['summary', '内容简介', 'area', false, '剧情与看点'],
    ['image', '封面路径', 'text', false, 'images/uc/preview.jpg'],
    ['page_path', '详情页链接', 'text', false, 'info/uc-info.html'],
    ['sort_order', '排序', 'number', false, '数字越小越靠前'],
  ],
};

const form = document.getElementById('entry-form');
const statusLine = document.getElementById('form-status');
const kindSelect = document.getElementById('kind');
const opSelect = document.getElementById('op');
let current = null;

function fieldHtml([key, label, type, required, hint], value) {
  const id = `f-${key}`;
  const v = value ?? '';
  const text = type === 'area'
    ? `<textarea id="${id}" name="${key}" rows="4" placeholder="${hint}"></textarea>`
    : `<input id="${id}" name="${key}" type="${type === 'number' ? 'number' : 'text'}" placeholder="${hint}">`;
  return `<div class="field"><label for="${id}">${label}${required ? ' *' : ''}</label>${text}<small>${hint}</small></div>`;
}

function buildForm(kind, entry) {
  form.innerHTML = SCHEMA[kind].map((f) => fieldHtml(f, entry?.[f[0]])).join('');
  if (kind === 'series' && entry?.summary) form.querySelector('[name=summary]').value = entry.summary;
  for (const input of form.querySelectorAll('input,textarea')) {
    const value = entry?.[input.name];
    if (value === undefined || value === null) continue;
    input.value = Array.isArray(value) ? value.join(',') : String(value);
  }
}

function readPayload(kind) {
  const payload = {};
  for (const [key, , type] of SCHEMA[kind]) {
    const raw = form.querySelector(`[name=${key}]`).value.trim();
    if (!raw) continue;
    if (type === 'list') payload[key] = raw.split(',').map((s) => s.trim()).filter(Boolean);
    else if (type === 'number') payload[key] = Number(raw);
    else payload[key] = raw;
  }
  return payload;
}

function say(message, tone = '') {
  statusLine.textContent = message;
  statusLine.className = `studio-status ${tone}`;
}

async function loadMySubmissions() {
  const list = document.getElementById('my-submissions');
  try {
    const { items } = await GW.request('submissions', { query: { status: 'pending', mine: '1' } });
    const { approved } = await GW.request('submissions', { query: { status: 'approved', mine: '1' } });
    const { rejected } = await GW.request('submissions', { query: { status: 'rejected', mine: '1' } });
    const all = [...items, ...approved, ...rejected];
    list.innerHTML = all.length
      ? all.map((s) => `<li><span class="badge badge-${s.status}">${{ pending: '待审', approved: '已通过', rejected: '已驳回' }[s.status]}</span> ${{ product: '模型条目', series: '系列条目' }[s.kind]} · ${GW.esc(s.payload?.name ?? s.payload?.title ?? s.kind)} · ${new Date(s.created_at).toLocaleString('zh-CN')}</li>`).join('')
      : '<li class="empty">还没有投稿，登录后提交第一条吧。</li>';
  } catch (error) {
    list.innerHTML = `<li class="empty">${GW.esc(error.message)}</li>`;
  }
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const loginPanel = document.getElementById('login-panel');
  const editorPanel = document.getElementById('editor-panel');
  document.getElementById('login-link').href = GW.signInHref;
  document.getElementById('identity').textContent = GW.user
    ? `已登录：${GW.user.name || '未命名账号'} · 账号 ID ${GW.user.user_id}${GW.isAdmin ? '（管理员）' : ''}`
    : '当前为访客身份，投稿需要登录。';
  if (!GW.user) {
    loginPanel.hidden = false;
    editorPanel.hidden = true;
    return;
  }
  loginPanel.hidden = true;
  editorPanel.hidden = false;

  const queryKind = params.get('kind');
  const queryId = params.get('id');
  kindSelect.value = queryKind === 'series' ? 'series' : 'product';
  buildForm(kindSelect.value, null);

  if (queryId) {
    opSelect.value = 'update';
    try {
      const { entry } = await GW.request('entry', { query: { kind: queryKind, id: queryId } });
      current = entry;
      buildForm(kindSelect.value, entry);
      say(`正在编辑《${entry.name ?? entry.title ?? entry.slug}》，提交后进入待审队列。`);
    } catch (error) {
      say(error.message, 'bad');
    }
  }

  kindSelect.addEventListener('change', () => {
    current = null;
    buildForm(kindSelect.value, null);
  });
  opSelect.addEventListener('change', () => {
    if (opSelect.value === 'create') current = null;
    buildForm(kindSelect.value, current);
  });

  document.getElementById('submit-btn').addEventListener('click', async () => {
    const button = document.getElementById('submit-btn');
    button.disabled = true;
    say('正在提交…');
    try {
      const payload = readPayload(kindSelect.value);
      const result = await GW.request('submit', {
        method: 'POST',
        body: { kind: kindSelect.value, action: opSelect.value, target_id: opSelect.value === 'update' ? current?.id ?? null : null, payload },
      });
      say(`已提交，编号 ${result.submission.id.slice(0, 8)}，等待 AI 初审与管理员终审。`, 'good');
      await loadMySubmissions();
    } catch (error) {
      say(error.message, 'bad');
    } finally {
      button.disabled = false;
    }
  });

  await loadMySubmissions();
}

document.addEventListener('gw:ready', boot);
