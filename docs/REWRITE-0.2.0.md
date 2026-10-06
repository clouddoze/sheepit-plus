| S3 | `site` 原版模式（三态开关：关/原版/开） | ✅ 已完成（见下） |# 0.2.0 计划：上传链路（上传 → 等待 → 设置）按源码重写

> 状态：**设计已核对上游源码，等用户拍板后动手**。
> 范围（用户 2026-10-07 拍板）：0.2.0 只做「上传 → 等待 → 设置」三步链路；项目管理页留到 0.2.1。
> 依据：上游 GitLab `sheepitrenderfarm/www`，master `9b13032c`（= 线上指纹），已整仓拉取核对。

---

## 0. 为什么要重写

现在的做法是「抓站点 HTML → 自绘界面 → 把站点碎片塞进活文档 → 站点 JS 和我们的 JS 抢同一份 DOM」。
代价已经付过：0.1.14–0.1.17 的「第三步有两份表单、提交的是隐藏原件」就是因为 `box.innerHTML = s.html`
在活文档里造了第二份控件 id，站点的 `$('#id')` 解析到了原件。补丁（`hideStaleAnalyse`/`parkAnalyse`）
能让它不出错，但整条链路仍然依赖「站点 JS 的 DOM 行为不变」——这正是用户担心的那条脆弱链路。

结论（用户拍板）：**按源码重写整条链路，通过实验开关切换**。

## 1. 上游事实（已核对，不是推测）

| 项 | 事实 | 出处 |
|---|---|---|
| 仓库 | GitLab `https://gitlab.com/sheepitrenderfarm`（**不是 GitHub**）；`www` 是站点本体 | group projects API |
| 版本 | `www` master HEAD = `9b13032c`（2026-09-25）＝线上资源路径 `/media/9b13032c/` ＝ `getShortVersion()` | `HTML.php:1956` |
| 上传页 | **不是** `/project/add`（那是 404），而是 `/getstarted` 最后一段 `<section class="slice color-three">` | `templates/getstarted/getstarted.html.twig:86` → `HTML::printCreateProject()`（`HTML.php:2021`） |
| 本地快照 | `.tmp/upstream/src/www-<sha>/www/`（templates + src + ajax 脚本，608 文件） | 本次拉取 |
| 线上样本 | `.tmp/upload-test/live-getstarted.html`（上传表单）、`live-step2.html`（等待页）、`step3-outer.html`（真实抓到的第三步碎片） | 本次抓取，逐个 id 与源码对齐 |

### 1.1 契约 A：上传（第一步）

```
表单（HTML.php:2127-2152）
  POST /project/internal/upload        （route app_project_add_step1）
  enctype=multipart/form-data
  onsubmit=addproject_upload_progress_fct('<32 位 hex>')
  <input type=hidden name=UPLOAD_IDENTIFIER value=<同一个 32 位 hex>>
  <input type=file   name=addproject_archive>
  提交按钮在 <td id="td_upload_submit"> 里
  #upload_progress_bar / #upload_progress_label 是站点的进度条（jQuery UI progressbar）
进度轮询：POST /project/internal/progress  {uid}  → {content_length, bytes_processed}
服务端（ProjectController::add_step1 :111-179）：
  先 addProjectCheck(null,null,null) → 不通过就 return new Response(纯文本原因) —— **不是错误页**
  再校验文件后缀（blend/zip）、大小（MAX_SIZE）
  通过 → 建 ProjectAnalyse 行 + **302 → /project/add/<token>**
站点前置拦截（HTML.php:2091-2108）：renderedFrames < 10 且公共剩余帧 > 5000 → 整块只渲染
  #addproject_warning_zero_frame，**连表单都不给**
```
注：上传页还带一个**估算器**（`HTML.php:2158-2202`）：`POST /project/estimator` 传 `time`/`count`/`device`，
设备名走 `GET /device/search`（jQuery UI autocomplete，`?term=`）。用户要求本次一并自绘。

### 1.2 契约 B：等待分析（第二步）

