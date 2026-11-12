# SheepIt Plus · ROADMAP

> 基线日期 2026-11-12。发布形态锁定油猴脚本（`@grant none`，`src/00-meta.js`）——本文件不提换框架、拆服务、上构建链。
> 只读取证：`node build.mjs --check`、`git log --oneline -20`、`.notes/PRODUCT.md`、`docs/REWRITE-0.2.0.md`、`docs/CLEANUP-AUDIT.md`、`docs/PUBLISHING.md`。DESIGN.md 未读（视觉方向已拍板）。

## 基线

| 项 | 事实 | 依据 |
|---|---|---|
| 线上版本 | 0.2.4；仓库 HEAD `0e1e733` 未发布 | `docs/PUBLISHING.md:570`；`git log -1` |
| 产物 | 517,077 字节（505.0 KiB），注释 115,966 = 22.4%；超 440,000 提示线 77,077 | `node build.mjs --check` |
| 源码 | 13 个模块共 516,570 字节 | `src/*.js` 合计 |
| 文档 | 394,983 字节 = 源码的 76.4% | `docs/` 合计 |
| 接管面 | 12 条路径模式 → 8 个视图 | `src/80-app.js:27-49` |
| 最近 20 条提交 | 0.2.2 / 0.2.3 / 0.2.4 三次发布 + 1 次未发布的模式切换 | `git log --oneline -20` |

## 1. 缺口（按用户任务列）

