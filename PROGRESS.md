# PROGRESS

## 阶段 0 — 基线与文档（已完成）
- git 仓库已建，首提交 `0725bca`；`.gitignore` 忽略 `dist/`、`dist.prev-*/`、`node_modules/`、`*.qoder.site`
- 远端：`https://github.com/Gorilla-Kevv/gundam-world`（公开仓库，用户指定）
- 修坏链：`index.html` 的 `images/shin-gundam.jpEg` → `shin-gundam.jpeg`

## 阶段 1 — 静态站点发布（已完成）
- `scripts/build-dist.mjs`：`dist/` 14.6MB（源 60MB）。两个背景视频转码为 1280 宽/30fps/CRF23 副本（hero-bg 1.97MB、uc/wallpaper 1.69MB），原素材不动；JPEG>500KB 重压、PNG>900KB 缩放；3 个未引用图片不入包
- 已发布并验证 `published: true`

## 阶段 2A — Supabase 后端 + 投稿编辑器（已发布，待管理员配置）
- 后端：`ensure_backend` → database + functions + storage，`get_backend` status ready
- 迁移 v1 已应用（schema_version 1，脚本存档 `scripts/migrations/001_content_tables.sql`）：
  `app.series_entries`、`app.product_entries`、`app.content_submissions` + 2 个索引；
  三张表策略均为 anonymous `select/insert/update`（public 模板，不给 delete），登录与字段校验在 Function 内做
  —— 用户已明确接受该「有限功能测试」边界（表内容是面向公众的高达资料，非隐私数据）
- `functions/`：`index.ts` + 平台 `adapter.mjs` + `auth.mjs` + 自写 `handler.mjs`
  动作：`catalog` `me` `entry` `submit` `submissions` `review` `import` `snapshot`
  管理员判定：`ADMIN_USER_IDS` Secret（逗号分隔 Qoder user_id），未配置时无人是管理员
- 前端：`js/site.js`（登录态导航 + 目录改由数据库渲染，失败回退页面内置内容）、
  `editor.html`/`js/editor.js`（两种条目表单 + 我的投稿）、`admin.html`/`js/admin.js`（审核队列 + 批准/驳回 + 种子导入 + 导出 approved.json）、`css/studio.css`
  公开页 `index.html`（`data-gw-catalog="series"`）与 `products.html`（`data-gw-catalog="product"`）已接上，`js/products.js` 改为你事件后重新取卡片
- 种子：`scripts/make-seed.mjs` → `content/seed.json`（8 条模型 + 8 条系列，内容与现有页面一致）
- 本地验证：`dev/function-local.mjs`（内存表 + 真实身份解析）+ `dev/e2e-local.mjs` → 15 项全通过
  （含未登录 401、非法图片路径 400、他人投稿不可见、非管理员 403、批准后进入公开目录、重复审批 409、快照鉴权、未知动作 404）
- 线上验证（已发布 release `01a114d4-c85a-79f1-91f5-974b45e99254`，runtime_version 9，站点 access_mode public）：
  - 通过：`/functions/v1/app?action=catalog` 200 空列表（说明 Function 与 Supabase 运行时已通）
  - 通过：`?action=me` 200 `{user:null,isAdmin:false}`；未知 action 404；`/editor.html`、`/admin.html`、`/content/seed.json`、`/js/site.js` 200
  - 未通过/未覆盖：curl 写请求被网关以 `sites_gateway_origin_forbidden` 拒绝（非同源），所以真实投稿写入、审核、批准尚未在线上跑过，需要浏览器里带 Qoder 登录态实测
- 踩过的坑：
  - `prepare_site` 声明 `secretNames` 但 Settings 里还没有值 → 发布报 `sites_secret_not_ready`。改成先不声明 Secret 发布，等值填好后再发带声明的版本
  - Function 上线后 Supabase 运行时不会立刻 ready（曾持续 409 `sites_gateway_supabase_not_ready`），重新 prepare+publish 一个新 release 后恢复
  - 构建脚本曾把 `dist.prev-*` 的副本扫进新包（1240 个 html），已用 `SKIP_DIR` 修正

## 阶段 2B — 站内 AI 管理员审核（代码完成，待发布验证）
- 用户已确认开启 Qoder 后端并自动创建 PAT：`ensure_backend(["qoder"])` 操作 `01a114e5-1615-73ea-97d4-f88c53e04412` 成功
- `functions/cloud-agents.mjs`（平台自带客户端）+ 自写 `functions/review.mjs`：固定服务端 Agent/Environment（按 metadata `app=gundamworld,role=content-review` 复用），每次审核新建 Session、发提示词、轮询 events 取回复
- 模型选择：`GET /api/v1/cloud/models` 取 enabled 列表，可用 `AI_MODEL` 指定，否则按 ID 排序取第一个（创建后 Agent version 固定）
- 输出契约：回复首行 APPROVE/REJECT/MANUAL → `ai_suggestion`，其余文本 → `ai_opinion`（截断 900 字）
- `handler.mjs` 增加 `ai-review`（仅管理员、仅 pending）；`admin.js` 每条待审卡片加「AI 初审」按钮，意见就地显示
- 上游地址 `https://api.qoder.com.cn/` 取自 `get_runtime_context`，写死在服务端；QODER_PAT 只在 Function 内读，不进 secretNames、不进浏览器
- 本地：`dev/function-local.mjs` 注入无凭据初审替身，`dev/e2e-local.mjs` 18 项全通过（含非管理员 403、意见落库、队列可见）
- 已知偏差（需如实告知）：未实现平台文档建议的 `coordinator.withLock` 持久化租约；并发首次创建可能残留多余的空闲 Environment 资源，代码按 ID 稳定选一个复用，这些资源不承载数据
- 真实上游调用尚未验证（需要带管理员身份的浏览器请求），线上发布后跑一次代表性审核

## 待用户操作（阻塞收尾）
1. Qoder 右侧站点预览卡片 → 站点设置 → 密钥（Secrets）→ 新建 `ADMIN_USER_IDS`，值 `01a102f8-1b50-70e7-aa78-f67efac71c65`，等同步成功
2. 回我一句「填好了」，我发布同时声明该密钥的最终版本（AI 初审 + 管理员一次性上线）
3. 然后你在 `admin.html` 点「导入仓库种子数据」，公开目录切到数据库内容；再用 `editor.html` 提一条测试投稿，回审核台点「AI 初审」→ 批准，我用「导出已批准内容」的 `approved.json` 回写仓库 `content/approved.json` 并提交 git（推送前再确认）

## 批准后同步回仓库（未开始，等第 3 步）
- `admin.html` 的「导出已批准内容」→ `approved.json`（含 series/product 全量已发布行）
- 落地方式：文件放进仓库 `content/approved.json` → 我 `git add/commit`，推送前请你确认


## 关键 ID（复用，勿新建站点）
- projectRoot `F:\大学文件\大一\web期末大作留档\GundamWorld`，webDirectory `dist`，functionDirectory `functions`
- projectId `01a107ef-1839-7e9a-888e-e5e2da6d2bc7` / siteId `01a107ef-183b-700b-829f-1dadd387b783`
- host `gundam-world-6tnvyphezee.qoder.zone`，requiredSchemaVersion 1