```
页面：GET /project/add/<token>（add_step2，只渲染模板，**不校验 token**）
  容器 #project_add_analyse_result 里是"Please wait while your project is being analysed."
  站点 JS：doAnalyseUploadedProject(token)（addproject.js:177-211）
轮询：GET /project/add_analyse/<token>
  {"status":"RETRY"}                      → 5s 后再轮
  {"status":"PROCESSING","analysed":a,"total":t} → 5s 后再轮
  HTML（FINISHED）                        → 站点把整段 HTML 注入 #project_add_analyse_result
  找不到 token / 已过期                    → 整页错误页（实测 xQqKF8 已过期，返回 Oops 页）
```

### 1.3 契约 C：设置与提交（第三步）

第三步**不是一个页面**，是契约 B 返回的 HTML 碎片（`formAddProject`，`HTML.php:960-1449`）：

```
#public_render      checkbox value=1（默认勾选）
#generate_mp4       二形态：全 EXR 时是 hidden(value=0)；否则 checkbox
#public_thumbnail   二形态：不允许关缩略图时是 hidden(value=1)；否则 checkbox
#token              hidden = 分析 token
#compute_method_cpu / #compute_method_gpu   radio（站点按 blend 能力决定给不给这一列）
#addproject_content_<i>                     每个 blend 一张卡片，i 从 0 顺排
  #addproject_exe_<i> / _path_<i> / _archive_<i> / _engine_<i> / _denoising_<i> /
  #addproject_color_management_<i> / _render_on_gpu_headless_<i> / _use_adaptive_sampling_<i> /
  #addproject_framerate_<i> / _output_path_<i> / _width_<i> / _height_<i> /
  #addproject_cycles_samples_<i> / _samples_pixel_<i> / _image_extension_<i>     ← 15 个隐藏值，提交时读
  radio name=addproject_change_type_<i>   animation / singleframe
  #addproject_animation_div10_<i>   Start/End/Step frame
  #addproject_animation_div11_<i>   切块滑条（engine=CYCLES 且不允许 tile 时）
  #addproject_singleframe_div20_/div21_<i>
  #addproject_split_tiles_number_<i>  隐藏 1 / 隐藏 -1 / select（同一 id，按分支只出一个）
  #checkbox_ad_<i> → #checkbox_advanced_option_<i>（内存）
  #addproject_submit_div_<i> → #addproject_submit_<i>
  #addproject_error_box_<i>          ← 在 form 外
拒绝分支：只有 h4 + div.error，没有 form（blend 无相机 / 无输出节点 / 分析报错）
提交（addproject.js:1-101）
  POST /project/add_internal   （jQuery：new $.ajax(url, {method:'post', data:{…}})）
  27 键：type compute_method executable engine denoising color_management render_on_gpu_headless
        token public_render public_thumbnail generate_mp4 start_frame end_frame step_frame
        archive max_ram_optional path framerate output_path width height split_tiles
        split_samples use_adaptive_sampling cycles_samples samples_pixel image_extension
  compute_method 是位掩码：CPU=1，GPU=8（都勾 = 9）
  响应：文本以 "http" 开头 → 跳转该地址（成功体是 `{scheme}://{host}/project/<id>`）；
        否则整段替换 #addproject_content_<i>（站点的错误 <p class="error">）
服务端必查 24 键（缺一即纯文本 `missing parameter`）：start_frame end_frame step_frame path
  framerate output_path width height executable compute_method engine render_on_gpu_headless
  denoising public_render public_thumbnail generate_mp4 type split_tiles cycles_samples
  samples_pixel image_extension use_adaptive_sampling token archive
  （color_management / max_ram_optional / split_samples **不**必查）
前置闸门 addProjectCheck（ProjectController.php:1108-1149，命中即失败）：维护模式 / 没有头像 /
  无 ACL / 并发项目超限 / 帧数为负 / Blender 二进制不支持
成功后再也回不去：ProjectAnalyse 行被删（:427），token 一次性
```
**站点源码里的两个坑**（我们照抄语义、不照抄 bug）：`HTML.php:1206` 的 name 属性少了收尾引号；
`#addproject_split_tiles_number_<i>` 在隐藏输入与 select 两个分支里**重复 id**（同分支只出一个）。