| 用户任务 | 站点原版怎么做 | 我们做了什么 | 差在哪 | 掉回原版界面的触发点 |
|---|---|---|---|---|
| 看懂自己的贡献 | `/home` 仪表盘：统计卡 + 已废弃的 `google.com/jsapi` 曲线 + 二值日历（PRODUCT.md:26） | 接管 `/home` 与 `/user/*/profile`：统计、积分/帧数曲线、活跃日历、在线机器、近 30 天概览；派生指标与站点 `dl` 的 897 一致（PRODUCT.md:122-125） | 站点首页 4 张统计卡在原站可点进 `/home/frames`、`/home/machines`；我们只重绘卡片，没有这两个深挖页 | 手输或收藏 `/home/frames`、`/home/machines`；`viewForPath` 对它们返回 null（`80-app.js:48`） |
| 浏览、筛选、比较项目 | `/home/projects` 6 列表格挤在 620px（PRODUCT.md:26） | 项目表 21 行、搜索/筛选/排序（`50-views.js` 的 `P_SORTS`/`M_SORTS`）、发布者与头像 21/21 | 项目页整页自绘未做：站点原页 DOM 与 JS 仍在，我们在上面盖一层（REWRITE §10.5）；「我的项目」只在主页，别人的主页没有项目 id（REWRITE §9.3） | 项目不存在或无权查看 → `release()` 还回站点 Forbidden 页（`80-app.js:1538`） |
| 在排行榜定位自己 | `/ranking/user` 500 行 | 500 行全量、原始精度积分、头像 500/500；可在设置里隐藏（0.2.3） | 机器算力榜 `/ranking/machine` 未接管（`12-lang-zh.js:347` 里有这个链接） | 手输 `/ranking/machine`，或从原版 FAQ 页点进去 |
| 上传新项目 | `/getstarted` 三步表单 + `/project/add/<token>` 等待页 | 三档 off/raw/new（默认 new，`80-app.js:21`）；自绘三步、提交 28 键、第三步 4 形态、估算器（`62-chain.js`/`64-step1.js`/`68-step3.js`） | 维护中/无头像/并发上限三支真站触发不了，只有桩验；估算器「推荐这么切」取色未验（PUBLISHING:614、651） | off/raw 档下 `/getstarted` 返回 null（`80-app.js:43`）；站点改版认不出控件时交回站点 |
| 管理自己的项目 | `/project/<id>` 的 manage 页（`manage.html.twig` 343 行；动作文案在 `title`） | 自绘操作区：计算方式 / 生成 MP4 / 公开渲染 / 删除；发布者格「优先 / 移出」；3 点菜单（REWRITE §10.1） | 叠加式接管：站点原页的 LazyLoad / masonry 等 JS 照旧跑（REWRITE §10.5） | 页面上没有 `#jobs_of_a_project` → `release()`（`80-app.js:1538`） |
| 看会话 / 机器 | `/session/<id>` 761 条事件默认铺约 5000px | 机器档案 20 项、事件按天汇总折叠到 1635px、暂停/恢复做过真实往返（PRODUCT.md:128-135） | 别人的会话页站点只给 404，读不到数据（PUBLISHING:540） | 打开别人的 `/session/<id>` → 站点 404 页 |
| 改账户设置 | `/user/<me>/edit` | 调度开关、渲染优先级、捐赠积分、两组黑名单、邮箱、头像、渲染密钥；写操作打站点自己的端点（PRODUCT.md:57） | 只接管自己的 edit，别人的 edit 放行（`80-app.js:1508-1512`） | 打开 `/user/<别人>/edit` |
| 登录 / 退出 | `/user/signin` 登录页；原站导航「Log out」 | 未登录态给一个按钮到 `/user/signin/home`（`40-ui.js:397`），签完回 `/home` | 新版界面没有退出登录入口（顶栏只有头像 span，`80-app.js:346`）；登录页本身仍是原版 | 点登录 → 原版登录页；要退出账号 → 只能切回原版 |
| 去社区 / 帮助页 | `/forum`（独立 phpBB3）、`/faq`、`/servers`、`/team`、`/donation` | `@exclude /forum/*`（`00-meta.js:10`）；其余由 DOM 翻译层覆盖（`70-i18n-dom.js`），布局仍是原版 | 新版导航只有 6 项（`80-app.js:322-328`），这 5 页没有入口；空态 FAQ 按钮直指 `/faq`（`40-ui.js:413`） | 点空态 FAQ；手输或外部链接进入这 5 页 |
| 看站点新闻 | `/news/<id>` 共 4 条（`_home.html` 夹具） | 不接管、不翻译（长正文） | 无入口、无翻译 | 外部链接或手输 `/news/<id>` |
| 切回原版 / 切回新版 | 无 | 顶栏「< 原版界面」+ 原版左下角入口；同页互换、扫光过渡、不刷新（HEAD `0e1e733`，`72-sweep.js` 164 行） | 这套改动未验收、未发布：PUBLISHING 最后一条是 0.2.4 | 本身即原版模式，符合预期 |
| 跨页导航 | 整页刷新 | 同页 replaceState；跨页整页导航 + 遮罩（`80-app.js:1432-1465`） | README 已登记：视图不属于当前地址时切原版要正常加载一次 | 无 |

## 2. 维护成本最高的三处

| 成本点 | 可核对的事实 | 一次改动要验什么 |
|---|---|---|
| 上传链路 | `62-chain.js` 516 行 + `64-step1.js` 408 行 + `68-step3.js` 479 行 = 1,403 行 / 69.2 KB，占产物 13.7%；提交契约 28 键（0.2.3 适配 `osl`，27→28） | `run-upload-matrix.ps1` + `run-step3-matrix.ps1`；第三步 4 形态（降噪 / EXR / 多块 / 指纹过期）；维护、无头像、并发三支真站触发不了，只能桩验 |
| 视图层 | `50-views.js` 1,496 行 / 85.1 KB，占产物 16.9%；单文件承载 6 个视图 + 3 张表 + 2 张排序注册表 | 7 个视图 + 管理页夹具 + 第三步 4 形态（0.2.3 发布记录原话）；`probe-sort.mjs` 105 条断言 |
| 双语层 | `12-lang-zh.js` 437 行 / 34.8 KB + `70-i18n-dom.js` 223 行 / 10 KB；UI 键 502；三层动态源（模板拼键 / `packLabel` / `SESSION_LABELS`） | `check-ui-dict.mjs`（zh 502 / en 490）；删键前逐条对照 CLEANUP-AUDIT §二，否则约 2.8 KB 活词条会被误删 |
| 文档（附带） | `docs/` 394,983 字节 = `src/` 的 76.4%；PUBLISHING 79,560 + DESIGN 74,012 + REWRITE 68,249 + CLEANUP 54,152 = 275,973 | 改代码后要同步 3 处：REWRITE 的待办、CLEANUP 的执行日志、PUBLISHING 的版次 |

