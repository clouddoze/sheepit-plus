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

Privacy

All data comes from pages you could already see, read with same-origin requests. No undocumented
endpoints, and no requests to third parties. The stylesheet and every chart are self-contained:
no analytics, no external fonts, no CDN. Your preferences live in `localStorage` under
`sheepit-plus:*`.

Three things can change anything on the server, and each is a button you press, posting to the same
endpoint the original page posts to: the forms in Account settings, pause/resume on a session page,
and add/remove in your render priority. The script makes no scheduling decisions and does not touch
points or frame accounting.

Prefer the old interface?

There is a one-click "switch to the original interface" in the top bar, and in the original
interface a small button to come back.

Requirements

Tampermonkey (Violentmonkey / Greasemonkey also work) and a signed-in SheepIt session — the script
reads data through your own session. No extra permissions: `@grant none`.

Known limitations

- The original CSS/JS still downloads; it is only hidden. A userscript has no network-layer blocking.
- Pages that are not rebuilt (`/faq`, `/project/*`, `/servers`, `/getstarted`, …) keep their original
  layout; text is replaced only where a translation exists. Uploading a project is its own page in
  the new interface (`#/upload`, behind the experimental switch); `/getstarted` stays the site's page.
- The last two steps of uploading a project are still the site's own interface: the project-settings
  form that appears once the analysis finishes (engine, frame range, tiles, samples, resolution…),
  and the project management page `/project/<id>`. They work; they just have not been rebuilt.
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

关于隐私

所有数据都来自你本来就能看到的页面，用同源请求读取；不调用未公开的接口，也不向任何第三方
发请求。样式和图表都是脚本自带的，没有统计代码、外部字体或 CDN。你的偏好存在 `localStorage`
的 `sheepit-plus:*` 键下。

只有三处会改动服务器上的状态，都是你自己点下去的按钮，提交到原站同一个地址：账户设置里的
表单、会话页的暂停/恢复、项目列表里发布者那格的优先/移出。脚本不参与渲染调度，也不碰积分
与帧数的计算。

想用回原版

顶栏有一键「切回原版界面」；原版模式下左下角留了一个切回来的入口。

前提

装 Tampermonkey（Violentmonkey / Greasemonkey 也可以），并且在 SheepIt 上已登录 ——
数据靠你自己的会话读取。不需要额外权限（`@grant none`）。

已知限制

- 原站的 CSS/JS 仍会下载，只是被隐藏了；油猴脚本没有扩展那样的网络层拦截能力。
- 未重建的页面（`/faq`、`/project/*`、`/servers`、`/getstarted` 等）保持原版界面，只在有译文
  时替换文案。上传项目在新界面里是单独一页（`#/upload`，需要在设置里打开「实验性」）；
  `/getstarted` 仍是原站页面。
- 上传项目的后两步还是站点自己的界面：分析完成后出现的项目设置表单（引擎、帧区间、切块、
  采样、分辨率…），以及项目管理页 `/project/<数字>`。功能正常，只是还没重做。
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
99.7→33.4 KB，产物 -20%）。

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

---

## 六、OpenUserJS（可选）

同一份产物可以直接用，它也识别 `@updateURL`；说明字段同样接受 Markdown，直接抄「二」的正文。
两边都发时，`@updateURL` 只能指向其中一边（一般是 GreasyFork），另一边靠脚本页自身的更新机制。
