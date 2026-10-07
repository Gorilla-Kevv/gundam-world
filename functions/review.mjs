// AI 初审：把待审投稿交给 Qoder Cloud Agent 判断，返回中文意见与建议决定。
// 上游地址与凭据全部留在服务端；浏览器只拿到意见文本。
import { createCloudAgentsClient } from './cloud-agents.mjs';

// 由 sites.get_runtime_context 的 cloudAgents.apiOrigin 固定而来，不可按语言或站点域名推断。
const API_ORIGIN = 'https://api.qoder.com.cn/';
const SCOPE = { app: 'gundamworld', role: 'content-review' };
const AGENT_NAME = 'gundamworld-content-reviewer';
const ENVIRONMENT_NAME = 'gundamworld-review-env';

const SYSTEM = [
  '你是 GundamWorld（高达模型与系列作品资料站）的内容初审员。',
  '站点只收录与高达系列作品、机动战士设定、拼装模型（HG/RG/MG/PG/MR/MB 等）相关的资料。',
  '请判断投稿是否：1) 属于上述主题；2) 中文表述、字段完整、名称与编号自洽；3) 不含剧透式标题党、广告、辱骂、涉黄涉暴或违法内容；4) 图片字段是站内相对路径 images/... 而非外链。',
  '输出格式必须严格遵守：第一行只写 APPROVE、REJECT 或 MANUAL 三者之一；从第二行起用不超过 120 个中文字说明理由，指出需要修改的具体字段。',
  '拿不准、涉及版权争议或需要人工判断的，一律写 MANUAL。不要输出 JSON、Markdown 或额外前后缀。',
].join('\n');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function promptFor(item) {
  const fields = Object.entries(item.payload ?? {})
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(' | ') : String(value).slice(0, 400)}`)
    .join('\n');
  return [
    `投稿类型：${item.kind}（${item.action === 'update' ? '修改现有条目' : '新增条目'}）`,
    `投稿人昵称：${String(item.author_name ?? '').slice(0, 60) || '未填写'}`,
    '字段内容：',
    fields.slice(0, 6000),
  ].join('\n');
}

const textOf = (event) => (Array.isArray(event?.content) ? event.content : [])
  .filter((part) => part?.type === 'text' && typeof part.text === 'string')
  .map((part) => part.text)
  .join('');

function decide(raw) {
  const lines = String(raw).trim().split(/\r?\n/);
  const head = (lines[0] ?? '').toUpperCase();
  const suggestion = head.includes('REJECT') ? 'reject' : head.includes('APPROVE') ? 'approve' : 'manual';
  const opinion = lines.slice(1).join(' ').trim() || lines[0].trim();
  return { suggestion, opinion: opinion.slice(0, 900) };
}

async function ensureResource(client, kind, definition) {
  const matches = await client.findResources(kind, definition.metadata);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // 多实例并发首轮创建可能留下重复资源；按 ID 稳定取一个，多余的空闲资源不承载数据。
    return [...matches].sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  }
  return client.request(`/api/v1/cloud/${kind}`, {
    method: 'POST',
    body: definition,
    ...(kind === 'agents' ? { idempotencyKey: `gundamworld-review-${definition.metadata.role}` } : {}),
  });
}

async function pickModel(client, preferred) {
  const models = await client.request('/api/v1/cloud/models');
  const enabled = (models?.data ?? []).filter((m) => m?.enabled !== false && typeof m.id === 'string').map((m) => m.id);
  if (!enabled.length) throw new Error('ai_no_model');
  if (preferred && enabled.includes(preferred)) return preferred;
  return [...enabled].sort()[0];
}

export function createReviewer({ env = (name) => globalThis.Deno?.env.get(name), fetchImpl, budgetMs = 45000 } = {}) {
  const client = createCloudAgentsClient({ origin: API_ORIGIN, getToken: () => env('QODER_PAT'), fetchImpl });

  return {
    async review(item) {
      const environment = await ensureResource(client, 'environments', {
        name: ENVIRONMENT_NAME, config: { type: 'cloud' }, metadata: { ...SCOPE, kind: 'environment' },
      });
      const agent = await ensureResource(client, 'agents', {
        name: AGENT_NAME,
        model: await pickModel(client, env('AI_MODEL')),
        system: SYSTEM,
        tools: [],
        metadata: { ...SCOPE, kind: 'agent' },
      });
      const session = await client.request('/api/v1/cloud/sessions', {
        method: 'POST',
        body: { agent: { type: 'agent', id: agent.id, version: agent.version }, environment_id: environment.id },
      });
      await client.request(`/api/v1/cloud/sessions/${session.id}/events`, {
        method: 'POST',
        body: { events: [{ type: 'user.message', content: [{ type: 'text', text: promptFor(item) }] }] },
      });

      const deadline = Date.now() + budgetMs;
      const seen = new Set();
      const collected = [];
      while (Date.now() < deadline) {
        await sleep(2000);
        const history = await client.request(`/api/v1/cloud/sessions/${session.id}/events?order=asc&limit=100`);
        for (const event of history?.data ?? []) {
          if (!event?.id || seen.has(event.id)) continue;
          seen.add(event.id);
          if (event.type === 'agent.message') collected.push(textOf(event));
        }
        if (collected.join('').trim()) break;
      }
      if (!collected.join('').trim()) throw new Error('ai_review_timeout');
      return { ...decide(collected.join('\n')), session_id: session.id };
    },
  };
}
