# PROGRESS

## 阶段 0 — 基线与文档（已完成）
- 已完成：项目 git init + 首个提交 `0725bca`（原始 60MB 素材固化）；`HANDOFF.md`、`.gitignore`（忽略 dist/、node_modules/、*.qoder.site）
- 改动文件：`HANDOFF.md`、`.gitignore`、`scripts/asset-report.mjs`、`scripts/build-dist.mjs`、`index.html`（修坏链 `shin-gundam.jpEg` → `shin-gundam.jpeg`）
- 结果：ffmpeg-static 装在 `C:\Users\kevin\.cache\ffmpeg-tool`（82.8MB，可用）
- 风险：无

## 阶段 1 — 发布静态站点（已完成）
- 已完成：
  - `node scripts/build-dist.mjs` 生成 `dist/`：14.79 MB（原 60 MB）。两个背景视频转码为 1280 宽 / 30fps / CRF23 副本（hero-bg 1.97MB、uc/wallpaper 1.69MB），原始视频未改动；大图 JPEG>500KB 重压、PNG>900KB 缩放；3 个未引用图片不进包
  - 本地预览 `python -m http.server 4173 --directory dist`：`/`、`/css/style.css`、`/info/uc-info.html`、`/images/hero-bg.mp4` 均 200
  - 云端：站点已发布，`published: true`，产物 14,576,689 B，部署目录 152 个文件
- 站点信息（后续阶段复用，勿新建站点）：
  - projectId `01a107ef-1839-7e9a-888e-e5e2da6d2bc7`
  - siteId `01a107ef-183b-700b-829f-1dadd387b783`
  - host `gundam-world-6tnvyphezee.qoder.zone`
  - 当前 `access_mode: private`、actionId `61a36897-1760-4032-a9dc-55744dcb153f`、releaseId `01a107f0-b316-75fa-8fef-3486c8c41e21`
- 未做/待办：浏览器视觉走查（用户未要求）；`dist.prev-1791134421206` 临时目录待回收
- 下一阶段入口：见下

## 阶段 2 — Supabase 后端 + 投稿编辑器（未开始）
必须先确认的三件事：
1. **公开访问**：现在是私有站点，公网用户进不来。改访问范围需要用户单独授权 → 下一步先问。
2. **投稿写权限的隔离边界**：平台登录态不会变成 Supabase `auth.uid()`，Function 只能用 anon key 写 `content_submissions`。方案是「匿名 select/insert 策略 + Function 内用 `requireUser` 强制登录并校验字段」。这属于文档要求的「有限功能测试」范围，需用户明确接受该边界后再建迁移。
3. **管理员身份判定**：拟用应用 Secret `ADMIN_USER_IDS`（Sites Settings 里填值），值 = 站点所有者的 Qoder `user_id`，可在发布后用浏览器访问 `/__qoder_auth/me` 取得。

计划落地：
- `ensure_backend`（database + functions，用户已授权这条路线）
- 迁移 v1 三张表：`app.series_entries`、`app.product_entries`、`app.content_submissions`（仅用支持的类型：uuid/text/integer/timestamptz/jsonb，无 DEFAULT/CHECK/FK；索引普通列）
- `functions/`（index.ts + adapter.mjs + handler.mjs + auth.mjs），动作：`list`、`submission.create`、`submission.list`、`submission.review`
- 前端：`editor.html`（编辑器：系列条目 / 模型条目两种表单 + 预览）、公开页 `products.html` 与首页系列卡改为读已发布数据（失败回退静态内容）、导航按登录态显示「编辑」入口、`admin.html` 审核台
- `prepare_site` 带 `functionDirectory: "functions"`、`databaseAccess: "read_write"`、`requiredSchemaVersion: <实际版本>`、`secretNames: ["ADMIN_USER_IDS"]`

## 阶段 3 — AI 管理员审核 + 回写仓库（未开始）
- 按 `sites-build-agent-app` 接入 Qoder Cloud Agents（`qoder` backend，平台注入 `QODER_PAT`，不进 secretNames）
- 审核页对每条待审投稿调用 Agent 生成意见（相关性/事实性/是否跑题/风险），建议 approve/reject，管理员点批准才落库
- 批准后：Function 生成快照 → 管理页可下载 `content/approved.json`；本地脚本 `scripts/sync-content.mjs` 拉取并写入仓库 `content/`，再由我提交 git（推送需用户确认）
