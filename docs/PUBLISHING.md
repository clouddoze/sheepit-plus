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

英文段放在前面，是因为 GreasyFork 的读者以国际用户为主；这不影响界面本身的中文优先
（界面的基准语言与词表策略见 `PRODUCT.md`）。

---

## 二、Additional info 正文

### English（先贴这段）

**SheepIt Render Farm, with the 2013 interface replaced.**

SheepIt Plus is a userscript that rebuilds six parts of the site with a modern front end. It is
not a skin: it reads the site's own pages with a same-origin `fetch` + `DOMParser` and renders
the data in a new interface.

**What it rebuilds**

- **Overview** — `/home` and your profile: stat cards, points/frames growth curves, a render-activity
  calendar, connected machines, live site numbers.
- **Projects** — `/home/projects`: searchable, filterable, sortable; publisher name and avatar visible;
  progress numbers moved off the bar; a **render-priority toggle** on each publisher.
- **Ranking** — `/ranking/user`: built from the site's raw `data-sort` values, so precision doesn't
  suffer from "1.3 G" style abbreviations; your own row is highlighted.
- **Session** — `/session/<number>`: one machine's record — 20 machine facts (the render key stays
  masked until you reveal it), an activity summary per day (render time / events / jobs / failures)
  with the full log one click away, the projects it can render grouped by reason with their
  publishers, and **pause/resume for that machine**.
- **Account settings** — `/user/<you>/edit`: scheduler switches, render priority, avatar, e-mail,
  render keys, two blocklists. Submits go to the site's own endpoints.
- **Settings** — in-app: theme (system / dark / light), interface language, and a switch for
  translating the pages that keep their original layout.

**Privacy — it talks to nothing but the site**

Every piece of data comes from a page you could already see, read with a same-origin request. No
private or undocumented endpoints. No analytics, no external fonts, no CDN, no requests to third
parties of any kind — the stylesheet and every chart are self-contained. Your preferences live in
`localStorage` under `sheepit-plus:*`.

**Server state**

Only three things can change anything on the server, and each is a button *you* press, posting to
the very same endpoint the original page posts to:

1. the forms in Account settings,
2. pause/resume on a machine's session page,
3. add/remove a publisher in your render priority, from the project list.

The script never makes scheduling decisions for you and never touches points or frame accounting.

**Prefer the old interface?** There is a one-click "switch to the original interface" in the top
bar — and in the original interface it leaves a small button to come back.

**Requirements:** Tampermonkey (Violentmonkey / Greasemonkey work too) and a signed-in SheepIt
session — the script reads data through your existing session. No extra permissions: `@grant none`.

**Known limitations**

- The original CSS/JS still downloads; it is only hidden. A userscript has no network-layer blocking.
- Pages that are not rebuilt (`/getstarted`, `/faq`, `/project/*`, `/servers`, `/team`, `/forum`, …)
  keep their original layout; the translation layer only rewrites text it has a translation for.
- If the site is redesigned a parser can stop matching. The worst case is that one view says
  "no data" — the site itself is never affected.
- The Chinese word list is the most complete; English is the baseline and falls back to the site's
  own wording.
- Signed out? The script tells you to sign in on the original site.

**Not official.** This is a third-party interface rebuild, not affiliated with or endorsed by
SheepIt Render Farm. The name, the sheep and the orange are kept on purpose, so it stays
recognisable as *their* site.

**Written by an AI.** The code, the interface copy and the docs were produced by an AI assistant
(DeepSeek Harness) under a human's direction and item-by-item review — the human supplied the real
site material, made every product call, and checked each view against a live account. This is
stated so you can calibrate how much to trust it: if something breaks, tell me the page and what
you saw, rather than assuming the author has read every line.

MIT licensed. Feedback welcome — tell me which page and what you saw.

### 中文（接在后面贴）

**把 SheepIt Render Farm 那套 2013 年风格的界面换掉。**

SheepIt Plus 是一个油猴脚本，用新前端接管站点自己的数据 —— 不是叠一层皮肤：它用同源
`fetch` + `DOMParser` 读取站点页面，再把数据渲染成新界面。

**重建了这六处**

- **总览**（`/home`、你的个人主页）：统计卡、积分/帧数增长曲线、渲染活跃日历、已连接的机器、
  全站实时数据。
- **项目**（`/home/projects`）：可搜索、可筛选、可排序；发布者名字与头像可见；进度数字移到
  进度条外；发布者那格带**渲染优先级开关**。
- **排行榜**（`/ranking/user`）：用站点自带的 `data-sort` 原始数值排序，精度不受 "1.3 G"
  这类缩写字面量影响；自动高亮你自己。
