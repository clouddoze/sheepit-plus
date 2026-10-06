# 分发文案包（GreasyFork / OpenUserJS）

> **这份文件给发布者用，不是给最终用户看的** —— 用户文档在 `README.md`。
> 文案已定稿，可直接使用。**已发布**：GreasyFork 脚本 id `598624`（2026-10-04），
> 脚本头四行 metadata 已回填，值见下面「四」。
> 事实来源：能力与限制以 `README.md` 为准；合规声明（只读取你本已可见的数据、不参与渲染调度、
> 不触碰积分计算）与本项目的 **AI 作者身份声明**都是固定对外表述，发布时不要删。
> 界面语言策略：中文优先，英文为基准语言，缺失的键回落站点原文（见 `README.md`）。

---

## 一、上传字段逐项

| GreasyFork 字段 | 填什么 |
|---|---|
| Script type | **Public** |
| 脚本文件 | `dist/sheepit-plus.user.js`（单文件零依赖，随源码一起提交） |
| Name / Description | **不用手填** —— GreasyFork 自动读脚本头：`@name` / `@name:en`、`@description` / `@description:en` |
| Language | 选「中文（简体）」。脚本自带 `:en` 后缀，英文浏览器会看到英文那套 |
| License | MIT（脚本头 `@license` 已写，会自动识别） |
| Applies to | **自动**读 `@match`：`https://www.sheepit-renderfarm.com/*`，并按 `@exclude` 排除 `/forum/*` |
| Tags | **表单里没有这个字段**（2026-10-04 实测：新建与更新表单的字段里都没有 Tags），标签由站点自己生成。当初想填的：`sheepit` `renderfarm` `blender` `dashboard` `dark-mode` `chinese` |
| Additional info | 抄下面「二」的正文。2026-10-04 首次发布时按「默认简体中文」把**中文段放前面、英文段接在后面**贴的 |

正文由 `.tmp/make-stage.mjs` 从本文件抽出（中文段在前、英文段接在后面），**不要手抄**，
免得两处漂移。中文在前的理由见 `README.md` 的语言策略：界面默认简体中文，脚本页文案跟着界面走，
不影响英文读者 —— 他们看到的是 `:en` 那套。

---

## 二、Additional info 正文

### English（先贴这段）

A new front end for SheepIt Render Farm.

SheepIt Plus is a userscript. It reads the site's own pages with same-origin requests and renders
the data in a new interface. It is not a CSS reskin — everything on screen comes from the site.

What it rebuilds

- Overview — `/home` and your profile: stat cards, points and frames curves, a render-activity
  calendar, connected machines, live site numbers.
- Projects — `/home/projects`: search, filter, sort; publisher names and avatars visible;
  a render-priority toggle on each publisher.
- Ranking — `/ranking/user`: sorted by the values the site gives, so "1.3 G" style abbreviations
  don't cost precision; your own row is highlighted.
- Session — `/session/<number>`: one machine's record. 20 machine facts (the render key stays
  masked), a per-day activity summary with the full log one click away, renderable projects
  grouped by reason, and pause/resume for that machine.
- Account settings — `/user/<you>/edit`: scheduler switches, render priority, avatar, e-mail,
  render keys, two blocklists.
- Settings — in-app: theme (system / dark / light), interface language, and whether to translate
  the pages that keep their original layout.
