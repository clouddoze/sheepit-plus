# SheepIt Plus

把 [SheepIt Render Farm](https://www.sheepit-renderfarm.com) 的界面换成新前端的油猴脚本。
它读取站点自己的页面，把数据渲染成仪表盘、项目列表、排行榜这些新界面。中文优先，自带英文。

> 代码、界面文案与文档由 AI 助手（DeepSeek Harness）在人的指令与逐项验收下写成。

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
| **上传项目** | 应用内 `#/upload`（顶栏入口；设置里三档：关闭 / 原版 / 新版，默认新版） | 上传表单、渲染用时估算、排队位置、上传前须知。三块都由脚本解析站点 `/getstarted` 的数据后**自绘**；`/getstarted` 本身仍是原站页面（只翻译），「原版」档点入口就是新标签页打开它 |
| **项目分析** | `/project/add/<token>` | 上传后的等待页：排队 / 分析进度 / 完成。分析完成后接上**自绘**的项目设置表单（引擎 / 帧区间 / 切块 / 采样 / 分辨率…），提交也由脚本按站点的 27 个 POST 键发出；万一认不出站点这一版的结构，就明说并把这一页交回站点自己的界面 |

### 多语言

站点没有做国际化（文案硬编码在 PHP 里，`Content-Language: en`）。脚本用两层补上：

- **重建视图**：文案由语言包驱动，加一门语言 = 注册一个词表（见 `src/12-lang-zh.js`）。
- **未接管的页面**（`/faq`、`/servers`、`/project/*`…）：原站界面不动，只在本地把文案替换成当前语言。短词条精确匹配、带变量的走正则、被内联标签切碎的句子走整块替换（纯文本逐段替换会把语序打碎）。整块替换**不会碰含表单控件的容器** —— 那会把控件本身删掉（`/getstarted` 的文件框就这么被删过一次）。

翻译全程不联网、不上传任何文本；词典里没有的字符串（项目名、用户名、新闻正文）原样保留。
**英文是基准语言**，也是站点原文语言，所以选英文时翻译层完全不介入；缺失的键一律回落英文。

### 顺带修掉的原站问题

都是实测到的渲染问题，和审美无关：

- 账户页统计标签被截断成 `Consecutive render d...`
- 账户页机器列表里有个孤立的左括号
- 项目列表把「1216 / 12000」压在进度条上，白字横跨橙/灰两色且会被条宽切掉
- 项目列表 6 列挤在约 620px 里，而 1368px 视口左右各空出约 370px
- 热力图插件往一个 div 里塞约 100KB DOM，把账户页撑到 519KB / 11037 个元素
- 图表依赖已废弃的 `google.com/jsapi`

新版账户页约 200 个节点，图表是自绘 SVG，零外部依赖。

## 隐私

数据只来自你本来就能看到的页面：同源 `fetch` + `DOMParser` 读取站点自己的 HTML，不调用未公开接口，
也不向任何第三方发请求。样式表与每张图都是脚本自带的，没有统计代码、外部字体或 CDN。
你的偏好存在 `localStorage` 的 `sheepit-plus:*` 键下。

只有三处会改动服务器上的状态，都是你自己点下去的按钮，提交到原站同一个地址：

1. 账户设置页的表单（调度开关、渲染优先级、捐赠积分、头像、邮箱、渲染密钥、黑名单）
2. 会话页的暂停 / 恢复
3. 项目页发布者那格的动作（优先 / 移出、捐赠积分、加入黑名单）

脚本不参与渲染调度，也不碰积分与帧数的计算方式 —— 它只是把页面重新画一遍。

这是第三方界面重制，与 SheepIt Render Farm 官方没有隶属或背书关系。
保留名称、羊的形象与品牌橙 `#e06d58`，是为了让人一眼认得出这是他们的站点。

## 随时可以切回原版

顶栏有一键「切回原版界面」；原版模式下左下角留一个实心按钮切回新界面。
未重建的页面上（FAQ、服务器…）也会显示一个进入新界面的入口。

## 界面

- **主题**：跟随系统 / 暗 / 亮（两套设计 token，不是简单反色）
- **界面缩放**：90% / 100% / 110% / 125% / 140%，整块界面（字号、间距、图表）一起缩放
- **无障碍**：键盘可达（隐藏用 `opacity` 不用 `display`）、`:focus-visible` 焦点环、表格带 `role`/`aria-sort`、图表有文本替代

## 已知限制

- **原站 CSS/JS 仍会下载**，只是被隐藏。用户脚本没有扩展那样的网络层拦截能力；要用网络层拦截得走扩展形态。
- **未重建的页面保持原版布局**（`/project/*`、`/servers`、`/getstarted`、phpBB 论坛…），只是文案被本地翻译。上传项目在新界面里是独立的一页（`#/upload`，设置里的「新版」档）；`/getstarted` 归站点自己 —— 同一件事不留两种界面（2026-10-04 用户拍板：那一页的半接管容易混淆）。
- **站点改版会让解析器失效**：最坏结果是那个视图显示"无数据"，不会影响站点本身。
- **登录态是前提**：数据靠你自己的会话读取；未登录时会提示你先在原站登录。
- 站点只在**你自己的主页**内联积分曲线与逐日帧数，所以别人的主页上没有这两块面板（那里显示的是站点给的活跃日历）。
- 翻译长尾：FAQ / News / 服务条款这类**长正文**不翻译（那是内容不是界面）。
- **项目上传的第三步（项目设置）由脚本自绘**：引擎 / 帧区间 / 切块 / 采样 / 分辨率…界面是我们画的，提交发的是站点那 27 个 POST 键；项目管理页 `/project/<数字>` 仍是站点自己的控件（只统一了外观）。脚本认不出站点这一版的结构时会明说，并把那一页交回站点自己的界面。
- 上传页与分析等待页是对着真实页面验的，但验法是「清掉已装脚本 + 注入新构建」，不是"更新到新版后再打开"；差在 `@run-at document-start` 那一段（防闪与守卫注入的时机）。详见 [`docs/PUBLISHING.md`](docs/PUBLISHING.md) 的「五、验证状态」。

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

A userscript that gives [SheepIt Render Farm](https://www.sheepit-renderfarm.com) a new front end.
It reads the site's own pages with same-origin requests and renders the data as a dashboard, a
project list, a ranking, a machine session page and account settings — in Chinese and English,
dark and light.

- Privacy: it only talks to the site itself. No analytics, no external fonts, no CDN.
- Three things can change anything on the server, all of them buttons you press: the
  account-settings forms, pause/resume on a session page, and the publisher actions on the project
  list. Each posts to the site's own endpoint.
- It makes no scheduling decisions and does not touch points accounting.
- Written by an AI assistant (DeepSeek Harness) under a human's direction and item-by-item review.
- Third-party rebuild, not affiliated with SheepIt Render Farm.
- MIT licensed.

Install steps and the full feature list are above (in Chinese).

## License

[MIT](LICENSE)