## 3. 优先级

### 止血（不修会持续流血）

| # | 动作 | 验收方式 |
|---|---|---|
| 1 | 把 HEAD `0e1e733` 验完并发布 0.2.5（或回滚到 0.2.4） | `node build.mjs --check` 后取回 `/scripts/598624/code`：版本号高于 0.2.4、字节数 = 本地 dist（仅第 16/17 行 `@updateURL`/`@downloadURL` 差异） |
| 2 | 新版界面补站点 7 个入口：`/team` `/servers` `/faq` `/donation` `/forum` `/home/frames` `/home/machines` | 一次点击路径：总览 → 「更多」→ FAQ → 打开 `/faq`；该页 `document.getElementById('sp')` 为 null、左下角 `#sp-mode-pill` 可见，点它落到 `/home` 新版总览 |
| 3 | 头像菜单补「退出登录」（当前只有头像 span，`80-app.js:346`） | 一次点击路径：点头像 → 退出 → 落到 `/user/logout` → 回未登录态（`state.loggedOut`，`40-ui.js:394`） |

### 补齐（用户能感知）

| # | 动作 | 验收方式 |
|---|---|---|
| 1 | 上传链路 4 个真站分支 + 估算器取色 | `pwsh .tmp/recon/run-upload-matrix.ps1` 与 `run-step3-matrix.ps1` 全过；真站提交一次，看提交体 28 键；估算器返回后看 `--positive` 行取色 |
| 2 | 项目页彻底自绘：不接管 `/project/<id>`，自己造一页 | 在项目页屏蔽站点脚本后，计算方式 / MP4 / 公开渲染各点一次，端点返回 `OK` |
| 3 | 机器排行榜 `/ranking/machine` 接管 | 访问 `/ranking/machine`：`#sp` 存在、导航高亮；`node build.mjs --check` 通过 |

### 扩张（新能力）

| # | 动作 | 验收方式 |
|---|---|---|
| 1 | 贡献数据导出（CSV：日期 / 帧数 / 积分 / 时长） | 点「导出」下载 CSV，行数 = 973 个采样点（PRODUCT.md:122） |
| 2 | 站点统计页 `/home/frames`、`/home/machines` 接管 | 点总览统计卡 → 出现 `#sp` 视图；两页各有一条解析来源 |
| 3 | 站点公告摘要卡（4 条 `/news/<id>`） | 总览出现「站点公告」卡；点第一条能打开对应 `/news/<id>` |

## 4. 这一轮明确不做

| 不做 | 为什么 |
|---|---|
| 换框架 / 拆服务 / 上构建链 | 发布形态锁定油猴脚本（PRODUCT.md:64-66） |
| 接论坛 | 独立 phpBB3、独立 cookie，`@exclude /forum/*` 是拍板（PRODUCT.md:94） |
| 翻译长正文（FAQ / News / 服务条款） | 拍板不做（PRODUCT.md:95） |
| 改已拍板的数据语义：星标 0 颗、他人积分缩写、无数据不画、活动汇总无周档、优先级名单不统一 | PRODUCT.md:96-103 逐条拍板；改语义要重新拍板，不在本轮范围 |
| 重写历史文档（PUBLISHING 的 0.1.x 版次、CLEANUP-AUDIT 的全量审计过程） | 它们是发布与审计证据，不是待办；只在文末追加「当前状态」段 |
| 为注释占比删防回归依据 | CLEANUP-AUDIT §5.3/5.4：再压就是删「为什么」，会让后人把对的东西改错 |
| 外部 CDN 字体 / 旧浏览器兼容 | 未选为约束（PRODUCT.md:105-107） |
