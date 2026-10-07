# SheepIt Plus 废弃代码与可读性审计清单

- 审计对象：`src/*.js`（12 个文件，473,789 字节）、`build.mjs`、`00-meta.js`，以及它们引用的 CSS 与词表。
- 基线：commit `ffc82d3`，**工作区干净**；本地产物 `dist/sheepit-plus.user.js` = 474,261 字节，与 `node build.mjs --check` 的推算**完全一致**。
- **本轮只出清单，没有改动任何一个源码字节。** 下面每条都是「候选 + 依据 + 建议动作 + 风险」，执行与否由用户拍板。

> **执行状态（2026-10-08）**：用户已同意按本文档的建议执行。**第一批 + 第二批均已落地，浏览器实测已过**（详见 §十）：
> A1 13 项 + A2 17 项 + A4 7 条 + A5 部分 + A6 2 项 + 2 个缺陷 + 4 个拍板项 = 89 处精确替换，
> 再加第二批 7 处重复注释去重。产物 **474,261 → 466,732 字节（−7,529）**，注释 **97,630 → 95,475 字节（20.6% → 20.5%）**；
> `probe-sort` 105 条断言全过、`check-ui-dict` 仍是 zh 502 / en 490（仅 12 条 `why.*`）、
> `12-lang-zh` 的 `site` 表 281 → 273 条且"跨标签不可达"清零。**浏览器实测**：7 个视图 + 第三步 4 个形态全部跑通、控制台零 JS 异常。
> **B 组其余项待第三批**（§十末列出）。**发布口径（用户 2026-10-08）**：0.2.3 **不单独发布，累计到下一次**——
> 下次一起发的是"本次清理 + 缺陷修复 + 注释去重 + 第三批（B5/B2/B11）"。`--positive` 的取色待用户拍板（保留绿色 / 改回橙色）；
> 真站上试跑估算器那一趟的经过与作废原因见 §十末（被用户装着的第三个实例盖掉）。
- 一句话结论：**没有大面积死代码**——UI 词表 502 键零死键、CSS 596 条规则零重复、16 个 `data-act` 双向零孤儿、10 个 `localStorage` 键读写成对、无 `TODO/FIXME/console/debugger`、注释里没有整段被注释掉的代码。可清理的是**边角死肉（A1+A2+A4+A6 共 54 项，约 3.6 KB 代码/产物）**、**站点词典 14 项"结构上不可能命中"的条目（约 1.24 KB）**、**10 处过时或失真的注释**、**约 35 处零信息量分隔线/横幅（约 1.7 KB）**，以及**最值得做的注释压缩（约 13–17 KB，见 §五）**。另有 **3 条真实缺陷风险**（§四 B1–B3）建议优先修。

---

## 一、结论速览

| 类别 | 候选数 | 建议动作 | 可省（估） | 风险 |
|---|---|---|---|---|
| A1 死函数 / 死常量 / 死守卫 | 13 | 删 | ~1.5 KB 源码 | 低 |
| A2 只写不读的死字段 | 17 | 删 | ~1.2 KB 源码 | 低 |
| A3 过时或失真的注释 | 10 | 改写/删 | ~1.5 KB 注释 | 零 |
| A4 永不匹配的 CSS | 7 | 删 | ~0.67 KB 产物 | 低 |
| A5 零信息量注释（分隔线/横幅） | ~35 | 删 | ~1.7 KB 注释 | 零 |
| A6 冗余导出项（对外面） | 17 | 谨慎：先查 `.tmp` 探针 | ~0.2 KB | **中（有 4 项被验收探针读）** |
| B 疑似需人工确认 | 16 | 逐条看 §四 | ~1.5 KB | **含 3 条真实缺陷风险** |
| C 注释压缩（用户重点） | 30+ 块 | 见 §五 | **13–17 KB** | 低（只动"为什么"的叙述） |
| — 站点词典（`12-lang-zh.js`） | 281 词条 + 71 正则 | 14 项结构上不可能命中（8 词条 + 6 正则）；另 3 条待确认 | ~1.24 KB | 低（1 项中：重复键 `Processing`） |

---

## 二、判定口径（这轮踩到的三层动态源，执行者必读）

本仓库的"零引用"判定**不能只看字面量**。以下三层会把活代码判成死的——按"搜不到就删"处理会直接删掉活功能：

1. **模板拼键**：`50-views.js:916` `` const k = `sess.f.${f.key}` `` → `10-core.js` 里 18 条 `sess.f.*`；`sess.class.${…}`、`sess.tl.${…}`、`empty.s${i}h` 同理。
2. **`packLabel(prefix, 站点原文)`**（`50-views.js:62-68`，运行时把站点英文 slug 化后查表）→ `why.*` 12 条、`badge.top-10-renderers`、`sess.status.enable/disable` 全靠它。**这 12 条 `why.*` 恰好是 zh 有 en 无的仅有的 12 条**，是设计如此，不是废弃。
3. **英文标签→内部键的映射表**：`20-api.js:125-153` 的 `SESSION_LABELS`（`'ramAllowed'` 等）、`MY_STATUS`、`MG_ACTION_TITLES`、`SITE_LABEL_KEYS`。
4. **CSS 自定义属性由 JS 拼**：`40-ui.js:10-11` 的 `SHADE`/`HEAT` → `var(--heat-N)` 是活的。
5. **站点自有类名**：`.container`/`.form-control`/`.btn-*` 等由站点 HTML 提供，我们是在 `#sp` 里压制它们，**不算死**。

本轮取证用的命令（只读，均可复跑）见 §八。

---

## 三、A 高置信可清理

### A1 死函数 / 死常量 / 死守卫（13 项）

| # | 位置 | 依据 | 动作 | 风险 |
|---|---|---|---|---|
| 1 | `10-core.js:50-59` `Util.compact` | 全项目 `Util.compact(` 零调用；`40-ui.js:491` 有同功能本地实现（口径不同：`B/M/K` 无空格），用在 `40-ui.js:420` | 删方法 | 低（若当控制台 API 想留，则保留） |
| 2 | `10-core.js:977-981` `I18n.blockText` | `blockText` 全项目仅定义处；`70-i18n-dom.js:31-40` 自建 `blockIndex()` 取代 | 删方法 | 低 |
| 3 | `10-core.js:907` `I18n.LANGS` | `LANGS` 全项目仅此一处 | 删字段 | 零 |
| 4 | `70-i18n-dom.js:189-194` `DomI18n.setEnabled()` | `setEnabled` 全项目仅定义处；翻译开关实际由 `80-app.js:79-80`、`372` 直接写 `.enabled` | 删方法 | 低 |
| 5 | `70-i18n-dom.js:248-250` `htmlLang()` | 唯一调用点就是上面的 `setEnabled`；`80-app.js:86` 已内联同一映射 | 随 #4 一起删 | 低 |
| 6 | `70-i18n-dom.js:27` `DomI18n.stats` + `77/89/96/131` 四处自增 | 只写不读（其它 `stats` 命中都是 20-api/40-ui 的无关字段） | 删字段与自增 | 零 |
| 7 | `64-step1.js:37-46` `rulesFrom()` + `:449` 导出项 | `rulesFrom` 全项目+`.tmp` 探针零调用；同一件事由 `:381-392` 的 `buildRules` 重做 | 删函数与导出项 | 零 |
| 8 | `68-step3.js:71-75` `tip(text)` | 零调用；与 `:34` 的 `tipRow` 重复（只差一个 class） | 删函数 | 零 |
| 9 | `62-chain.js:214` `const num = …` | 本文件零调用（在用的是 `:275` 的 `numStr`） | 删 | 零 |
| 10 | `50-views.js:245` `const home = state.home` | `overview()` 内 `home` 之后再无引用（`:639` 用的是 `state.home`） | 删该行 | 零 |
| 11 | `40-ui.js:189` `const label = (k) => k` | 恒等包装，只用于 `:191` 的 `label(keys[i])` | 内联为 `keys[i]` | 零 |
| 12 | `80-app.js:81` `if (!SP.DomI18n) return;` | 它在 `:80` 的 `SP.DomI18n.enabled = on` **之后**——真 undefined 时上一行已抛错，本行恒为假 | 删该行（或把守卫移到 `:80` 之前） | 零 |
| 13 | `80-app.js:1143,1148` `const host = …` + `void host;` | `host` 只被 `void` 一次；`void 变量名` 不构成强制重排（对照 `40-ui.js:446` 的 `void p.getBoundingClientRect()` 才是真用法） | 删两行 | 零 |