- **会话页**（`/session/<数字>`）：一台机器的档案 —— 机器信息 20 项（渲染密钥默认遮住，点
  「显示」才出现）、按天的活动汇总（渲染时长/事件/作业/失败）与一键展开的完整日志、可渲染
  项目按原因分组并挂上发布者；**暂停/恢复这台机器**。
- **账户设置**（`/user/<你>/edit`）：调度开关、渲染优先级、头像、邮箱、渲染密钥、两组黑名单；
  提交打到站点自己的接口。
- **设置**（应用内）：主题（跟随系统/暗/亮）、界面语言、以及「是否翻译保持原版的页面」开关。

**隐私：它只和站点说话**

所有数据都来自你本已能看到的页面，用同源请求读取；不调用任何私有或未公开接口。没有统计，
没有外部字体，没有 CDN，不向任何第三方发请求 —— 样式表和每一张图都是自带的。你的偏好存在
`localStorage` 的 `sheepit-plus:*` 键下。

**会改动服务器状态的只有三处**，而且每一处都是**你自己点下**的按钮，提交到原站同一个地址：

1. 账户设置里的表单；
2. 机器会话页上的暂停/恢复；
3. 项目列表里发布者那格的「优先 / 移出」（渲染优先级）。

脚本不参与渲染调度，也不触碰积分与帧数计算。

**想用回原版？** 顶栏有一键「切回原版界面」；原版模式下左下角也留了一个切回来的入口。

**前提**：装 Tampermonkey（Violentmonkey / Greasemonkey 亦可），并且在 SheepIt 上已登录 ——
数据靠你自己的会话读取。不需要额外权限，`@grant none`。

**已知限制**

- 原站 CSS/JS 仍会下载，只是被隐藏；油猴脚本没有扩展那样的网络层拦截能力。
- 未重建的页面（`/getstarted`、`/faq`、`/project/*`、`/servers`、`/team`、`/forum` 等）保持
  原版界面，翻译层只在有译文时替换文案。
- 站点改版可能让某个解析器失效，最坏结果是那一个视图显示「无数据」，不会影响站点本身。
- 中文词表最完整；英文是基准语言，缺失的键回落站点原文。
- 未登录时脚本会提示你先在原站登录。

**非官方。** 这是第三方界面重制，与 SheepIt Render Farm 官方无隶属或背书关系。保留名称、
羊的形象与品牌橙，是为了让人一眼看出这是**他们的**站点 —— 不是另一个产品。

**由 AI 写成。** 代码、界面文案与文档由 AI 助手（DeepSeek Harness）在人的指令与逐项验收下产出 ——
真实站点样本由人提供，产品取舍由人拍板，每一个视图都在真实账号上复核过。之所以写明白这一点，
是让你知道该按什么标准去信任它：遇到问题请直接告诉我页面和现象，不必假设作者逐行读过这段代码。

MIT 许可。欢迎反馈：告诉我哪个页面、你看到了什么。

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

| 头字段 | 最终值 |
|---|---|
| `@namespace` | `https://github.com/clouddoze` —— 上传前定死，**此后不可再改**：Tampermonkey 与 Violentmonkey 都用 `@name` + `@namespace` 认脚本身份，发布后改动会让已装用户收不到更新、并在他们那里变成两个脚本 |
| `@homepageURL` | `https://greasyfork.org/scripts/598624` |
| `@supportURL` | `https://greasyfork.org/scripts/598624/feedback` |
| `@updateURL` | `https://update.greasyfork.org/scripts/598624/SheepIt%20Plus%20%C2%B7%20%E6%B8%B2%E6%9F%93%E5%86%9C%E5%9C%BA%E7%95%8C%E9%9D%A2%E9%87%8D%E5%88%B6.meta.js` |
| `@downloadURL` | 同上，把结尾换成 `.user.js` |

⚠️ **URL 里的 slug 是中文脚本名，不是交接文档原先假设的 `SheepIt%20Plus`。** 上面两条取自
脚本页「安装此脚本」的原样地址；服务端按 `/scripts/<id>/` 取脚本、slug 只影响可读性 ——
实测 `SheepIt%20Plus.user.js` 也能取到同样的 265,219 字节，但跟站点给的那条保持一致最稳。

发布新版的流程：改 `@version` → `node build.mjs` → GreasyFork 脚本页 →「更新」→（代码粘贴/
本地上传）→ 发布新版本。`@version` 必须往上走，已装用户靠 `@updateURL` 拉 `.meta.js` 比版本号。

---

## 五、OpenUserJS（可选）

同一份产物可以直接用，它也识别 `@updateURL`；说明字段同样接受 Markdown，直接抄「二」的正文。
两边都发时，`@updateURL` 只能指向其中一边（一般是 GreasyFork），另一边靠脚本页自身的更新机制。