## 2. 三态开关（用户 2026-10-07 拍板）

`uploadMode` 的值改为 `off` / `site` / `new`（旧的 `compat` 语义作废）：

| 值 | 界面名 | 行为 |
|---|---|---|
| `off` | 关 | 导航栏**没有**「上传项目」；链路完全不接管（`/getstarted`、`/project/add/*` 保持站点原样，只保留我们现有的 i18n 补丁） |
| `site` | 原版 | 导航栏有「上传项目」；进去是**我们外壳 + 站点原版界面的内容区**：保留站点活节点、站点自己的表单与 JS 照旧工作；只去掉站点**全站装饰**（顶部导航、页脚、下载客户端等）。整条链路（上传 → 等待 → 设置）都保持原版 |
| `new` | 开 | 导航栏有「上传项目」；三步全部是我们自绘的界面，数据只从上面三个契约来，提交由我们发出 |

> ⚠️ 待确认（见 §7）：`site` 模式的三步是否都保持原版。本计划按"整条链路都保持原版"写。

## 3. 「开」模式的实现

### 3.1 模块划分（`build.mjs` 按文件名排序拼接，新文件排 70 之前）

| 文件 | 职责 |
|---|---|
| `src/62-chain.js`（新） | 链路数据层：三个契约的请求/解析/提交 + 结构指纹 + 降级判定。**只认服务端契约，不碰活文档** |
| `src/64-step1.js`（新） | 上传页：自绘表单 + XHR 上传 + 自绘进度 + 估算器 |
| `src/66-step2.js`（新） | 等待页：自绘进度 + 自己的 5s 轮询 + 中立化站点轮询 |
| `src/68-step3.js`（新） | 设置页：从碎片里取数据 → 自绘控件 → 自组 27 键提交 |
| `src/80-app.js` | 只做接线：路径判定、视图切换、三态开关 |
| `src/50-views.js` | 只保留纯渲染（`Views.upload/analyse` 转调新模块） |
| `src/60-step3.js` | 0.2.0 验收通过后**删除**（其"站点 id 对照表"价值移进本文件 §1.3） |

### 3.2 数据流（关键：站点碎片**永不**进活文档）

```
/getstarted（或应用内 #/upload）
  └ 抓 /getstarted → DOMParser → 只取两件事：
       ① 表单在不在（#addproject_warning_zero_frame 在 → 显示站点的前置拦截说明）
       ② 估算器需要的静态文案（可选）
  └ 自绘：文件选择 + 说明 + 估算器
  └ 提交：XHR POST /project/internal/upload（FormData：addproject_archive + UPLOAD_IDENTIFIER）
       upload.onprogress → 自绘进度条（不再轮询 /project/internal/progress）
       成功：xhr.responseURL 命中 /project/add/<token> → 跳转等待页
       失败：解析响应（error.html.twig 的 message 块 / 纯文本 addProjectCheck 文案）→ 就地显示

/project/add/<token>
  └ 自绘等待卡片；window.doAnalyseUploadedProject = noop；移除 #project_add_analyse_result
  └ 自己轮询 GET /project/add_analyse/<token>（no-store）：RETRY / PROCESSING(a/t) / HTML
  └ 拿到 HTML → DOMParser 解析 → 交给 68-step3（活文档里从头到尾只有我们这一份 DOM）

设置页（68-step3）
  └ 取：token、三个公开开关（hidden/checkbox 两形态都认）、CPU/GPU 可用性、
        每个 <i> 卡片的 15 个隐藏值 + 可见默认值 + 是否拒绝分支
  └ 自绘：卡片（每个 blend 一张）+ 可见性/计算方式/帧范围/切块/内存/错误槽
  └ 提交：fetch POST /project/add_internal，body = URLSearchParams（27 键，值全部来自上一步取到的数据）
       响应以 http 开头 → location.href；否则把错误 HTML 显示在我们的错误槽里
  └ 结构指纹：token + public_render + 至少一个 addproject_content_<i> 齐不齐；
        不齐 → **降级**：把服务端碎片原样渲染进卡片 + 顶部提示"上游结构变了"（并记进报告键）
```

