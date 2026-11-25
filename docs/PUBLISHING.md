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

A modern front end for SheepIt Render Farm.

SheepIt Plus is a userscript. It reads the site's own pages with same-origin requests and redraws
them as a new interface — not a CSS reskin.

What it covers

- Overview: stat cards, points and frames curves, activity calendar, connected machines.
- Projects and ranking: search, filter, sort; publisher actions (render priority, donate points,
  blocklist).
- Session: machine status, per-day activity summary, pause and resume.
- Account settings: scheduler and lists, donations, avatar, e-mail, render keys.
- Upload: upload, analysis wait and project settings (the site's own upload page is one setting away).
- Settings: theme, interface zoom and language; untouched pages get translated copy only.

Privacy

Everything comes from pages you can already see. No undocumented endpoints, no third-party requests,
no analytics or external assets. Preferences live in localStorage.

Actions that change the server are only the buttons you press, posted to the site's own endpoints:
account-settings forms, pause/resume, publisher actions, and adding a project. The script makes no
scheduling decisions and does not touch points or frames accounting.

Prefer the old interface?

One click in the top bar switches back; there is a way back to the new interface too. If the site
changes and a parser stops matching, the script says so and hands that page back to the site.

Requirements

Tampermonkey / Violentmonkey and a signed-in SheepIt session. No extra permissions: `@grant none`.

Third-party interface rebuild, not affiliated with SheepIt Render Farm. The name, sheep and orange are
kept so the site stays recognisable. MIT licensed.

### 中文（接在后面贴）

给 SheepIt Render Farm 换一套现代前端。

SheepIt Plus 是一个油猴脚本：用同源请求读取站点自己的页面，重绘成新界面 —— 不是覆盖一层 CSS 的换肤。

做了什么

- 总览：统计卡、积分与帧数曲线、渲染活跃日历、在线机器。
- 项目 / 排行榜：搜索、筛选、排序；发布者操作（渲染优先级、捐赠积分、黑名单）。
- 会话页：机器状态、按天活动汇总、暂停 / 恢复。
- 账户设置：调度与名单、捐赠积分、头像 / 邮箱 / 渲染密钥。
- 上传项目：上传 → 分析等待 → 项目设置（设置里可切回站点原版页面）。
- 设置：主题、界面缩放、语言；未重建的页面只翻译文案。

隐私

所有数据都来自你本来就能看到的页面，用同源请求读取；不调用未公开接口、不向第三方发请求，
没有统计代码或外部资源。偏好存在 localStorage。

只有你亲手点的按钮才会改动服务器状态，且都提交到原站同一地址：账户设置表单、会话页暂停 / 恢复、
项目列表的发布者操作、添加项目。脚本不参与调度，也不碰积分与帧数的计算。

想用回原版

顶栏一键切换；原版界面里也有切回来的入口。站点改版、解析器认不出时，脚本会明说，
并把那一页交回站点。

前提

Tampermonkey / Violentmonkey，以及已登录的 SheepIt 会话。不需要额外权限（`@grant none`）。

第三方界面重制，与 SheepIt Render Farm 官方无隶属关系；保留名称、羊和品牌橙是为了让人认得出
这是他们的站点。MIT 许可。

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

## 四、历史验证结论（0.1.x 时代，已归档）

> 早期逐版实测的细节已删除；旧提交也不再保留。留下的只有仍然有用的结论。

- **验证方式**：0.1.x 用「清掉已安装节点 → 注入 dist 到已加载页面」验证，与真实安装路径差在
  `@run-at document-start` 的注入时机。2026-10-06 起改为用户更新后新标签页实测；这条路径
  证明注入是**竞态**而非保证，页面慢时可能先露出原站。
- **CDN 缓存**：`update.greasyfork.org` 发布后可能仍返回上一版。核对时加 `?cb=<随机数>`，
  或直接读 `/scripts/<id>/code`（直接读库、不走 CDN）。
- **线上与本地差 4 字节**：0.1.x–0.2.x 反复出现，差在 `@updateURL` / `@downloadURL` 两行的空格；
  正文、注释与代码逐字节相同。核对以 `/scripts/<id>/code` 为准。
- **装机路径**：`@run-at document-start` 的守卫注入不保证先于站点绘制，0.2.x 起由切换层兜底
  （见 `72-sweep.js`）。
## 五、版本记录（0.1.x–0.2.6 摘要）

> 逐版细节、字节数与 SHA-256 已删除；需要核对产物时现跑构建。

| 版本 | 日期 | 主题 |
| --- | --- | --- |
| 0.1.0–0.1.11 | 2026-10-04–06 | 首次公开；进度条、会话表、暂停/算力、上传页局部接管与分析等待页 |
| 0.1.12–0.1.18 | 2026-10-06 | 未发布：仓库内迭代 |
| 0.2.0 | 2026-10-07 | 上传链路四档（关 / 原版 / 新版 / 分析等待页） |
| 0.2.1 | 2026-10-07 | 兼容档退役；死代码清理 |
| 0.2.2 | 2026-10-07 | 项目管理页整页自绘；排序偏好、总览调序、机器详情 |
| 0.2.3 | 2026-10-18 | 首屏提速；上传适配；总览与顶栏改版；一批缺陷修复 |
| 0.2.4 | 2026-10-20 | 精简 README 与脚本说明，功能不变 |
| 0.2.5 | 2026-11-13 | 团队、实况、机器榜；上传不再接管；原版翻译层移除 |
| 0.2.6 | 2026-11-21 | 我发布的项目批量删除（表头全选、两步确认、停止） |

## 六、OpenUserJS（可选）

同一份产物可以直接用，它也识别 `@updateURL`；说明字段同样接受 Markdown，直接抄「二」的正文。
两边都发时，`@updateURL` 只能指向其中一边（一般是 GreasyFork），另一边靠脚本页自身的更新机制。

## 0.2.7（已发布 2026-11-22）

主题：交互现代化、移动端可读、多端滚动条、组件收敛。

- 原生 dialog 确认框（删除 / 退出），替代 window.confirm；closedby + 兜底、背景滚动 contain。
- 表格：全部 scope=col；排序表头改按钮；首列 sticky 加 z-index（修进度条穿透）；宽表 980/760 可读宽度 + 横向滚动；顶部镜像条随宽度动态出现/消失。
- 实况页：构成图换分类色板（系统 / 设备 / 厂商），项目分布改条形列表，图例钻取筛选，我的机器高亮。
- 窄屏：底部 5 项 +「更多」二级菜单；顶栏单行；账户菜单（账户设置 / 退出登录）。
- 组件：面板 / 区块标题 / 表内空行 / 表格外壳收敛到 SP.VK。
- 清理：体积提示线、过期文档、上传历史注释。
- 验收：build --check 453,958 字节；legacy-scan 0；resize 探针 PASS。

线上回填（2026-11-22 用户已上传）：版本 0.2.7；本地产物 453,958 字节；SHA256 bb4b3ece0c31a8bd7d4d08b63a6f1c8712d866d9f181a334b526b0f301b09dcd。线上哈希请从 GreasyFork 代码页核对。

## 0.2.8（已发布 2026-11-23）

- 删除上传第三步的历史 CSS（.sp-up3，约 6KB 死样式；无 JS 再生成这些类名）。
- 修复空态把 `emptyRow(...)` 渲染成源码文本：项目 / 排行榜（机器、团队、成员）/ 实况共 6 处漏了插值。
- 修复项目表排序记忆丢失：防重复注入 + 渲染前以存储为准 + localStorage/sessionStorage 双写。
- 回归 47/47（新增 `literalCalls` 静态检查）。

> 发布记录只记版本、日期与变更摘要。字节数 / SHA256 不是发布步骤——需要核对线上与本地是否同一版时，
> 现跑 `sha256sum dist/sheepit-plus.user.js`，再从 GreasyFork 代码页取线上文件对比。

## 0.2.9（已发布 2026-11-25）

- 窄屏（≤760px）项目表取消首列固定：固定首列在 390px 里占约 28% 宽，可动区域只剩右边一小块；取消后整表左右滑（与排行榜一致）。
- >760px 仍保留首列固定（宽表横向滚动时项目名始终可见）。
- 用户名换行：长用户名（无空格整串）补 overflow-wrap:anywhere，不再被折叠裁切，与项目名一致。
- 硬件厂商归类：补 NVIDIA 的 P104/P102/P106 矿卡、CMP 系列、A40/L4/L40/V100/T4 与 GP104/GA102 芯片代号；「其它」从 6 台降到 1 台（只剩 DO-Regular 这类非硬件厂商型号）。
- KPI 曲线悬停：每个采样点一段透明热区 + 原生 title，鼠标放上去显示该点的具体数值（站点只给值序列，没有时间戳）。
- 图表 X 轴日期本地化：中文环境把 `Aug 27` / `27-07-2026` / `2026-10-07` 三种站点格式统一成「8月27日」，跨年才带年份；英文环境保持站点原格式。
- 时间显示全量审计：图表悬停提示、注册日期（「2026年10月7日」）、会话活动日期（「10月3日」）统一走同一个 `dateLabel`；会话时间线保留 `MM-DD HH:mm`（列对齐优先）、相对时间保留 `19m` 这类数字格式。
- 回归 47/47。

## 0.2.10（2026-11-25 已构建，待上传）

- 排名解析：站点 Rank 在排名计算出错时返回整句 `Has not rendered anything for at least 31 days`，旧解析把句中的 `31` 当成名次；改为只认「数字 + 可选序数后缀」（`718th` / `1,123rd`），其余视为无排名。
- 无名次时身份条显示「暂无排名」、积分卡显示「暂无排名 · 30 天滚动」；新增中英词条 `hero.rankNone` / `stat.rankNone`。
- 回归 47/47。