### A2 只写不读的死字段（17 项；删字段前先确认没有 `.tmp` 探针在读——本节已逐项查过）

| # | 位置 | 字段 | 依据（谁写 / 谁本应读） | 风险 |
|---|---|---|---|---|
| 1 | `20-api.js:325` | `manageable: !!id` | `.manageable` 全仓零命中；`50-views.js:107-109` 的 `myName(x)` 直接判 `x.id` | 零 |
| 2 | `20-api.js:231-236` | `fact.flag`（国旗） | `.flag` 唯一命中是赋值行；`50-views.js:1136-1150` 渲染 facts 只读 key/secret/value/href | 低 |
| 3 | `20-api.js:673` | `rankNum` | 全仓零命中（排行榜用 `r.rank`） | 零 |
| 4 | `20-api.js:560` | `streakInclToday` | 全仓零命中（只读 `streakExclToday/best/active30`） | 零 |
| 5 | `20-api.js:563` | `totalDays` | `.totalDays` 零命中（`heat.totalDays` 是另一个词条） | 零 |
| 6 | `62-chain.js:248-249,258` | `advChk`/`advBox`/`advanced` | `.advanced` 全仓零命中；`68-step3.js:16-17` 注释明说不设该勾选框 | 低（`OWN_IDS`/`KNOWN_IDS` 正则要留） |
| 7 | `62-chain.js:57,59,61` | `toggleOf()` 返回的 `why`/`title` 字段（+ `:172-173` 两个实参） | `68-step3.js:196-209` 只用 `kind`/`on`/`force` | 低 |
| 8 | `62-chain.js:475,503` | `uploadPage()` 的 `uid` 字段 | `.uid` 零命中；`64-step1.js` 只读 `hasForm/warning/gate/note/limit*` | 低 |
| 9 | `62-chain.js:448` | `classifyUpload` 成功分支的 `url` | `64-step1.js:219-222` 只读 `ok`/`token` | 零 |
| 10 | `62-chain.js:366,369,451,457` | 四处 `raw:` | 全仓无 `.raw` 读取（`20-api.js:645` 的 `status.raw` 是另一处活字段） | 低（诊断信息会丢，但没人看） |
| 11 | `68-step3.js:456,490,498` | `missing: []` ×3 | `fpRows()`（`:515-540`）只读 `at`/`stage`/`n`/`unknown` | 零 |
| 12 | `68-step3.js:458,491,499` | `verified` / `upstream` / `version` ×3 | 同上（`.tmp` 探针读的是早已不存在的 `Step3.verifiedUpstream`） | 零 |
| 13 | `40-ui.js:359` | `state.loading` | `UI.state.loading` 全项目零调用（只用了 `state.error`/`state.empty`） | 低（加载态 spinner 目前没有入口） |
| 14 | `40-ui.js:185` | `months()` 早退值的 `first`/`mid`/`last` | 唯一调用点 `50-views.js:319` 只用 `mo.html` | 零（改成与非空分支同形状 `{html:''}`） |
| 15 | `68-step3.js:171-172,432,452,466,470` | `.up3-msg` 节点 + `doSubmit` 的 `msg` 形参 | 全生命周期只有 `hidden = true`，从不写文本；错误走 `slot`（`:477-508`） | 低（**连带** `30-style.js:971,973` 两条 `.up3-msg` CSS 变死，要一起清） |
| 16 | `68-step3.js:466` | `doSubmit` 的 `card` 形参 | 函数体内零引用 | 零 |
| 17 | `68-step3.js:314,434,461` | `cards` 数组的元素载荷 `{b,card,body,submit,slot}` | 唯一读者是 `:461` 的 `cards.length` | 低（换成计数器变量） |

### A3 过时或失真的注释（10 项——**这组最伤可读性**，因为它会让后人把对的东西改错）

| # | 位置 | 现状 | 为什么错 | 建议 |
|---|---|---|---|---|
| 1 | `50-views.js:72` | 「与下面的 `STATUS_RULES` 同一套做法」 | `STATUS_RULES` 已在 `709581a` 随"总览身份条客户端状态"删除，全项目零命中 | 改成「与 `WHY_RULES` 同一套做法」 |
| 2 | `40-ui.js:343-344` | 「分数**不在这里**（见 50-views.js 的项目表）：…独立成列才对得齐」 | **与用户 2026-10-07 拍板的最新口径相反**：`50-views.js:521-525` 现在是「条子与分数同一格」，`pcell()` 把 `.bar` 与 `.frac` 放同一个 `.pwrap` 里 | 改为「分数与条子同格（`.frac` 必须定宽 `min-width:6.6em`）」 |
| 3 | `50-views.js:1340` | 「80-app.js 的轮询…认 `#sp-an-*` 这几个钩子」 | 真实钩子是 `data-an="…"`（`80-app.js:380`）与**单个 id** `#sp-an-result`（`50-views.js:1357`）；`#sp-an-*` 作为选择器族不存在 | 改成 `data-an="…"` + `#sp-an-result` |
| 4 | `50-views.js:1295` | 孤立区块头「==== 挂载后补丁：只有总览的积分曲线需要真实像素宽度 ====」 | 它下面紧跟着的是**另一段**区块头（上传/等待页，`:1296-1297`），对应的 `mount()` 在 `:1556`，中间隔了 260 行 | 删 `:1295` 或并入 `:1556` 前 |
| 5 | `10-core.js:189` | 「站点那个「Connected as …」框里的客户端状态词条已随那一格一起删」 | 描述的是**已经删掉的词条**，它在词典里已不存在（同一段历史 `50-views.js:87-89` 另有完整记述） | 删 |
| 6 | `10-core.js:421-422` | 「这句顶掉站点原文（"Max: … before ZIP compression"）…」 | 它下面紧接的是 `/* 上传后的分析等待页 */` 与 `an.*` 词条；该文案的实际实现在 `12-lang-zh.js:368` 的 site pattern，本文件没有对应词条 | 删，或压成一行指向 `12-lang-zh.js:368` |
| 7 | `64-step1.js:13` | 「上传成功就让浏览器跳到第二步（那一页由 **66** 那边接管）」 | `src/` 全历史从未有过 `66-*.js`（`git log --diff-filter=A` 只有现存的 12 个文件 + 已删的 `60-step3.js`）；第二步实际由 `80-app.js:314` 的 `Chain.analyse` 线接管 | 改指 80-app 的 analyse 线，或删半句 |
| 8 | `80-app.js:220`、`:376` | 「重画会抹掉**站点注入** `#sp-an-result` 的表单」 | `#sp-an-result` 是**我们自己**的空 div（`50-views.js:1357`），内容由 `Step3x.render()` 自绘；站点那份永远不进活文档 | 改为「会抹掉用户已填的第三步表单」 |
| 9 | `80-app.js:250` | 「卡片里是抓回来装好的**活节点**（含表单）」 | `SP.Step1.mount` 是 `64-step1.js:246+` 用 `mk()` **自建**的节点；站点 HTML 只经 `DOMParser` 当数据源 | 改为「卡片里的表单是我们自绘的」 |
| 10 | `80-app.js:302` | `catch (e) { /* 站点没定义就算了 */ }` | 严格模式下对 `window` **赋值**只在属性不可写时抛错，与"站点没定义"无关 | 改注释；`try/catch` 建议保留（防站点改 `defineProperty`） |

### A4 永不匹配的 CSS（7 项，约 668 B 产物）

判定方法：用「只认类名上下文」的口径（`class="…"`、`mk(tag,'cls')`、`className=`、`classList.*`、`setAttribute('class')`）把 CSS 里 259 个类 token 与 JS 全量比对。

