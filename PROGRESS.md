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

## 待用户操作（阻塞阶段 2 收尾）
1. 打开 `https://gundam-world-6tnvyphezee.qoder.zone/editor.html` → 点「Qoder 登录」→ 页面顶部会显示「账号 ID …」，把那串 ID 发我
2. 在 Qoder 站点设置里新建应用密钥 `ADMIN_USER_IDS`，值填上面那串 ID
3. 我随后发布声明该密钥的版本，你在 `admin.html` 点「导入仓库种子数据」，公开目录即切到数据库内容

## 阶段 2B — 站内 AI 管理员审核（未开始）
- 用 `sites-build-agent-app`（`qoder` backend，平台注入 `QODER_PAT`，不进 secretNames）
- Function 增加 `ai-review` 动作：对单条待审投稿生成意见写入 `content_submissions.ai_opinion/ai_suggestion`，`admin.js` 已预留展示位（`.ai-opinion` 区块）
- 批准后同步回仓库：`admin.html` 的「导出已批准内容」产出 `approved.json` → 放入仓库 `content/approved.json` → 我提交 git（推送前需你确认）

## 关键 ID（复用，勿新建站点）
- projectRoot `F:\大学文件\大一\web期末大作留档\GundamWorld`，webDirectory `dist`，functionDirectory `functions`
- projectId `01a107ef-1839-7e9a-888e-e5e2da6d2bc7` / siteId `01a107ef-183b-700b-829f-1dadd387b783`
- host `gundam-world-6tnvyphezee.qoder.zone`，requiredSchemaVersion 1
