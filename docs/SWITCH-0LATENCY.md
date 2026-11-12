# SWITCH-0LATENCY · 把「新版/原版切换」压到 1 帧

> 交付人：switch（task-3）· 2026-11-12
> 行号口径：基于本次工作区快照（`src/72-sweep.js` 164 行版）。task-1/task-2 正在并行改 `src/80-app.js`，行号会漂移 —— 按函数名（`toClassic` / `hideModern` / `revealModern` / `play`）检索，不要按行号。
> 结论一句话：**600ms 里 99% 是动画编排，不是加载。把 mid 挪到点击的同一个同步块，切换的同步成本是 0.0ms、到下一帧 11.1ms（< 1 帧 16.7ms）、网络请求增量 0。**
> 剩下唯一付不掉的是「跨路径第一次」的文档加载，用空闲预取 + hover 预取 + 访问过即缓存把它藏到用户看不见的地方。

实测环境：Windows / Node v24.18.0 / headless Chromium 1200（`--headless=new --disable-gpu`）/ 刷新节拍中位 **16.7ms**（60Hz）。
现有实现基线：`dist/sheepit-plus.user.js` = **429,979 字节**，SHA256 前缀 `52FE32FA`，构建时间 2026-11-12 20:10:57；夹具 `/home`（`.tmp/fixtures/raw/_home.html`）。

---

## 0. 结论表

| 问题 | 答案 | 证据 |
|---|---|---|
| 现在的 600ms 花在哪 | **动画编排**。mid（真正换界面）排在幕布盖满之后 | 点击→mid 实测 330.4ms；mid 代码在 `cover.finished.then()` 里，见 `src/72-sweep.js:108-113` |
| 同页互换有加载吗 | **没有文档加载**。navs 全程 1 | 实测 `navigation` 条目数 1→1（三次探针全是 1） |
| 切成「立即换层」后同步成本 | **0.0ms**（5 次中位，范围 0–0.1ms） | `.tmp/proto/results-proto.json` → `instantClassic.tSync` |
| 到下一帧 | **11.1ms**（中位），范围 8.6–15.7ms，**全部 < 1 帧** | 同上 `instantClassic.tFrame1` |
| 切层触发网络请求 | **0 个**（5 次全是 0） | 同上 `netAdded: [0,0,0,0,0]` |
| 跨路径第一次 | **951ms** 才看到内容（DCL，含原型注入的 300ms RTT） | `crossCold.tContentSeen` |
| 跨路径第二次 | **0.1ms**（后台已预取好） | `crossWarm.tContentSeen` / `crossThird 8.6ms` |
| 所以「门槛足够低」能不能做到 | **能**。只剩跨路径第一次这一项固有成本，且可被预取隐藏 | 见 §2.3 |

---

## 1. 延迟来源拆解：点击 → 看到变化

把一次 `toClassic()` 拆成三段。判据都是帧级：页面里同步钩 `requestAnimationFrame` 逐帧采样幕布矩形 + `MutationObserver` 记 `#sp.hidden` / `#sp-guard` 的变更时刻（脚本 `.tmp/proto/measure-legacy.mjs`）。

### 1.1 实测时间线（modern → classic，夹具 `/home`）

| 时刻 | 发生了什么 | 用户看到 |
|---|---|---|
| 0ms | 点击 | 新版界面 |
| **262.5ms** | 幕布盖满（`curtain.animate` 300ms，到 262ms 已视觉到位） | **整屏被幕布盖住，什么变化都没有** |
| **330.4ms** | `mid()` 执行：`#sp.hidden = true` + 移除 `#sp-guard` | 还是幕布 |
| **450.3ms** | 幕布开始退场，左侧露出原版页面 | **第一次看到"变了"** |
| **601.2ms** | 幕布完全离开视口 | 看全原版 |
| 767.3ms | `#sp-sweep` 节点移除 | — |

第 1 次 / 第 3 次（重复同一操作）对照：盖满 262.5 / 260.9ms，到 mid 330.4 / 335.2ms，开始露出 450.3 / 373.1ms，完全离开 601.2 / 521.9ms。**两次独立采样的一致性说明这不是偶发抖动。**

### 1.2 三段归因

