# MODERN-WEB · 现代 Web 基线

> 本项目的「要不要用新特性、怎么降级」只有一个答案来源：
> [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)。
> 这份文档是**使用契约**，不是它的副本 —— 规则以插件检索到的指南原文为准。

## 1. 工具

插件是一个 CLI（当前 skill 版本 `2026_11_10-47b4c80e`），按需检索指南，不随项目分发：

```bash
# 检索：2–5 个英文词，只描述一个能力；不要带框架名 / 产品名
npx -y modern-web-guidance@latest search "confirmation dialog"

# 取回完整指南：可一次取多个 id
npx -y modern-web-guidance@latest retrieve "responsive-table,sortable-table"

# 扫确定性 legacy 规则（只覆盖约 20% 的指南，不能替代 search）
npx -y modern-web-guidance@latest legacy-scan src --json
```

项目封装（同一入口，省得每人手敲不同参数）：

```bash
node tools/mwg.mjs search "confirmation dialog"
node tools/mwg.mjs retrieve "responsive-table"
node tools/mwg.mjs legacy-scan src --json
```

## 2. 改前端代码之前

1. `search` 出相关用例。空结果或跑题时换一个具体的 UI 名词再搜一次（`dialog` / `modal` / `table` / `form`），不要直接凭空写。
2. `retrieve` 取回指南，按其中的 **DO / DON'T / MANDATORY** 执行；指南没覆盖的场景才自己决定。
3. 改完 `legacy-scan` 必须为 `totalFindings: 0`。
4. 交付说明末尾列出本轮用到的 guide id，一行一条，写清它避免了什么坑。

## 3. 浏览器支持策略

产物是 `@grant none` 单文件油猴脚本，**不引入打包器、polyfill 或外部依赖**。因此：

- 默认只用 **Baseline Widely available**：`:has()`、容器查询、`<dialog>`、`popover`、`color-scheme`、`toSorted()` 都属此档。
- 较新的 API 必须 **特性检测 + 优雅降级**；降级代码 ≤ 20 行、不引依赖。例：`closedby="any"` 不支持时由一次 click 兜底。
- 不做「一律 polyfill」：缺特性时退到浏览器/站点原生行为，不拿包体积和攻击面去换。
- 动效一律遵守 `prefers-reduced-motion`；主题跟随 `prefers-color-scheme`。

## 4. 已落地清单（0.2.7–0.2.10）

| 用例 | guide id | 落点 | 避免了什么 |
|---|---|---|---|
| 删除/退出确认 | `html`、`dialog`、`light-dismiss-a-dialog`、`platform-controls-dismiss-dialog`、`prevent-page-scroll-under-modal-dialog`、`animate-to-from-top-layer` | `40-ui.js` `confirmBox`；`30-style.js` `.spdlg` | `window.confirm` 样式不可控、无焦点管理；`role` 重复声明、背景可滚动、`closedby` 缺失 |
| 可排序表头 | `sortable-table` | `51-views-projects.js` `th()` | 只在 `th` 上绑 click，键盘用户没有激活点 |
| 表格语义 | `responsive-table` | 全部 `<th scope="col">`；滚动容器 `tabindex="0"` | 表头与单元格缺程序化关联 |
| 父级状态样式 | `style-parent-with-has` | 菜单打开时行内按钮可见；勾选行高亮 | 状态只能靠 JS 逐行写 class |
| 组件自适应 | `size-aware-styling` | 空态步骤列数改用容器查询 | 视口媒体查询在窄容器里失效 |
| 原生控件主题化 | `component-specific-light-dark-theme` | `color-scheme` + `accent-color` | 深色界面弹出白底 `<select>` |
| 不可变排序 | `js` | 4 处 `toSorted()` | 拷贝后排序的冗余与误改原数组 |

## 5. 不走的路

| 指南 | 为什么不用 |
|---|---|
| `view-transition` / `directional-navigation-transitions` | 项目硬约束：新版/原版切换**不刷屏、不做过渡动画**（README 与 `72-sweep.js`）。 |
| `scroll-driven-animations` | 滚动发生在站点整页，不是独立滚动视口；收益低、风险高。 |
| `light-dark()` | token 体系已用 `data-theme` + 媒体查询稳定运行，整体替换不值得。 |
| 打包器 / 框架 | 产物形态锁定单文件拼接（`build.mjs`），见 `ARCH.md` §4。 |
