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

## 8. 兼容档退役（用户 2026-10-07 拍板）

用户拍板：**砍掉兼容档，不再维护**。理由是站点一旦改版两条线都要维护（§A 方案那张表里两边的
成本量级本来就一样，而"站点加新功能自动跟上"这个好处抵不过多养一条接管链路）。上传项目只留
三档 —— **关闭 / 原版（`raw`，跳站点自己那页）/ 新版（`new`，彻底自绘）**，历史值 `site`（中途用过
的名字）、`compat` 与空值一律归到新版：它们不该把用户留在一条已经不存在的路径上。

这一版删掉的东西（不是注释掉、没留开关）：

- `src/60-step3.js` 整个文件（`enhance()` 把站点第三步表单重排成我们的面板）与 `SP.Step3`。
- `50-views.js` 的 `wireUploadDoc()` 与它专用的四个 helper（`rewordFileLimit` / `tidyRules` /
  `watchEstimatorResult` / `rebindDeviceSearch`）；上传视图的兼容分支也没了 —— 三个槽位只有
  `64-step1.js` 一种填法。`shapeNotice()` 保留（新版认不出站点结构时仍要说清楚），只去掉兼容档文案。
- `80-app.js` 里降级时"把站点碎片塞进卡片 + 按站点 id 点名提交"那整段（连带它依赖的
  `up3x.degrade` 旧文案）。`paintAnalyse()` 现在认不出来时只显示 `up3x.degrade` + 一个按钮，
  点了走 `handBackToSite()`：`release()` 交还页面，再把站点自己那份碎片放回站点自己的容器
  （站点自己的轮询就是这个写法）—— 不做半新半旧的渲染，也不 reload（重载后脚本照样接管、
  照样认不出来，用户会原地转圈）。
- `30-style.js` 里只服务兼容档的 CSS：`.sp-siteform*`、`.up3-sec*`/`.up3-body*`/`.up3-hid*`/
  `.up3-ico*`/`.up3-hint*`/`.up3-foot*`/`.up3-note`、`.up-rules` 里给站点裸文本排版的那组 `.q*`、
  `.numband`、`.expnote`，以及 `.sp-acmenu`（jQuery UI 的补全菜单只有兼容档那条路会创建；
  守卫里的 `:not(.sp-acmenu)` 例外一并撤掉）。
- 文案（中英两套）：`set.upmode.compat`、`up.expNote`、`up.shapeCompat`、`site.sub`、`site.missing`、
  `up3.frames`/`up3.adv`/`up3.needCompute`/`up3.missing`/`up3.rejected`/`up3.netFail`。

没动的边界：第三步的 27 键提交负载一个字节没改（`62-chain.js` 的 `buildPayload`）；新版在用的
`.sp-up3` 那一套、`.up-body*`、`.up1-*`、`.filepick`、`.sp-manage*` 全部留着。

产物：457,473 → 417,032 字节（-40,441，约 -8.8%）。
- 团队加白名单发**数字 team id**，用户加白名单发 **login**；自由输入不选自动补全 → 发 0 → 404 HTML 被 alert。

## 9. 「我的项目」（0.2.2，用户 2026-10-07 拍板的方向）

入口：**总览加「我的项目」区块 + 项目页加范围切换「全部 / 我发布的」**，不新增导航项。

### 9.1 数据源（真机核对过，不是照源码猜）

站点个人主页那张表来自 `HTML::printProjects()`（`HTML.php:2551`），2026-10-07 抓的真实 HTML
（`.tmp/recon/raw/profile-self.html`、`profile-wiza.html`、`profile-moneymike.html`、`profile-miaocang.html`）：

```html
<div class="w-box blog-post"><h2>Latest projects</h2><div class="padding-15">
  <table class="table table-bordered table-striped table-comparision table-responsive">
    <tr><td><a href="/project/1224469">sptest</a></td><td class="msg_finished">Rendered</td></tr>
```

| 观察到的事实 | 依据 |
|---|---|
| **两列**：名字、状态。**没有**最后更新时间、设备、内存、发布者 | 真机 HTML + `printProjects()` 源码 |
| 状态词在 `td` 的 class `msg_<processing\|waiting\|paused\|finished\|unknown>`；`Rendering (88%)` 的百分比只对 rendering/waiting 有 | `humanStatus()`（`HTML.php:1462`）+ 真机样本 |
| 名字被站点截到 25 字符（`Misc::stringLimit`），带 `...` | `profile-wiza.html`（`SHEAP_V5_Eclipse_Large_Fa...`） |
| **别人的主页没有 `<a>`**（`canManageProject` 为假）→ 解析不出 id | `profile-wiza.html`（22 行全是纯文本） |
| 被封的项目整行 `class="danger"`（`blocked != 0`，如"太重/缺 bake/上传失败"） | `Project::isBlocked()`（`Project.php:506`）+ 源码三元 |
| 零项目时**整块不渲染**（不是空表） | `profile-miaocang.html` 里只有页脚那个同名 `<h4>` 块 |
| 站点自己那份顺序是**插入序**（正在渲染的排在最后），不是"最近在前" | `profile-wiza.html`：22 行末尾才是两个 Rendering |