自绘控件**不再复用站点的 id/name**（邮件契约只认 POST 键，不认 DOM）；这样 0.2.0 起不可能再有
「两份表单」这类缺陷。

### 3.3 提交前的本地校验（比站点多一点，但不拦合法输入）

站点自己的 3 道闸门：动画的 `start<0 || step<0`、`compute_method==0`、其余一律发。
我们补：`end < start`、帧数上限的**提示**（上限数字来自服务端错误文案，不硬编码）、内存非数字。
**所有"服务端说了算"的判断一律等服务器回话**，不在前端复刻 `addProjectCheck`。

## 4. 「原版」模式的实现

- `/getstarted`：接管但不重绘 —— 把站点那个 `section`（上传表单那段）整体搬进我们的 `#sp-body`
  （沿用管理页 `wireManageDoc`/`parkManage` 的现成机器），站点内联 `onsubmit` 与 jQuery UI 进度条照旧可用。
- `/project/add/<token>`：同样搬 `#project_add_analyse_result` 所在 `section`；站点自己的
  `doAnalyseUploadedProject` 照旧轮询并把第三步碎片注入那个容器（我们不插手）。
- 要隐藏的装饰（实测确认后写死清单）：站点顶栏、页脚、右侧 `printAddProjectRight`（下载客户端/等待队列）、
  面包屑、广告位。
- 与「开」共用同一套"搬活节点"机制：`site` 与 `new` 的差别只在"谁来画"，不在"怎么搬"。

## 5. 分阶段与验收

| 阶段 | 内容 | 验收 |
|---|---|---|
| S1 | `62-chain.js` 数据层 + `68-step3.js` 设置页（离线 fixture 驱动） | ✅ 已完成（见下） |
| S2 | `64-step1.js` 上传页 + `66-step2.js` 等待页 | ① 离线：错误分支（维护中/无头像/并发上限/后缀不对/超大）逐个显示正确文案；② 真机：上传 `sptest.blend` → 跳等待页 → 分析完成（会产生一个分析 token，不产生项目） |
| S3 | `site` 原版模式（三态开关改名：off/site/new） | 三个页面截图对比站点原版；站点表单/进度条/轮询在嵌入后仍工作 |
| S4 | 文档 + 发布 | `docs/PUBLISHING.md` 补 0.2.0 段；`node .tmp/make-stage.mjs`；构建预算与字典覆盖检查 |

### S1 已完成（离线全绿，未碰服务器）

代码：`src/62-chain.js`（新增，契约层）、`src/68-step3.js`（新增，自绘设置页）、
`src/80-app.js`（`paintAnalyse` 接线 + 降级）、`src/30-style.js`（`.up3-*` 皮肤，含自绘滑条；
把 `type=range` 从通用输入框规则里摘出来）、`src/10-core.js`（`up3x.*` 字典）、`src/12-lang-zh.js`
（站点说明/拒绝理由的正则翻译）。

验收证据（全部在真站点页面里、用真 jQuery + 真 `addproject.js` 跑，只是不发真请求）：

1. **逐键一致**：把同一份碎片分别喂给站点自己的 `doAddProject(i)`（`$.ajax` 换记录桩）和我们的
   `Chain.parseStep3 → Step3x.render → Chain.buildPayload`，用 `$.param()` 序列化后逐键比。
   四个分支（真碎片 EXR/降噪、tiles 下拉、samples 滑条、单帧+滑条）**各 27 键、零差异**。
2. **形态齐全**：真碎片 / 两个 `.blend`（多文件警告）/ 站点拒绝的文件（只有理由）/ tiles / samples
   五种都能渲染；结构不认识的 HTML → `parseStep3` 返回 `null`，走 0.1.18 的降级路。
3. **端到端接线**：拦 `window.fetch` 让 `/project/add_analyse/<token>` 回真碎片 → 应用自己 boot →
   轮询 → 自绘 → 点「添加这个文件」→ 桩收到的正是 27 键（`token/path/width/split_tiles/public_thumbnail/…` 值正确）；
   同时 `#project_add_analyse_result` 不在文档里、站点的 `addproject_content_0` 从未进活文档。
