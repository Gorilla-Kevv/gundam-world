/* 审核台：待审队列、批准/驳回、种子导入与已批准内容导出 */
const LABELS = {
  code: '商品编号', name: '商品名称', series: '系列', grade: '等级', scale: '比例',
  price_text: '价格', price_value: '价格数值', release_date: '发售', image: '主图',
  page_path: '详情页', gallery: '图集', features: '标签', detail: '说明',
  slug: '标识', era: '纪元', title: '作品名', subtitle: '简介标题', summary: '内容简介', sort_order: '排序',
};

const queue = document.getElementById('queue');
const toolStatus = document.getElementById('tool-status');

function fieldRows(payload) {
  return Object.entries(payload ?? {}).map(([key, value]) => {
    const shown = Array.isArray(value) ? value.join('、') : String(value);
    return `<div><span>${GW.esc(LABELS[key] ?? key)}</span><span>${GW.esc(shown.length > 200 ? shown.slice(0, 200) + '…' : shown)}</span></div>`;
  }).join('');
}

function cardHtml(item) {
  const kindName = item.kind === 'product' ? '模型条目' : '系列条目';
  const actionName = item.action === 'update' ? `修改 ${String(item.target_id ?? '').slice(0, 8)}` : '新增';
  const image = item.payload?.image && /^images\//.test(item.payload.image)
    ? `<div class="review-preview"><img src="${GW.esc(item.payload.image)}" alt=""></div>` : '';
  return `<article class="review-card" data-id="${GW.esc(item.id)}">
    <header>
      <b>${GW.esc(item.payload?.name ?? item.payload?.title ?? item.payload?.code ?? item.payload?.slug ?? kindName)}</b>
      <span class="badge badge-${item.status}">${{ pending: '待审', approved: '已通过', rejected: '已驳回' }[item.status]}</span>
      <span class="meta">${kindName} · ${actionName} · ${GW.esc(item.author_name || item.author_user_id.slice(0, 8))} · ${new Date(item.created_at).toLocaleString('zh-CN')}</span>
    </header>
    ${item.ai_opinion ? `<div class="ai-opinion"><b>AI 初审：</b>${GW.esc(item.ai_opinion)}（建议 ${{ approve: '通过', reject: '驳回', manual: '人工判断' }[item.ai_suggestion] ?? item.ai_suggestion ?? '—'}）</div>` : ''}
    <div class="review-fields">${fieldRows(item.payload)}</div>
    ${image}
    ${item.status === 'pending' ? `<div class="review-buttons">
      <button type="button" class="approve">批准并发布</button>
      <button type="button" class="reject">驳回</button>
    </div>` : `<div class="meta">处理人 ${GW.esc(item.reviewed_by ? String(item.reviewed_by).slice(0, 8) : '—')} · ${item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('zh-CN') : ''}</div>`}
  </article>`;
}

async function loadQueue() {
  queue.textContent = '正在读取队列…';
  try {
    const { items } = await GW.request('submissions', { query: { status: document.getElementById('status').value } });
    if (!items.length) {
      queue.innerHTML = '<p class="studio-hint">这个队列是空的。</p>';
      return;
    }
    queue.innerHTML = items.map(cardHtml).join('');
    queue.querySelectorAll('.review-buttons button').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('.review-card');
        const decision = button.classList.contains('approve') ? 'approve' : 'reject';
        button.disabled = true;
        try {
          await GW.request('review', { method: 'POST', body: { id: card.dataset.id, decision } });
          await loadQueue();
        } catch (error) {
          button.disabled = false;
          button.closest('.review-buttons').insertAdjacentHTML('afterend', `<p class="studio-status bad">${GW.esc(error.message)}</p>`);
        }
      });
    });
  } catch (error) {
    queue.innerHTML = `<p class="studio-status bad">${GW.esc(error.message)}</p>`;
  }
}

function say(message, tone = '') {
  toolStatus.textContent = message;
  toolStatus.className = `studio-status ${tone}`;
}

async function importSeed() {
  say('正在读取 content/seed.json…');
  try {
    const response = await fetch('content/seed.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`种子文件读取失败（HTTP ${response.status}）。`);
    const seed = await response.json();
    const parts = [];
    for (const kind of ['product', 'series']) {
      if (!seed[kind]?.length) continue;
      const result = await GW.request('import', { method: 'POST', body: { kind, items: seed[kind] } });
      parts.push(`${kind === 'product' ? '模型' : '系列'} ${result.imported} 条`);
    }
    say(`已写入公开目录：${parts.join('，')}。`, 'good');
  } catch (error) {
    say(error.message, 'bad');
  }
}

async function downloadSnapshot() {
  say('正在导出已批准内容…');
  try {
    const data = await GW.request('snapshot');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'approved.json';
    link.click();
    URL.revokeObjectURL(url);
    say(`已导出 ${data.product.length} 条模型、${data.series.length} 条系列。`, 'good');
  } catch (error) {
    say(error.message, 'bad');
  }
}

function boot() {
  document.getElementById('login-link').href = GW.signInHref;
  const denied = document.getElementById('denied');
  if (!GW.user) {
    document.getElementById('identity').textContent = '未登录。';
    denied.hidden = false;
    return;
  }
  document.getElementById('identity').textContent = `已登录：${GW.user.name || GW.user.user_id}`;
  if (!GW.isAdmin) {
    document.getElementById('denied-why').textContent = `${GW.user.name || '该账号'} 不是管理员，只能在自己的投稿页查看进度。`;
    denied.hidden = false;
    return;
  }
  document.getElementById('queue-panel').hidden = false;
  document.getElementById('tools-panel').hidden = false;
  document.getElementById('status').addEventListener('change', loadQueue);
  document.getElementById('refresh').addEventListener('click', loadQueue);
  document.getElementById('seed-btn').addEventListener('click', importSeed);
  document.getElementById('snapshot-btn').addEventListener('click', downloadSnapshot);
  loadQueue();
}

document.addEventListener('gw:ready', boot);