| # | 位置 | 为什么不匹配 | 可省 |
|---|---|---|---|
| 1 | `30-style.js:630` `#sp .sess .none` | `.sess` 从不出现在任何类名上下文（JS 里所有 `sess` 命中都是 i18n 键前缀 `sess.xxx`）；会话页空态由 `50-views.js:1232` 的 `.pbody > .none` 承接 | 65 B |
| 2 | `30-style.js:569` `#sp .toast.ok` | `toast()` 是唯一创建者（`80-app.js:625-637`），只赋值 `el.className = 'toast'` | 66 B |
| 3 | `30-style.js:844` `#sp .up1-tbl td.bad` | 估算器表唯一渲染点 `64-step1.js:352-371` 只在 `idx===1 && c.good` 时设 `td.className = 'ok'`（`:364`），从无 `bad` | 40 B |
| 4 | `30-style.js:973` `#sp .sp-up3 .up3-msg.bad` | `.up3-msg` 从不加 `bad`（第三步错误走 `.up3-slot.up3-bad` / `up3-notes up3-bad`） | 72 B |
| 5 | `30-style.js:991` `#sp .sp-up3 input[type=submit]` | 自绘提交控件是 `button.up3-submit`（`68-step3.js:421`）；全仓库无 `form` 创建、无 `type=submit` 创建 | 70 B |
| 6 | `30-style.js:992-994` `[id^="addproject_error_box_"]`（含注释） | 该 id 只在 `62-chain.js:191` 从 `DOMParser` 的**副本**里读，从不进活文档；`docs/REWRITE-0.2.0.md §8` 明确"把站点碎片塞进卡片"那条路已删 | 308 B |
| 7 | `30-style.js:738` `#sp .up-body table input[type=text]` | `.up-body` 里唯一的 table 是估算器表（`64-step1.js:352`），其 td 全走 `textContent`；输入框在 `.up1-dev`/`.up1-fld` 里、不在 table 内 | 47 B |

> 附：现成工具 `.tmp/critique/css-dead.mjs` 报出的**唯一**候选 `.sp-manage` 是**假阳性**——它只出现在 `30-style.js:869` 的一句注释里，规则正则从注释头一路吃到紧随其后的活规则 `#sp .sp-mg-badge{…}`。**不需要任何 CSS 改动**，要动也只是把那句历史注释（`30-style.js:867-869`，326 B）压成一行（约省 200 B）。

### A5 零信息量注释（可零风险删）

| 位置 | 内容 | 可省 |
|---|---|---|
| `70-i18n-dom.js:29,42,62,135,187,230` | 6 条 `/* ---- 索引/翻译单点/批量处理/入口/开关/诊断 ---- */` 段落横幅（文件仅 253 行） | 462 B |
| `20-api.js:49,360,428,467`、`62-chain.js:42`、`64-step1.js:53,240`、`68-step3.js:58,464` | 9 条纯 `/* ----…---- */` 分隔线 | ≈674 B |
| `30-style.js` 散落 20 处单行 `==== 小节标题 ====` | 纯分区标签 | ≈250 B |
| `30-style.js:754-757` | 控件皮肤小节头里约 24 个装饰性连字符 | 见 §五 5.2 |
| `00-meta.js:20` | 维护者须知（"@namespace 定死后不可再改…见 docs/PUBLISHING.md「四」"）——它会随 `build.mjs:62` **原样进产物** | 123 B（产物） |

### A6 冗余导出项（17 项：函数本体活着，只是"对外暴露面"里没人读）

`SP.*` 是对外可见全局（`window.__SHEEPIT_PLUS__`），下面这些成员**只有本文件在用**，列在导出表里属冗余：

- `SP.NS`（`10-core.js:7`）、`SP.TOKENS`（`:1067`）——全仓无 `SP.NS`/`SP.TOKENS` 读取。
- `SP.Api`：`cache`、`parseStatBoxes`、`parseMachines`、`extractArray`、`computeDerived`（函数本体都在内部调用，含 `20-api.js:513-570`）。
- `SP.UI`：`ICONS`（内部用于 `:34`）、`machineDetail`（`:329` 调用）、`compact`（`:420` 调用）。
- `SP.Views`：`ovDisplayOrder`（`:363/:759`）、`dailySeries`（`:250`）。
- `SP.Chain`：`analyseUrl`（`:395`）、`messageFrom`（`:369/412/415/457`）、`SUBMIT_KEYS`（**见下**）。
- `SP.Step3x`：`report`、`version`（**见下**）。

> **不要动这 4 项**——`.tmp` 的发版前验收探针在读它们：
> - `SP.Chain.SUBMIT_KEYS`：`probe-e2e.js:57`、`probe-eq.js:114-125`、`probe-realsubmit.js:12`（27 键逐键对账）。
> - `SP.Step3x.report` / `version`：`make-render-probe.mjs`、`make-unknown-probe.mjs`、`probe-render.js`、`probe-unknown.js`。
> - `SP.app`（`80-app.js:1269`）：源码零读者，但 `docs/PUBLISHING.md:630` 的手工验收清单要读 `SP.app.state` 判"有没有接管"——**这是文档承认的复验入口**，删就得同步改文档。
> - `SP.state`（`80-app.js:533`）：全仓只有 `:204` 一处读，而 `:204` 读的 `SP.state.avatar` 恒为 `undefined`（见 §四 B5）→ 修掉 B5 后它就变零读者。建议与 B5 一并决定。

---

## 三·补 站点词典专项（`12-lang-zh.js`，用户最关心的"有没有没人用的词条"）

**结论：没有大面积死词条，但有 14 项"结构上不可能命中"的边角**（8 条 `site` 条目 + 6 条 `patterns`，合计约 1.24 KB）。判定不能靠"字面量搜不到"，要靠**站点自己的原文语料 + 真机快照**。

### 方法

`12-lang-zh.js` 是**原版界面/未接管页面**的站点文案替换表：`site`（281 条精确表）+ `blockPatterns`（3 条）+ `patterns`（68 条正则）。判定活死不能靠"在 src 里搜得到"，要靠站点侧证据，而且要**同时用两类语料**：

- **原文语料**：`.tmp/upstream/**`（上游模板 + PHP + public JS，609 个文件）；
- **真机快照**：`.tmp/fixtures/raw/`（39 个文件 / 4.0 MB，**未翻译**的页面，能看到站点原始 DOM 形状）+ `.tmp/upload-test/`（187 个文件 / 6.7 MB，**已翻译**的页面，能直接看某条词条到底有没有生效）。

**必须过滤自指污染**：语料里混着我们自己以前的构建/注入产物（`.tmp/recon/old-dist.js`、`prev-dist.js` 等 10 个文件），它们本身含整份词典 → **不过滤时结果是 281/281 全命中（假绿）**，过滤后才是真实数字。

### 结果（两类语料 + **真机快照**）

语料共 8.7 MB 原文 + 10.7 MB 真机快照：`.tmp/upstream/**`（模板/PHP/public JS）、`.tmp/recon/**`、**`.tmp/fixtures/raw/`（39 个文件 / 4.0 MB 未翻译真机快照）**、**`.tmp/upload-test/`（187 个文件 / 6.7 MB 已翻译真机快照）**。**后两个目录是决定性证据**——第一遍只扫 upstream/recon 时留下了"5 条待确认"，正是漏了它们。

| 口径 | 条数 |
|---|---|
| `site` 表条目（279 个唯一键） | 281 |
| 原文在站点源码/抓取里**逐字命中** | **263** |
| 只在**去标签后**出现（单文本节点永不命中，见下） | 2 |
| 两路都找不到 | 16 |

`site` 表按**单个文本节点**精确匹配（`70-i18n-dom.js:53-59` 先 `normalizeBlock` 再 `I18n.siteText`），所以"跨 `<strong>`/`<a>` 的整句"和"数字在独立 `<h2>` 里的句子"都**永远命中不了**——这两类不是"看起来像死"，而是**结构上不可能命中**。