→ 因此 `parseMyProjects()`：只认 `<h2>`（页脚同名块是 `<h4>`，`smallestBoxByTitle` 那种按字数挑"最小盒子"
的写法在项目少时会挑错块）、用 class 判状态不认英文文案、按 **id 倒序**当"新的在前"（id 是 IDENTITY 自增，
`Project.php:63`；没有 id 的行保持原序）。

### 9.2 实现与验收

- `src/20-api.js`：`parseMyProjects(doc)` → `{ id, name, statusKind, status, pct, blocked, manageable }`；
  `parseProfile()` 返回值多一个 `myProjects`。
- `src/50-views.js`：`myPanel()`（总览区块，最多 5 条 + 「看全部」）、`mineProjects()`（项目页那一档，
  四列：项目 / 状态 / 进度 / 操作）、`scopeSeg()`（两档共用）。
- `src/80-app.js`：`state.myProjects` 取数 + `#sp-scope [data-s]` / `th[data-msort]` / `[data-scope]` 三个接线。
  看自己的总览时**零额外请求**（复用已抓的个人主页）；在别人主页上点进项目页才会多一趟（60 秒缓存）。
- 真机验收（`.tmp/recon/inject-recon.js` 把 dev dist 装进真机页）：自己的主页 1 条（sptest/已完成）、
  Wiza 22 条（无 id）、MoneyMike 2 条（Rendering 36%/21%，两次抓取数字在涨，说明读的是活数据）、
  miaocang 0 条（走空态）；另用合成夹具验了 danger 行、`msg_unknown`、名字截断、7 条截断成 5 + 看全部。
- 窄屏：≤760px 砍掉进度列（条子固定 200px 会把「操作」挤出容器，而百分比本来就在状态文案里）。

### 9.3 没做 / 待定

- **最后更新时间没有数据源**：站点这张表不给，要它就得每个项目跑一趟项目页。区块里因此不画"最近更新"。
- 「我的项目」只在**自己的主页**上画（别人的主页那张表没有 id，点不进管理页）。
- 一个项目都没有时**整块不画**（用户 2026-10-07 拍板）；区块位置固定在指标带下面。去上传页的入口留在
  项目页「我发布的」那一档的空态里。

## 10. 项目设置（0.2.2，用户 2026-10-07 拍板：先自绘「操作」区）

用户定的方向：**现状（把站点那一大块搬进我们的壳）只是兼容适配，最终要像上传链路那样彻底重写**。
所以这一版就按终态的形状写：**解析器出数据模型 → 视图只吃模型 → 动作直发站点端点**，
不再往搬进来的站点节点上加耦合。

### 10.1 契约（上游源码逐个核对）

`templates/project/manage.html.twig:133-274` 渲染设置控件，`showjob.js` / `admin.js` 是提交方：

| 设置 | 当前值怎么读 | 写端点（无 CSRF 的 POST，回纯文本 `OK`） |
|---|---|---|
| 计算方式 | `input[name=compute_method]` 里哪只 `checked`，onclick 里写着 `'cpu'`/`'gpu'` | `/project/<id>/computemethod/<cpu\|gpu>/<0\|1>` |
| 生成 MP4 | `#project_generate_mp4_checkbox_1` 的 checked | `/project/<id>/mp4/<0\|1>` |
| 公开渲染 | 公开时 `#project_public_render_checkbox_1`（checked）+ 一只 hidden `#..._value`；私有时 `#..._value` **自己**就是那只可见 checkbox | `/project/<id>/visibility/<0\|1>` |
| 删除项目 | —（按钮恒在，`can_manage` 才渲染） | `/project/<id>/remove_no_redirect` |

三个坑（都写进 `20-api.js` 的注释里了）：① 站点 radio 的 onclick 值是**翻转后的目标值**
（`checked_cpu ? '0' : '1'`），判当前值只能看哪只 checked；② 公开渲染那两只控件的 id 会**换形态**
（判据看 `type` 不看 id）；③ 站点 GPU 那只 radio 的外层判据写成了 `canUseCPU()`（站点自己的 bug，别照抄）。

### 10.2 实现与验收

