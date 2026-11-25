# ARCH · 项目结构

> 当前形态：一个 `@grant none` 油猴脚本，`src/` 按文件名顺序拼成单文件产物。
> 这份文档回答「东西在哪、为什么这样切、哪里有债」。

## 1. 分层（拼接顺序 = 依赖方向，只能向下依赖）

```
00-meta.js        用户脚本头（@match / @version / @updateURL）
10-core.js        工具函数 + 语言包注册表 + 主题 token（最底层，无依赖）
12-lang-zh.js     中文词条（依赖 10-core 的注册表）
20-api.js         站点解析器 + 取数（依赖 10-core）
30-style.js       全部 CSS（模板字符串，靠 document-start 注入）
40-ui.js          原子组件（avatar / icon / progress / 空态 / 图表外壳）
50-54 views/      视图层 —— 见 §2（一个共享 IIFE 的五个片段）
（70-i18n-dom.js 已删除 —— 见 §7 翻译策略）
72-sweep.js       界面切换（playInstant / veil / veilThen）
80-app.js         应用层：接管判定、路由、事件、启动（最上层）
```

产物里没有模块系统，靠**文件拼接顺序**保证符号可用。加新文件时文件名前缀决定位置。

## 2. 视图层（0.6.1 起已解耦）

每个视图文件是**独立 IIFE**，自己从 `45-view-kit` 取公共件、自己注册到 `SP.Views`：

```js
/* 51-views-projects.js */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { esc, fmt, foot, moreRow, packLabel, whyLabel } = SP.VK;   // 公共件
  ...本体...
  SP.Views = SP.Views || {};
  Object.assign(SP.Views, { projects, projState, P_SORTS, ... });   // 自注册
})();
```

注册表用 `Object.assign`，不是整体赋值 —— 整体赋值会把别的文件注册的覆盖掉。

### 跨文件状态与组件的流向

| 提供方 | 提供什么 | 消费方 |
|---|---|---|
| `45-view-kit` | `esc/fmt/foot/moreRow/dailySeries/statOf/asCount/packLabel/whyLabel` | 所有视图 |
| `50-views-overview` | `overview`、`ovDisplayOrder` / `setOvHidden` / `moveOv` | 80-app |
| `51-views-projects` | `projects`、`projState`、`P_SORTS`、`saveSort` 一族、`ownerCell` / `ownerMenu` / `listsOf` / `pcell` | 53（会话页复用了项目行组件）、54（设置页读排序偏好） |
| `52-views-ranking` | `ranking` / `teams` / `teamDetail`、`rankState` / `teamsState` / `teamState` | 80-app |
| `53-views-session` | `session`、`sessState` | 80-app |
| `54-views-account` | `settings` / `account` / `mount`、`acctState` | 80-app |

### 接缝检查（改视图时照这个查）

跨文件引用只允许走 `SP.VK` 和 `SP.Views`。用静态扫描找候选：

```bash
# 有没有人还在直接引用别的视图的符号（改完必须为 0）
node -e "const fs=require('fs');const a=fs.readFileSync('src/51-views-projects.js','utf8');..."
```

**但静态扫描会漏模板字符串里的调用**（`listsOf` 就是这么漏的）。最终裁决看运行时：`regress` 的页面断言 + 页面错误堆栈。

## 3. 目录职责

| 目录 | 是什么 | 不该放什么 |
|---|---|---|
| `src/` | 唯一源码 | 测试、夹具、构建脚本 |
| `dist/` | 构建产物（入库，方便 GreasyFork 对照） | 手改 |
| `tools/` | 开发期工具：`harness`（夹具服务）、`rig`（CDP）、`regress`（回归）、`coverage`、`mwg`（modern-web-guidance 检索）、`serve-local`（本地安装/更新源）、`update-upstream`（拉上游 www）、`parser-contract`（解析器契约测试） | 运行时代码 |
| `docs/` | 当前有效的设计与流程文档（见 `docs/README.md`） | 一次性审计、已完结的策略记录（均已删除，见 git 历史） |
| `.tmp/` | 夹具、探针、截图（gitignore） | 任何要交付的东西 |

## 4. 构建

`build.mjs` 只做三件事：按文件名排序拼接、剥/统计注释、`vm.Script` 语法校验。
没有打包器、没有依赖、没有 tree-shaking——**产物就是源码的拼接**，所以：

- 注释会原样进产物（当前 21.4%，提示线 25%）
- 删代码就是删字节，没有别的优化手段
- 任何「优化」都必须先在 `build --check` 上看到字节数变化

## 5. 应用层的事件表（替 80-app 拆分的替代方案）

`80-app.js` 53KB，看起来该拆成「路由 / 事件 / 启动」三个文件。**但它内部是紧耦合的闭包**：
事件处理函数要读 `state`、调 `render()` / `show()` / `go()`，拆出去要么传十个引用，要么把闭包变成全局——
可读性不会更好。所以这里用**一张表**降低理解成本，而不是用文件数量。