裁定汇总：**263 条逐字命中**（活）；**2 条"只在去标签后出现"**——`site` 表按单文本节点匹配，所以它们**永不命中**，计入 A 组第 4、5 项；**16 条找不到**——其中 **11 条是 `sprintf`/`.=` 拼出来的活文案**（真机已译快照里有对应中文，如 `Maximum image resolution %dx%dy px.` 由 pattern 兜底），2 条经真机快照证实活（`Switch to light theme`、`SheepIt's servers`，见"必须保留"），3 条并入 A 组（`Read more`、带空格变体、`or higher.`）。

### A 组：站点词典可清理（14 项，约 1.24 KB）

**`site` 表 8 条（约 838 B）**

| # | 位置 | 依据（已核） | 风险 |
|---|---|---|---|
| 1 | `12-lang-zh.js:178` `'Processing': '处理中'` | 与 `:256` `'Processing': '渲染中'` 是**同一个对象字面量里的重复键**，JS 取后者 → `:178` 永不生效 | **中**：删掉即接受"服务器页 Processing 列显示『渲染中』"；要区分语境得换 `blockPatterns`/按页分流 |
| 2 | `:263` `'CPU disabled'` | 与 `:199` **同键同值**（重复键） | 无（删任一处） |
| 3 | `:185` `'shepherd': 'shepherd'` | 值==键，纯 no-op（未命中本来就会保持原文） | 无 |
| 4 | `:64` `SheepIt is a free distributed renderfarm for Blender. Try it now!` | 上游 `home/main.html.twig:14` 是 `<strong>SheepIt</strong> is a free…` → 被 `<strong>` 切成两个文本节点；真机快照中文 0 次 | 低-中：**当前首页 h1 其实一直留英文**。删该键是承认现状；若想让它真的被翻，得改用 `blocks`/`blockPatterns` |
| 5 | `:97` `If you don't want to share your computer, … you should consider donating` | 上游 `getstarted.html.twig:18` 是 `…you should consider <a href=…>donating</a>` → 被 `<a>` 切断；同段落已由 `blocks[L345]` 整段覆盖（`patchBlocks` 先跑） | 低 |
| 6 | `:135` `'or higher.'` | 上游 `HTML.php` 是 `<strong>3.0 or higher</strong>.`，文本节点为 `3.0 or higher`，由 `patterns[L399]` 处理（快照中文来自 L399） | 低 |
| 7 | `:286` `…being packed. The server…`（**带空格**变体） | `HTML.php:474` 是 `$zip_explanation .= 'The server hosting…'` **直接拼接、无空格** → DOM 文本是 `packed.The server`（`:284` 才是真身）；带空格形态全仓 0 次 | 低。**连带**：`:282-283` 注释里"带空格的变体也留一份"这个假设**已被证伪**，注释同删 |
| 8 | `:88` `'Read more'` | 新闻由 `HTML.php printNews()` 渲染，只输出 `<h2>标题</h2>`＋截断正文，无该链接；上游 twig/PHP/快照全 0；中文"阅读更多"快照 0 次 | 低 |

**`patterns` 表 6 条（约 402 B）**

| # | 位置 | 依据 | 风险 |
|---|---|---|---|
| 9–13 | `:391` `^(\d[\d,]*)\s+computed frames per hour$`、`:393` `…frames? remaining$`、`:394` `…connected clients?$`、`:395` `…processing frames?$`、`:396` `…active projects?$` | 真机未译快照 `.tmp/fixtures/raw/_home.html` 的实际形状是 `Frames remaining <h2>34,204</h2>`、`computed frames per hour` —— **数字在独立 `<h2>` 里**，文本节点只有标签，由 `site[L76-81]` 命中；"带数字的整句"全仓 0 次 | 低 |
| 14 | `:447` `^Limitation on EXR {2}support:$` | 要求**连续两个空格**，而 `siteText` 拿到的是 `normalizeBlock` 折叠过的文本（`70-i18n-dom.js:12-18` 的 `\s+ → ' '`）→ 该路径**结构上不可能命中**；单空格形态由 `site[L125]` 命中。上游原文 `HTML.php:1209/2237` 确实有两个空格 | 低-中：若有**非归一化**调用方（`50-views.js`/`62-chain.js` 的 `siteText(s)` 直传站点字符串）恰好带双空格，它才可能生效——**建议一并删，并在真机复验一眼**（`:125` 已兜住单空格） |

### 必须保留（这次全部用真机快照证实是活的，**别删**）

| 位置 | 词条 | 活证据 |
|---|---|---|
| `:49` | `Switch to light theme` | `base.html.twig`：`Switch to {{ header_theme_switch }} theme`，**暗色主题下才渲染**该串（抓到的快照都是亮色，所以只见到 `Switch to dark theme`） |
| `:160` | `SheepIt's servers` | 上游 PHP 写成 `'SheepIt\'s servers'`（转义撇号），简单 grep 会漏，真机渲染文本即该键 |
| `:113/115/117/119/120/123/144/148` 等 | 一批 "grep 0 命中" 的句子 | 全是 `sprintf`/`<?php echo>`/`{{ }}` 插值 → 真机已译快照 `live-getstarted.html` 里有对应中文（"输出图片的宽和高都必须小于…"、"单个分块文件上限 50.0 MB"、"20 分钟规则"、"最大图像分辨率…"、"pxr24…"、"上限：2,048 MB"） |
| `:211` | `To Top` | 上游 `jquery.ui.totop.js` 的默认文案，中文"回到顶部"在 4 个真机快照命中 |
| `:368/371/377` | `blockPatterns` 3 条 | 全部命中（"推荐并支持 Blender 压缩。"、"预计排队位置："） |
| `:383/385/386/387/388/389/398/464-478` | 一大批 `patterns` | 中文在快照里可证（"已登录："、"帧渲染中"×196、"已渲染 N 帧"、"第 N 位"…） |

### 其余待人工确认（3 条）

| 位置 | 事项 | 建议 |
|---|---|---|
| `:117/144/148` | 三条已渲染 `<li>` 整句被 `blocks[L348/L354]` **抢先整块替换**（真机已译快照里元素带 `data-sp-block="1"`），`:144` 特有措辞"以基准机器计"在全部快照 0 次 | 可留作"版式变化时回退"的兜底（523 B），要瘦身则删；删后若 `blocks` 守卫失效会退回英文 |
| `:196` | `'Loading'` 只出现在上游第三方库（fancybox / openstreetmap / scriptaculous），中文"加载中"快照 0 次 | 真机打开图片弹层看一眼，能看到再保留 |
| `:215` | `'Become a Patron'` 全 0；`donation/main.html.twig` 的 Patreon 区只有 `<h3>Patreon</h3>` + `<img>`，无可见文字 | 疑似旧版残留/外部 widget，确认后删 |
| `:119/115/120` | 硬编码数量词（`4096x2160`、`8,000 px`、`50.0 MB`）当前**命中**，但数值来自站点 config | 建议改写成 `patterns`，否则站点改配置即失效（`HTML.php:1213` 已有 `%dx%dy` 形态、`:450/451` 已有兜底 pattern 可参照） |

### `patterns` 正则表（71 条 = 68 patterns + 3 blockPatterns）

语料比对的可判定部分：**51 条**至少有一个 ≥10 字符的字面片段能在语料里找到。其余多为数值/占位型（`^Connected as (.+)$`、`^Sent (.+) ago$`、`^Max:\s*([\d,]+) MB$`）或注释片段被误当正则——**天生匹配不到字面量，不能据此判死**；上表已给出 6 条**有结构证据**的死条目，其余按"快照里能找到中文"判活。

### 与 `10-core.js` 的关系

`12-lang-zh.js` 的 register 载荷只有 `label/dateText/site/blocks/blockPatterns/patterns`，**没有 `dict` 字段**（`:27-29`），所以它不会覆盖 `10-core.js` 的 zh 词条（core 里 `pack.dict` 分支对 zh 是空转）；两套词表**不重复、不冲突**。`10-core.js` 侧：zh 502 / en 490，差异**恰好**是设计上中文独有的 12 条 `why.*`，无死键、无重复定义（见 §二）。

