/* 本地链路自检：投稿 → 审核 → 公开目录 → 快照。用 node dev/e2e-local.mjs */
const base = 'http://127.0.0.1:8000/functions/v1/app';
const call = async (action, { query = {}, method = 'GET', body, fixture = 'admin' } = {}) => {
  const params = new URLSearchParams({ action, ...query, fixture });
  const init = { method, headers: {} };
  if (body) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  const response = await fetch(`${base}?${params}`, init);
  const data = await response.json().catch(() => null);
  if (process.env.E2E_DEBUG) console.log(action, params.toString().slice(0, 60), '->', response.status, JSON.stringify(data)?.slice(0, 200));
  return { status: response.status, data };
};

const seed = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../dist/content/seed.json', import.meta.url), 'utf8'));
const results = [];
const check = (name, ok, detail) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const me = await call('me');
check('管理员识别', me.data?.isAdmin === true, JSON.stringify(me.data?.user?.name));

const imported = await call('import', { method: 'POST', body: { kind: 'product', items: seed.product } });
check('导入 8 条模型', imported.data?.imported === 8, JSON.stringify(imported.data));
await call('import', { method: 'POST', body: { kind: 'series', items: seed.series } });

const catalog = await call('catalog', { query: { kind: 'product' } });
check('公开目录可读', catalog.data?.items?.length === 8, `items=${catalog.data?.items?.length}`);

const anon = await call('submit', { fixture: 'anonymous', method: 'POST', body: { kind: 'product', action: 'create', payload: { code: 'P-900', name: '访客投稿' } } });
check('未登录投稿被拒 401', anon.status === 401, JSON.stringify(anon.data));

const bad = await call('submit', { fixture: 'A', method: 'POST', body: { kind: 'product', action: 'create', payload: { code: 'P-900', name: '外链图', image: 'https://evil.example/x.jpg' } } });
check('非法图片路径被拒 400', bad.status === 400, JSON.stringify(bad.data));

const ok = await call('submit', { fixture: 'A', method: 'POST', body: { kind: 'product', action: 'create', payload: { code: 'P-900', name: '牛高达 EW', series: 'IBO', grade: 'MG', price_value: 12000, price_text: '12,000日元', image: 'images/gundam-5.jpg', features: ['铁血孤儿系列', '新条目'] } } });
check('登录后投稿进入待审', ok.status === 201 && ok.data?.submission?.status === 'pending', JSON.stringify(ok.data?.submission));

const other = await call('submissions', { fixture: 'B', query: { status: 'pending' } });
check('他人看不到我的投稿', other.data?.items?.length === 0, `B sees ${other.data?.items?.length}`);

const queue = await call('submissions', { fixture: 'admin', query: { status: 'pending' } });
check('管理员看到待审队列', queue.data?.items?.length === 1, `pending=${queue.data?.items?.length}`);

const notAdmin = await call('review', { fixture: 'B', method: 'POST', body: { id: ok.data.submission.id, decision: 'approve' } });
check('非管理员批准被拒 403', notAdmin.status === 403, JSON.stringify(notAdmin.data));

const approve = await call('review', { fixture: 'admin', method: 'POST', body: { id: ok.data.submission.id, decision: 'approve' } });
check('批准成功', approve.data?.submission?.status === 'approved', JSON.stringify(approve.data));

const after = await call('catalog', { query: { kind: 'product' } });
check('批准条目进入公开目录', after.data?.items?.length === 9 && after.data.items.some((p) => p.code === 'P-900'), `items=${after.data?.items?.length}`);

const twice = await call('review', { fixture: 'admin', method: 'POST', body: { id: ok.data.submission.id, decision: 'approve' } });
check('重复审批被拒 409', twice.status === 409, JSON.stringify(twice.data));

const guest = await call('snapshot', { fixture: 'A' });
check('快照需管理员', guest.status === 403 || guest.status === 401, `snapshot as B -> ${guest.status}`);
const snap = await call('snapshot', { fixture: 'admin' });
check('快照含两类内容', snap.data?.product?.length === 9 && snap.data?.series?.length === 8, `product=${snap.data?.product?.length} series=${snap.data?.series?.length}`);

const missing = await call('unknown-endpoint');
check('未知动作返回 404', missing.status === 404, JSON.stringify(missing.data));

console.log(results.join('\n'));
console.log(results.some((r) => r.startsWith('FAIL')) ? '\n有失败项' : '\n全部通过');
