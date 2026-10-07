/* 本地 Function 台架：内存表 + 真实身份解析路径，用于在发布前跑通投稿→审核→目录链路。
   用法：node dev/function-local.mjs [port] */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { handleSite } from '../functions/handler.mjs';

const port = Number(process.argv[2] ?? 8000);
const ADMIN = 'fixture-admin-00000000-0000-4000-8000-0000000000ad';
globalThis.Deno = { env: { get: (name) => (name === 'ADMIN_USER_IDS' ? ADMIN : '') } };

const tables = { series_entries: [], product_entries: [], content_submissions: [] };
const clone = (row) => structuredClone(row);
const matches = (row, filters) => filters.every(([k, v]) => String(row[k]) === String(v));

function builder(table) {
  const state = { filters: [], order: [], range: null, limit: null, count: false, single: false, op: 'select', patch: null, cols: '*' };
  const q = {
    select(cols, opts) { state.cols = cols; state.count = !!opts?.count; return q; },
    eq(k, v) { state.filters.push([k, v]); return q; },
    order() { return q; },
    range(a, b) { state.range = [a, b]; return q; },
    limit(n) { state.limit = n; return q; },
    maybeSingle() { state.single = true; return q; },
    insert(row) { state.op = 'insert'; state.patch = row; return q; },
    update(patch) { state.op = 'update'; state.patch = patch; return q; },
    async then(resolve, reject) {
      try {
        const rows = tables[table].filter((r) => matches(r, state.filters));
        if (state.op === 'insert') {
          tables[table].push(clone(state.patch));
          const after = state.single ? [clone(state.patch)] : [];
          return resolve({ data: state.single ? after[0] : null, error: null });
        }
        if (state.op === 'update') {
          for (const row of rows) Object.assign(row, clone(state.patch));
          return resolve({ data: state.single ? (rows[0] ? clone(rows[0]) : null) : null, error: null });
        }
        if (state.count) return resolve({ data: rows.slice(0, state.limit ?? rows.length), count: rows.length, error: null });
        let out = rows.map((row) => {
          const cols = state.cols.split(',').map((c) => c.trim());
          return Object.fromEntries(cols.map((c) => [c, clone(row[c])]));
        });
        if (state.range) out = out.slice(state.range[0], state.range[1] + 1);
        if (state.limit) out = out.slice(0, state.limit);
        return resolve({ data: state.single ? out[0] ?? null : out, error: null });
      } catch (error) {
        return reject(error);
      }
    },
  };
  return q;
}

const supabase = { from: (table) => (tables[table] ? builder(table) : { select: () => ({ then: (r) => r({ data: null, error: new Error('no table') }) }) }) };

const b64url = (json) => Buffer.from(JSON.stringify(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const identities = {
  admin: { user_id: ADMIN, name: '管理员·测试', picture: '', site_id: 's', host_id: 'h', session_expires_at: Math.floor(Date.now() / 1000) + 3600 },
  A: { user_id: 'user-a-00000000-0000-4000-8000-00000000000a', name: '投稿者A', picture: '', site_id: 's', host_id: 'h', session_expires_at: Math.floor(Date.now() / 1000) + 3600 },
  B: { user_id: 'user-b-00000000-0000-4000-8000-00000000000b', name: '投稿者B', picture: '', site_id: 's', host_id: 'h', session_expires_at: Math.floor(Date.now() / 1000) + 3600 },
};

const dist = join(process.cwd(), 'dist');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith('/functions/v1/app')) {
    const fixture = url.searchParams.get('fixture') ?? 'admin';
    const headers = new Headers({ 'content-type': req.headers['content-type'] ?? 'application/json' });
    const identity = identities[fixture];
    if (identity) headers.set('x-qoder-user-context', b64url(identity));
    let raw;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      raw = Buffer.concat(chunks);
    }
    const request = new Request(`http://127.0.0.1${url.pathname}${url.search}`, {
      method: req.method, headers, body: raw,
    });
    const response = await handleSite({ request, supabase });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const file = join(dist, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file) || !extname(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`local fixture preview: http://127.0.0.1:${port}/  (identity via ?fixture=admin|A|B)`);
});