- `20-api.js: parseManage(doc)` → `{ compute, mp4, publicRender, hasCompute, hasMp4, hasPublic }`；
  站点没渲染的那几项解析成 `null`/`false`，视图就**不画那一行**（不猜默认值）。
- `50-views.js: manageOps(state)`：自绘「项目设置」面板（计算方式二选一 + 两只开关 + 危险动作一行）。
- `80-app.js`：`state.mg` **一载只读一次**（读完之后 wireManageDoc 会把站点那份重复控件去掉，
  再读就读不到 —— 实测踩过，第二次 render 把两行读没了）；`mgSet()` / `mgDelete()` 直发端点，
  成功后说完结果再 `location.reload()`（站点自己的 JS 也是 reload，真相在服务端渲染的 DOM 里）；
  `hideSiteOps()` 把站点那份重复的「计算方式 / MP4 / 操作页签」藏掉/去掉（用 `style.display`，
  不用 `[hidden]` —— `#sp` 里有 display 规则压过它，这个坑踩过一次）。
- 真机验收（`.tmp/recon/inject-page.js`：把**真实页面** document.write 进被 mock 的 Document，
  再装 dev dist，于是 `/project/<id>` 的站点 DOM 与真机同形）：
  `POST /project/1224469/mp4/1 → OK`（刷新后 `mp4:true`，再点回 `false`）、
  `POST .../computemethod/gpu/1 → OK`（刷新后 GPU 选中，再点回 CPU）、
  `POST .../visibility/0 → OK`（刷新后读到**私有形态** `pubA:false/pubB:true`、`publicRender:false`，
  再点回 1）—— 三次都按原值还原，测试项目最终状态与测试前一致。
- **删除项目没在真机上点过**（不可逆）：端点与站点自己的垃圾桶按钮同一个（上一期已实测过
  `remove_no_redirect` 的删除+404 效果），但自绘按钮 → confirm → 导航这条链路只有代码级核对。

### 10.3 已补完（0.2.2 第二片：整页自绘，搬节点那套路整条删掉）

用户 2026-10-07 明确：「现在只是兼容适配，最终还是会像上传那样彻底重写」。于是把 10.2 那片直接推到
终态：**数据来自那一页 HTML 的副本，站点节点一个都不进我们的壳**。

- `20-api.js: parseManage(doc, id)` → 全量模型：`name / statusText / statusCls / progression /
  summary[{label,value}] / warn / actions[{kind,url,title,disabled}] / tiles[{src,frame,cost,time,state}] /
  video / acl{managers,renderers,teams,hasManagerPanel,hasRendererPanel,hasTeamPanel} / canManage /
  三处设置`。概要那几条按 `标签 + <span>值</span>` 拆两段（否则 `On reference per frame rendertime:`
  那条语言包匹配不上）；动作按 onclick 与 title 归一成 kind；**站点"活跃项目太多"时那只灰按钮**
  （`href="#"`、没有 onclick、原因写在 title 里）也认回来并标 disabled。
- `50-views.js`：`manageActions / manageOps / manageAcl / manageSummary / manageTiles` 五个自绘块。
  站点没渲染的那几项**不画**；公开渲染开着时站点不渲染名单，就明说「关掉公开渲染名单才会出现」。
- `80-app.js`：删掉 `wireManageDoc` / `parkManage` / `hideSiteOps` 与 `mgNode` / `mgAnchor`（搬活节点
  那整套），换成 `ensureData('project')` 里的 `Api.fetchPage('/project/<id>') → DOMParser →
  parseManage`；新增 `mgAct`（pause / resume / reset / partialframearchive）、`mgAcl`（三种名单增删）、
  `wireManage`（名单输入框的自动补全）。
- 删除项目那次「一载只读一次」的补丁随之作废（现在读的是副本，随便读几次都不会被我们自己改坏）。
- 端点（`ProjectController` 的 Route 表逐个核对）：`/{id}/{pause,resume,reset}`、
  `/{id}/action/partialframearchive`、`/{id}/acl/manager/user/{add,del}/<login>`、
  `/{id}/acl/renderer/user/{add,del}/<login>`、`/{id}/acl/renderer/team/{add,del}/<team id>`；
  自动补全走 `/user/list_from_term` 与 `/team/list_from_term`。

**自动补全踩到的站点坑**（写进 `80-app.js` 注释）：`/user/list_from_term` 回的是 **JSON 对象**
`{"0":"alice",…}` 而不是数组 —— 站点那边 `natcasesort()` 保留了键，`json_encode` 就把非连续数组
编成对象了。`/team/list_from_term` 反而是正常的 `[{value: 数字 id, label: 团队名}]`。两种形状都得认。