| 段 | 实测成本 | 代码位置 | 能否削到 0 |
|---|---|---|---|
| **动画编排** | 点击→mid 330.4ms；mid→幕布开始移出 119.9ms；退场到看全 271ms | `src/72-sweep.js:103-113`（300ms 盖满 → `finished.then(run)` → 320ms 退场） | **能**。mid 挪到点击同步块，动画退化成不遮挡的光 |
| **加载** | **0**。`navigation` 条目数 1→1；无白屏、无文档请求 | 同页互换本来就零加载（原站 DOM 一直在文档里，被 `#sp-guard` 压住：`src/30-style.js:1075-1087`） | 本来就是 0 |
| **重绘** | mid 到「幕布开始移出」之间有 **119.9ms** 空档，期内一次 **92ms longtask** | `src/80-app.js:188-199` `hideModern()`：`#sp.hidden=true` + 移除 `#sp-guard`（把 `body > *` 全部 `display:none` 的规则撤掉）→ 原版页从 `display:none` 恢复，文档高度 852→1575，整页重排；随后 `dispatch resize/scroll` 再让站点 JS 重算 | **部分能**。换成 `opacity`/`visibility` 切层可避免 `display:none` 引起的整层重排 |

**关键判定**：330ms 里的前 262ms，屏幕是被幕布盖满的 —— 用户对「这 330ms 做了什么」零感知，只感知到「点了没反应」。这不是加载慢，是编排把换界面推后了。

> 重绘段没有消失在「立即换层」里，但它从「盖着幕布的空白等待」变成「新界面已经出现后的第一帧略慢」。原型里跨路径冷切（要新建 iframe）首帧实测 19.8ms，paint 已可见；同路径切换首帧 11.1ms。**都属于 1–2 帧。**

### 1.3 一个容易漏掉的事实：同页互换不是「零请求」

实测 resource 条目数 67 → 71（+4）。`navs` 恒为 1，所以**没有文档导航**，但原版页面被唤醒后，站点自己的 JS 会重新拉它要的数据。
→ 准确说法是「零文档加载」，不是「零网络」。跨路径用 iframe 预取后，切层时 netAdded = 0（ifram 已经 load 完），这一点比唤醒沉睡的原版页更干净。

---

## 2. 方案

### 2.1 立即换层（mid 先执行，动画退化成不遮挡的光）

**规格（4 条，都可独立验收）**

1. **mid 必须在 click 的同一个同步块里执行**，不能放进任何动画回调。现有代码的唯一障碍就是 `src/72-sweep.js:108` 把 `run()` 放在 `cover.finished.then()` 里。
2. **幕布改成闪光**：`opacity` 0 → ≤0.35 → 0，180ms，`pointer-events:none`，不是全屏不透明板。它从「遮挡」变成「光掠过」。
3. **层的显隐用 `opacity` + `pointer-events`，不用 `hidden` 属性/display:none**。理由见 §1.2 重绘段：`display:none` 撤销时整页重排（实测 92ms longtask）。原型用 `opacity` 切换，同路径切换首帧 11.1ms。
4. **动画不读 `offsetWidth`**（强制布局）。原 `src/72-sweep.js` 已经是 WAAPI，保持；闪光也用 `element.animate()`。

**原型实测（5 次，夹具 `/home`，每项含同步耗时 / 首帧 / 两帧 / 请求增量）**

| 方向 | 同步耗时 tSync | 首帧 tFrame1 | 两帧 tFrame2 | 网络请求增量 | 首帧已可见 |
|---|---|---|---|---|---|
| 新版→原版 | **0.0ms**（0–0.1） | **11.1ms**（8.6–15.7） | 27.4ms（27–32.5） | **0**（5/5） | 5/5 `visible:true`，w=1382 h=852 |
| 原版→新版 | **0.1ms**（0–0.1） | **10.9ms**（8.4–12.8） | 26.5ms（23–30.6） | **0**（5/5） | — |

判据：`tFrame1 < 16.7ms`（= 本机刷新节拍）= **1 帧内**。同步耗时中位数 0.0ms 意味着「换层这个动作本身没有成本，剩下的只是浏览器渲染下一帧的下限」。

**对照：同一台机器上复刻旧编排**（`#legacy-curtain`，300ms → mid → 320ms，与 `src/72-sweep.js:103-113` 同参数）：

| 编排 | mid（真正换界面） | 幕布离开（看全） |
|---|---|---|
| 旧扫光 新版→原版 | 332.5ms（320.9–332.6） | 666.0ms（653.9–666.1） |
| 立即换层 新版→原版 | **0.0ms** | **11.1ms** |