---

## 四、B 疑似需人工确认（16 项）

### B1–B3 三条值得当成**真实缺陷**看的（不是清理项）

| # | 位置 | 问题 | 影响 | 建议 |
|---|---|---|---|---|
| B1 | `80-app.js:814-818` | `[data-del]` 处理器是 9 个数据驱动 POST 里**唯一没有非空 URL 守卫**的（`:729/742/781/804` 都有 `if (!url) return;`）。空值**可达**：`20-api.js:739` 允许 `action: ''`，`50-views.js:788` 在 `needAction` 为假时无条件画按钮 → `data-del=""` → `Api.post('')`（`20-api.js:43`）会 POST 到**当前文档 URL** | 中：站点改版导致解析失败时，点"移除"会向 `/user/<me>/edit` 之类发空 POST | 加 `if (!del.dataset.del) return;`，或空 action 不画按钮 |
| B2 | `80-app.js:1045` | `MG_ACTION_KEY`（`50-views.js:1368`）含 `frames/zip/video`，但 `MG_ACT_URL` 只有 `pause/resume/reset` → 站点若把下载类动作写成 `projectAction(…,'frames')`（`20-api.js:407-411` 产无 url 项）会渲染出按钮、点了静默无反应 | 低（当前站点这几项都带 href，走 `<a>`） | 不支持的 kind 要么不渲染、要么明说 |
| B3 | `70-i18n-dom.js:177-180` | `attributeFilter: ATTRS.concat(['value'])` 允许 `value` 触发，但回调判据是 `ATTRS.includes(r.attributeName)`（`ATTRS = ['title','placeholder','alt']`）→ **配置与判据不自洽**：单独改 `value` 永远被忽略 | 低-中：若本意是跟进站点动态改提交按钮文案，则是个真 bug | 二选一：从 filter 去掉 `'value'`，或放宽判据 |

### B4–B16 其余待确认项

| # | 位置 | 待确认 | 建议 |
|---|---|---|---|
| B4 | `10-core.js:1019,1034` | `--positive` 两个主题各声明一次，**全项目零 `var(--positive)` 读取**；`:1018` 注释自称用途是"上传页的『可以传』读数点" | 先确认上传页那个绿色读数点是否**本该**用它（可能是漏接），再决定删 token 还是补 CSS |
| B5 | `80-app.js:204` | `UI.avatar(SP.state && SP.state.avatar, …)`：`state` 的字段是 `myAvatar`（`:136`，`:1215` 赋值），**没有 `avatar`** → 该实参恒 `undefined`，顶栏先画首字母，再由 `:230-246` 的补丁换成 `<img>` | 实参改成 `state.myAvatar`，或删掉该实参；改完再决定 `SP.state` 是否还需要（见 A6 末条） |
| B6 | `20-api.js:10-13` | `fetchPage(path, { ttl, force })` 的 `ttl`/`force` **全仓无一处传**，`force` 恒 `false` → "强制刷新"分支实际不可达 | 删参数并简化，或保留并注明"当前无调用方使用" |
| B7 | `62-chain.js:452-456` | `classifyUpload` 里 `/Upload new project|add_step2/` 兜底分支，代码注释自认"理论上不会" | **建议保留**（兜的是"302 未生效仍回第二步整页"这条真实站点路径），最多压注释 |
| B8 | `62-chain.js:376-389` | `messageFrom()` 导出成员（内部 4 处调用，排障好入口） | 倾向保留 |
| B9 | `50-views.js:1368-1371` | `MG_ACTION_KEY` 缺 `delete`，而 `20-api.js:352` 的 `MG_ACTION_TITLES` 有 `'remove'→'delete'`、`:419` 会真的推出 `kind:'delete'` → 被 `manageActions` 静默过滤 | **有意为之**：删除动作在 `:1521-1525` 的 Ops 面板另有带确认的按钮（避免重复入口）。建议补一行注释说明 |
| B10 | `50-views.js:524-525` + `40-ui.js:345-347` | `pcell(pct,frac,title)` 的两个调用点（`:533`/`:1284`）都传 `title=frac`，而 `frac` 来自 `progressText` 恒非空 → `title ? … : ''` 的假分支永不成立；`progress(pct,label)` 同理 | 可去掉 `title` 形参/`label` 条件，风险极低（将来若传空值该分支又有用） |
| B11 | `80-app.js:534-549` | `projects` 视图取 `/home/projects` **没有** try/catch，而 `overview` 分支（`:539-541`）有并降级成 `null` → 异常会冒到 `show()` 变整页错误态 | 确认是否有意，否则补一致降级 |
| B12 | `30-style.js:702-711,740` | 「抹掉原站外观」那组站点类压制（`.w-section/.w-box/.container/.sign-in-wr/.blog-post/.row/[class*="col-md-"]/form.form-inline`，约 500 B）**可能已无匹配对象**：全仓唯一的站点节点导入是 `64-step1.js:392` 的 `document.importNode(li, true)`，只导入"须知"的 `li` 子节点（内部只有纯文本 + `strong` + `a`） | 人工确认后整块删，或保留并注明"已失效"；**风险中**（将来若恢复搬节点路线会需要） |
| B13 | `30-style.js:734` | `#sp .up-body input.form-control` 半截失效（`.form-control` 只来自站点），但同行前半段 `input[type=text]` **是活的**（`64-step1.js:248/261/267` 显式设 `.type='text'`） | 只删 `,input.form-control` 半截（≈31 B） |
| B14 | `30-style.js:720-730` | `#sp .up-body input[type=file]` 及 `::file-selector-button`（724 B）**实际不再绘制**：上传页唯一的 file input 在 `.up1-drop` 里（`64-step1.js:89`），被 `:812` 按成 1px/`opacity:0` | 保留作级联底座并注明"已不绘制"，或删 `:726-730`（≈355 B）；删前真机确认 `.up-body` 内无第三个 file input |
| B15 | `00-meta.js:6-7` | `@description`(:en) 过时且不完整：没提 0.2.x 的上传页重制、项目管理页自绘、设置页；只写"数据**读**自站点自己的页面"，**没写本脚本会向站点 POST**（20+ 处 `Api.post`） | 补上传/管理页，并把"读"改成"读写"（GreasyFork 首屏就看这段） |
| B16 | `62-chain.js:59,61` / `64-step1.js:37` 等 | 与 A1/A2 同批，但涉及"是否留作调试入口"的判断 | 见 A1/A2 |

### 其余"看着像死、其实不是"的**必须保留**项（执行者请照抄这段当护栏）

- `SUBMIT_KEYS`、`Step3x.report`、`Step3x.version`、`SP.app`（探针/文档在读，见 §三 A6）。
- `SESSION_LABELS`（`20-api.js:125-153`）、`MY_STATUS`、`MG_ACTION_TITLES`、`SITE_LABEL_KEYS`、`SHADE`、`OWN_IDS`/`KNOWN_IDS` 正则、`stats` 子键（都是动态取值域）。
- `20-api.js:483` 的 `statusText`：**活字段**（`50-views.js:1534` 在读），被删的是同名的 `STATUS_RULES`/`statusText` 常量，不是它。
- `.frac` CSS（`30-style.js:356`）：**活**（`50-views.js:525` 在输出），被删的是旧 `.tbl td.frac` 那条。
- `reportUnmatched()`（`70-i18n-dom.js:232-245`）：源码零调用，但 `12-lang-zh.js:343` 注明"控制台诊断入口"——**有意保留**。
- 多路兜底解析（`isoDate` 三形态、`publicRender` 两种 checkbox 形态、`packLabel` 未命中原样返回、`connect method` 无值退回算力、`ResizeObserver` 缺失退回 resize）：**站点改版的资产**，最多压缩注释，不要删。
- `@grant none`、`@exclude /forum/*`、`@run-at document-start`：**都是承重的**。`@grant none` 让脚本跑在页面上下文，正是 `80-app.js:302` 顶掉站点 `window.doAnalyseUploadedProject` 的前提；换任何 grant 会让站点轮询复活（`0.1.18` 那类双轮询/双份同名 id 缺陷复发）。**不要加 grant、不要动 run-at、不要删 exclude**。