**真机验收**（`.tmp/recon/inject-page.js`：真实页面 document.write 进被 mock 的 Document，再装 dev dist；
它取页面时带 `?spraw=1`，这样"只 mock 精确 URL 的桩规则"不会连文档一起换掉）：

| 场景 | 证据 |
|---|---|
| 真实 finished 项目页 | 全字段解析正确（sptest.blend / Rendered / 2/2 / 概要 4 行 + 红字 / 3 个动作链接 / 帧 2 + 视频预览），视觉复核通过 |
| 管理员增删 | `POST /acl/manager/user/add/muwyelkoai3k → OK` → 刷新后名单出现 → `POST .../del/... → OK` → 名单复原为空 |
| 公开渲染 off/on | `POST /visibility/0 → OK`（读到**私有形态**与两个名单面板 + 团队补全建议）→ `POST /visibility/1 → OK` 复原 |
| 暂停/继续/重置/部分存档/灰按钮/非空名单/三种帧状态 | 只有合成桩能造（真项目是 finished）：桩里 5 个动作全渲染、灰按钮带站点原因当 tooltip、alice/bob/carol/Dragon Studio 四个名单行 + 三种边框色的帧方块 |

**没在真机上点的**：删除项目（不可逆，按用户规矩不点）。**注意自动化会自动接受 `window.confirm`**
（实测：移除管理员的确认框被自动接受，POST 照发）—— 所以真实站点上永远不要用自动化去点删除按钮。

### 10.4 顺带清掉的东西

- `.sp-manage*` 整块 CSS（只服务"搬进来的站点节点"）→ 换成自绘的 `.mg-*`。
- `.up-body` 下已经没有对应 DOM 的站点标记规则：`#upload_progress_bar` / `#addproject_estimator_result`
  （29 行）/ `form table,td` 那一组 / `input-group` / `input[type=submit]` / `.note`
  —— 0.2.0 起上传三步全自绘，这些站点 id 与表格在页面上根本不存在了。删前逐段断言、删后自查
  花括号与注释配平（脚本 `.tmp/recon/drop-dead-upbody.mjs`）。
- 一字不差的重复 CSS（`.fp` 小卡 + `.sp-manage` 整块 + sp-rise 动画，7170 字节，第 874-951 行与
  第 1040-1117 行逐字节相同）删掉一份（脚本 `.tmp/recon/drop-dup-css.mjs` 自带"两段必须逐行相等"的断言）。

### 10.5 还欠的

- 站点那一页本身仍在文档里（我们在它上面盖一层），所以它的 JS 照旧会跑（LazyLoad / masonry 那些）。
  要彻底不加载它，得改成不接管 `/project/<id>` 而是自己造一页 —— 那是另一个量级的改动，没做。

## 11. 0.2.2 第四批：排序偏好、总览调序、机器详情、四个真缺陷、指标带折行

（用户 2026-10-07 逐条点名；四轮产出一批，指标带折行是本批最后一轮。截至写这段**仍未提交、未发布**。）

### 11.1 排序自定义（用户点名第一步）

- `src/50-views.js`：`P_SORTS`（全站列表）/ `M_SORTS`（我发布的）两张注册表 + `sortCmp(spec,key)`；
  偏好落盘键 `SORT_PREF='projSort'`，存 `{sort, msort, dir}`；`setSortPref()`（设置页单选）、
  `setDirPref()`、`saveSort()`（**点表头排序也一并记住**）。
- 设置页新增「默认排序」一栏（`set.psort` / `set.psortHint`），选项标签**复用既有的 `proj.col.*` 词条**，
  没另加一列文案。
- 「我发布的」那张表站点只给得出名字与进度，所以 `M_SORTS` 里只放能排的那几列。
- 真机验收：设置「内存 + 升序」→ 项目列表按内存升序；**整页刷新后仍生效**
  （`.tmp/recon/shots/10-sort-projects-memory-asc.png`、`11-sort-settings.png`）。

### 11.2 总览区块：显隐 + 调序（用户点名第二、三步）

- `OV_BLOCKS`（kpi / mine / charts / heat / machines）、`OV_PINNED=['kpi']`、`ovHidden`、`ovOrder`、
  `ovDisplayOrder()` / `setOvHidden()` / `moveOv()` / `ovRow()`。
  存的是**被关掉的键**而不是"开着的键"：以后新加一个块，老用户的偏好里没有它 → 默认就是开着的。
  认不出的键直接忽略。
- 设置页「总览区块」= **一行一块：开关 + ↑↓**，行序就是页面顺序；`kpi` 那行只给开关 +
  「固定在顶部」。**总览页本身不加任何按钮**（用户拍板：位置固定、但仍可隐藏）。