- Uploading a project — the top bar has an "Upload" entry, with four modes in Settings: off, the
  site's own page untouched, "compatible" (the site's own controls laid out inside our cards — the
  default), and "new" (the upload card, the analysis wait, and the project-settings step drawn and
  submitted by the script, using the values the site's own analyzer returned).

Privacy

All data comes from pages you could already see, read with same-origin requests. No undocumented
endpoints, and no requests to third parties. The stylesheet and every chart are self-contained:
no analytics, no external fonts, no CDN. Your preferences live in `localStorage` under
`sheepit-plus:*`.

Four things can change anything on the server, and each is a button you press, posting to the same
endpoint the original page posts to: the forms in Account settings, pause/resume on a session page,
add/remove in your render priority, and adding a project (the file upload, then the project settings
you confirm). In the upload flow the script posts the same fields the site's own form posts, to the
same addresses; it does not invent endpoints. The script makes no scheduling decisions and does not
touch points or frame accounting.

Prefer the old interface?

There is a one-click "switch to the original interface" in the top bar, and in the original
interface a small button to come back.

Requirements

Tampermonkey (Violentmonkey / Greasemonkey also work) and a signed-in SheepIt session — the script
reads data through your own session. No extra permissions: `@grant none`.

Known limitations

- The original CSS/JS still downloads; it is only hidden. A userscript has no network-layer blocking.
- Pages that are not rebuilt (`/faq`, `/project/*`, `/servers`, …) keep their original layout; text is
  replaced only where a translation exists. The upload flow is rebuilt in "new" mode; in the default
  "compatible" mode the site's own upload form is kept and only re-laid out inside our cards, and
  "original" mode opens the site's own page untouched.
- In "new" mode the project-settings step (engine, frame range, tiles, samples, resolution…) is drawn
  and submitted by the script from the site's own analysis values. If that form ever stops matching
  the upstream version the script was checked against, it says so and falls back to the site's own
  form. The project management page `/project/<id>` keeps the site's own controls, restyled.
- If the site is redesigned a parser can stop matching. The worst case is one view saying "no data";
  the site itself is unaffected.
- The Chinese word list is the most complete; English is the baseline and falls back to the site's
  own wording.
- Signed out? The script asks you to sign in on the original site.

This is a third-party interface rebuild, not affiliated with or endorsed by SheepIt Render Farm.
The name, the sheep and the orange are kept so it stays recognisable as their site.

The code, the interface copy and the docs were written by an AI assistant (DeepSeek Harness) under
a human's direction and item-by-item review.

MIT licensed. Feedback welcome — tell me which page and what you saw.

### 中文（接在后面贴）

给 SheepIt Render Farm 换一套新前端。

SheepIt Plus 是一个油猴脚本。它用同源请求读取站点自己的页面，再把数据渲染成新界面 ——
不是覆盖一层 CSS 的换肤，界面上显示的东西全部来自站点本身。

重做了这几处：

- 总览（`/home`、你的个人主页）：统计卡、积分与帧数曲线、渲染活跃日历、已连接的机器、
  全站实时数据。
- 项目（`/home/projects`）：可搜索、可筛选、可排序；发布者名字与头像可见；发布者那格
  带一个渲染优先级开关。
- 排行榜（`/ranking/user`）：按站点给的原始数值排序，不受 "1.3 G" 这类缩写影响；
  你自己那行会高亮。
- 会话页（`/session/<数字>`）：一台机器的档案。机器信息 20 项（渲染密钥默认遮住）、
  按天的活动汇总与完整日志、可渲染的项目按原因分组；可以在这里暂停或恢复这台机器。
- 账户设置（`/user/<你>/edit`）：调度开关、渲染优先级、头像、邮箱、渲染密钥、两组黑名单。
- 设置（应用内）：主题（跟随系统/暗/亮）、界面语言、是否翻译保持原版的页面。
- 上传项目：顶栏有「上传项目」入口，设置里有四档 —— 关闭、原版（站点自己那页，我们一点不碰）、
  兼容（站点自己的控件收进我们的卡片排版，**默认**）、新版（上传卡片、分析等待、项目设置三步
  都由脚本自绘并自行提交，用的是站点分析器给的值）。

关于隐私

所有数据都来自你本来就能看到的页面，用同源请求读取；不调用未公开的接口，也不向任何第三方
发请求。样式和图表都是脚本自带的，没有统计代码、外部字体或 CDN。你的偏好存在 `localStorage`
的 `sheepit-plus:*` 键下。

只有四处会改动服务器上的状态，都是你自己点下去的按钮，提交到原站同一个地址：账户设置里的
表单、会话页的暂停/恢复、项目列表里发布者那格的优先/移出，以及添加项目（文件上传，再到你确认的
项目设置）。上传链路上脚本发的是站点自己那张表单会发的同一组字段、同一个地址，不自造接口。
脚本不参与渲染调度，也不碰积分与帧数的计算。

想用回原版

顶栏有一键「切回原版界面」；原版模式下左下角留了一个切回来的入口。

前提

装 Tampermonkey（Violentmonkey / Greasemonkey 也可以），并且在 SheepIt 上已登录 ——
数据靠你自己的会话读取。不需要额外权限（`@grant none`）。

已知限制

- 原站的 CSS/JS 仍会下载，只是被隐藏了；油猴脚本没有扩展那样的网络层拦截能力。
- 未重建的页面（`/faq`、`/project/*`、`/servers` 等）保持原版界面，只在有译文时替换文案。
  上传链路只在「新版」档重做；默认的「兼容」档保留站点自己的表单，只把它收进我们的卡片排版；
  「原版」档完全不接管，打开的是站点自己那一页。
- 「新版」档下，项目设置那一步（引擎、帧区间、切块、采样、分辨率…）由脚本按站点分析器给的值
  自绘并自行提交。万一这张表单与脚本核对过的上游版本对不上，它会明说并退回站点自己那张表单。
  项目管理页 `/project/<数字>` 仍是站点自己的控件，只统一了外观。
- 站点改版可能让某个解析器失效，最坏情况是那一个视图显示「无数据」，不影响站点本身。
- 中文词表最完整；英文是基准语言，缺失的键回落站点原文。
- 未登录时会提示你先在原站登录。

这是第三方界面重制，与 SheepIt Render Farm 官方没有隶属或背书关系。保留名称、羊的形象与
品牌橙，是为了让人一眼认得出这是他们的站点。

代码、界面文案与文档由 AI 助手（DeepSeek Harness）在人的指令与逐项验收下写成。

MIT 许可。有问题欢迎反馈：告诉我哪个页面、你看到了什么。

---

## 三、截图（当前：一张都不放）

**2026-10-04 决定：脚本页与仓库都不放截图。** 原来的 6 张（曾放在 `docs/screenshots/`）是从
真实账号抓的实测画面：用户名、排名、积分、帧数、累计渲染时长、注册日期全在图上，足以反推
是哪个账号 —— 与「不要出现测试账号」这条拍板直接冲突，已从 GreasyFork 脚本页撤下、
并从仓库删除。这段说明刻意不抄那些数字，原因就是这一条本身。

要再放图时：**必须用合成数据渲染**，不能拿真实会话的页面截图。图上出现的账号名、积分、
帧数、排名、机器名、渲染密钥一律用假值；`tools/` 里有夹具服务器与截图工具，夹具来源见
`tools/README.md`。GreasyFork 单次新建/更新最多带 5 个附件，每张 ≤ 1 MB。

---

## 四、metadata 回填记录（2026-10-04 已完成）

首次公开：**2026-10-04，GreasyFork 脚本 id `598624`，以版本 0.1.0 建页、随即以 0.1.1 补全下列字段。**

已发布版本：`0.1.0` → `0.1.1`（补 metadata）→ `0.1.2`（注明 AI 作者身份、撤下截图）→
`0.1.3`（修项目表进度条长短不一）→ `0.1.4`（会话页「可渲染项目」改成表）→
`0.1.5`（会话页一批修正：两种暂停、算力、行序、发布者动作）→
`0.1.6`（上传页局部接管 + 分析等待页；修掉翻译层删掉文件框的 bug）→
`0.1.7`（修 0.1.6 带进来的两个"没有出口"缺陷：翻译开关关掉自己后不再挂载、
半接管页丢了角落入口）→
`0.1.8`（角落两个开关收进同一竖排；须知那一列摆脱站点栅格的 float:50%、条目分三栏；
排队那块改回单栏正常折行；估算器结果不再白底白字、改成中文、不再拉长左侧卡片；
新增实验性开关，打开后顶栏出现「上传项目」入口）→
`0.1.9`（实验性入口改成**应用内**打开：把 /getstarted 抓回来装进卡片，不再跳去原站页面）→
`0.1.10`（/getstarted 不再接管 —— 上传只留应用内那一页；脚本页与 README 的描述重写、语气放平）→
`0.1.11`（修设备名自动补全的菜单被自己的守卫挡掉；补上菜单的失焦/点外面关闭；源码注释精简
99.7→33.4 KB，产物 -20%）→
`0.1.12`–`0.1.18`（**未发布**：仓库里持续迭代，GreasyFork 上一直停在 0.1.11）→
`0.2.0`（上传链路按上游源码重写：四档开关、新版上传页、新版第三步自绘自提交；验收记录见「五」的
0.2.0 段）。

⚠️ **刚发布完别立刻拉 URL 判成败** —— `update.greasyfork.org` 有 CDN 缓存。0.1.4 发布后
第一次查 `.meta.js` 拿到的还是 `0.1.3`，加一个 `?cb=<随机数>` 再查就是新版本了；脚本页上
的版本号则是即时更新的。判断发布是否成功以**脚本页的版本号**为准。

| 头字段 | 最终值 |
|---|---|
| `@namespace` | `https://github.com/clouddoze` —— 上传前定死，**此后不可再改**：Tampermonkey 与 Violentmonkey 都用 `@name` + `@namespace` 认脚本身份，发布后改动会让已装用户收不到更新、并在他们那里变成两个脚本 |
| `@homepageURL` | `https://greasyfork.org/scripts/598624` |
| `@supportURL` | `https://greasyfork.org/scripts/598624/feedback` |
| `@updateURL` | `https://update.greasyfork.org/scripts/598624/SheepIt%20Plus%20%C2%B7%20%E6%B8%B2%E6%9F%93%E5%86%9C%E5%9C%BA%E7%95%8C%E9%9D%A2%E9%87%8D%E5%88%B6.meta.js` |
| `@downloadURL` | 同上，把结尾换成 `.user.js` |

⚠️ **URL 里的 slug 是中文脚本名，不是交接文档原先假设的 `SheepIt%20Plus`。** 上面两条取自
脚本页「安装此脚本」的原样地址；服务端按 `/scripts/<id>/` 取脚本、slug 只影响可读性 ——
实测把 slug 换成 `SheepIt%20Plus` 也能取到同一份产物，但跟站点给的那条保持一致最稳。

**GreasyFork 对这两行的处理（2026-10-04 实测）**：`.meta.js` 里会**把 `@updateURL` /
`@downloadURL` 剥掉** —— 那份文件本身就是更新源；`.user.js` 里则**保留**，只把缩进归一、
并把两行挪到 metadata 块末尾。所以线上 265,689 字节与本地 `dist` 的 265,693 字节只差这 4 个
空格，正文、注释与代码逐字节相同（0.1.2 实测）。

**同一条规律在 0.1.6 上复现（2026-10-04 实测）**：线上 `.user.js` **312,027** 字节 vs 本地
`dist` **312,031** 字节，差的仍是这 4 个空格；5564 行里**只有第 16、17 两行不同**
（`@updateURL` / `@downloadURL` 换了顺序、缩进由对齐列变成单空格），其余逐字节相同。
所以"发布是否成功"有两个独立判据，都不用等 CDN：**脚本页的版本号**，以及**本地产物与线上
产物的这个已知差值**。`.meta.js` 里则照旧没有这两行。

0.1.7 发布后同一套核对再走了一遍：线上 **318,914** vs 本地 **318,918**，5657 行里仍然只有
第 16、17 两行不同。三次发布三次都是这 4 个空格，这条规律可以当断言用了。

0.1.8 第四次复现：线上 **334,678** vs 本地 **334,682**，5909 行里仍然只有第 16、17 两行不同。
发布前的自检也固定下来了：在 GreasyFork 的更新页里对 `dist` 算 SHA-256 与本地比对
（0.1.8 是 `bbd7f8f9…`），一致了再点提交 —— 避免"构建失败但脚本照旧拷了旧产物"这种事
（0.1.8 开发期间真发生过一次）。

0.1.9 开发期间回核了一遍（**第五次**）：线上仍停在 **334,678** vs `4e82644:dist` **334,682**，
5909 行里还是只有第 16、17 两行不同 —— 跟发布当天那次逐项一致，所以**线上确实还是 0.1.8**
（当时仓库里已是 0.1.9、尚未发布）。这条差值现在可以直接当断言用：只要线上产物与本地同名版本差
4 个字节、且只差这两行，就说明服务端存的就是这份产物。

发布新版的流程：改 `@version` → `node build.mjs` → `node .tmp/make-stage.mjs` → GreasyFork
脚本页 →「更新」→ 代码粘进 `script_version[code]`、附加信息抄 `additional-info.md`
（Markdown 模式）→ 填更新日志 → 提交。`@version` 必须往上走，已装用户靠 `@updateURL` 拉
`.meta.js` 比版本号。

（**2026-10-06 起这两步各加了校验**，都是冲着"拿错文件"和"产物悄悄回涨"去的：
`node build.mjs` 会打印注释字节 / 产物字节 / 占比，超过提示线（产物 > 285,000 字节、或注释占比
> 25%）只打 `⚠`，**不拦构建**（用户拍板「不要硬上限，提示一下就行」：加功能本来就会变大，
构建不该替人挡路）；注释字节由 `tools/comment-bytes.mjs` 精确统计，字符串 / 模板串 / 正则感知。
`node .tmp/make-stage.mjs` 则**会中止** —— stage 目录里有白名单（产物 + `additional-info.md` +
`*.png`）之外的文件、或 stage 产物版本与 `src/00-meta.js` 的 `@version` 不一致
（这两条拦的是"拿错文件"，不是体积）。实测：两条中止都能拦住，正常路径退出码 0。）

**0.1.10 发布（2026-10-04）**：线上 **336,053** vs 本地 `dist` **336,057**，5922 行里仍然只有
第 16、17 两行不同 —— **第七次复现**，差值 4 字节这条断言继续成立。这次**附加信息正文是换过的**
（6,220 → 5,051 字符，第一行从"把 SheepIt Render Farm 那套 2013 年风格的界面换掉。"改成
"给 SheepIt Render Farm 换一套新前端。"），所以表单里那份不能再沿用预填内容，必须用
`make-stage.mjs` 抽出来的新正文覆盖 —— `infoMatchesStaged` 这个比对就是为这一步加的，返回
false 才说明确实需要覆盖。更新日志 330 字符走 Markdown。

**不想等 CDN 的判断法（0.1.9 新增）**：脚本页的 `/scripts/<id>/code` 是**直接读库**、不走
`update.greasyfork.org`。提交完立刻在那一页的 `pre` 里搜任意一处新代码的特征串，就能确认入库的
是不是这一版。0.1.9 实测：提交后立刻拉 CDN 的 `.user.js`，拿到的**还是 0.1.8 的正文**（带
`?cb=<随机数>` 也一样），而脚本页版本号与 `/code` 都已经是 0.1.9；过几分钟 CDN 才换过来。
所以"发布是否成功"永远是**脚本页版本号**说了算，正文再等 CDN 或直接看 `/code`。
0.1.10 反过来用了一次：先看脚本页版本号与 `/code` 确认入库，再拉 CDN 比对 —— 这次 CDN 已经
换过来了（不必等）。这一版在 `/code` 上验的是"删掉的东西不在、保留的东西在"：`INLINE_VIEWS`、
`sp-inline`、`wireUpload(root)`、`mode.partialTip`、`up.noForm` 全都不在，`wireUploadDoc`、
`up.expNote` 与三处修复都在。

发布前在更新页里对 `script_version[code]`（也就是真正会提交的那串字符）算 SHA-256 与本地
`dist` 比对，这次是 `7EA67A84…` —— 比 0.1.8 那次更靠前一步：0.1.8 是拿 `dist` 去比，这次直接
比**填好的表单内容**，连"填错文件"这一层也一起挡掉了。

---

## 五、验证状态（哪些是实测过的，哪些不是）

分清"看过真实页面"和"只对着源码写"，因为两者出的错不一样。

**已经对着真实页面看过的**：总览、项目、排行榜、会话页、账户设置，以及本批新做的
上传卡片（数据取自 `/getstarted` 的「Add your project」段）与分析等待页（`/project/add/<token>`）。

**但这一批的验证方式要写清楚**（2026-10-04）：不是"用户把已装脚本更新到新版、然后打开页面"，
而是**先清掉已安装脚本留下的节点、再把 `dist` 产物注入到已加载的真实页面里**。
两者差在 **`@run-at document-start` 那一段**：真实安装路径下守卫会在原站界面画出来之前
就注入（防闪），而注入式验证是在 DOM 已就绪之后启动的。所以下列行为**尚未走完整安装路径验证**：
防闪、`document-start` 时的守卫注入、以及"用户从旧版更新上来"这一跳。
要补上它，只能让用户更新到新版后直接看 —— 记在这里，不假装已经验过。
（**2026-10-06 补上了这一跳**：用户自己更新到 0.1.11 后开新标签页实测，见本节末尾的
「0.1.11 装机实测」。结论有一半是意料之外的 —— 注入时机是竞态，不是保证。）

**2026-10-04 补测（0.1.8 / 0.1.9，0.1.9 当日发布）**：

- **0.1.8 走真实安装路径能正常启动**：新开一个标签页、由 Violentmonkey 以 `@run-at document-start`
  启动，`#sp` 建好、14 个视图在、状态正常。判定"浏览器里装的是哪一版"用三枚指纹：
  `SP.CSS.length`（0.1.7=47615 / **0.1.8=51407** / 0.1.9=51763）、`SP.cornerHost` 是否存在
  （0.1.8 引入）、`t('up.expNote')` 回的是译文还是键名（0.1.9 才有译文）。
  **2026-10-06 追加第四枚，以后优先用它**：`#sp-guard` 的规则文本 —— 0.1.11 起是
  `body > *:not(#sp):not(.sp-acmenu)`，0.1.8–0.1.10 是 `body > *:not(#sp)`。这条是二值的，
  不受页面状态影响；而 `SP.CSS.length` 会被运行时状态带偏（见本节末尾）。

  **2026-10-06 追加第五枚（判断"站点有没有改版"，不是判断"装的哪一版"）**：站点自己资源路径里的
  `<short_version>`，即线上 `www` 仓库的 commit 短 id。取法：页面里任一 `script[src*="/media/"]` /
  `link[href*="/media/"]` 的 `/\/media\/([0-9a-f]{8})\//`。0.1.14 的新版上传就是拿它当上游指纹
  （`src/60-step3.js` 的 `VERIFIED_UPSTREAM = '9b13032c'`，设置页那张卡片会把它和"本脚本验证过的版本"
  并排显示）。它与 GitLab `sheepitrenderfarm/www` 的 master HEAD 同值，改一次上传链路它就会变。
  仍未验证的还是**防闪**与"用户从旧版更新上来"那一跳。（后一条 2026-10-06 已补，见本节末尾；
  前一条只拿到一半证据。）
- **0.1.9 的应用内上传视图（`#/upload`）三条路径都实测过**：直接以 `#/upload` 载入、
  切到别的视图再切回来、以及"上一个视图还在取数据时立刻切过来"。
- 这三条路径当场修掉三处缺陷，**同一个形状：一个只描述"某一次渲染"的状态，被当成了元素的性质**。
  ① `#sp-body` 上的 `spWired` 切走视图后不清，切回来时 `render()` 早退、画的是上一个视图
  （地址写着 `#/upload`，界面却是总览，文件框不见）；② `boot()` 是**先 `render()` 再 `show()`**
  的，直接以 `#/upload` 载入时那次 render 只有卡片外形、没有数据，却也被标成"已接线"，
  于是 show() 的两次 render 全被早退，用户拿到**一张没有表单、交不出去的空卡片**；
  ③ `show()` 的 `finally` 无条件按自己的视图写地址栏，取数据慢的那次会落在新导航之后把 URL
  改回去（"总览还在取 → 点了上传"就是这一串，刷新会回到总览）。三处都在 0.1.9 内修掉，
  0.1.8 及以前没有（0.1.8 根本没有应用内上传视图）。

**2026-10-04（0.1.10）把 `/getstarted` 的半接管整个去掉**，用户拍板：同一件"上传项目"两种界面
容易混淆，而且原版模式下点那颗角落按钮会落到一个半新半旧的页面。实测（真站点 + 注入 `dist`）：

- 那一页现在 `#sp`、守卫、`#sp-style`、`sp-inline` **全都不存在**；站点自己的上传段原样在 DOM 里
  （`#addproject_main_div` + 1 个文件框 + 估算器都在），翻译照常（`lang=zh-CN`，中文文案在）。
- 角落那颗从「切回新界面」变成 **「进入新界面」**，标题写着"这一页没有重制版"；点下去去的是
  `/home`（完整新界面），**不再是那个半接管页**。
- 上传卡片本身（`#/upload`）没被删坏：启动于 `#/upload`、切走再切回、慢总览后立刻切过来
  三条路径与顶栏逐项导航同时复测，三处修复都在。

**2026-10-04（0.1.11）修掉设备名自动补全不出菜单**，用户实报（输入 2060，没有 GeForce RTX 2060
的候选）。查下来绑定、源地址、接口三样都是好的：菜单**已经生成**、里面就是
`GeForce RTX 2060 / 2060 SUPER`，只是 jQuery UI 把菜单挂在 `<body>` 上，被整页接管的守卫
`body > *:not(#sp){display:none}` 挡成 `display:none` —— 用户看到的是"输入了没反应"。

做法：守卫按我们自己的类名 `.sp-acmenu` 放行，菜单用我们的 token 重画（它因此成了**唯一一件
长在 #sp 外面的家具**，token 块单给它生成一份）。两个坑记在这里：

- **不能 `appendTo` 到 `#sp` 里**：实测在 `#sp` 的 CSS zoom 下 jQuery 的 `offset()` 把差值算成 0，
  菜单落到左上角。所以留它在 body —— 默认挂载点的定位反而是准的（实测 dx=0，正好在输入框下方）。
- **`Theme.css(scope)` 不能传选择器列表**：它生成的是 `scope:not([data-theme="dark"])` 与
  `scope[data-theme="light"]`，写成 `'#sp, ul.sp-acmenu'` 时那两处条件只绑在最后一项上，
  `#sp` 会无条件吃到亮色 token（实测：用户选暗色，整壳变白、菜单却还是暗的）。两次调用即可。

实测（真站点 + 注入 `dist`，界面缩放 125%）：菜单可见、两项候选、位置在输入框正下方、
`data-theme` 跟着 `#sp`、底色是 `--surface`；点选把 label 与隐藏字段一起填上
（`GeForce RTX 2060` / `gpu_2849`）；body 上的空菜单从 4 个降到 1 个。

**2026-10-04（0.1.11）注释精简 + 补上自动补全菜单的关闭**：

- 源码注释 **99.7 → 33.4 KB（-67%）**，产物 **339,846 → 271,560 字节（-20%）**。口径是精确的
  （字符串/模板串/正则感知；粗口径会把 `accept="image/*"` 这类当注释，虚高约 10 KB）。
- "只动了注释"是机器校验过的：把 `git HEAD` 版与工作区版的注释都剥掉后逐字符比对，九个文件
  全部一致。另有 25 条关键词做底线复查（`反引号`、`appendTo`、`选择器列表`、`整块替换`、
  `文件框`、`已接线`、`行序`、`server side`、`numband`…），全部在。
- **菜单可见之后暴露出的第二件事**：这个 jQuery UI（1.10.2）在本页**既不在 blur 时关菜单、
  也不在"点外面"时关** —— 实测把真实 mousedown 派发到导航上，菜单 `display` 仍是 `block`；
  而菜单挂在 `<body>` 上、不跟卡片一起消失，于是会留在屏幕上。修法：失焦与点外面各补一次
  `close()`（点菜单项不会误关，jQuery UI 在菜单项 mousedown 里 preventDefault，输入框不失焦）。
  实测：点外面 → `none`；blur 事件 → `none`；点菜单项 → 填入 `GeForce RTX 3080` / `gpu_2851` 且菜单关闭。
- 方法说明（照老规矩记下来）：这台机器上该标签页 `document.hasFocus()` 是 **false**，所以
  `focus()/blur()` **不会**触发原生焦点事件 —— 焦点那条路径是用 `$(label).trigger('blur')`
  触发的；"点外面"用的是真实 `mousedown` 序列（那条不依赖窗口焦点，可信）。

**0.1.11 发布（2026-10-04）**：线上 **271,556** vs 本地 `dist` **271,560**，5210 行里仍然只有
第 16、17 两行不同 —— **第八次复现**。这一版是仓库里最大的一次体积变动（339,846 → 271,560 字节），
所以 4 字节这条断言也跟着走了一遍：**体积变了、差值不变**，说明它认的是那两行的元数据归一，
与正文大小无关。附加信息正文与 0.1.10 逐字相同（表单预填即最新）→ 不必覆盖；更新日志 347 字符；
提交前对填好的 `script_version[code]` 算 SHA-256 = `352AE5F1…`，与本地一致。

**2026-10-06（0.1.11 装机实测）**：用户自己在浏览器里把已装脚本更新到 0.1.11 之后，开新标签页实测。
这一份是 **Violentmonkey 拉起的正式安装版**，不是注入 `dist` —— 也就是补上了上一条一直缺的那一跳。

- **装的确实是 0.1.11**：`#sp-guard` 的规则文本含 `:not(.sp-acmenu)`（见上面的第四枚指纹）。
  另两个指纹也对得上：`SP.cornerHost` 是 function、`t('up.expNote')` 回译文。
- **升级没有留残留**：`#sp-guard`、`#sp-style`、`#sp` 各只有 1 个。
- **`document-start` 的守卫注入第一次拿到直接证据**：那次加载里 `#sp-guard` 与 `#sp-style` 是
  `<html>` 的直接子节点，位置在 `<head>` **之前**（index 0 与 1，同级还有 `HEAD`、`BODY`）。
  代码是 `(document.head || document.documentElement).appendChild(s)` —— 只有 `document.head`
  **尚不存在**时才会落到 `documentElement`，这只可能发生在解析开始前的窗口。防闪烁的结构前提成立。
- **但注入时机是竞态，不能当保证**：另一次加载里 `#sp-guard` 落在 `<head>` 第 22 位，两次位置不同。
  所以"抢在 `<head>` 之前"只是有时成立；能确定的是它最终必在 `<body>` 之前或 `<head>` 之内，
  `body > *:not(#sp)` 仍覆盖整页。以后别再把这句写成"一定在原站界面画出来之前"。
- **`SP.CSS.length` 这枚指纹会被运行时状态带偏**：本机产物里算 0.1.11 = 47707，浏览器里也是 47707
  （这一版对上了）；但文档原表里 0.1.8=51407、0.1.9=51763，与从产物里算出的 48733 / 51713 对不上 ——
  同一份产物两个数，说明它受页面状态影响。**别拿"从产物里算出的 CSS 长度"去比"浏览器里装的是哪一版"**，
  要比就用同一台浏览器同一页面状态下量的值。
- **0.1.11 的自动补全菜单修复在真实安装路径下完整复现**（此前只验过注入式）：上传卡片里输入 `2060`
  → 菜单 `display:block`、两条候选（`GeForce RTX 2060` / `GeForce RTX 2060 SUPER`）、
  `data-theme="dark"`、底色 `rgb(17,20,25)`（我们的 token）、class 含 `sp-acmenu`；
  选第一项 → label 填 `GeForce RTX 2060`、隐藏字段填 `gpu_2849`、菜单关闭；
  `$(label).trigger('blur')` → `block`→`none`；在 `#sp` 外壳上派发真实 `mousedown` → `block`→`none`
  且没有导航。三个时刻 `#sp-guard` 都在。
- **测法上两个坑（都当场栽过，记下来）**：① 拿"菜单里有 `<li>`"当"菜单已打开"是错的 ——
  上一次搜索残留的隐藏菜单项会立刻满足它，于是量到的是"还没打开"（表现是 `before` 就是 `none`）。
  要等 `display === 'block'`。② "点外面"的靶子不能用 `<a>`：用了导航里的品牌链接，一点就离开
  `#/upload`、上传卡片被销毁，后续全部量到"输入框不存在"。改成在 `#sp` 外壳上派发。
- **`chrome.debugger.sendCommand` 这条路在本机不通**：浏览器 MCP 代理把它当空操作 ——
  所有命令都 resolve `null`，`Runtime.evaluate` 写下的全局变量与 DOM 节点事后再查都不存在
  （页面侧确认 `typeof window.__sp_probe === 'undefined'`）。所以"限速 + 加载期采样"没做成。
  这一条别按 CDP 去设计验证。
- **仍未验证**：首次绘制之前是否每次都能抢到（只能靠上面那条竞态结论）；以及 0.1.10 → 0.1.11
  这一跳之外的其它升级路径（如从 0.1.8 直接跨到 0.1.11）。

**0.1.12（2026-10-06 起，尚未发布）**：`@version` 从 0.1.11 升到 0.1.12，因为这一版的产物已经和
线上的 0.1.11 不是同一份（会话页表格的列宽、两处未译原因、`sess.prjSub` 去尾；见 `src/30-style.js`、
`src/50-views.js`、`src/10-core.js`）。**从这一刻起，仓库里的 0.1.11 与线上的 0.1.11 内容不同** ——
按「`@version` 必须往上走」那条规矩升的，发不发等用户点头。

**0.1.12 里的缺陷修复：加入/移出渲染优先后会闪一下「暂无数据」**（2026-10-06，用户实报，
原话是"选择某用户加入优先，再删掉会出现暂无数据"）：`submit()`（`src/80-app.js`）POST 成功后先把
`state.account` / `state.session` 置空，再用 `show(view, { silent: true })` 重取；而 `{silent}`
不设 `state.loading`（`need` 里也没有 account 分支），所以这段重取窗口里**任何一次 `render()`**
都会走"数据为 null"分支画成 `state.empty()`。**不是名单为空** —— 名单空显示的是「（空）」。
最容易中的触发点：`prio-set` 原来不像 `owner-gift` / `owner-block` 那样清 `Views.projState.menu`，
菜单一直敞着，随手点一下菜单外面就是一次 `render()`；切页签、Esc、刷新按钮同理。
修法三处：`need` 补 account 分支、置空后设 `state.loading = true`（**不**立刻 render）、`prio-set` 关菜单。
实测（真站点 + 注入改动后的产物，只看 `#sp-body` 的内容签名）：账户页首次进入
`SKEL:5` → 1.3s → `PANELS:3 TABS`；窗口内切页签 `PANELS:3` → `SKEL:5` → `PANELS:1`；
项目列表页 kebab → 优先 后菜单收起、56 行不变。**修之前这三处画的都是「暂无数据」**。

**0.1.13（2026-10-06 起，尚未发布）**：`@version` 从 0.1.12 升到 0.1.13（0.1.12 从未发布过，但仓库里的
0.1.12 产物已经变过几轮，升号才能让 Violentmonkey 明确认成一次更新）。这一版做的是**上传闭环的后半段**，
按用户 2026-10-06 拍板的路线 A：第三步只补翻译与外观，再接管项目管理页。

- **第三步（分析完成后的站点设置表单）**：注入站点表单后显式调 `SP.DomI18n.translateSubtree(box)`
  （`src/80-app.js` 的 `paintAnalyse`）—— 翻译器默认跳过 `#sp` 内的节点，不显式放行就永远不翻。
  只翻文案、不动结构：站点 JS 按 id 拼 24 个参数，改结构就断。实测（拿 `.tmp/upload-test/step3-outer.html`
  当 fixture）可见文本 13 行只剩文件名 `sptest.blend`（故意不翻），属性只剩 `title=CPU` / `title=GPU`；
  控件 58→58、id 74→74、`formAction` 仍是 `javascript:;`、`onsubmit` 仍是 `doAddProject(0); return false`。
- **「排队情况」那段英文**（用户实报）：`src/12-lang-zh.js` 的 `patterns` 补了短变体
  `The render order is based on points. … You currently have N points.`；原来那条长变体（带团队加成）
  仍在 `blockPatterns`，两条互不冲突。
- **接管 `/project/<数字>` 项目管理页**（`viewForPath` 新增一条路由 → 视图 `project`）：**不重新 fetch**，
  而是把站点服务端渲染好的那一整块 `.w-section`（含 `#jobs_of_a_project`）**搬进** `#sp-mg-host`，
  id、内联 `onclick`、表单全不动 —— 站点的 `projectAction` / `doModifyComputeMethod` /
  `doModifyAttributeFromCheckbox` / `doAddACLUserProjectManage`（都在 `media/<ver>/script/ajax/showjob.js`）
  因此照旧可用。渲染前 `parkManage()` 先把活节点送回原位的注释锚点，免得被 `body.innerHTML` 连同旧壳扔掉；
  找不到 `#jobs_of_a_project`（别人的项目、站点改版）时 `boot()` 直接 `release()`，页面原样还给用户。
- 站点的 `title` 属性也当文案用：动作按钮的图标写的是 Font Awesome 4 类名（`fa fa-search-plus`），
  而站点装的是 FA6，`::before` 根本没内容、按钮是空心圆 → 我们直接把 `title` 当按钮文字；
  帧缩略图站点只把 `<img src>` 塞在 `span.square` 的 `title` 里（原页面每帧都是空白小方块）→ 抠出来插真 `<img>`。
- 日期本地化：`src/12-lang-zh.js` 加 `farmDate()`（`20th Oct 06:10` → `10月20日 06:10`）；
  `patterns` 的替换值可以是函数（`src/10-core.js` 用的是 `text.replace(re, rep)`）。

实测（Helium + BrowserSkill 驱动真站点，测试账号 `muwyelkoai3k`，注入 `dist` 产物）：

| 检查 | 结果 |
| --- | --- |
| 第三步翻译（fixture） | 可见文本无英文残留；结构 / 控件数 / id 全不变 |
| 管理页接管 | `#sp-mg-host` 子节点 1、`.sp-manage-sec` 已搬入、徽章「已渲染」、正文只剩 `sptest.blend` |
| 页签（权限 / 渲染者 / 操作） | 点「权限」→ `tab-pane active` + `display:block`，另一个 pane 隐藏 |
| 管理员自动补全 | 输入 `muw` → 站点读接口 `/user/list_from_term` 建出 8 项候选（**只读，无写入**） |
| 顶栏刷新 → `show(view)` | 送还 + 再搬入各一次：`#jobs_of_a_project` 仍 1 个、`onclick` 原样、缩略图 2 枚 |
| 别人的项目 `/project/1223983` | 站点自己回「无权限」页 → 我们 `release()`：`#sp` / `#sp-guard` 都不在，页面照常可见 |

**样本从哪来**：这两页只对项目所有者开放，所以 2026-10-06 用测试账号真走了一遍上传（`sptest.blend`：
Blender 4.5 默认场景、2 帧、160×120、Cycles 8 采样 → 项目 `/project/1224469`），第三步表单与项目管理页
因此第一次有了**真实样本**（`step3-outer.html`、`manage.html` 落在 `.tmp/upload-test/`，`.tmp/` 不入库）。
**验证方式仍然是注入式**（把 `dist` 产物在页面里 eval 一遍），不是真装路径 —— 真装路径下的管理页
要在用户点过重新安装之后再复验一次。`/getstarted` 依旧有意不接管（0.1.10 拍板），上传只走应用内那一页。

**体积提示线**：`build.mjs` 的 `BUDGET_OUT_BYTES` 从 285000 抬到 320000（这一版 +21 KB 后原线会每次
构建都报，报久了没人看）；仍是**只提示不拦**，见该常量上面的注释。

**0.1.14（2026-10-06 起，尚未发布）**：`@version` 0.1.13 → 0.1.14。上传闭环的**最后一跳**：第三步
从"只翻文案"变成"自绘外观"，并补上面板级的上游指纹与提交护栏。用户 2026-10-06 拍板：外观 100% 自绘、
容器之间也用我们的布局，但 **4 个容器本体、27 个控件的 id/name、提交方式一律保留站点原样**，
"永不自己拼提交体"是硬约束。

- **新增模块 `src/60-step3.js`**（构建时按文件名排序，落在 `50-views.js` 与 `70-i18n-dom.js` 之间）。
  `SP.Step3 = { enhance, check, upstreamVersion, verifiedUpstream, report, fpRows }`。
  `enhance(box)` 做四件事：**搬**（把站点渲染好的活节点一个个 `appendChild` 进我们的面板 —— 不
  `innerHTML` 重建、不重新 fetch，id / 内联 `onsubmit` / 表单原样）→ **点名**（进面板前给 box 内所有
  `[id]` 拍快照 `{id,type,value}`）→ **提交前复点**（元素没了 / type 变了 / hidden 的值被清空 → 拒绝提交）
  → **接住结果**（成功会跳走；`.done` 出错时站点 `$('#addproject_content_i').html(data)`、`.fail` 时写
  `#addproject_error_box_i`，两种都被 `MutationObserver` 接住，把树放回去、按钮放回去，换成我们的文案
  并附上站点原文）。
- **提交护栏挂在祖先的捕获阶段，不是表单自己身上**（这一条是踩出来的）：submit 事件的目标就是 `form`，
  而在**目标节点**上捕获与非捕获**按注册先后执行** —— 站点那句 `onsubmit="doAddProject(0); return false"`
  是先注册的，挂在 `form` 上抢不到它前面，站点函数会照跑、`$.ajax` 会照发。挂在 `#sp-an-result` 的
  捕获阶段才拦得住（捕获阶段先于目标阶段，`stopPropagation` 之后事件到不了 form）。
- **三态开关**：设置页原来的"实验性 / 项目上传（兼容界面）"两态换成三档 `uploadMode`
  （`off` 不出现入口 / `compat` 兼容界面，默认 / `new` 新版）；旧的 `expUpload` 键不再读，值本身就是
  默认档，不需要迁移。同一行下方是**上游指纹卡片**：站点资源版本 vs 本脚本验证过的版本（一致 / 已更新 /
  读不到），以及上一次进入第三步与上一次提交前点名的结果（`up3Report` 存在 `NS:` 下）。
- 新词条：`set.upmode*` / `set.fp.*` / `up3.vis|cpu|frames|adv|needCompute|missing|rejected|netFail`
  （zh + en 两份），并删掉 `set.expUpload` / `set.expUploadHint`（grep 全仓库已无残留）。

实测（Helium + BrowserSkill，真站点 `/getstarted`，**注入 `dist` 产物**，页面里 jQuery 与站点
`addproject.js` 都是活的；把 `$.ajax` 打桩成"只记不发"，**全程零写入**；测试账号 `muwyelkoai3k`）：

| 检查 | 结果 |
| --- | --- |
| id / 控件保真 | `[id]` 34 → 34（丢 0、增 0）；`input,select,textarea` 29 → 29 |
| 表单语义 | `form#addproject_0` 仍 `action="javascript:;"`、`onsubmit="doAddProject(0); return false"`；提交按钮仍在 form 内；`#addproject_error_box_0` 仍在 form 外 |
| 站点畸形字段 | `#addproject_split_tiles_number_0`（name 被站点 PHP 拼坏的那种）原样保留，值没动 |
| **请求体逐字段比对** | 站点真函数 `doAddProject(0)` 在**改版前/改版后**各跑一次：27 个键**完全相同**（`diff: []`） |
| 面板 | `.up3-sec` 四块（可见性 / 计算方式 / 帧范围 / 高级选项）全部可见；降噪提示进了 `.up3-note` |
| 拦提交 | 抽掉 `#addproject_exe_0` 后点提交 → **ajax 调用 0 次** + 我们的文案；放回去再点 → 1 次 |
| 错误片段 | `cont.innerHTML = 'Failed to add project'` → `form` 被放回、提交按钮被放回、文案含站点原文 |
| `.fail` 路径 | `#addproject_error_box_0` 有字 → 清空 + "提交没有送到（网络或登录状态）：Error (timeout)" |
| 形状护栏 | 没有 `[id^=addproject_content_]`/`form[id^=addproject_]` 的 box → `{ok:false,reason:'shape'}` 且**原样不动**；重复调用 → `{ok:false,reason:'done'}` |
| 设置三档 | `off compat* new` → 点"新版"存储变 `new`；点"关闭"顶栏的"上传项目"消失 |
| 指纹卡片 | "站点资源版本：9b13032c … 与本脚本验证过的版本一致"；"上次提交前点名：34 个控件全部在位" |
| 野 token | `/project/add/bogus1234` → 服务端回 HTML 错误片段 → 走既有的"分析编号已经找不到了"，`#sp-an-result` 保持空、无异常 |

**真装路径已复验（2026-10-06，用户点过一次重新安装后）**：`/home#/settings` 上 `#sp` 建好、
`SP.Step3` 存在（这是"装的是 0.1.14"的判据）、`Step3.upstreamVersion()` 从活页面读到 `9b13032c`
并与 `verifiedUpstream` 一致、设置页三档为 `off compat new*`、指纹卡片三行都在、顶栏含「上传项目」。
**这一版页面侧 `SP.CSS.length = 56791`**（旧值 0.1.7=47615 / 0.1.8=51407 / 0.1.9=51763）。
截图：`.tmp/upload-test/install-0114-settings.png`。

**真流程 + 真提交已跑通（2026-10-06，测试账号 `muwyelkoai3k`，2 帧测试项目）**：
`/getstarted` 用站点自己的第一步表单（`action=/project/internal/upload`，`bsk upload` 送
`sptest.blend` 90,936 字节，点译成「发送此文件」的提交键）→ 落到 `/project/add/dB5Sq6`，
分析页接管并走完"排队等分析器接手… → 分析完成"；第三步画出 `.up3-sec` 四块、
`#addproject_content_0` 里 27 个控件、提交键「添加这个 blend」，服务端默认值逐项核对无误
（`changeType=animation`、start=1 / end=2 / step=1、`exe=blender405`、`path=sptest.blend`、
站点那个畸形的 `split_tiles` hidden 仍为空、cpu 选中 / gpu 未选、`public_render` 选中、
`generate_mp4` 未选、高级选项 `display:none`）。容器链完好：
`#addproject_content_0 → .form-light → .w-box → .w-section → .col-md-6 → .row → .container → section.slice`
—— 我们只在**容器内部**重排，没有把站点容器搬出站点结构。

点提交后站点真函数发出请求、浏览器跳到 `/project/1224486`（我们的管理页接管），
`up3Report = {stage:'submit', ok:true, n:34, missing:[], upstream:'9b13032c', verified:'9b13032c'}`
—— 真实提交那一刻 34 个控件全部在位。项目随后渲染完成（`已渲染 2/2`、已用存储 51.0 kB、
实际渲染用时 0m、自动删除日 `10月20日 06:10`）。截图：`.tmp/upload-test/up3-real-step3.png`、
`.tmp/upload-test/up3-real-project1224486.png`。

**仍未验证**：上游指纹只钉了 `9b13032c` 这一个版本，站点下次改上传链路时应当"卡片变红 +
建议切回兼容界面"，这条提示本身还没在真实改版场景里见过。

**0.1.15（2026-10-06 起，尚未发布）**：`@version` 0.1.14 → 0.1.15。管理页（`/project/<数字>`）的文案
收尾，外加一个真实缺陷的修复。

- **修：动作按钮的文字变成了一串原始标签**。管理页那几个动作按钮只带 FA4 的图标类名（站点装的是
  FA6，`::before` 没内容），所以 `wireManageDoc` 一直拿 `title` 属性当按钮文字；可站点给"生成压缩包"
  那个按钮的 `title` 里塞的是**状态 HTML**（`<strong>Generating archive.</strong><br>Current position: 1st…`），
  于是屏幕上出现字面标签。现在：`title` 里还有标签 → 去标签、取第一行当按钮文字、整段净化后逐行翻译
  再放回 `title` 当悬停提示；判据是"title 里还有没有 HTML"而不是"有没有 span"，所以重复跑是空操作
  （`render()` 会重入，搬回来的活节点还带着上一次那个 span）。实测（真站点 `/project/1224486`，
  注入 `dist`）：label 现在是「正在打包存档。」，`title` 是
  「正在打包存档。\n当前排位：第 1 位\n本项目任务数：1\nShepherd 上的任务总数：50」。
- **词条落错了表（自己踩的）**：0.1.14 之后补的那 11 条短词条被写进了 `blocks:`（长句整块表），
  而 `patchBlocks` 要求整块归一化文本 **40–600 字**（`src/70-i18n-dom.js:117`），
  `title`/`placeholder`/`value` 又只查 `site`+`patterns`（`src/70-i18n-dom.js:57-60`）—— 短句永远不会命中。
  已搬进 `site:`。这条结构性事实值得记住：**<40 字的词条只能进 `site:`；属性值只查 `site`+`patterns`**。
  为了让这类错误可回归，新增只读体检脚本 `.tmp/check-dict.mjs`（vm 沙箱里跑 `10-core` + `12-lang-zh`，
  对着一串真实页面文本问 `I18n.siteText()`；沙箱里 `navigator.language` 不生效，必须先手动 `I18n.init()`）。
- 新增词条（zh）：调度器那一段（`Scheduler` / `How many machines can actually render the project?` /
  `Connected machines:` / `Connected machines for CPU:` / `Potential rendering machines:` / `Pause` /
  `Resume` / `Current renderers:` / `Rendering` / `Paused` / 限速提示 / `Ask for a partial Archive Frame`）、
  已渲染状态（两句 packed 的**无空格拼接形态**加带空格变体、`Download video`、`Statistics about the render`、
  两张缩略图 Note、`Generating archive.`、`More information about …`）、以及私有/封禁/服务器不可用那几句
  （**故意不加单词 `private`** —— 全站任何独立的 `private` 文本节点都会被误伤，宁可那一句留半截英文）。
- 新增 patterns：`Current position`（输出「第 N 位」）/ `Tasks for this project` / `Total tasks on Shepherd` /
  `Cumulated time of render` / `Points spent` / `n/m (remaining …)` / 封禁原因 / 限速，以及**两条齿轮 tooltip
  的 HTML 形态**（属性值是带 `<strong>`/`<br>` 的原文，先例是帧缩略图那条 tooltip）。`Connected machines:`
  这类**值在兄弟 `<strong>` 里**的行，文本节点只到冒号，所以既有 pattern 永远不命中，靠 `site:` 短键兜住。
- 实测：真站点 `/project/1224486`（已渲染态）注入后，`#sp` 内未译英文从 7 条降到 6 条，其中 4 条是数据
  （用户名 `muwyelkoai3k`、文件名 `sptest.blend`）或探针白名单误报，`Tab widget` 那条实测 `display:none`；
  `div.alert` 四段全部变中文。
- 体积：`dist` 321,161 字节（注释 48,899 = 15.2%）。构建提示线从 320,000 抬到 **360,000**
  （0.1.13 抬到 320,000 之后 0.1.15 正好贴线 —— 提示线贴着现状就等于每次构建都报）。
- **真装路径已复验（2026-10-06，用户点过重新安装后，真站点 `/project/1224486`）**：页面里跑的是用户装的那份，
  `SP.I18n.siteText()` 对 0.1.15 才有的词条全部命中（`Scheduler` → 调度器 / `Current position: 1st` →
  当前排位：第 1 位 / `Tasks for this project: 1` → 本项目任务数：1 / `Total tasks on Shepherd: 50` →
  Shepherd 上的任务总数：50 / `Connected machines:` → 已连接机器： / 两句 packed / `Generating archive.` /
  `More information about …` / `Pause` → 暂停 / 限速提示 / 封禁那句 / 缩略图 Note）；三个动作按钮
  label = 查看帧图像 / 下载帧图像 / 删除项目，**没有一个是含 `<` 的原始标签**（0.1.14 那个字面标签缺陷
  在真装路径上确实没了）；页面文本除 `Tab widget`（`display:none`）外全中文。
- **仍未验证**：私有 / 封禁 / 限速那几句（测试账号没有这些状态），只能靠 `.tmp/check-dict.mjs`
  在词典层逐条验证。等待/渲染中态的调度器那一段**已在 0.1.16 补齐实证**（见下）。

**0.1.16（2026-10-06 起，尚未发布）**：会话页「机器信息」里的原始值与一个死键 —— 也就是 Q5 那笔旧账。
本版没有新功能，只有"站点给的值不是给人看的字"这一类收尾。

- **站点把内部枚举当值印出来**（会话页 `/session/<id>` 的「机器信息」表）：`OS = linux`、
  `Scheduler = very_slow_computer`（这格说的是**这台机器跑多快**，跟"调度模式"没关系，站点自己的页面
  标题就叫 Scheduler）、从没活动过的机器几格印字面 `Never`、Action 那格是
  `<input type="button" value="Pause">`。现在这些值在界面上翻成人话，**原文进悬停提示**
  （`站点内部值：very_slow_computer`）：行标签『调度模式』改成『速度档位』，副标题改成
  「站点报告的原值，未做换算；内部枚举翻成了人话，原文在悬停提示里」。识别规则只有三条
  （`never` 大小写不敏感 / OS 表 / 速度档表），**认不出的值一律原样显示** —— 站点哪天加新档，
  界面上照样看得见，不会被翻成空白。
- **日期本地化下沉到语言包**：新增可选字段 `pack.dateText`（`src/12-lang-zh.js` 注册时给出），
  核心加 `I18n.date()` 转发；站点两种日期形状 `20th Oct 06:10`（管理页）与 `06:40 Sep 29`（会话页）
  都本地化成 `10月20日 06:10` / `9月29日 06:40`，认不出的形状原样返回。原来只认第一种形状的
  `farmDate` 扩成两种后，管理页那条已验证过的 pattern（「项目将于 10月20日 06:10 自动删除」）
  用 `check-dict.mjs` 复查过没有回归。
- **死键**：`sess.publisher`（『发布者』/ `Publisher`）从 zh/en 两份词典里都删掉 —— 全仓库 grep
  只有词典里有它，**没有任何代码 `t()` 它**（相邻的 `packLabel('sess.status', …)` 只拼 `sess.status.*`）。
- 单位与时长仍按站点原值显示（`10m` / `9m` / `8h27m`）：它们是数字+单位，不是被误当文案的枚举，
  副标题那句"未做换算"就是这个意思。另外补了一条 `site:` 短词条 `never` → 「从未」，管的是
  **我们没重制的站点页面**（原版账户页那三行红字 `never`）。
- **验证方式：真数据在本地快照上跑**。别人的 session 页我们打不开 —— 真站点 `/session/2155361`
  在我们的视图里只显示「读取失败 / 这一页没读到机器信息」（站点不给非属主数据，实测）。所以把真站点
  抓下来的 `.tmp/fixtures/raw/session.html`（43,281 字节，owner `miaocang`，正好
  `OS=linux` / `Scheduler=very_slow_computer`）放进夹具服务器，在**页面上下文里**喂给
  `S.Api.parseSession()` + `Views.session()` 渲染（探针 `.tmp/upload-test/probe-sessview.js`；
  跨源 fetch 到 8742 可用）。结果：`[速度档位] = [极慢档] tip=[站点内部值：very_slow_computer]`、
  `[创建时间] = [9月29日 06:40]`、`[可用动作] = [暂停] tip=[站点内部值：Pause]`、
  身份条 `Linux`（tip `站点内部值：linux`）、KPI 描述「自 9月29日 06:40 起」。
  同一份快照的英文残留扫描（`.tmp/upload-test/probe-sessleftover.js`，列出含拉丁字母的文本节点）
  从 37 条降到 35 条：剩下的全是数据（项目名 26 条、主机名 `SheepIt-Docker`、用户名 `miaocang`）
  与 CPU 型号串 `Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz x 6`。
- **补 0.1.15 那条"仍未验证"**：真提交第二个 2 帧测试项目（`/project/1224491`，同一条真流程：
  站点第一步表单 → `/project/add/Qf0MYz` 分析 → 第三步 → 点提交）后 4 秒抓到的正是**等待态**，
  调度器那段全中文：「调度器 / 有多少台机器能真正渲染这个项目？ / 已连接机器： 474 /
  CPU 已连接机器： 245 / 474 / 能用 Blender 4.5+ 的机器： 202 / 245 / 潜在渲染机器： 202」，
  动作按钮「查看帧图像 / 暂停 / 删除项目」，该态残留只有 3 条（用户名、文件名、`display:none`
  的 `Tab widget`）。截图 `.tmp/upload-test/up3-waiting.png`。测试账号下曾留着两个项目：
  1224486（已渲染完）与 1224491（等待中）；**收尾时两个都用站点自己的删除按钮删掉了**
  （管理页红键 → `projectAction(id, 'remove_no_redirect')` → POST `/project/<id>/remove_no_redirect`
  → 站点回 `EMPTY` 并自己跳 `/user/profile`；重访两页都是站点的「无权限」页）。
- 体积：`dist` 325,494 字节（注释 50,353 = 15.5%）。
- **收尾时踩到的一个假警报：先看一眼"界面档"再判缺陷**。用户浏览器当时停在**原版界面档**
  （`Util.store.get('uiMode', 'modern') === 'classic'`）—— 这一档下我们**不接管任何页面**
  （`80-app.js:81` 的 `uiMode === 'classic' || !pathView` 分支），只补翻译并挂左下角两个药丸
  （`#sp-mode-pill` 文字「切回新界面」、`#sp-lang-pill` 文字「译 ZH」）。于是 `/project/1224486`
  上 `#sp` 不存在、`SP.app.state` 读不到、站点原版页面照常显示。这不是缺陷，但**真装复验之前
  必须先确认这一档是 `modern`**，否则很容易把"没接管"当成回归去查。

---

### 0.2.0（2026-10-07 已发布）

**主题：上传链路按上游源码重写，四档开关（关闭 / 原版 / 兼容 / 新版）。**

上游契约逐条核对：GitLab `sheepitrenderfarm/www` 的 master HEAD = `9b13032c`，与当时线上资源
路径 `/media/9b13032c/` 同值。三个服务端接口全部对着源码核过，落在新增的 `src/62-chain.js`：
上传 `POST /project/internal/upload`（multipart：`addproject_archive` + `UPLOAD_IDENTIFIER`，
成功 302 → `/project/add/<token>`）、轮询 `GET /project/add_analyse/<token>`（JSON `RETRY` /
`PROCESSING` 或 HTML 碎片）、提交 `POST /project/add_internal`（27 键，成功体是 `http…` 开头的
绝对地址）。新增 `src/64-step1.js`（新版上传页）与 `src/68-step3.js`（新版第三步，自绘自提交）。

**真机实测**（真站点 + 注入 `dist`，测试账号 `muwyelkoai3k`）：

- 真机上传 `sptest.blend`（89 KB）→ 站点建分析记录、302 到 `/project/add/aGJVQC`。
- 等待页轮询显示「分析器正在读：0 / 1 个文件」→ 分析完成后自绘第三步：引擎 CYCLES /
  blender405 / 160×120 / 24 fps / 采样 153600 / 8 像素 / .png / 降噪 / 自适应采样 / 无头渲染。
- **提交前拦截**（`SP.Chain.submit` 换桩，**没有发请求**）：27 键齐全、值正确。
- **四分支逐键一致**：真碎片（EXR/降噪）、tiles 下拉、samples 滑条、单帧+滑条，各 27 键、
  **零差异**（`.tmp/upload-test/probe-eq.js`）。
- 兼容档与新版档在同一真实编号上的截图对比：`.tmp/upload-test/step3-v2-compat-vs-new.png`。
- **架构性保证**：解析碎片用 `DOMParser`，站点 HTML **永不进活文档** —— 0.1.14–0.1.17
  「两份同名表单」那一整类缺陷结构上不可能再出现。
- 失效模式可见（用户拍板的 A 方案：两条路都留、都"坏得响"）：`62-chain.js` 的 `KNOWN_IDS`
  结构指纹 + `model.unknown` → 第三步提示条 + 设置页指纹行变红；`50-views.js` 的
  `shapeNotice()` 在兼容档拼不出来时明说并给出切档办法。
- 2026-10-07 本轮 impeccable critique（dual-agent，含真机截图与确定性扫描）分数 **27/40**，
  快照在 `.impeccable/critique/2026-10-06T21-38-40Z__src-68-step3-js.md`；五条改进项尚未动手。

**本轮未验证（别当成已验证）**：

- 真机点「添加这个文件」真正建项目（每次都要用户点头，只跑到"提交前拦截"为止）。
- 新版上传页的错误分支（站点维护中 / 无头像账号 / 并发上限 / 站点拒绝原因的就地显示）
  只用桩验过，没有真实截图。
- 第三步的其它分支形态（EXR 切块清单、多 .blend 存档、`up3x.unknown` 指纹提示条、
  提交中 / 提交失败 / 已提交）。
- **用户从 0.1.11 更新到 0.2.0 的那一跳**（装机实测）：旧设置键里 `uploadMode` 的
  `site`/`compat` 已做兼容归一，`uiMode`/`translateSite`/`lang`/`scale` 未动。
- 防闪守卫的 race（第四期遗留）：`#sp` 注入早于站点渲染时仍有闪一下的风险。

**发布记录（2026-10-07）**

这是**跨版本发布**：GreasyFork 上一直停在 `0.1.11`，`0.1.12`–`0.1.18` 从未发布，所以这一跳是
`0.1.11 → 0.2.0`。流程按「四」末尾那条走，逐项结果：

- `@version` 0.1.18 → **0.2.0**；`node build.mjs` 通过（443,433 字节 / 8,173 行 / 注释占比 17.5%）；
  `node .tmp/make-stage.mjs` 通过（版本一致性检查是它拦的，不是人眼看的）。
- **发布件指纹**：`dist` 与 `.tmp/publish-stage/sheepit-plus.user.js` **逐字节一致**，
  SHA-256 = `2ED23064844DDEF9E6F02EAA514DD807B8C2C314E61815B84532F1B602E88DA9`。
- **提交前的自检**：对填好的 `script_version[code]` 求 SHA-256，与上一行一致才点提交
  （不再是"拿 dist 去比"，比的是**真正会提交的那串字符**）。
- **入库核对**（脚本页版本号说了算）：脚本页 = `0.2.0` / 433.0 KB；`/scripts/598624/code`
  （直读库）里 `up1-drop`、`Step3x`、`62-chain.js`、`add_internal`、`KNOWN_IDS`、`up3x.degrade`
  全在，0.1.x 时代的 `sp-inline` 已不在；脚本页正文已是 0.2.0 那版（含「上传项目」四档那段），
  旧的"后两步还是站点自己的界面"已消失。
- **CDN 复现第八次**：`update.greasyfork.org` 的 `.user.js` = **443,429** 字节 vs 本地 **443,433**，
  差的仍是 `@updateURL` / `@downloadURL` 那 4 个空格（这次 CDN 没滞后，发布后立刻就是 0.2.0）。
- **发布前的真机冒烟**（注入 0.2.0 产物到真站点）：新版上传页 `hasUp1:true`、第三步
  `view:analyse / token:aGJVQC / hasUp3:true`，真数据齐全。
- 0.1.11 → 0.2.0 这一跳的**装机实测仍未做**（见上面「本轮未验证」）。
- **发布之后仓库又改了**（`77c6042` 起）：上传页的发射前闸门/取消/剩余时间、第三步标题层级、
  硬约束就地提示、须知折叠、估算器降权等。**这些改动不在 0.2.0 里** —— 线上仍是发布时那份
  （SHA-256 `2ED23064…`）。下次发版会把它们带上，`@version` 要继续往上走。

### 0.1.18（2026-10-06 起，尚未发布）

**两块内容**：① 新版上传第三步的控件皮肤全部自绘（控件本体仍是站点原版，只换外观）+ 设置页那张
指纹卡压成一行；② **修掉一个真缺陷：第三步的表单在页面上有两份，站点提交时读的是壳后面那份原件**。

**缺陷（0.1.14 起一直存在，本轮才查出来）**：
`80-app.js` 的 `paintAnalyse()` 拿到我们自己的 GET `/project/add_analyse/<token>` 结果后执行
`box.innerHTML = s.html` —— 这是把服务端渲染的整块表单**当字符串复制**进 `#sp-an-result`。
与此同时站点自己的轮询 `doAnalyseUploadedProject()`（`addproject.js:177-211`，由页面内联脚本起
`setTimeout(..., 5000, token)`，写完就停）把同样的 HTML 写进它自己的
`#project_add_analyse_result`，那份原件留在原地、被我们的整页外壳盖住。
⇒ 页面上每个控件 id 都有两份；而站点取值一律 `$('#id')`（`doAddProject` 逐 id 读，
`$('#public_render').is(':checked')` 这种写法，见 `addproject.js:1-101`），jQuery 命中文档序靠前的
**隐藏原件**，于是：**用户在新版第三步里改的任何值都提交不上去，提交的是服务端默认值。**

**为什么 0.1.14 的验收没发现**：验收跑的是"值全留默认"那条路径（payload `diff: []` 就是这个意思），
而"34 个控件全部在位"那次点名查的是 `document.getElementById(rec.id)` —— 命中的正是那份隐藏原件。
两边行为一致，所以三次真提交（1224486 / 1224491 / 1224502）都"成功"了，看不出问题。
本轮用「先在原版页面给每个节点打标记、再注入」+「点界面上的勾选框、再回头问 jQuery 状态」
两个实验才把它钉死（点完之后 `$('#public_render').is(':checked')` 仍是 `true`）。

**改法（`src/80-app.js`）**：搬活节点，不复制 HTML。
- 新增 `hideStaleAnalyse()`：在 `box.innerHTML = s.html` **之前**把站点那份
  `#project_add_analyse_result` 从文档里摘下来（存 `anStale`），原位留一个 `<!--sp-analyse-->`
  注释锚（`anAnchor`）；
- 新增 `parkAnalyse()`：按锚点把摘下来的容器送回原位 —— `render()` 的重画前、`release()` 拆 `#sp`
  之前各调一次，和既有的 `parkManage()` 同一套路。

**实测（真站点 + 真流程，token `40c6Bk`）**：
- 注入前（classic 档、站点原版页面）：`#project_add_analyse_result.container` 存在、`1170×533`、
  内含 form、`[id]` 共 34 个、`$('#public_render')` 只 1 份且 13×13 可见。
- 注入 0.1.18 之后：同名 id **每个都只剩 1 份**（`addproject_0` / `addproject_content_0` /
  `public_render` / `generate_mp4` / `compute_method_cpu` / `addproject_animation_start|end|step_frame_0` /
  `addproject_exe_0` / `token` / `addproject_submit_div_0` / `addproject_error_box_0` 全 = 1；
  `addproject_split_animation_sample_range_value_0` = 0 是站点对 animation 本来就不给这个元素）；
  `staleContainerInDoc: false`、注释锚 `["sp-analyse"]`、`controlsInBox: 34`、`up3secs` 四块齐全。
- **用站点自己的取值路径读一遍 payload**（探针 `.tmp/upload-test/probe-payload.js`，逐条对照
  `addproject.js:1-101`，**不发任何请求**）：27 个键齐全；每个 id 的 `$('#id')[0]` 都指向 `#sp` 里那份
  （`jqHit: true`）；在界面上取消「所有成员均可渲染」、勾上「生成 MP4 视频」之后，payload 读到
  `public_render: "0"`、`generate_mp4: "1"`（服务端默认分别是 1 和 0）⇒ **界面上的改动进得了 payload**。
- 指纹卡改成一行：`9b13032c · 已核对 34/34`，悬停提示放三行细节（站点资源版本 / 与本脚本验证过的
  版本一致 / 上次进入第三步的时间与控件数）；没走过第三步时是 `9b13032c · 还没走过第三步`。
- 控件皮肤：「新版（实验）」档的第三步里，站点那两张 PNG（`cpu_enabled.png` / `gpu_enabled.png`）
  换成我们的 SVG（16×16；CPU 选中时是主题色 `rgb(182, 71, 47)`、未选是 `rgb(75, 84, 98)`）；
  「预计排队 / 项目总数」那两行裸文本包成 `.up3-hint`（`display:block`、11.5px、`#656d79`，
  两行之间多余的 `<br>` 清掉）；勾选框/单选框/输入框/下拉一律 `appearance:none` + 自绘
  —— 站点 CSS（`base-light.css` / `base-main.css` / `bootstrap.min.css`，已下载到
  `.tmp/upload-test/site-css/`）里没有任何一条规则在画这些控件，之前看到的"橙色勾选框"其实是我们自己
  `30-style.js` 里那条 `accent-color` 的效果，本轮已删。
- 构建：`dist` 337,536 字节（注释 55,354 = 16.4%）。

**踩到的坑（写下来免得再踩）**：
1. **`new $.ajax(url, opts)` 的 URL 是第一个参数**。为了不真提交我写了个 `$.ajax` 桩，只拦 `opts.url`，
   结果站点那次调用没被拦住、**真提交了**，建出项目 1224502（`public_render="0"`，因为探针刚把界面上
   那个勾选框点掉）。事故反过来成了最硬的证据：该项目管理页显示站点的
   「Your project is **private**, not every worker will be able to participate in your project.」提示
   ⇒ 提交上去的正是界面里的值（不是默认值）。项目 1224502 事后用站点自己的删除按钮删掉了
   （`projectAction(id, 'remove_no_redirect')`，与 1224486 / 1224491 同一条路径）。
2. 站点那句私有提醒被 `<strong>` 切成三段文本节点，`site` 表（逐节点精确匹配）配不上整句；
   逐节点配 `'Your project is'` / `'private'` / `', not every worker…'` 能翻，但 `textNodeValue`
   会保留节点首尾空白，渲染成「你的项目是 私有的，…」—— 中文里多一个空格，难看。
   最终走 `blockPatterns`（整块 textContent 正则 + 替换值自带 HTML）：
   `/^Your project is private, not every worker will be able to participate in your project\./`
   → `你的项目是<strong>私有的</strong>，不是所有 worker 都能参与你的项目。`
   （实测渲染为「你的项目是私有的，不是所有 worker 都能参与你的项目。」）
3. `#public_thumbnail` 这个键：账号不能自己关缩略图时，站点渲染的是
   `<input type="hidden" id="public_thumbnail" value="1" checked>`（`UI__HTML.php:1057`），
   而站点自己用 `$('#public_thumbnail').is(':checked')` 取值 —— hidden 输入永远 `:checked === false`
   ⇒ 站点一直提交 `public_thumbnail=0`。这是站点自己的既有行为，我们照原样透传、不动它。
4. 「切回原版界面」是 `Util.store.set('uiMode','classic')` + `location.reload()`（`80-app.js:661-664`），
   所以搬进壳里的活节点（管理页的 `.w-section`、分析页摘下来的 `#project_add_analyse_result`）
   被重载连带销毁是安全的；只有"同一个页面里换实例"的调试场景（探针注入覆盖旧 `#sp`）会踩到。

**仍未验证**：控件皮肤与"两份表单"的修复只在站点当前这一版（`9b13032c`）上测过；
`public_thumbnail` 的 hidden 变体只在"不能关缩略图"的账号上见过。

---

### 0.1.17（2026-10-06 起，尚未发布）

**缺陷（用户实报）**：今天刚注册的账号，总览显示「还没有渲染记录」那张新用户卡，而站点原版页面
明明有数字（`Frames rendered 148` / `Points 20,062` / `Projects created 3`）。

**根因**：`50-views.js` 的 `overview()` 用
`hasData = points 时间线 > 1 点 || frames 时间线 > 0 点 || 热力图 activity > 0` 判断"有没有记录"。
站点对**新账号**是"有统计表、没有图表"：实测 `/user/muwyelkoai3k/profile`（66,793 字节）里
`line_points_timeline` / `line_frames_timeline` / `consecutive-render-heatmap` **三样整段不渲染**
（探针 `arrFlags` 全 false），但 `dl.dl-horizontal` 里有真数字（Projects created 3 / Frames ordered 6 /
Frames rendered 148 / Points 20,062 / Registration October 7th, 2026）。于是 `hasData` 为假、`st` 非空
→ 正好落进"新用户空状态"分支。同页 `parseMachines` 其实读到了 1 台在线机器
（`CLOUDCOMPUTER` / `GeForce RTX 3060`），也被一并忽略。

**改法**（都在 `src/50-views.js`）：
- `asCount` 提到模块作用域（原来定义在 `hasData` 之后的分支里，判断用不到它）。
- `hasData` 增加三类证据：统计表里 `Frames rendered` / `Points` / `Time rendered` 任一 > 0、
  `p.machines.count > 0`、`p.sessions.length > 0`。
- 「当前连续 N 天」这张 KPI 只在**有产出日历**（`daily.length || activity.length`）时才画：
  数字是从日历算出来的，站点不给日历就会给新账号摆一个"连续 0 天"。

**实测（真站点注入 0.1.17）**：
- 新账号总览：`emptyCard: false`；KPI = 已渲染帧数 148 / 积分 20,062 / 累计渲染时长 — / 建的项目 3 /
  订的帧 6（连续天数那格没画）；「渲染产出」面板如实写「站点没有为这个账号提供产出日历」（`heat.none`）；
  「已连接的机器 共 1 台 CLOUDCOMPUTER GeForce RTX 3060」。截图 `.tmp/upload-test/ov-after-fix.png`。
- 回归（数据齐全的 `/user/johnnyvillas/profile`）：KPI 六格都在（含「当前连续 1 天 / 历史最长 16 天 ·
  近 30 天活跃 2 天」）、热力图有真实数据（6 天有渲染）、机器面板「共 2 台 · 当前没有连着算力的客户端」。
- 构建：`dist` 326,448 字节（注释 50,962 = 15.6%）。
- **仍未验证**：只实测了"统计表有数字、图表缺席"这一种新账号形态；站点何时才给新账号渲染图表数组
  没查（在前端控制范围之外）。

---

## 六、OpenUserJS（可选）

同一份产物可以直接用，它也识别 `@updateURL`；说明字段同样接受 Markdown，直接抄「二」的正文。
两边都发时，`@updateURL` 只能指向其中一边（一般是 GreasyFork），另一边靠脚本页自身的更新机制。
