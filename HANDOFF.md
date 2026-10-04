# HANDOFF

## 项目
- 路径：`F:\大学文件\大一\web期末大作留档\GundamWorld`
- 技术栈：纯静态多页站点（HTML + CSS + 原生 JS），无构建系统，Node 24 仅用于本地脚本
- 页面：`index.html`（首页）、`products.html` / `detail.html`（模型目录）、`news.html` / `information.html` / `news-news.html` / `diyTECH.html`（资讯）、`info/*-info.html`（8 个纪元系列详情）、`login.html` / `register.html`（当前是假登录，`js/auth.js` 只 alert）
- 数据现状：内容全部硬编码在 HTML 里；`js/products.js`、`js/news.js` 只是筛选/轮播等 DOM 行为
- 站点体积：60 MB，其中 `images/uc/wallpaper.mp4` 27.4 MB + `images/hero-bg.mp4` 14.9 MB

## 目标
- 重构目标：
  1. 发布为 Qoder Site（静态基线）
  2. 公网用户登录后可编辑/扩充「系列作品条目」和「产品/模型目录」，投稿进 Supabase 暂存表
  3. 站内 AI 管理员审核页：AI 给出审核意见，管理员批准/驳回
  4. 批准后内容同步回仓库（`content/*.json` + git 提交）
- 非目标：不改视觉风格、不做资讯文章编辑、不做整页文案 diff 编辑、不做评论/社区功能

## 结构
- 关键目录：`dist/`（webDirectory，部署产物，含压缩视频副本）、`functions/`（app Edge Function）、`scripts/`（本地构建脚本）、`content/`（已批准内容的仓库副本）
- 入口文件：`index.html`
- 核心接口：浏览器同源 `/functions/v1/app?action=...`
- 数据模型（Supabase）：
  - `series_entries`（已发布系列作品：id, slug, era, title, subtitle, summary, image, page_path, updated_at）
  - `product_entries`（已发布模型条目：id, code, name, series, grade, price, image, detail, updated_at）
  - `content_submissions`（投稿暂存：id, kind, target_id, payload jsonb, author_user_id, author_name, status[pending|ai_reviewed|approved|rejected], ai_opinion, ai_suggestion, reviewed_by, reviewed_at, created_at）

## 决策与坑
- 已做决策：
  - Qoder Sites 的后端本身就是 Supabase（平台注入 `SUPABASE_*`，Function 侧用捆绑 adapter），不需要用户自备 Supabase 项目
  - 视频不删除，用 ffmpeg 转码压缩后放 `dist/`，原始素材保留
  - 身份用 Qoder 登录上下文（`x-qoder-user-context`，`requireUser`），不用 Supabase Auth
  - 回写仓库：项目已 git init，批准内容由 Function 落到 `content/approved.json` 下载 + 本地脚本写回仓库
- 已知坑：
  - 部署产物硬上限 50 MB，单文件 50 MB，`web` 原始内容 450 MB；不压视频必然失败
  - Function 用 anon key 访问数据库，平台登录态不会变成 Supabase `auth.uid()`；所以投稿写权限靠 Function 内的应用层鉴权，策略要按「公开可读 + Function 写入」设计，不要放开匿名公开 CRUD
  - 发布预览（Canvas）不执行 Function，后端行为必须在已发布站点上验证
  - `images/shin-gundam.jpEg` 是坏链（真实文件为 `shin-gundam.jpeg`）；`turn A.png` 文件名带空格
  - 未引用素材：`images/gundam-1.png`、`images/gundan-3.jpg`、`images/gundam-2-2.jpeg`（不打进 dist）
  - ffmpeg 不在系统 PATH，装在 `C:\Users\kevin\.cache\ffmpeg-tool\node_modules\ffmpeg-static\ffmpeg.exe`

## 命令
- 素材分析：`node scripts/asset-report.mjs .`
- 构建 dist：`node scripts/build-dist.mjs`
- 本地预览：`python -m http.server 4173 --bind 127.0.0.1 --directory dist`（或 `node scripts/serve.mjs`）
- Function 本地检查：`deno check functions/index.ts`（未装 Deno 时跳过，需说明未验证）
- git：`git add -A && git commit`

## 状态
- 当前状态：阶段 0（git 基线 + 本文档）；站点尚未发布，后端尚未开通
- 验收标准：
  - 阶段 1：站点可通过公网地址访问，首页/目录/资讯/系列页正常，视频可播放，dist ≤ 30 MB
  - 阶段 2：未登录看不到编辑入口；登录后能改条目并提交，投稿进入 pending
  - 阶段 3：管理页能看到待审投稿 + AI 意见；批准后公开页显示新内容，`content/approved.json` 可取回
- 下一步：读 `PROGRESS.md`，执行阶段 1（`scripts/build-dist.mjs` → `prepare_site` → `publish_site`）