- 真机验收：关掉「渲染产出」→ 整块消失、刷新仍关；把「在线机器」连按 ↑↑↑ 顶到最前 → 总览顺序真的跟着变
  （`12-ovblocks-heat-off.png`、`13-ovlist-settings.png`、`14-overview-reordered.png`）。

### 11.3 在线机器详情（在线时间 / 运行状态 / 渲染方式 / 性能 / 已渲染帧数 / 积分）

- 数据：`src/80-app.js` 的 `machineDetails(profile)` —— 逐台取机器自己的 `/session/<id>`，
  **最多 3 台**、每台一次 GET；**不从历史会话取数**（用户明确）。
- 渲染：`src/40-ui.js` 的 `machineDetail(d)` —— CPU/GPU 标签（**亮哪一路以站点 `Compute device` 为准**，
  算力值直接写在标签里 `CPU 22 %`）、状态、`已连接 X`（`createdAt` → 现在；已停的算到最后一次请求；
  站点原文挂 `title`）、右侧「已渲染帧数 / 积分」。
- 为什么不能拿「Power CPU」判有没有走 CPU：客户端取消勾选 CPU 后，`CPU` 型号格与 `Power CPU` 百分比
  **都还在**（真机实测 `Power CPU 130 %`），看它们必然误报"两路都亮"。
- 真机（miaocang 的 `SheepIt-Docker` / `Fen-PC`）逐条验过：`19-machine-real-miaocang.png`、
  `20-machine-paused-client.png`。

### 11.4 四个真缺陷（都是真机实测逼出来的）

1. **登录入口 404** —— `src/40-ui.js` 的 `UI.state.loggedOut()` 曾写 `/user/signin/%2Fhome`（404）。
   实测 `/user/signin`、`/user/signin/home` 是 200，两个编码变体都 404 → 改成 `/user/signin/home`。
2. **两种暂停收不到** —— `src/20-api.js` 的 `parseSession` 第一道判据 `if (!th || !td) continue;`
   把「没有 `<th>`」的状态行整行丢掉；真机原文是
   `<tr><td style="…"></td><td><span style="color:red">Paused client side</span></td></tr>`。
   改成不要求 `th`、取该行所有非空 `td` —— **会话页视图与在线机器两处一起变正确**。
3. **原版界面的会话页没有汉化**（用户实报）—— 不是回归：`src/12-lang-zh.js` **从来没有**这批词条
   （`git log -S` 六个字符串全部 0 命中）。补 40+ 条（机器信息表 / 两种暂停 / 时间线图例 / 按钮），
   措辞沿用重制版的 `sess.f.*`。
4. **表格横向滚动条**（用户实报 + 追加要求"截断处悬浮看全文"）—— 会话页「可渲染项目」那张长表与项目页
   那张表超出容器，外层 `.tablewrap` 只能横向滚。改成 `table-layout:fixed` + `<colgroup>`
   （两张表**列宽不同**：项目页状态列是短词、会话页是长句子）、`.tbl.fit .bar{min-width:0}`，
   并给「分数」格与顶栏用户名补 `title`。真机：会话页 1408/888 宽、项目页 1068 宽都是
   `scrollingWraps: []`（不横向滚）；**被截断且无 `title` 的文字元素 0 个**
   （`22-projects-table-fit.png`、`23-session-table-fit.png`）。

### 11.5 指标带（数据看板）折行：右下角那块空洞（用户实报，本批最后一轮）

用户原话：「会话页和总览的看板，如果项目过多的话，它会挤到第二行，然后有些排版就会有问题」。
这里的「看板」= 顶部指标带 `.kpis`（用户在排序那一轮自己说过「上面那个数据看板」）。
「项目过多」的因果成立：总览的看板在建过项目后会多出「建的项目 / 订的帧」两格（4 格 → 5–6 格）。

**量出来的旧行为**（真机会话页，5 格）：一行只在 >1200px 成立；1199–861 走 3 列 → 3+2；≤860 走 2 列 → 2+2+1。
折行后**最后一排填不满** —— 右下角留一块空洞，内部分隔线只画到一半
（`.tmp/recon/shots/30-kpi-band-2rows-session.png`）。

**改法**（用户拍板：能一行就一行，真放不下才折、折了要铺满；全在 `src/30-style.js`）：

- 栅格 → flex：每格 `flex:1 1 var(--kb)`，`--kb = 100% / 格数 - 1px` 时就是整齐的一行。
  减 1px 是留给亚像素取整的余量 —— 6 个 16.667% 相加可能超过 100%，不减速会让第 6 格被挤到第二排。