旧编排复刻出的 332/666ms 与真实 dist 实测的 330/601ms 对得上 —— 说明原型里的对照没有作弊。

**改造点（不改 src，只给规格）**

```js
// src/72-sweep.js：新增，与 play() 并存，调用方按需切换
function playInstant(opts, mid) {
  // 1) 先换：同步块内
  mid();
  // 2) 再闪：不遮挡，不阻塞
  if (!reduced()) { /* host.animate([...opacity...], {duration:180}) */ }
  // 3) 不做 cover/退场两段
}

// src/80-app.js:213-228 toClassic()：把 play 换成 playInstant，mid 不变
// src/80-app.js:230-241 toModern()：同上
```

`prefers-reduced-motion` 下什么都不演，仍然 1 帧 —— 与现有 `src/72-sweep.js:72-75` 的降级一致。

### 2.2 空闲预取：把当前路径的原版页提前装进隐藏 iframe

**规格**

1. `requestIdleCallback(fn, { timeout: 1200 })` 里创建 iframe，`src = location.pathname`（真实场景是同源同路径）。
2. **预取态必须占真实尺寸**：`position:absolute; inset:0; width:100%; height:100%; opacity:0; pointer-events:none`。
   **不能 `display:none`** —— display:none 的 iframe 按 0 尺寸布局，内部媒体查询、图表、轮播全按 0 宽算，显示出来要重排。
3. **就绪判据必须是 DOMContentLoaded，不是 load**。实测同一页：

| 判据 | /user/other-user/edit | 差 |
|---|---|---|
| DOMContentLoaded（轮询 `contentDocument.readyState`） | **951ms** | — |
| load 事件 | **1848ms** | **+897ms** |

   load 要等图片和第三方脚本；用户能看见原版界面的时刻是 DCL。用 load 会让「预取看起来要 1.8 秒」，用 DCL 是 0.95 秒，而这段时间完全发生在用户看新版界面的时候。
   实现：iframe 创建后逐帧轮询 `contentDocument.readyState`，先确认 `contentDocument.URL` 已经是目标 URL（否则读到的是 about:blank 的 `complete`），再判 `interactive | complete`。
4. 同源是前提：跨域读不到 `contentDocument`，DCL 轮询和点击拦截都会失效（见 §4 风险 8）。

**实测**：空闲预取 `/home` 花了 **3246.5ms**（DCL 3183.5ms）—— 后台完成，用户无感。点切换时它是 ready 的，所以 §2.1 的首帧 11.1ms 成立。

> 这个 3.2s 偏悲观：夹具页面有 30+ 个同步 `<script src="/media/...">`，测量时 Chromium 缓存是关闭的（`Network.setCacheDisabled`）。真实站点有浏览器缓存，DCL 会明显更短。但**无论长短，它都发生在用户看新版的时候**。

### 2.3 跨路径：三层预取策略

现状：`/home` 上想看 `/faq`（或本原型的 `/user/other-user/edit`），只能整页导航（`src/80-app.js:216-221`：`classicAligned()` 为假时走 `veilThen`）。

**三层策略（按代价从低到高）**

| 层 | 触发 | 代价 | 实测 |
|---|---|---|---|
| L1 空闲预取当前路径 | `requestIdleCallback`，进入新版后立即 | 1 次同源文档请求，后台 | DCL 3246ms（后台） |
| L2 hover 预取 | 原版 iframe 内 `mouseover` 停在站内链接上 **80ms** 去抖 | 只对真正要点的链接付 | 未单独计时，机制已在原型跑通（日志可见 `hover 预取`） |
| L3 访问过即缓存 | `Map<url, iframe>`，LRU 上限 3 | 常驻内存 ≈ 3 份原版页 | 第二次跨路径 **0.1ms** |

**跨路径实测（同一个 URL，冷 → 热）**

| 场景 | 看到内容 | 网络请求增量 | 说明 |
|---|---|---|---|
| 冷（从没预取过） | **951ms**（DCL） | +1（iframe 文档请求） | 首帧 19.8ms 只是空壳，内容 951ms 才到 |
| 热（第二次，已缓存） | **0.1ms** | 0 | 首帧即内容 |
| 热（第三次） | 8.6ms | 0 | 同样是 1 帧内 |