---

## 五、注释体量与压缩计划（用户明确诉求）

### 5.1 现状

| 口径 | 数值 |
|---|---|
| 源码总量 | 473,789 B（12 个文件） |
| 注释总量 | **97,630 B = 20.6%**（`build.mjs` 提示线 25%，**未破**） |
| 注释块数 | 638 |
| ≥400 B 长注释 | 39 块 / 25,221 B（占注释 25.8%） |

逐文件注释占比（降序）：

| 文件 | 注释 B | 占比 | 评价 |
|---|---|---|---|
| `00-meta.js` | 1,425 | 98.6% | 油猴头本身，不可压（真正可议的只有 `:20` 的 123 B） |
| **`80-app.js`** | **18,125** | **31.2%** | **全项目最差，"注释太多"的体感来源** |
| `62-chain.js` | 8,062 | 27.9% | 契约说明密集 |
| `64-step1.js` | 4,980 | 26.0% | 同上 |
| `20-api.js` | 10,194 | 24.6% | 站点解析契约多，多为必要资产 |
| `68-step3.js` | 5,949 | 24.4% | 同上 |
| `30-style.js` | 15,354 | 22.8% | 其中 CSS 注释 14,646 B |
| `40-ui.js` | 6,299 | 21.3% | |
| `70-i18n-dom.js` | 1,818 | 18.1% | 含 462 B 零信息量横幅 |
| `50-views.js` | 14,486 | 17.4% | |
| `12-lang-zh.js` | 5,794 | 15.7% | |
| `10-core.js` | 5,144 | 7.0% | 最干净 |

### 5.2 压缩候选（合计约 13–17 KB，均为估算，未动代码）

| 优先 | 位置 | 内容 | 可省 |
|---|---|---|---|
| 1 | `20-api.js:167-200` | 四块重复讲"两种暂停"（含"早先是 `if (!label) continue`"历史） | ~1.4 KB |
| 2 | `62-chain.js:1-16` + `64-step1.js:1-13` + `68-step3.js:1-20` | 上传契约 A/B/C/D 在三个文件头各写一遍（同一动作，三处共 4.1 KB） | 三处共 ~1.8 KB（各留一处 + 指向 `docs/REWRITE-0.2.0.md`） |
| 3 | `30-style.js:127-135` | 指标带机制（`--kb`、`box-shadow` 分隔线、亚像素余量）——保留三条**约束**，删解释 | ~600 B |
| 4 | `40-ui.js:253-265` + `279-283` | 同一判据（Compute device）讲两遍，共 1,690 B | ~1.0 KB |
| 5 | `50-views.js:521-523` + `30-style.js:347-353` | "条子与分数同格"同题两处，含实测像素 | ~630 B |
| 6 | `80-app.js:44-45,464-467,548-549,1245-1247` | "站点 HTML 只是副本 / 节点不进壳"写了 **4 遍**（1,294 B） | ~700 B |
| 7 | `80-app.js:328-333` + `423-426` | 两份同名 id 的缺陷史 2 遍（1,180 B） | ~450 B |
| 8 | `80-app.js:12-17,36-38,142,185-186,677-678` | 上传三态说明 **5 处**（1,510 B） | ~400 B |
| 9 | `30-style.js:367-372` + `373-375` | "长文本换行显示全文"同题两处 | ~660 B |
| 10 | `50-views.js:87-89` + `228-229` | 已删的「Connected as…」同一历史写两遍 | ~500 B |
| 11 | `68-step3.js:184-189` | "不再有抬头行/存档行"——描述的两个区块已不存在，纯历史 | ~445 B |
| 12 | `30-style.js:797-800` + `909-912` | 已删兼容档 `up3-*` 的账本 | ~700 B |
| 13 | `30-style.js:707-709` | 站点栅格压制理由 + "注释里不能出现反引号"元提醒 | ~332 B（**反引号那条务必留一份**，见 5.4） |
| 14 | §三 A3 的 9 条失真/过时注释 + A5 的零信息量注释 | —— | ~3.2 KB |
| 15 | 其余"用户 2026-xx 拍板 + 当时实测多少 px"的过程叙述（`30-style.js` 约 3.4 KB 集中在 11 个块；`80-app.js:597/805-806`、`68-step3.js:514` 等） | 保留结论与约束，删过程 | ~2–3 KB |
| 16 | `12-lang-zh.js`（本文件注释 5,794 B） | 典型可压：`L291-295`（600 B，`<strong>` 拆句历史）、`L319-322`（455 B，"2026-10-07 之前这一整块是空的"）、`L8-11`（406 B，日期两形态）、`L374-376`（382 B，与 L291-295 信息重复，可整块删）、`L460-463`（403 B，保留上游行号）、`L250-252`（317 B）、`L282-283`（197 B，**假设已被证伪**，随 A 组第 7 项删） | 保留 29 条小节标题与"整句走 blockPatterns"结论，删历史 | **~2.6–3.0 KB** |

### 5.3 不建议为凑指标而删的（会被后人改错）

`80-app.js` 压到 25% 还需再砍约 1,485 B，那就得删掉仍有用的设计理由（`pageFor` 为何整页导航、`#sp-an-result` 只画一次、补全端点为何回对象）。**这轮不建议为了压比例删这些**；建议目标定为"删重复叙述、保留约束"，即 80-app.js 31.2% → 约 27%，全项目 20.6% → 约 18–19%。

### 5.4 必须原样保留的**防回归约束**（压缩时逐条对照）

- `30-style.js`：分隔线必须用 `box-shadow`（折行后选不出每排第一个）、`.frac` 必须定宽（`min-width:6.6em`）、"别退回 `inline-block` 默认行为"（会被 `td overflow:hidden` 硬裁）、farm 迷你折线"必须能收缩"、**"本文件是模板串，注释里不能出现反引号"**（踩过两次）。
- `68-step3.js:913-914`：`[hidden]` 必须 `display:none !important`。
- 站点来源指引里的**行号**（`running.html.twig:296-314`、`ProjectController.php:925-997`、`HTML.php:1637/2022`…）：它们是"这条判据从哪来"的唯一凭据，压缩时保留。
- 所有 `Api.post` 目标端点与"直发站点自己的端点、不复制服务端状态"的设计纪律。

---

## 六、仓库级与文档（不在脚本产物内，单列）

| # | 项 | 事实 | 建议 |
|---|---|---|---|
| E1 | `.tmp/` | 703 个文件 / **78.4 MB**（另 `.tmp/upstream/` 609 个文件 / 144.8 MB）；`git ls-files` 确认 **全部未入库**（`.gitignore` 第 4 行） | 不影响仓库与产物；要回收磁盘可整体删。里面有一批一次性脚本（`patch-*.mjs` 60+ 个、`commit-msg*.txt` 30+ 个）已完成使命 |
| E2 | 过期探针 | `.tmp` 里有探针在数 `src` 已不存在的 DOM/符号（如 `.up3-card`/`.up3-sec` 选择器、`Step3.verifiedUpstream`、`SP.Step1` 旧接口） | 若要继续用探针做验收，先修这几处，否则会给出**假绿** |
| E3 | 入库文件 | `git ls-files` 只有 28 个文件，且 `dist` 与 `src` 一致（`--check` 对得上） | 无需清理 |
| E4 | 文档过时引用 | `docs/PUBLISHING.md:628` 写「`80-app.js:81` 的 `uiMode` 分支」——实际在 `97` 行（`81` 行现在是 A1 #12 那条死守卫）；`:314` 提 `src/60-step3.js` 的 `VERIFIED_UPSTREAM`——文件已改名 `68-step3.js`，且 `VERIFIED_UPSTREAM` 这个标识符在 src 里不存在（真名 `UPSTREAM`，`62-chain.js:25`）；`:480/517` 的 `SP.Step3` 指纹属**历史版次记录**（在 0.1.x 段里，不是失效） | 只改前两处的行号/文件名，历史段保持原样（那是发版账本） |