- `flex-grow:1` 让**最后一排自动铺满整行**，空洞消失。
- 分隔线从 `border` 改成 `box-shadow:-1px 0 0, 0 -1px 0`：折行后"谁是每排第一个"由布局决定、
  CSS 选不出来；每格都往左、往上各画 1px，最左与最上那两条落在容器边框上被 `overflow:hidden` 吃掉 ——
  于是任意排版下都不缺线、也不双线。
- 档位：`≤1240` 先缩内边距与数值字号（27→24px）把一行**尽量保住**；真放不下才折：
  6 格 `≤1090`、5 格 `≤920` 折成 3 格一排；4 格 `≤745`、3 格 `≤620` 折成 2 格一排；5/6 格 `≤480` 再降到 2 格。
  阈值按「每格至少留约 145px 内容」倒推 —— 最长那类数字 `356,569,549`（24px 下约 140px）刚好不被省略号截断。

**验收**（`inject-dist.js` 把新产物 fetch 进真机页面，`kpi-probe.js` / `kpi-tiers.js` 量）：
5 格在 1160px **保持一行**（旧版这里已经折了）；900px 折成 3+2，两排都铺满、横线贯通；
6 格在 1000px 折成 3+3；528px 折成 3+2。n=3..6 × 17 个宽度逐档量：
**每一排的宽度和 = 容器内容宽（±2px 取整）**，且**没有任何一格的数值被省略号截断**。
截图 `31`–`34-kpi-*.png`。离线门禁：`probe-sort.mjs` 69 项全过；`check-ui-dict.mjs` = zh 504 / en 492。

### 11.6 窄窗口下迷你折线不再溢出格子（用户点名的可选小项）

指标带（`.farm`，只出现在项目页那条「全站实时」）里每格右端挂一条走势迷你折线。
`#sp .farm svg{...;flex:none}` 让它**不能收缩**：真机 868px 视口下四格各 166px，
固定 160px 的折线加数值会溢出格右边缘 **43–77px**，被邻格的背景盖住（看着像被裁）。
改成 `flex:1 1 auto;min-width:0`：宽格子仍由 `max-width:160px` 顶住，窄格子按剩余空间缩。
真机 7 档（1400/1100/900/800/700/620/560）复测：**最大溢出 −14px**（都在格内），
折线宽 69–160px 自适应（`.tmp/recon/shots/35-farm-before.png` / `35-farm-after.png`）。

### 11.7 第六期遗留：上传页错误分支（桩验，2026-10-07）

这三条**在真站上没法触发**（要站点开维护、要一个没上传头像的号、要把项目数顶到上限），
所以用上游 PHP 原文造桩。上游事实（逐个核对）：

- 页面 `/getstarted` 自己就拦：维护中（`HTML.php:2022`）、**没头像**（`:2027`）、
  并发上限（`:2033`）、ACL 被禁（`:2040`）—— 四条都走 `printError()`（`:1637`，形状是
  `section.slice.color-one .text-center h2 + p`）并且**提前 return、不给表单**。
- `POST /project/internal/upload` 命中的同一条闸门（`ProjectController.php:1108-1125`）回的是
  **HTTP 200 纯文本理由**（`add_step1` 的 `new Response($errorMessage)`）。

**桩测出来的旧行为**（`.tmp/recon/inject-upload.js` + `run-upload-matrix.ps1`，10 个场景）：

| 场景 | 旧行为 | 判定 |
|---|---|---|
| 页面闸门：维护中 / 无头像 / 并发上限 | 只剩通用兜底「站点这次没有给出上传表单（通常是没有渲染够帧数，或者正在维护）」 | ❌ 站点给的具体原因（含"去传头像"这种可操作指引）一个字没读 |
| 页面闸门：欠 10 帧 | 站点英文原文 | ❌ 中文界面显英文 |
| POST 拒绝：维护中 / 无头像 / 并发上限 / 无原因 | 英文原文 | ❌ 未汉化；且 `<br>` 处粘连成 `project.To add one`、`projects.The limit` |
| 本地拦截：后缀不对 / 超过站点上限 | 中文、正确 | ✓ |

**改了四处**（都在显示层）：

1. `src/62-chain.js` 的 `uploadPage()` 新增 `gate:{title,body}` —— 解析 `printError` 那块；
   并加 `brText()`：**先把 `<br>` 换成空格**再取文本（治粘连）。
2. `src/64-step1.js` 的 `buildForm()`：`!hasForm` 时优先站点 `warning`（欠帧那条），
   其次 `gate` 标题 + 正文（各走 `zh()`），最后才通用兜底；闸门命中时**连估算器与须知两块面板一起收掉**
   （只清内容会留两个空壳标题，桩验截图抓到的）。
