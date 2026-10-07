// Content editing API for GundamWorld. Authorization is application-level:
// the platform injects the verified Qoder identity, and table grants are anonymous
// because the Function is the only path to the database.
import { getUser, UserContextError } from './auth.mjs';

const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

const TABLE = { series: 'series_entries', product: 'product_entries' };
const KINDS = Object.keys(TABLE);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PATH = /^images\/[^<>{}"'\\\r\n]{1,180}$/;
const HREF = /^(?:\.\/)?(?:info\/)?[\w\-./%() ]{1,180}\.html(?:\?[\w&=%.-]{0,60})?$/;

const FIELD = {
  series: {
    slug: { re: /^[a-z0-9][a-z0-9-]{1,63}$/, required: true },
    era: { max: 40, required: true },
    title: { max: 80, required: true },
    subtitle: { max: 120 },
    summary: { max: 1200 },
    image: { re: PATH },
    page_path: { re: HREF },
    sort_order: { int: [0, 9999] },
  },
  product: {
    code: { re: /^[A-Za-z][A-Za-z0-9._-]{1,63}$/, required: true },
    name: { max: 80, required: true },
    series: { max: 40 },
    grade: { max: 20 },
    scale: { max: 20 },
    price_text: { max: 40 },
    price_value: { int: [0, 10000000] },
    release_date: { max: 40 },
    image: { re: PATH },
    page_path: { re: HREF },
    detail: { max: 4000 },
    gallery: { list: { max: 8, item: { re: PATH } } },
    features: { list: { max: 24, item: { max: 200 } } },
  },
};

const fail = (code, status = 400) => {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
};

const clean = (value) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim() : value);

function validate(kind, input) {
  if (!input || typeof input !== 'object') fail('invalid_payload');
  const out = {};
  for (const [key, rule] of Object.entries(FIELD[kind])) {
    const value = clean(input[key]);
    if (value === undefined || value === null || value === '') {
      if (rule.required) fail(`missing_${key}`);
      continue;
    }
    if (rule.int) {
      const n = Number(value);
      if (!Number.isSafeInteger(n) || n < rule.int[0] || n > rule.int[1]) fail(`invalid_${key}`);
      out[key] = n;
    } else if (rule.list) {
      if (!Array.isArray(value) || value.length > rule.list.max) fail(`invalid_${key}`);
      const itemRule = rule.list.item;
      out[key] = value.map((item) => {
        const r = clean(item);
        if (typeof r !== 'string' || !r) fail(`invalid_${key}`);
        if (itemRule.re && !itemRule.re.test(r)) fail(`invalid_${key}`);
        if (itemRule.max && new TextEncoder().encode(r).length > itemRule.max) fail(`invalid_${key}`);
        return r;
      });
    } else {
      const text = String(value);
      if (rule.re && !rule.re.test(text)) fail(`invalid_${key}`);
      if (rule.max && new TextEncoder().encode(text).length > rule.max) fail(`invalid_${key}`);
      out[key] = text;
    }
  }
  if (!Object.keys(out).length) fail('empty_payload');
  return out;
}