4. 上游指纹：线上 `/media/` 版本 = `9b13032c` = `Chain.UPSTREAM`（脚本自己报的一致）。


### S3 已完成（原版三档 + 用户实报的两处修正）

用户 2026-10-07 的定义与两次追加：
- 关 = 整条链路不接管（顶栏也不出入口）
- 原版 = 只显示上传相关的那部分内容（顶栏、页脚、下载客户端都不出现），**排版要收拾干净**
- 开 = 源码重写（62-chain / 64-step1 / 68-step3）

**走过的弯路（记下来免得再犯）**：原版一开始做成"把站点整页那一块原样搬进壳里"，两头都错——
① 搬进 `#sp` 之后站点节点落进我们那套通用样式（`#sp *{margin:0}`、`#sp .btn`、`#sp table`），
上传框里的"发送此文件"被压得看不见；② 就算不搬，"原样"就是站点自己的浅色排版，放进深色外壳里又乱又丑
（用户原话："别做这么丑"）。
最终做法：**原版 = 站点自己的控件与逻辑 + 我们的卡片排版**，也就是 0.1.x 就在跑的那两条路 ——
上传页走 `Views.upload` + `wireUploadDoc`（把站点那三块收进三张卡片），等待/设置页走
`paintAnalyse` + `60-step3.js` 的 `enhance()`（面板化）。**所以这两段代码不删**。

落地改动：
- `viewForPath`：`/getstarted` 与 `/project/add/<token>` 在 off 档不接管、site/new 档接管；
  档位切换后重载（路由判定在 boot 时做完）
- `80-app.js` 的 `paintAnalyse`：`enhance()` 两档都跑（之前只有 new 跑，原版落到"注入原始碎片 +
  `.sp-siteform` 展平"，就是那版丑的）
- `50-views.js`：原版档上传页去掉站点自带的 `<h4>估算器</h4>`（与卡片标题重复）
- `60-step3.js`：搬 CPU/高级选项时去掉站点自带的重复标签（"计算方式："、"Advanced options"）
- `10-core.js`：三态标签与说明改成 关/原版/开；`up.expNote` 改成对得上原版的话
- `30-style.js`：把 0.1.18 那套 `.up3-*` 面板样式**取回来**（0.2.0 重写 CSS 时误删，导致原版
  第三步变成没样式的裸控件）；它排在自绘那套之前，同名类冲突时以自绘为准

复验：
- 原版档真机：`/getstarted`（三张卡片、站点表单/估算器/须知都在卡片里、下载客户端不在）、
  `/project/add/aGJVQC`（面板化第三步、CPU/GPU 并排、无重复标签）
- 开档回归：上传页拖放/估算器/错误路径、端到端 27 键、四分支逐键一致 —— 全绿

产物提示线抬到 460000：两套界面在过渡期并存，代码都在包里。


### A 方案（用户 2026-10-07 拍板）：两条路都留，但都"坏得响"

背景问题（用户）：兼容档是"站点控件 + 我们卡片"，如果服务端更新、或原版界面改了，会怎样？维护成本高不高？
把两条路各自"认得什么"数出来之后，结论是**成本量级一样**（每次站点改动都是照着改 1–2 处 + 真机验一次），
真正的差别只有一句：**站点加新功能时兼容档白捡、新版档要补**。所以决定性的不是成本，而是**坏法是否看得见**：

| 站点改了什么 | 兼容档 | 新版档 |
|---|---|---|
| 上传页容器/类名变了 | 卡片拼不出来（原来是**空白**） | 不受影响（只读那页的文案） |
| 第三步表单 id 变了 | 站点自己的 JS 先坏，我们不比它差 | 解析失败 → 退回站点原表单（可用） |
| 加了新选项 | **自动跟上**（控件是站点的） | 要补；否则**静默用默认值** |
| 加了必填 POST 键 | 站点自己的 JS 也漏 → 服务端报错 | 服务端回 `missing parameter`（明确） |
| 换主题/CSS | 我们的皮肤要跟着调 | 不受影响 |