3. `src/62-chain.js` 的 `messageFrom()`：解析前把 `<br>` 换成空格。
4. `src/12-lang-zh.js`：补 7 条 pattern（维护中标题、无头像标题、无头像正文、并发上限正则、
   ACL 被禁、欠 10 帧那段、`Internal error, please retry to upload your file`、`Oh no!`）。
   并发上限那句上游有**两个时态变体**（页面 `has been set`、POST `have been set`），正则一起吃。

**复验**（干净单实例：先让装着的那版 `uiMode=classic` 载入退场，再装 dev dist；
本机浏览器 + 测试账号 `muwyelkoai3k`，`spCount=1`）：闸门三条分别是
「站点正在维护，暂时不能添加项目。 {站点自填的 reason}」/「现在还加不了项目。我们很看重友好的社区氛围。
请先在「账户设置」里上传一张头像，之后就能添加项目了。」/「哦不！你正在进行中的项目已经到上限…
你当前的上限是 3 个项目。」；POST 四条全部中文（含无原因那条）。
截图 `.tmp/recon/shots/36-upload-gate-noavatar.png`。

### 11.8 第七期遗留：第三步三个形态 + `#/upload` 越档

**第三步**（桩素材 = `.tmp/upload-test/step3-outer.html`，上一轮从真站抓到的**真实**碎片；
它本身就是"降噪"那一支：隐藏的 animation radio + 隐藏的 `split_tiles_number` 输入 + 降噪说明）：

| 形态 | 怎么造 | 结果 |
|---|---|---|
| 降噪（真碎片原样） | — | ✓ 切块显示「整帧」+ 悬停解释（`up3x.splitFixedTip`），降噪两句中文 |
| EXR 清单 | 把降噪那句换成 `HTML.php:1209-1216` 的 EXR 清单 | ✓ 5 条全中文、各自成行 |
| 多 `.blend` 存档 | 复制一份 blend 块并把 `_0` 改成 `_1` | ✓ 两张卡片 + `up3x.multi` 提示 |
| 指纹过期 | 塞一个脚本没画过的控件（`addproject_brandnew_option_0`） | ✓ `up3x.unknown` 提示条并点名该元素 |

**EXR 那一支逼出一个真缺陷**：解析器的「相邻碎片合成一行」把
`EXR output detected` 与 `Limitation on EXR  support:` 并成了一句 →
两边各自的 pattern 都匹配不上 → 整段留在英文。修法：**词典里有整句译文的碎片不许并**
（`src/62-chain.js` 的 `notesOf()`；英文档 `siteText` 返回 null，合并行为照旧）。
复验见 `.tmp/recon/step3-stub-results-after.txt`。

**`#/upload` 越档**（用户实报的形态）：`boot()` 读 hash 与 `hashchange` 两处都只看
`ROUTES[v]`、**不看上传页的重开开关**，所以 off/raw 档手打 `#/upload` 照样画新版上传页。
改成：`#/upload` 只在 `uploadMode === 'new'` 时可达；另两档留在原视图并把地址改回
`ROUTES[state.view]`（`src/80-app.js`）。真机三档复测（每次重载、单实例 `spCount=1`）：
`new` → upload ✓；`raw`/`off` → 停在总览、无 `wrap.up`、地址回到 `#/overview` ✓。

### 11.9 在线机器「一行一台」+ 两种暂停同时成立（用户 2026-10-07 追加）

用户两句话：「在线机器，感觉还是差点意思。你看看能不能一行搞定，就不要挤到两行」；
「有客户端侧暂停，有服务端侧暂停，这两个也可以同时存在」。

**上游事实**（这次的判据不再靠猜）：`templates/session/running.html.twig:296-314` 把两种暂停写成
**两个独立的 `{% if %}`、各一行 `<tr>`**（`session.paused()` = 客户端侧、`session.running() == false`
= 服务端侧），所以**两个可以同时成立**，而且站点行序是客户端行在前。会话页那张表里
**没有 `<th>` 的行只有这两行**（逐行核对过 twig），所以可以安全地把它们拼起来。

**查出来的两个真缺陷**：

1. 解析器 `20-api.js` 的 `parseSession` 对 note 是**直接赋值** → 第二种暂停那行把第一种顶掉，
   两端都暂停时客户端那条**凭空消失**。改成拼接（`A · B`）。
2. `machineDetail` 与会话页身份条都是**三目二选一**，只能表达"其中一种"。改成
   `40-ui.js` 的共享判据 `pauseKeys(note)` → 返回 0/1/2 个词条键，两处各自渲染
   （会话页一档一个 chip；在线机器那行是紧凑数据行，拼成 `A · B`）。