所有点击都走 `onClick` 里的一次 `kind` 分派（30 个分支）。勾选类交互例外：表头全选与行勾选走 `data-pickall` / `data-pick` 的独立分支，在 `kind` 分派**之前**判断（它们只改内存选中集与几处 DOM，不整页重画）：

| 分组 | kind | 做什么 |
|---|---|---|
| 界面 | `theme-cycle` `refresh` | 主题循环、重取数据 |
| 界面 | `mode-classic` `classic` | 切到原版界面（同页互换 / 跨路径导航） |
| 界面 | `owner-menu` `ov-right` | 3 点菜单开合、总览右侧卡片切换 |
| 写操作 | `avatar-save` `email-save` `key-add` `block-add` | 账户页表单，成功后整页重取 |
| 写操作 | `prio-add` `prio-set` | 渲染优先级：加人 / 给发布者加星 |
| 写操作 | `owner-gift` `owner-block` `sponsor-add` `sponsor-set` | 捐赠名单、黑名单 |
| 写操作 | `team-act` `team-create` | 团队：退出/解散/申请/移除、创建（**二级确认**） |
| 视图交互 | `sess-run` | 会话页暂停/恢复 |
| 视图交互 | `sess-log` `reveal-key` | 日志折叠、密钥显隐（纯本地） |
| 写操作 | `proj-del` | 「我发布的」行内删除：两步确认（按钮 arm 3 秒）后发一次 `/project/<id>/remove_no_redirect` |
| 写操作 | `proj-del-picked` | 「我发布的」批量删除第一步：进入确认态（4 秒无操作自动退回） |
| 写操作 | `proj-del-confirm` | 「我发布的」批量删除第二步：确认后逐项串行 POST（过程中可停止） |
| 写操作 | `proj-del-back` | 退出批量确认态，不删任何项目 |
| 写操作 | `proj-del-stop` | 删除中请求停止：当前项完成后不再发剩余项，未处理的保留选中 |
| 视图交互 | `proj-picknone` | 「我发布的」清空选中（只改 DOM 与内存选中集，不整页 render） |
| 视图交互 | `proj-clear-filters` | 搜索/筛选空态的「清除筛选」：q 清空 + filter=all 后重画 |

**校验方式**：扫 `data-act="..."` 的取值集合，与 `kind === '...'` 的集合做差。

```bash
node -e "…"   # 见 .tmp/events-scan.mjs 的写法：差集必须为空
```

当前：22 个 `data-act` 全部有处理分支，无孤儿。

## 6. 已知结构债（按危险程度）

| # | 债 | 危险 | 处理 |
|---|---|---|---|
| 1 | 视图层共享 IIFE（§2） | 高：改一个文件可能影响另一个的作用域 | 留到下次大改 |
| 2 | `80-app.js` 53KB，承担接管判定 + 路由 + 事件 + 启动 | 中 | **不拆**（见 §5），用事件表代替 |
| 3 | `12-lang-zh.js` 与 `10-core.js` 的中英词条双份维护 | 中：加键要改两处 | 保持，键少时可控 |
| 4 | `docs/` 曾达 426KB（> 源码） | 低（已清理） | 见 `docs/README.md` |


## 7. 翻译策略（2026-11-13 拍板）

**中文只做在新版界面；原版页保持站点原样。**

| 曾经 | 现在 |
|---|---|
| `12-lang-zh.js` 216 条 site 词条 + 块 + 模式，`70-i18n-dom.js` 遍历原站 DOM 替换文本 | 全部删除；`12-lang-zh.js` 只剩 1.4KB 的**日期本地化**（会话页用 `I18n.date()`） |

为什么：站点文案一改，逐条词条就静默失效；覆盖率永远追不上，维护成本却一直涨。切回原版是"看站点原样"，翻译反而违背意图。

**代价**：原版页对中文用户就是纯英文。回滚方式：`git revert 1e39294`，词条在历史里。

## 8. 现代 Web 约定（2026-11-22 起）

改任何 HTML / CSS / 客户端 JS 之前，先按 `docs/MODERN-WEB.md` 的流程走一遍
（`node tools/mwg.mjs search "<2–5 个英文词>"` → `retrieve` → 按指南改 → `legacy-scan` 必须 0 命中）。

产物是零依赖单文件，所以：

- 只用 Baseline Widely available；更新的 API 要特性检测 + 优雅降级（≤20 行、不引依赖）。
- 不加打包器、不加 polyfill、不加 CDN。
- 动效尊重 `prefers-reduced-motion`；主题尊重 `prefers-color-scheme`。

两个已经落地的结构约定：

| 约定 | 为什么 |
|---|---|
| 确认框走 `SP.UI.confirmBox()`（原生 `<dialog>` + `<form method="dialog">`） | 浏览器自带焦点陷阱、Esc、点遮罩关闭、关闭后焦点返回触发元素；`window.confirm` 全都做不到，也无法展示后果文案 |
| 可排序表头是 `<th scope="col" aria-sort="{...}">` 里包 `<button class="thbtn">` | `aria-sort` 只让读屏「读得出」，`<button>` 才让键盘「操作得了」；事件委托仍用 `closest('th[data-sort]')` |
