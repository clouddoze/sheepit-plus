# SheepIt Plus

把 [SheepIt Render Farm](https://www.sheepit-renderfarm.com) 那套 2013 年风格的界面换掉的油猴脚本。
**不是换肤** —— 脚本读取站点自己的页面，用新前端把数据重新渲染成现代仪表盘。中文优先，自带英文界面。

> **由 AI 写成。** 代码、界面文案与文档由 AI 助手（DeepSeek Harness）在人的指令与逐项验收下产出：
> 真实站点样本由人提供，产品取舍由人拍板，每一个视图都在真实账号上复核过。

## 安装

1. 装一个用户脚本管理器：[Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)
2. 安装脚本：
   - 从 GreasyFork 安装：<https://greasyfork.org/scripts/598624>
   - 或直接用仓库里的产物：打开 `dist/sheepit-plus.user.js`，管理器会弹出安装页
3. 刷新 SheepIt 任意已接管的页面

不需要额外权限（`@grant none`），脚本跑在页面上下文里；不需要构建，产物是单文件。

## 它做了什么

| 视图 | 接管路径 | 内容 |
|---|---|---|
| 总览 | `/home`、`/user/<你>/profile` | 账户仪表盘：统计卡、积分/帧数增长曲线、渲染活跃日历、已连接的机器、全站实时数据 |
| 项目 | `/home/projects` | 进行中项目：可搜索、可筛选、可排序；发布者名字可点进主页，那格带**渲染优先级开关**与 **3 点菜单**（优先 / 捐赠积分 / 加入黑名单），名字后面常驻显示你把它放进了哪几份名单 |
| 排行榜 | `/ranking/user` | 渲染者排行：用站点自带的 `data-sort` 原始数值，精度不受 "1.3 G" 这类缩写影响；自动高亮你自己 |
| **会话页** | `/session/<数字>` | 一台机器的档案：状态与主机名、四个指标、机器信息 20 项（渲染密钥默认遮住）、活动汇总（按天/按月：渲染时长 / 事件 / 作业 / 失败，完整日志一键展开）、可渲染项目按原因分组并挂上发布者；**暂停 / 恢复这台机器** |
| **账户设置** | `/user/<你>/edit` | 分三个选项卡（调度与名单 / 捐赠积分 / 账户）：调度开关、渲染优先级、两组黑名单、捐赠积分（把挣到的积分送给名单里的人）、头像、邮箱、渲染密钥 |
| 设置 | 应用内 | 主题（跟随系统 / 暗 / 亮）、**界面缩放（90%–140%）**、界面语言、原站页面翻译开关 |
| **上传项目** | `/getstarted`（只接管「Add your project」这一段） | 上传表单、渲染用时估算、排队位置、上传前须知。`/getstarted` 同时是「下载客户端」指南页，所以那一半**保持原站**，只把上传段换成新界面 |
| **项目分析** | `/project/add/<token>` | 上传后的等待页：排队 / 分析进度 / 完成。分析完成后接上站点自己的项目设置表单（那一步本版未重制） |

### 多语言

站点**没有任何 i18n 基础设施**（文案硬编码在 PHP 里，`Content-Language: en`）。脚本用两层补上：

- **重建视图**：文案由语言包驱动，加一门语言 = 注册一个词表（见 `src/12-lang-zh.js`）。
- **未接管的页面**（`/faq`、`/servers`、`/project/*`…）：原站界面不动，只在本地把文案替换成当前语言。短词条精确匹配、带变量的走正则、被内联标签切碎的句子走整块替换（纯文本逐段替换会把语序打碎）。整块替换**不会碰含表单控件的容器** —— 那会把控件本身删掉（`/getstarted` 的文件框就这么被删过一次）。

翻译全程不联网、不上传任何文本；词典里没有的字符串（项目名、用户名、新闻正文）原样保留。
**英文是基准语言**，也是站点原文语言，所以选英文时翻译层完全不介入；缺失的键一律回落英文。

### 顺带修掉的原站缺陷

这些不是主观审美，是实测到的渲染问题：

- 账户页统计标签被截断成 `Consecutive render d...`
- 账户页机器列表里有个孤立的左括号
- 项目列表把「1216 / 12000」压在进度条上，白字横跨橙/灰两色且会被条宽切掉
- 项目列表 6 列挤在约 620px 里，而 1368px 视口左右各空出约 370px
- 热力图插件往一个 div 里塞约 100KB DOM，把账户页撑到 519KB / 11037 个元素
- 图表依赖已废弃的 `google.com/jsapi`

新版账户页约 200 个节点，图表是自绘 SVG，零外部依赖。

## 隐私与合规

**数据只来自你本已能看到的页面。** 同源 `fetch` + `DOMParser` 读取站点自己的 HTML，不调用任何未公开接口，
不向任何第三方发送数据（没有统计、没有外部字体、没有 CDN，样式表与每张图都是自带的）。
你的偏好存在 `localStorage` 的 `sheepit-plus:*` 键下。

**只有三处会改动服务器状态**，且每一处都是**你自己点下**的按钮，提交到原站同一个地址：

1. 账户设置页的表单（调度开关、渲染优先级、捐赠积分、头像、邮箱、渲染密钥、黑名单）
2. 会话页的暂停 / 恢复
3. 项目页发布者那格的动作（优先 / 移出、捐赠积分、加入黑名单）

脚本**不参与渲染调度，也不触碰积分计算**。SheepIt 的服务条款禁止的是"作弊的自定义客户端 /
注入恶意代码 / 多账号绕过限制"，本脚本是纯前端界面重制，与那些都不沾边。

**非官方。** 这是第三方界面重制，与 SheepIt Render Farm 官方无隶属或背书关系。
保留名称、羊的形象与品牌橙 `#e06d58`，是为了让人一眼看出这是**他们的**站点，而不是另一个产品。

## 随时可以切回原版

顶栏有一键「切回原版界面」；原版模式下左下角留一个实心按钮切回新界面。
未重建的页面上（FAQ、服务器…）也会显示一个进入新界面的入口。

## 界面

- **主题**：跟随系统 / 暗 / 亮（两套设计 token，不是简单反色）
- **界面缩放**：90% / 100% / 110% / 125% / 140%，整块界面（字号、间距、图表）一起缩放
- **无障碍**：键盘可达（隐藏用 `opacity` 不用 `display`）、`:focus-visible` 焦点环、表格带 `role`/`aria-sort`、图表有文本替代

## 已知限制

- **原站 CSS/JS 仍会下载**，只是被隐藏。用户脚本没有扩展那样的网络层拦截能力；要用网络层拦截得走扩展形态。
- **未重建的页面保持原版布局**（`/project/*`、`/servers`、phpBB 论坛…），只是文案被本地翻译。`/getstarted` 是**半接管**：上传那一段归新界面，客户端下载指南那一半仍是原站。
- **站点改版会让解析器失效**：最坏结果是那个视图显示"无数据"，不会影响站点本身。
- **登录态是前提**：数据靠你自己的会话读取；未登录时会提示你先在原站登录。
- 站点只在**你自己的主页**内联积分曲线与逐日帧数，所以别人的主页上没有这两块面板（那里显示的是站点给的活跃日历）。
- 翻译长尾：FAQ / News / 服务条款这类**长正文**不翻译（那是内容不是界面）。
- **项目上传的后两步仍是原站界面**：分析完成后出现的项目设置表单（引擎 / 帧区间 / 切块 / 采样 / 分辨率…），以及项目管理页 `/project/<数字>`。功能正常，只是还没重制。
- **本批新页面的验证方式**：上传页与分析等待页是**对着真实页面**验的，但验法是「清掉已装脚本 + 注入新构建」，不是"更新到新版后再打开"。差在 `@run-at document-start` 那一段（防闪与守卫注入的时机）—— 详见 `docs/PUBLISHING.md` 的「五、验证状态」。

## 开发

```
src/00-meta.js     用户脚本头（@match / @run-at / @grant）
src/10-core.js     工具 / 语言包注册表 / 主题 token
src/12-lang-zh.js  中文语言包（UI 词表 + 原站词条 + 整块 + 模式规则）
src/20-api.js      抓取 + 解析器（页面 → 结构化数据）
src/30-style.js    整份 CSS（含挡掉原站样式的 #sp 前缀与守卫规则）
src/40-ui.js       组件：卡片 / 图表 / 热力图 / 进度条 / 状态页
src/50-views.js    六个视图
src/70-i18n-dom.js 未接管页面的翻译层
src/80-app.js      接管判定 / 挂载 / 路由 / 事件
```

```bash
node build.mjs            # 按文件名顺序拼成 dist/sheepit-plus.user.js
node build.mjs --check    # 只做语法与体积校验
node serve-test.mjs       # 静态服务器，把产物喂给浏览器实测
```

构建为什么是拼接而不是打包：油猴脚本天生单文件，拼接能在"产物零依赖、在脚本站上 diff 友好"
和"源码分模块可维护"之间取平衡。`build.mjs` 会用 `vm.Script` 编译一遍产物，能抓出拼接引入的语法错误。

`tools/` 是开发与验收工具（夹具服务器、交叉校验、截图拼接），不参与交付，用法见 [`tools/README.md`](tools/README.md)。

## 文档

| 文件 | 内容 |
|---|---|
| [`docs/DESIGN.md`](docs/DESIGN.md) | 设计系统：色彩、排版、几何、组件与规则（人读） |
| [`docs/design-system.json`](docs/design-system.json) | 同一套设计系统的机读版本（token / 组件片段 / 规则） |
| [`docs/PUBLISHING.md`](docs/PUBLISHING.md) | 发布流程与上传文案（GreasyFork / OpenUserJS） |

## English

A userscript that rebuilds the [SheepIt Render Farm](https://www.sheepit-renderfarm.com) interface.
It is not a skin: it reads the site's own pages with a same-origin `fetch` + `DOMParser` and renders
the data in a modern front end — dashboard, project list, ranking, machine session page and account
settings — in Chinese and English, dark and light.

- **Privacy:** talks to nothing but the site itself. No analytics, no external fonts, no CDN.
- **Server state changes in exactly three places**, all of them buttons you press, posting to the
  site's own endpoints: the account-settings forms, pause/resume on a machine's session page, and
  the publisher actions on the project list.
- Never makes scheduling decisions for you, never touches points accounting.
- **Written by an AI** (DeepSeek Harness) under a human's direction and item-by-item review.
- Third-party rebuild, not affiliated with SheepIt Render Farm.
- MIT licensed.

See [`README`](#) above for install steps and the full feature list (Chinese).

## License

[MIT](LICENSE)