---

## 七、执行顺序与验证门（等用户点头后再动）

1. **建议的第一批（零风险、纯删死肉）**：§三 A1 全部 + A2 全部 + A4 全部 + A5 全部 + A3 的 9 条注释。
   - 预期：产物约 −3.5 KB，注释占比 20.6% → ≈19.5%。
2. **第二批（注释压缩）**：按 §5.2 的优先序动手，每批只动一个文件，保持 `git diff` 可读。
3. **第三批（需人工拍板的 B 组）**：先做 B1（空 URL 守卫，属缺陷修复）、B3（`value` 过滤不自洽）、B15（`@description`），再决定 B4（`--positive`）、B12–B14（站点类压制 CSS）。
4. **A6（导出面）**：动之前先跑一遍 `.tmp` 探针确认没有读者。
5. **每批都必须过的门**（照抄即可）：
   - `node build.mjs --check` —— 语法 + 冒烟（`SP.CSS` 未被反引号截断）+ 体积/注释占比。
   - `node .tmp/recon/probe-sort.mjs` —— **105 条断言**，本轮基线**全部通过**；清理前后都要跑。
   - `node .tmp/recon/check-ui-dict.mjs` —— 期望输出仍是 `zh 502 / en 490`、`only in zh (12)` 全是 `why.*`；**退出码 1 是预期的**（工具用退出码报差异）。
   - `.tmp/comment-bytes.mjs`（`tools/comment-bytes.mjs`）—— 复核注释字节。
   - 发版前若还要逐键对账：`.tmp/critique/probe-eq.js`（读 `SP.Chain.SUBMIT_KEYS`，所以在 A6 里**不能删**它）。
6. **不要碰**：`docs/PUBLISHING.md` 的历史版次段、`@grant none`/`@run-at`/`@exclude`、§四末的"必须保留"清单。

---

## 八、附：本次取证脚本与命令（只读，均在 `.tmp/` 下，未入库）

| 脚本 | 作用 |
|---|---|
| `.tmp/critique/audit-cleanup.mjs` | 本轮新增：`--comments` 注释普查与长块排行 / `--i18n` 真死键（含 `packLabel` 等动态前缀域；**重复键只查了 `10-core.js` 的 `DICT`**，`12-lang-zh.js` 的 `site` 表重复键是另查的，见 §三·补 A 组第 1–2 项）/ `--css` 自定义属性、重复规则、条件块感知的覆盖分析 / `--js` `SP.*` 导出、`data-act`、`Util.store` 键矩阵 / `--codecomments` 找"被注释掉的代码"（结果：无） |
| `.tmp/critique/audit-members.mjs` | 本轮新增：`SP.*` 导出对象的**成员级**读者统计（区分"内部自用"与"对外冗余"） |
| `.tmp/critique/audit-site-dict.mjs` | 本轮新增：`12-lang-zh.js` 的 `site`/`patterns` 逐条 vs 站点源码语料比对（含**自指污染过滤**：不滤掉 `old-dist.js`/`prev-dist.js` 会得到 281/281 的假绿）。**覆盖面限制**：只扫 `.tmp/upstream` + `.tmp/recon`，**不含** `.tmp/fixtures/raw`（39 个未翻译真机快照）与 `.tmp/upload-test`（187 个已翻译快照）——本清单 §三·补 的最终裁定用了后两者，这也是"5 条待确认"变成"14 项可清理 + 全部裁定"的原因 |
| `.tmp/critique/css-dead.mjs` | 既有：死 CSS 类名（**已知口径漏洞**：词边界匹配会被 i18n 键前缀 `sess.owner` 与注释文本 `.sp-manage` 双向污染，本轮一假阳 `sp-manage`、一漏报 `.sess`） |
| `.tmp/critique/deadcode-evidence.mjs` | 既有：i18n 逐键取证（**已知局限**：不追 `const k = \`前缀.${x}\`` 这类赋值，会把 38 条活键报成"疑似死"——本轮已用 `packLabel`/模板前缀域复核，实为 **0 条死键**） |
| `.tmp/recon/check-ui-dict.mjs`、`.tmp/recon/probe-sort.mjs` | 既有：中英词条配对、105 条离线断言 |
| `tools/comment-bytes.mjs` | 既有：字符串/模板/正则感知的精确注释字节统计（`build.mjs` 用的同一份） |

---

### 一句话给执行者

按"搜不到就删"动手会出事（`sess.f.*`、`why.*`、`--heat-*`、`SUBMIT_KEYS` 都会被误判）；按本清单 A 组动手则基本零风险。**注释的问题不是"多"，是"同一件事写了 2–5 遍"**——压缩的抓手是去重，不是删依据。

---

## 十、执行日志（2026-10-08）

### 第一批：A1 + A2 + A4 + A5（部分）+ A6（2 项）+ 2 个缺陷 + 4 个拍板项

- 手段：`.tmp/patch-0.2.3-cleanup.mjs` —— **89 处精确字面量替换**，每处先断言命中次数（dry-run 全通过）再统一写盘；写盘后由 Lead 逐文件复核 `git diff`。
- 规模：11 个 `src/*.js`，`+38 / −161` 行；产物 **474,261 → 468,056 字节**（−6,205），注释 **97,630 → 96,620 字节**。
- 拍板项落地情况：
  1. **`--positive` 判为"漏接"并接上**：`30-style.js` 的 `#sp .up1-tbl td.ok` 由 `var(--accent)` 改成 `var(--positive)`（站点原本用 `label-success` 标这一行）。**这是一处可见变化**（估算器"推荐这么切"那行文字由品牌橙变绿）；要改回只需还原这一行。
  2. **B12 站点类压制保留** + 在 `30-style.js` 那组规则上方加了一行「已失效，留作级联底座」说明。
  3. **`12-lang-zh.js` 重复键**：删 `'Processing': '处理中'`（`:256` 的"渲染中"生效）、删重复的 `'CPU disabled'`、删 `'shepherd': 'shepherd'` 自映射；另删 5 条结构上够不到的条目（`Read more` / `or higher.` / 带空格的 packed 变体 / 2 条跨标签整句）。
  4. **首页 h1 改用 `blocks` 整块翻译**（站点把 `<h1>` 拆成 `<strong>SheepIt</strong>` + 后半句，短词条表按整节点匹配够不到）；`site` 表里那条同名键随之删除。
  5. **A6 只删 `SP.NS`、`SP.TOKENS`**；`SUBMIT_KEYS` / `Step3x.report` / `Step3x.version` / `SP.app` **保留**（验收探针与 `PUBLISHING.md` 在读）。
- **一处审计结论被复核推翻（重要）**：`12-lang-zh.js:447` `^Limitation on EXR {2}support:$` 原判"结构上不可能命中"——复核发现 `62-chain.js:113-114` 明确记载 EXR 整句走的是**非归一化**路径（`zh()` 直传站点原文），而上游 `HTML.php:1209/2237` 里确实是**两个空格**，该 pattern 正是那条路的兜底。**保留未动**，§三·补 的对应条目已改判。
- **两处刻意偏离**：`30-style.js` 的 20 条 `==== 小节标题 ====` 与 `70-i18n-dom.js` 的「诊断」横幅**保留**（导航价值大于合计约 350 B 的收益）。
- 验证：`node build.mjs --check` 语法 + 冒烟通过；`.tmp/recon/probe-sort.mjs` **105 条断言全过**；`check-ui-dict.mjs` 仍 `zh 502 / en 490`（仅那 12 条 `why.*`）。

### 第二批：注释去重（只删重复副本，不改写措辞）