原型服务器对每个 HTML 文档请求注入 **300ms** 延迟模拟公网 RTT（`.tmp/proto/serve.mjs` 的 `PROTO_DELAY`）。换算到真实站点：冷路径 = 真实 RTT + 服务端出页 + 解析，与 951ms 同量级；热路径 = 0，与 RTT 无关。

**点击拦截（让 iframe 里的链接也走换层，而不是整页跳转）**

- iframe `load`/DCL 后，在 `contentDocument` 的**捕获阶段**挂 `click`：命中 `a[href]` 且同源 → `preventDefault()` + `stopPropagation()` → `parentSwitchTo(pathname+search)`。
- 绝对化 base 必须是 `location.origin + rec.url`：`new URL('/home', '/user/x/edit')` 会抛 TypeError（**原型第一版就踩了这个坑，拦截一次都没命中**）。
- 实测：iframe 内点一个指向 `/home` 的链接 → `navHits` 0→1，父级路径改为 `/home`，父页面没有任何导航。

---

## 3. 原型：怎么起、怎么复现

### 3.1 文件

| 文件 | 作用 |
|---|---|
| `.tmp/proto/serve.mjs` | 原型服务器（:8755）。回放 `.tmp/fixtures/raw` 的真实页面当「原版站点」，每个 HTML 文档 +300ms 延迟模拟 RTT；第三方外链脚本（google jsapi / gstatic charts loader）顶空，否则无外网环境下会把 iframe 的 load 拖到 5 秒 |
| `.tmp/proto/app.html` | 原型页面：三层结构（新版外壳 / 原版 iframe 层 / 闪光）+ 测量面板 |
| `.tmp/proto/proto.js` | 全部逻辑：立即换层、旧扫光对照、空闲预取、跨路径、hover 预取、点击拦截、帧级测量 |
| `.tmp/proto/measure.mjs` | 自动化测量（headless Chromium + CDP），输出 `.tmp/proto/results-proto.json` |
| `.tmp/proto/measure-legacy.mjs` | 对**现有 dist** 做同样的帧级采样（不需要改 src） |
| `.tmp/proto/shot.mjs` | 截图取证（4 张） |

**没有改 `src/` 任何文件，没有动 `dist/`。**

### 3.2 启动

```bash
cd D:/DSH/dsh_workspace/sheepit-plus
node .tmp/proto/serve.mjs          # 前台起在 http://127.0.0.1:8755/
# 关掉 300ms 模拟延迟：PROTO_DELAY=0 node .tmp/proto/serve.mjs
```

浏览器打开 <http://127.0.0.1:8755/>，右下角就是测量面板。

### 3.3 Lead 手工复现（约 90 秒）

| 步骤 | 操作 | 应该看到 |
|---|---|---|
| 1 | 打开页面，等 3–5 秒（面板「空闲预取」从「未开始」变成 `3xxxms（DCL 3xxxms）`） | 后台已经把 `/home` 的原版页装好 |
| 2 | 点 **切到原版（立即换层）** | 画面**立刻**变成真正的 SheepIt 原版首页（深色顶栏、leffe 标志、四张统计卡），日志出现 `同步 0.0ms，首帧 +11ms，两帧 +27ms` |
| 3 | 点左下角 **‹ 回到新版** | 立刻回到新版外壳，同样 1 帧内 |
| 4 | 点 **对照：旧扫光编排** | 屏幕先被一块浅色板**盖满约 0.3 秒**（期间你看不到任何内容），然后才露出原版。日志：`mid 在 332ms，幕布离场 666ms` |
| 5 | 点 **跨路径 · 未预取** | 先白/空一下，约 0.95 秒后出现 `/user/other-user/edit` 的原版设置页。日志：`看到内容 +951ms（iframe load …）` |
| 6 | 点 **跨路径 · 已预取（再走一次）** | 立刻出现（`+0ms`） |
| 7 | 在原版界面里点任意站内链接 | 不整页跳转；日志出现 `拦截 iframe 内导航 …`，面板「拦截到的站内链接」计数 +1 |

关键对照就是第 2/4 步：**同一台机器、同一份夹具，区别只在编排顺序** —— 0ms vs 332ms。

### 3.4 自动化验证

```bash
node .tmp/proto/measure.mjs        # 输出 JSON + 写 .tmp/proto/results-proto.json
node .tmp/proto/shot.mjs           # 写 4 张截图到 .tmp/proto/
node .tmp/proto/measure-legacy.mjs # 对现有 dist 做帧级采样（需要 tools/harness.mjs，会自动起）
```