**一行一台**：`.machine` 从「列方向两层盒子（标题行 + 明细行）」改成**一条 flex 行**：
身份（标签 + 规格）/ 状态与时间 / 产出 / 查看会话；规格是唯一可伸缩段（先省略号化），
「查看会话」移到整行最后；≤900px 才折行（那时身份独占第一行）。

**真机 A/B**（桩数据 = 真会话页 + 站点形状的"2 connected machines"块；同页面同数据，
只换 `dist`：`b3a7b9b` 的产物 vs 现在）：

| | 行高 | 子元素顶差 | 一行/两行 |
|---|---|---|---|
| 改前 | **78 / 77px** | 31px | 两行 |
| 改后 | **46 / 45px** | 2px | **一行** |

宽度档（emulate 视口）：≥1000px 一行；900/860/760 折成两行（设计如此，无内容溢出）；
620 折三行（窄屏）。暂停组合：`none` → 「运行中」、`server` → 「服务器端已暂停」、
`both` → 「客户端已暂停 · 服务器端已暂停」；会话页身份条 `both` → **两个 chip 并排**
（`.tmp/recon/shots/37-session-both-pauses.png`）。
离线探针加了「两种暂停同时成立 → 两个词都画出来」一条，70 项全过。

⚠ 本机浏览器这台 `bsk window resize` 改不动视口（`outerWidth` 报 160、`innerWidth` 卡在旧值），
窄档改用 `bsk emulate --width`（CDP 设备度量覆盖）验的；另外 `bsk emulate --off` 会挂住，
重设宽度即可。总览那两张现场截图因截图 RPC 30s 超时没拿到，**行高/顶差是量出来的，不是看出来的**。

### 11.10 工具与验收环境（都在 `.tmp/recon/`，不进产物）

- `probe-sort.mjs`：离线探针，69 项断言（排序 / 显隐 / 调序 / 机器详情 / 登录入口 / 暂停 / 时区解析）。
- `check-ui-dict.mjs`：中英词条配对。修掉一个**行首锚定**的 bug（一行里第 2 个之后的键全被漏统计，
  "配对通过"是假的）。真实数字 **zh 504 / en 492**，差异**只有 12 条设计上中文独有的 `why.*`**
  （站点原因的原文措辞）。
- 指标带：`kpi-probe.js` / `kpi-tiers.js`；折线：`farm-probe.js`。
- 上传页闸门：`inject-upload.js`（DOM 手术造闸门页面 + `fetch`/`XHR` 桩）、`run-upload-matrix.ps1`。
- 第三步：`inject-step3.js`（从真碎片变出 EXR / 多块 / 未知控件三种形态）、`run-step3-matrix.ps1`。
- `inject-dist.js`：免重装的装法（`fetch` 局域网上的产物 → 删 `#sp` 等 → `(0,eval)(code)`）。
  **注意**：装着的那版旧实例还活着，会响应 `hashchange` 自己重画 —— 单实例复验必须先让它
  `uiMode=classic` 载入退场（`run-clean-recheck.ps1` 就是这个配方）。
- `LAN-RECIPE.md`：换机器调试的整套配方（第二台机 `magic@192.168.3.172`，**没有 node**；浏览器连回本机
  `wss://192.168.3.103:52800`；本机没有 ssh，用 Git 自带的 `ssh.exe` + `~/.ssh/bsk_lan_ed25519`）。
  本轮中途那台 Linux 机器的浏览器从通道掉线，干净复验改在本机浏览器（`162038a8`）上做。

### 11.11 还欠的

- **未提交、未发布**：0.2.2 仍压着没发，`.tmp/critique/changelog.md` 还是 0.2.1 的内容（发版前必须先重写）。
- 产物 **468,004 字节**、SHA-256 前 32 位 `C7C346482059360B74FCA4BD96CB8AB6`，
  超体积提示线 440,000 共 28,004 字节 —— `build.mjs` 只警告不拦；用户此前明确表态"接受，功能值这个字节"。
- 在线机器那块只量到 620px：**总览两张现场截图没拿到**（这台浏览器截图 RPC 30s 超时），
  窄档是 `bsk emulate` 量的，不是"看过的"；装机后请顺手扫一眼。
- **本轮验过的都是桩**：上传页闸门（维护/无头像/并发）+ 第三步 EXR/多块/未知 四条在真站上无法触发，
  只能对着上游原文造桩；站点真开维护或真换版时，应当重新跑一遍 `run-upload-matrix.ps1` /
  `run-step3-matrix.ps1`（桩素材与判定都在脚本里）。
- 仍未验：防闪守卫的 race、0.1.11 → 0.2.0 这一跳的装机实测（见 `docs/PUBLISHING.md`「七」）。