- 范围：8 组"同一件事写了 2–5 遍"的注释，保留最完整的一份，删掉其余副本。
- 结果：**删 7 处 / 3 个文件，−1,390 字节**（`80-app.js` 5 处、`50-views.js` 1 处、`12-lang-zh.js` 1 处）。
- **9 处刻意跳过**——被删那份里带着保留那份**没有的事实**，按"宁留勿丢"不动：
  `80-app.js` 的 548-549（"解析不出就说清楚、给重试"）、1243-1245（`release()` 判据的理由）、36-38（表格只占 `/getstarted` 最后一段 + `HTML.php:2085` 出处）、327-332（`/project/add_analyse/<token>` + "跟管理页 park 一个套路" + 3.4b 小节标题）、596；
  `40-ui.js` 278-282（Compute device 取值域 + `SessionController.php:121-130` 出处 + "认不出原样画"）；
  `40-ui.js` 242-245 与 `50-views.js` 1034-1037（两边各有对方没有的判据）；
  `50-views.js` 87-89（保留段自带"见上面那段注释"的指代，删了就指空）；
  `30-style.js` 795-798（"服务兼容档的整组 up3-* 规则已连类名一起删"这份账本）；
  `12-lang-zh.js` 264-265（调度器段渲染条件 + 指的是 `patterns` 而非 `blockPatterns`）。
- 结论：**"同一件事写多遍"的实际可省量是 1.4 KB，不是审计时估的 13–17 KB**——因为剩下那些看着重复的段落，绝大多数各自带着对方没有的站点事实。继续压就得开始丢依据，建议到此为止（见下）。

### 验证：浏览器实测（2026-10-08，本机 Chrome）

跑法：`tools/harness.mjs`（夹具服务器 —— 把 `.tmp/fixtures/raw/*.html` 当站点回放，并把 `dist` 注入页面）；
第三步另起一个**同源**小服务器 `.tmp/recon/step3-standalone.mjs`（把 dist / `inject-step3.js` / `step3-outer.html` 放在同一个 origin，
页面自己在 14 s 后把 `window.__SP_S3_LOG` 写进 `#sp`），因为 `inject-step3.js` 要求 pathname 是 `/project/add/<token>`。

**七个视图**（每个都：控制台无 JS 异常 + 数据与版式正确）：

| 视图 | 验到的关键点 |
|---|---|
| 总览（真数据） | KPIs、积分曲线 973 采样点、月度产出、热力图 365 天、在线机器一行一台 |
| 总览（`?variant=empty` 新账号变体） | 无排名/无图表降级、`months()` 空分支、热力图改说"站点没有为这个账号提供产出日历" |
| 项目表（21 行） | 长项目名与状态**换行显示全文**、发布者列不截断、条子与分数同格且**等长** |
| 会话页 | 机器档案（枚举翻人话 + 渲染密钥遮罩）、时间线 761 条、30 个可渲染项目、**12 条 `why.*` 中文真的在渲染** |
| 排行榜（500 行） | 名次/渲染者/已渲染帧数/渲染时长/获得积分 |
| 设置 | **上游指纹「9b13032c · 还没走过第三步」**＝删掉 `model.upstream/verified` 后 `fpRows()` 仍正常；「347 条词条」随词典**动态**变化 |
| 账户设置 | 调度/名单/黑名单；**「移除」按钮正常渲染**＝新加的空 URL 守卫不影响正常路径 |
| 上传页（真 `/getstarted` 捕获） | 自绘卡片（拖放区/文件按钮/上限文案）、估算器缺设备时的守卫文案"先从建议列表里选一台设备" |

**第三步四形态**（`s3v=base/exr/multi/unknown`，`inject-step3.js` 的老桩）：降噪分支（整帧 + 静态理由的 `title`）、
EXR 清单、多 `.blend`（两块 + "分析编号一次性"警告）、指纹过期（"多了 1 个脚本没画过的元素"）。
→ 覆盖了本轮改动最集中的 `62-chain`（parseStep3 去掉 `advanced`/`uid`/`url`/`raw`/`why`/`title` 后照常建模）、
`68-step3`（`cards`→计数器、去掉 `msg` 节点与 `doSubmit` 的 `card/msg` 形参后照常渲染出提交按钮）、
`30-style`（删掉 7 条死 CSS 后版式不变）与 `64-step1`（估算器/拖放区/须知）。

**实测纠正（推翻我自己的保留理由）**：EXR 那句 `Limitation on EXR  support:`（上游确实是**两个空格**）这次渲染出的是
`site` 表那条**单空格**条目的译文「EXR 支持限制：」——说明 `Chain` 解析**已经把空白折叠过**，
`^Limitation on EXR {2}support:$` 这条 pattern **没有被触发**。保留它的成本只有 1 行（删掉又可能漏掉未覆盖的路径），
所以仍归"零收益保留项"，但"非归一化路径会用到它"这个论证已被本次实测削弱，第三批可随手删。

**没验到的**：估算器 `.up1-tbl td.ok` 的绿色（`--positive`）——它只在站点 `/project/estimator` 返回结果时才渲染，
本地夹具没有那个端点；该改动是**一行 CSS 颜色**，静态上已核（token 两个主题都声明 + 唯一 `var(--positive)` 消费点）。
另外首次装机、防闪守卫 race 等仍按 §七 的原有清单留待真站。

### 真站上试跑估算器这一趟：**结论作废**（记下来别再踩）

2026-10-08 用 document mock（只 mock `https://www.sheepit-renderfarm.com/*` 的 Document 指向本地壳页）在真站上把估算器跑通了：
设备自动补全（`/device/search?term=intel` 回 224 KB）、估算 POST 真实返回「大概要花 112,960 积分」+ 16 行切块方案（`16 → 2m56s` … `不切块 → 47m04s`），全链路无 JS 错误。

**但画面不是 0.2.3 画的**，所以这一趟**不能当验收证据**：

- 判据：界面上一句中文「这次可以传：单个文件上限 2,048 MB。」在**任何**本地产物里都不存在（`dist`、线上 0.2.2、`.tmp` 里 12 个历史 build 全查过）。
- 请求 initiator 指向 Tampermonkey 里那个脚本第 **5314** 行，既不是 0.2.3 的 `deviceSearch`(6046)、也不是 0.2.2 的(6120) → 真站上跑着**第三个实例**（用户此前装过的某个 dev 版）。
- 按 LAN-RECIPE「先让旧实例 `uiMode=classic` 退场、再删 `__SHEEPIT_PLUS__`+移除 `#sp` 后 eval 新产物」做了两趟（eval 长度 403,136 = 466,732 字节的对应字符数，确认注入了 0.2.3），**仍被旧实例的 hashchange 渲染盖掉**。
- 由此作废的还有一个 A/B：本想用同一场景切 0.2.2 / 0.2.3 产物，判断"须知列表里那几条留英文"是不是本轮回归——两趟都是旧实例画的，**A/B 无效**（该现象在 0.2.2 与 0.2.3 上都存在，用户也在自己那版确认过）。
- **教训**：真站单实例复验前，必须先把用户装的那一版**临时停用**（或在干净 profile 里做）；只靠"classic 退场 + 删 SP"不够，旧实例的 hashchange 处理器会重新渲染 `#sp`。
- `--positive` 的收尾方式：等用户拍板（保留绿色 / 改回橙色）；harness 与第三步同源桩不受影响，那两处的结论照旧成立。

### 仍未做 / 建议不做

- B 组其余待拍板项：`fetchPage` 的 `ttl/force`（B6）、`messageFrom` 导出（B8）、`MG_ACTION_KEY` 缺 `delete` 的注释说明（B9）、`pcell` 恒真分支（B10）、`projects` 分支补 try/catch（B11）、`input.form-control` 半截（B13）、`input[type=file]` 是否保留（B14）、`SP.state.avatar` 恒 undefined（B5，属真缺陷但不是废弃项）。
- **改写式注释压缩（把"谁哪天拍的板 + 实测多少 px"压成一句）建议不做**：第二批证明重复量只有 1.4 KB，再往下压就是删 `pageFor` 为何整页导航、`#sp-an-result` 只画一次、补全端点形状这类**防回归依据**。
- **浏览器桩验已补做**（见上一节）：七个视图 + 第三步四形态都在本机 Chrome 上跑通、控制台无 JS 异常。原来点名的 `run-upload-matrix.ps1` / `run-step3-matrix.ps1` 用的是另一套依赖真站的注入流程，本次改为**本地同源夹具**复现同一批形态；真站装机复验仍建议按 §七 走一遍。