`measure.mjs` 的验收口径（都可从 JSON 复核）：

```
instantClassic.tSync.median   = 0.0    < 1ms      ← 换层动作本身无成本
instantClassic.tFrame1.median = 11.1   < 16.7     ← 1 帧内
instantClassic.netAdded       = [0,0,0,0,0]         ← 0 请求
instantClassic.frameWasReady  = [true ×5]           ← 5 次都不是「加载中」
legacyClassic.tMid.median     = 332.5               ← 旧编排的 mid
legacyClassic.tCurtainGone.median = 666.0           ← 旧编排看全
crossCold.tContentSeen        = 951                 ← 跨路径第一次
crossWarm.tContentSeen        = 0.1                 ← 跨路径第二次
intercept.hits                = 0 → 1               ← 点击拦截生效
```

**截图证据**（`.tmp/proto/`）：

- `shot-1-modern.png` —— 新版外壳
- `shot-2-classic.png` —— 立即换层后的原版首页（面板显示 `同步 0.1ms，首帧 +5.4ms`）
- `shot-3-legacy-covered.png` —— 旧幕布盖满那一刻：**整屏空白**，这就是现在 300ms 里用户看到的东西
- `shot-4-cross-warm.png` —— 跨路径热切到 `/user/other-user/edit`，面板显示 `看到内容 +32ms`

---

## 4. 风险清单

| # | 风险 | 机制 / 为什么 | 实测或判断 | 处置 |
|---|---|---|---|---|
| 1 | **iframe 高度自适应** | 原版页高度和视口不同（实测切回原版后文档高 852 → 1575px） | 原型用 `iframe{position:absolute;inset:0;height:100%}`，内部自己滚 —— **不做跨文档高度测量**，因此不会出现「撑高 → 抖动 → 再撑高」 | 保持「iframe 内部滚动」。若一定要外层整页滚，需要 `contentDocument.documentElement.scrollHeight` + ResizeObserver，且每次内容变化都要同步，代价大、抖动明显，不建议 |
| 2 | **滚动** | 两层各有自己的滚动容器；`#sp` 是 `position:fixed; inset:0; overflow-y:auto`（`src/30-style.js:11-13`） | 原型用 `opacity` 切层，两层的 `scrollTop` 都保留；用 `hidden` 属性（display:none）恢复时滚动位置会被重置 | 切层只用 `opacity/pointer-events`；切走的一层 `pointer-events:none` 防止滚轮串到下层。若必须用 display:none，切回前手动存/恢复 `scrollTop` |
| 3 | **点击拦截** | 只拦 `a[href]` 的普通点击 | 原型实测拦截命中（hits 0→1）；但下列不覆盖：`target=_blank`、`<form>` 提交、`location.href=` 的 JS 导航、`<a download>`、右键「在新标签打开」 | 拦截只做「同源 + 左键 + 无修饰键」；其余放行给浏览器（等于退回当前行为）。`target=_blank` 应保持浏览器默认 |
| 4 | **移动端 iOS** | iframe 内的滚动/缩放自成一套；iOS 上 iframe 的历史记录会插进父页面历史 | 未在真机验证（**这是本方案唯一没有实测的项**） | 上线前必须在真机过一遍：a) 双指缩放（iframe 内 `visualViewport` 独立）；b) 橡皮筋滚动是否穿到父层；c) `-webkit-overflow-scrolling:touch`；d) 返回手势是否触发 iframe 内历史。退路：mobile 下只用「同页互换」，跨路径走导航 |
| 5 | **站点加 `X-Frame-Options: DENY` 或 `CSP frame-ancestors 'none'`** | 2026-11-12 实测站点**没有**这两个头、没有 framebuster、同源，所以 iframe 可用 | 一旦加上，iframe 全部不可用：预取拿不到、`contentDocument` 读不到、拦截装不上 | **降级必须写死在代码里**：预取失败（onload 后读 `contentDocument` 抛 SecurityError，或请求头里查到 `x-frame-options`/`frame-ancestors`）→ 置 `frameBlocked` 标志 → 跨路径退回 `veilThen` 整页导航（`src/72-sweep.js:157-161`），同页互换不受影响（原站 DOM 本来就在文档里）。**同页 0 延迟与跨路径 0 延迟是两件事，前者不依赖 iframe** |
| 6 | **内存** | 每个 iframe 是一份完整原版页 + 一份站点 JS 运行时 | 夹具主页约 30KB HTML + 30+ 个脚本；3 个常驻 iframe 仍属可接受 | LRU 上限 3，切走超过阈值即 `iframe.remove()`；移动端降到 1 |
| 7 | **隐藏 iframe 里的站点脚本在跑** | `opacity:0` 的 iframe 内部定时器、动画、轮询照常执行 | 站点有 `setInterval` 类轮询（会话页时间线） | 只预取「静态类」页面（home/faq/edit）；带实时轮询的页面（`/session/<id>`）按需再预取；或预取后立刻 `contentWindow.stop()` 停掉未完成的子资源 |
| 8 | **同源是硬前提** | DCL 轮询与点击拦截都要读 `contentDocument` | 当前站点与扩展同源 | 跨域（子域/CDN 不同源）时：预取仍可显示（iframe 能加载），但不能轮询就绪、不能拦截点击 → 就绪判据退回 `load`，点击拦截退化为不拦 |
| 9 | **URL 与状态同步** | 换层不改 URL。原版 iframe 的真实 URL 和新版 SPA 的 `#路由` 是两套 | 原型里跨路径换层后同步了「当前路径」标签 | 换层时同步 `history.replaceState` 或至少同步内部 `state.path`；刷新后落在哪一侧由 `uiMode` 存储决定（现有 `Util.store.set('uiMode', …)`） |
| 10 | **可访问性** | iframe 是独立文档，焦点会进去；屏幕阅读器读两个文档 | 原型给 iframe 加了 `title`，切走的一层 `pointer-events:none` | 切走的一层同时 `aria-hidden="true"` + `inert`；切层时把焦点放到目标层第一个可聚焦元素 |