补的两处提示（都已真机验证）：
1. **兼容档**：`wireUploadDoc` 返回 false 时不再留白，由 `50-views.js` 的 `shapeNotice()` 明说
   「站点这一版的页面结构与脚本核对过的不一样，兼容档拼不出上传界面」+ 切档办法。
2. **新版档**：`62-chain.js` 里有 `KNOWN_IDS` 清单，解析碎片时把多出来的 id 收进 `model.unknown`；
   `68-step3.js` 渲染时给出提示条，并写进报告键 —— 设置面板的上游指纹行会因此变红
   （`set.fp.unknownEls`）。这样"站点多了控件、我们按默认值提交"这件事不会沉默发生。

三态名称（用户要求）：**关 / 兼容 / 新版**。


### 第四档「原版」（用户 2026-10-07 追加）

顶栏入口在，点一下 = **新标签页**打开站点自己的 `/getstarted`，我们**完全不接管**那一页
（连 `#sp` 外壳都不挂）—— 就是原站原样，含它自己的顶栏、页脚、下载客户端。

- 存的值 `raw`；`viewForPath` 里只有 `compat` / `new` 两档才接管 `/getstarted` 与 `/project/add/<token>`
- 顶栏点击：raw → `window.open('/getstarted','_blank')`；compat → 本页真跳转；new → 应用内 `#/upload`
- 设置里的四段：关闭 / 原版 / 兼容 / 新版（`site` 是中途用过的名字，归到 compat）
- 真机验证：raw 档在 `/home` 点入口 → `window.open('/getstarted','_blank')`、本页不动；
  在 `/getstarted` → 无 `#sp`、站点顶栏/页脚/下载客户端/上传表单全在（100% 原版）

## 6. 不做的事

- 不碰 `POST /project/estimator` 之外的站点接口语义；不自己发明字段。
- 不复刻站点的 `addProjectCheck` 服务端闸门（维护模式/头像/ACL/并发上限）——等服务器回话。
- 不在 0.2.0 动项目管理页（`/project/<id>`），留 0.2.1；但 §1 的 `manage` 相关结论（`printBlend`
  才是真正渲染那块页面的地方、动作按钮文案在 `title`、所有端点都是无 CSRF 的纯文本 `OK`/`NOK`）
  已经记在案，0.2.1 直接用。
- 不上传、不发版（用户未发话）。

## 7. 用户已拍板（2026-10-07）

1. `site`（原版）模式：**上传、等待、设置三步都保持站点原版**（我们只提供外框 + 去掉全站装饰）。
2. 「上传项目」入口：`site`/`new` 两态都从我们导航栏进；`off` 时导航项隐藏。
3. S1 **先纯离线验收**；真机提交（会产生项目）等用户发话，每次单独确认。

### 附：已核对、0.2.1 要用的管理页结论

- `/project/<id>`（`requirements: project => \d+`，`ProjectController.php:798`）的真正渲染者是
  `HTML::printBlend()`（`HTML.php:275-658`）；`manage.html.twig` 本身只有 343 行（面包屑 +
  `#jobs_of_a_project` + 右栏 Legend/权限/动作三个 tab），`#tab_actions` 默认激活。
- 动作按钮文案在 `title`（仅 `#project_job_<id>_div_actions` 那一组）；tab 里的控件文案在
  `value=`/按钮文本。jQuery-UI tooltip 悬停时会清空 `title`，原文在 `data('ui-tooltip-title')`。
- 所有动作端点都是**无 CSRF 的 POST**，响应是纯文本 `OK`/`NOK`/`EMPTY` 或整页 302 回 `/project/<id>`；
  `admin.js:projectAction` 只在响应**恰好等于** `OK` 时 `location.reload()`，否则 `alert()` 原始正文。
- `#project_public_render_checkbox_value` 会**随状态换元素类型**（公开时是 hidden input value=0，
  私有时就是那个可见 checkbox），onclick 永远读它——重绘时不能改名。
- 计算方式的 radio 发的是**服务端算好的翻转值**（`checked_cpu ? '0' : '1'`），不是 `el.checked`。
- 团队加白名单发**数字 team id**，用户加白名单发 **login**；自由输入不选自动补全 → 发 0 → 404 HTML 被 alert。