const isAdmin = (userId) => {
  const list = (Deno.env.get('ADMIN_USER_IDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(userId);
};

async function body(request) {
  const declared = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isSafeInteger(declared) && (declared <= 0 || declared > 64 * 1024)) fail('body_too_large', 413);
  if (!request.headers.get('content-type')?.includes('application/json')) fail('invalid_content_type');
  const raw = await request.text();
  if (!raw.length || new TextEncoder().encode(raw).length > 64 * 1024) fail('body_too_large', 413);
  try {
    return JSON.parse(raw);
  } catch {
    fail('invalid_json');
  }
}

async function rows(supabase, table, select, where) {
  const { data, error } = await supabase.from(table).select(select).eq(where[0], where[1]).limit(200);
  if (error) fail('database_request_failed', 503);
  return data ?? [];
}

const SELECT = {
  series: 'id,slug,era,title,subtitle,summary,image,page_path,sort_order,updated_at',
  product: 'id,code,name,series,grade,scale,price_text,price_value,release_date,image,page_path,gallery,features,detail,updated_at',
};

async function upsertEntry(supabase, kind, id, values, now) {
  const table = TABLE[kind];
  const unique = kind === 'series' ? 'slug' : 'code';
  if (id) {
    const { data, error } = await supabase.from(table)
      .update({ ...values, updated_at: now }).eq('id', id).select('id').maybeSingle();
    if (error) fail('database_request_failed', 503);
    if (data) return data.id;
  }
  const existing = await rows(supabase, table, 'id', [unique, values[unique]]);
  const rowId = id ?? crypto.randomUUID();
  const { error: insertError } = await supabase.from(table).insert({ id: existing[0]?.id ?? rowId, ...values, created_at: now, updated_at: now });
  if (insertError) fail('database_request_failed', 503);
  return existing[0]?.id ?? rowId;
}

async function handle({ request, supabase }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const get = request.method === 'GET';
  if (!get && request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST' });

  if (action === 'catalog' && get) {
    const kind = url.searchParams.get('kind');
    if (!KINDS.includes(kind)) return json({ error: 'invalid_kind' }, 400);
    const rawOffset = url.searchParams.get('offset') ?? '0';
    if (!/^(0|[1-9][0-9]{0,4})$/.test(rawOffset)) return json({ error: 'invalid_offset' }, 400);
    const offset = Number(rawOffset);
    const order = kind === 'series' ? 'sort_order' : 'created_at';
    const { data, error } = await supabase.from(TABLE[kind]).select(SELECT[kind])
      .order(order, { ascending: kind === 'series' })
      .order('id', { ascending: true })
      .range(offset, offset + 20);
    if (error || !Array.isArray(data)) return json({ error: 'database_request_failed' }, 503);
    return json({ items: data.slice(0, 20), hasMore: data.length > 20, nextOffset: data.length > 20 ? offset + 20 : null });
  }

  let user = null;
  try {
    user = getUser(request);
  } catch (error) {
    if (error instanceof UserContextError) return json({ error: error.code }, error.status);
    throw error;
  }

  if (action === 'me') return json({ user, isAdmin: user ? isAdmin(user.user_id) : false, ok: true });

  if (action === 'submit' && !get) {
    if (!user) return json({ error: 'login_required' }, 401);
    const input = await body(request);
    const kind = input.kind, op = input.action;
    if (!KINDS.includes(kind) || !['create', 'update'].includes(op)) return json({ error: 'invalid_kind' }, 400);
    const targetId = input.target_id ?? null;
    if (targetId !== null && !UUID.test(String(targetId))) return json({ error: 'invalid_target_id' }, 400);
    const pending = await supabase.from('content_submissions')
      .select('id', { count: 'exact' }).eq('author_user_id', user.user_id).eq('status', 'pending').limit(1);
    if (pending.error) return json({ error: 'database_request_failed' }, 503);
    if ((pending.count ?? 0) >= 20) return json({ error: 'too_many_pending' }, 429);
    const payload = validate(kind, input.payload);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const created = await supabase.from('content_submissions').insert({
      id, kind, action: op, target_id: targetId, payload,
      author_user_id: user.user_id, author_name: user.name ?? '', status: 'pending', created_at: now,
    }).select('id,kind,action,status,created_at').maybeSingle();
    if (created.error || !created.data) return json({ error: 'database_request_failed' }, 503);
    return json({ submission: created.data, ok: true }, 201);
  }

  const admin = user ? isAdmin(user.user_id) : false;

  if (action === 'entry' && get) {
    if (!user) return json({ error: 'login_required' }, 401);
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');
    if (!KINDS.includes(kind) || !UUID.test(String(id ?? ''))) return json({ error: 'invalid_request' }, 400);
    const { data, error } = await supabase.from(TABLE[kind]).select(SELECT[kind]).eq('id', id).maybeSingle();
    if (error) return json({ error: 'database_request_failed' }, 503);
    if (!data) return json({ error: 'entry_not_found' }, 404);
    return json({ entry: data, ok: true });
  }

  if (action === 'submissions' && get) {
    if (!user) return json({ error: 'login_required' }, 401);
    const status = url.searchParams.get('status') ?? 'pending';
    if (!['pending', 'approved', 'rejected'].includes(status)) return json({ error: 'invalid_status' }, 400);
    let query = supabase.from('content_submissions')
      .select('id,kind,action,target_id,payload,author_user_id,author_name,status,ai_opinion,ai_suggestion,reviewed_by,reviewed_at,created_at')
      .eq('status', status).order('created_at', { ascending: false }).limit(50);
    if (!admin || url.searchParams.get('mine') === '1') query = query.eq('author_user_id', user.user_id);
    const { data, error } = await query;
    if (error) return json({ error: 'database_request_failed' }, 503);
    return json({ items: data ?? [], isAdmin: admin, ok: true });
  }

  if (action === 'review' && !get) {
    if (!user) return json({ error: 'login_required' }, 401);
    if (!admin) return json({ error: 'forbidden' }, 403);
    const input = await body(request);
    if (!UUID.test(String(input.id ?? ''))) return json({ error: 'invalid_id' }, 400);
    if (!['approve', 'reject'].includes(input.decision)) return json({ error: 'invalid_decision' }, 400);
    const found = await supabase.from('content_submissions')
      .select('id,kind,action,target_id,payload,status,author_user_id').eq('id', input.id).maybeSingle();
    if (found.error) return json({ error: 'database_request_failed' }, 503);
    if (!found.data) return json({ error: 'submission_not_found' }, 404);
    if (found.data.status !== 'pending') return json({ error: 'already_reviewed' }, 409);
    const now = new Date().toISOString();
    const patch = { status: input.decision === 'approve' ? 'approved' : 'rejected', reviewed_by: user.user_id, reviewed_at: now };
    if (input.decision === 'approve') {
      const payload = validate(found.data.kind, found.data.payload);
      await upsertEntry(supabase, found.data.kind, found.data.action === 'update' ? found.data.target_id : null, payload, now);
    }
    const updated = await supabase.from('content_submissions').update(patch).eq('id', input.id).eq('status', 'pending')
      .select('id,status,reviewed_at').maybeSingle();
    if (updated.error || !updated.data) return json({ error: 'database_request_failed' }, 503);
    return json({ submission: updated.data, ok: true });
  }

  if (action === 'import' && !get) {
    if (!user) return json({ error: 'login_required' }, 401);
    if (!admin) return json({ error: 'forbidden' }, 403);
    const input = await body(request);
    if (!KINDS.includes(input.kind) || !Array.isArray(input.items) || input.items.length > 200) return json({ error: 'invalid_import' }, 400);
    const now = new Date().toISOString();
    const imported = [];
    for (const item of input.items) imported.push(await upsertEntry(supabase, input.kind, item.id ?? null, validate(input.kind, item), now));
    return json({ imported: imported.length, ok: true });
  }

  if (action === 'snapshot' && get) {
    if (!user) return json({ error: 'login_required' }, 401);
    if (!admin) return json({ error: 'forbidden' }, 403);
    const out = { exported_at: new Date().toISOString(), series: [], product: [] };
    for (const kind of KINDS) {
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase.from(TABLE[kind]).select(SELECT[kind]).order('id', { ascending: true }).range(offset, offset + 100);
        if (error) return json({ error: 'database_request_failed' }, 503);
        out[kind].push(...(data ?? []));
        if (!data || data.length < 100) break;
        offset += 100;
      }
    }
    return json({ ...out, ok: true });
  }

  return json({ error: 'not_found' }, 404);
}

export async function handleSite(args) {
  try {
    return await handle(args);
  } catch (error) {
    if (error instanceof UserContextError) return json({ error: error.code }, error.status);
    const status = Number.isInteger(error.status) ? error.status : 500;
    return json({ error: typeof error.code === 'string' ? error.code : 'internal_error' }, status);
  }
}