---

## 5. 落到 src 的最小改动面（本任务不改，供排期）

| 文件 | 改动 | 风险 |
|---|---|---|
| `src/72-sweep.js` | 新增 `playInstant(opts, mid)`：同步 mid + 180ms 低透明度 flash；保留 `play()` 给「真的要导航」的场合 | 低，纯新增 |
| `src/80-app.js:213-228` `toClassic()` | `SP.Sweep.play(...)` → `playInstant(...)`；`hideModern()` 里 `host.hidden = true` → `host.dataset.off = '1'`（配合 CSS `opacity:0;pointer-events:none`） | 中，`hidden` 换成属性后要检查所有依赖 `#sp.hidden` 的判断（`src/80-app.js:123/190/236`） |
| `src/80-app.js:230-241` `toModern()` | 同上；`revealModern()` 的 `host.hidden=false` 同步改 | 中 |
| `src/80-app.js:216-221` | `classicAligned()` 为假时的 `veilThen` 整页导航 → 换成「切层到预取好的 iframe」 | 中，需要新的 iframe 池模块 |
| 新增 `src/74-frame.js` | iframe 池：创建/预取/DCL 就绪轮询/点击拦截/hover 预取/LRU/`frameBlocked` 降级 | 新代码，约 200–260 行 |

体积影响：新增模块约 200–260 行 → 产物增加约 6–8KB。当前 429,979 字节，余量够。

---

## 6. 证据文件索引

| 文件 | 内容 |
|---|---|
| `.tmp/proto/results-proto.json` | 原型全部原始测量（含每次的 tSync/tFrame1/tFrame2/paint/netAdded） |
| `.tmp/proto/results-legacy.log` | 现有 dist 的帧级采样原始输出 |
| `.tmp/proto/shot-{1..4}.png` | 4 张截图 |
| `.tmp/proto/measure-legacy.mjs` | 采样脚本（探针在页面内 rAF + MutationObserver，t=0 是点击时刻） |
| `.tmp/proto/measure.mjs` | 原型自动化脚本 |

**测量方法的两点保留**：

1. `tFrame1` 是「点击后第一次 rAF 回调时刻」，headless Chromium 下有调度抖动（实测 0.1–21.5ms）。所以本文用**中位数 + 「< 16.7ms」**做判据，并额外用 `netAdded = 0` 与 `paint.visible = true` 两条独立证据。**同步耗时 tSync 不受抖动影响**，它是「换层动作本身」的硬成本。
2. 「有没有真的变」由 `getComputedStyle(iframe).opacity !== '0'` + `getBoundingClientRect().width > 0` + 截图共同确认，不靠脚本自报。