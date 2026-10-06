/* ==== 62-chain.js：上传链路的**数据层**（0.2.0）====================================

   契约来自站点源码，不是猜的：上游 GitLab `sheepitrenderfarm/www`，master 9b13032c
   （= 线上资源路径 /media/9b13032c/，就是 getShortVersion()）。行号对着那一版看。

   契约 A 上传（第一步）  HTML.php:2127-2152 → POST /project/internal/upload（multipart）
                          字段：addproject_archive（文件）+ UPLOAD_IDENTIFIER（32 位 hex）
                          成功 = 302 → /project/add/<token>；失败 = 200 纯文本原因 或 error 页
   契约 B 等待（第二步）  ProjectController.php:194-221 → GET /project/add_analyse/<token>
                          JSON {"status":"RETRY"|"PROCESSING",analysed,total} 或整段 HTML 碎片
   契约 C 提交（第三步）  addproject.js:1-101 / ProjectController.php:226-448 → POST /project/add_internal
                          27 键；响应以 "http" 开头 = 成功地址，否则整段是错误说明

   这一层的纪律：**服务端返回的 HTML 只经 DOMParser 走一遭，永不进活文档**。
   界面用我们自己的 id、我们自己的提交 —— 于是"两份同名控件""站点 JS 抢 DOM"那一整类缺陷
   （0.1.14–0.1.17 反复踩的）从根上不存在。 */
(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.Chain) return;
  const t = SP.t;

  /** 核对过的上游版本；站点升级后要重新核对并同时改这里与 docs/REWRITE-0.2.0.md。 */
  const UPSTREAM = '9b13032c';

  const URL_UPLOAD = '/project/internal/upload';
  const URL_SUBMIT = '/project/add_internal';
  const analyseUrl = (token) => '/project/add_analyse/' + encodeURIComponent(token);
  const step2Url = (token) => '/project/add/' + encodeURIComponent(token);

  /** 站点资源路径里的版本号：/media/<8 位十六进制>/…（脚本、样式、图片都带）。 */
  function upstreamVersion() {
    const nodes = document.querySelectorAll('script[src*="/media/"],link[href*="/media/"]');
    for (let i = 0; i < nodes.length; i++) {
      const m = /\/media\/([0-9a-f]{8})\//.exec(nodes[i].src || nodes[i].href || '');
      if (m) return m[1];
    }
    return '';
  }

  /* ------------------------------------------------------------------ 解析 */

  const str = (v) => (v == null ? '' : String(v));
  const parseDoc = (html) => new DOMParser().parseFromString(str(html), 'text/html');
  /* 同一套查找要能在 Document 和 Element 上都用（blend 的隐藏值是在卡片元素里找的） */
  const $id = (root, id) => (root.getElementById ? root.getElementById(id) : root.querySelector('[id="' + id + '"]'));
  const valOf = (root, id) => { const el = $id(root, id); return el ? str(el.value) : null; };

  /** 站点的取值方式：$('#id').is(':checked')。
      hidden 的 input 永远不是 :checked —— HTML.php:1042 的 generate_mp4 与 1057 的
      public_thumbnail 就是这么发的（服务端 ProjectController.php:360 自己再兜一层）。 */
  const siteChecked = (el) => !!(el && String(el.type).toLowerCase() !== 'hidden' && el.checked);

  /** 三种开关形态：checkbox（用户可改）/ hidden（站点替用户定了）/ none（这一版没给）。 */
  function toggleOf(el, why) {
    if (!el) return { kind: 'none', on: false, why: why || '' };
    if (String(el.type).toLowerCase() === 'hidden') {
      return { kind: 'hidden', on: false, force: str(el.value) === '1', why: why || '' };
    }
    return { kind: 'check', on: !!el.checked, why: why || '', title: (el.parentNode && el.parentNode.querySelector('span[title]') || {}).title || '' };
  }

  /** 计算方式那一列：CPU / GPU 各带自己的"排队位次 / 项目总数"两行**裸文本**（HTML.php:1112）。 */
  function computeOf(root) {
    const cpu = $id(root, 'compute_method_cpu');
    const gpu = $id(root, 'compute_method_gpu');
    const hintOf = (el) => {
      const out = { queue: '', total: '' };
      if (!el) return out;
      const box = el.closest('div');
      if (!box) return out;
      const s = box.textContent.replace(/\s+/g, ' ');
      const q = /Est\.\s*queue position:\s*([^ ]+)/i.exec(s);
      const n = /Total projects:\s*([\d,]+)/i.exec(s);
      /* 站点给的是英文序数（"9th"）。中文模板里写「预计排队第 8th 位」是机器味，
         这里剥掉后缀，中文拿去拼「第 n 位」，英文那边退化成 "Est. queue position 9"。 */
      if (q) out.queue = q[1].replace(/(\d+)(st|nd|rd|th)\b/i, '$1');
      if (n) out.total = n[1];
      return out;
    };
    return {
      canCpu: !!cpu, canGpu: !!gpu,
      cpuOn: !!(cpu && cpu.checked), gpuOn: !!(gpu && gpu.checked),
      cpuHint: hintOf(cpu), gpuHint: hintOf(gpu),
    };
  }

  /* 我们自己渲染的控件（这些 id 的内容不进"说明文字"）：帧、切块、内存、提交、错误框、隐藏项 */
  const OWN_IDS = /^addproject_(animation_(start|end|step)_frame|singleframe_start_frame|split_tiles_number|split_(animation_)?sample_range_value|split_sample_value|animation_split_sample_value|max_ram_optional|submit|submit_div|error_box|content|exe|path|archive|engine|denoising|color_management|render_on_gpu_headless|use_adaptive_sampling|framerate|output_path|width|height|cycles_samples|samples_pixel|image_extension)|^checkbox_ad_|^checkbox_advanced_option_/;

  /** 把服务端写的**说明文字**（EXR 限制、降噪提示、切块解释、缺文件、驱动警告…）抽出来。
      不抽控件、不抽 label 的 for 目标 —— 那些我们自己画。 */
  function notesOf(scope) {
    const out = [];
    const walk = (node) => {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          const s = n.nodeValue.replace(/\s+/g, ' ').trim();
          if (s) out.push(s);
          continue;
        }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName.toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'option' || tag === 'script' || tag === 'style' || tag === 'br') continue;
        if (n.id && OWN_IDS.test(n.id)) continue;
        if (n.querySelector && n.querySelector('input,select') && !n.querySelector('ul,li,p,br')) continue;
        walk(n);
      }
    };
    walk(scope);
    /* 相邻碎片合成一行：站点的说明由 <br>/<li> 切得很碎 */
    const merged = [];
    out.forEach((s) => {
      const last = merged[merged.length - 1];
      if (last && last.length < 40 && !/[.。:：]$/.test(last)) merged[merged.length - 1] = last + ' ' + s;
      else merged.push(s);
    });
    return merged;
  }

  /* 脚本认得（会渲染或会读）的 id 清单。站点这一版多出来的元素 = 新控件：
     我们没画它、就会按站点给的默认值提交 —— 这种事必须说出来，不能沉默（用户 2026-10-07 定）。 */
  const KNOWN_IDS = [
    /^token$/, /^public_render$/, /^public_thumbnail$/, /^generate_mp4$/,
    /^compute_method_(cpu|gpu)$/,
    /^addproject_\d+$/, /^addproject_content_\d+$/,
    /^addproject_(exe|path|archive|engine|denoising|color_management|render_on_gpu_headless|use_adaptive_sampling|framerate|output_path|width|height|cycles_samples|samples_pixel|image_extension)_\d+$/,
    /^addproject_(animation_start_frame|animation_end_frame|animation_step_frame|singleframe_start_frame|max_ram_optional)_\d+$/,
    /^addproject_(split_tiles_number|split_animation_sample_range_value|animation_split_sample_value|split_sample_range_value|split_sample_value)_\d+$/,
    /^addproject_(submit|submit_div|error_box)_\d+$/,
    /^addproject_(animation_div10|animation_div11|singleframe_div20|singleframe_div21)_\d+$/,
    /^checkbox_(ad|advanced_option)_\d+$/,
  ];
  /** 站点/第三方自己塞进来的 id（与我们无关，别再报给用户） */
  const IGNORE_ID = /^(ui-|ui\.|sp-|google|g-recaptcha|__)/;

  function unknownIds(root) {
    const out = [];
    [].slice.call(root.querySelectorAll('[id]')).forEach((el) => {
      const id = el.id;
      if (!id || IGNORE_ID.test(id)) return;
      if (KNOWN_IDS.some((re) => re.test(id))) return;
      if (out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  /** 解析第三步碎片（契约 B 的 HTML 响应）。返回 null = 结构不认识 → 调用方降级。 */
  function parseStep3(html) {
    const d = parseDoc(html);
    const token = valOf(d, 'token');
    const pub = $id(d, 'public_render');
    const conts = [].slice.call(d.querySelectorAll('[id^="addproject_content_"]'));
    if (!token || !pub || !conts.length) return null;

    const blends = conts.map((c) => blendOf(c)).filter(Boolean);
    if (!blends.length) return null;

    return {
      token,
      upstream: upstreamVersion(),
      verified: UPSTREAM,
      /* 这一版多出来的元素（不在上面清单里）= 站点新加的控件，界面上要提示 */
      unknown: unknownIds(d),
      vis: {
        render: toggleOf(pub),
        mp4: toggleOf($id(d, 'generate_mp4'), 'mp4Hidden'),
        thumb: toggleOf($id(d, 'public_thumbnail'), 'thumbHidden'),
      },
      compute: computeOf(d),
      blends,
    };
  }

  const ANIM = /^addproject_animation_(start|end|step)_frame_(\d+)$/;
  const SINGLE = /^addproject_singleframe_start_frame_(\d+)$/;
  const RANGE_ANIM = /^addproject_split_animation_sample_range_value_(\d+)$/;
  const RANGE_SINGLE = /^addproject_split_sample_range_value_(\d+)$/;

  function blendOf(cont) {
    const m = /^addproject_content_(\d+)$/.exec(cont.id || '');
    if (!m) return null;
    const i = m[1];
    const form = cont.querySelector('form[id="addproject_' + i + '"]');
    const h4 = cont.querySelector('h4');
    const err = cont.querySelector('[id="addproject_error_box_' + i + '"]');
    const rej = cont.querySelector('div.error');
    const hidden = {};
    const readHidden = (key) => str(valOf(cont, 'addproject_' + key + '_' + i));
    ['exe', 'path', 'archive', 'engine', 'denoising', 'color_management', 'render_on_gpu_headless',
      'use_adaptive_sampling', 'framerate', 'output_path', 'width', 'height', 'cycles_samples',
      'samples_pixel', 'image_extension'].forEach((k) => { hidden[k] = readHidden(k); });

    const base = {
      i,
      name: h4 ? h4.textContent.trim() : (hidden.path || ('#' + i)),
      hidden,
      rejected: !form,
      reason: rej ? rej.textContent.replace(/\s+/g, ' ').trim() : '',
    };
    if (!form) return base;

    /* 类型：三形态 —— ①强制动画（EXR/降噪分支只有个 visibility:hidden 的 radio）
       ②可选（非 EXR 非降噪时给 Single frame / Animation 两个可见 radio） */
    const typeRadios = [].slice.call(form.querySelectorAll('input[name="addproject_change_type_' + i + '"]'));
    const forced = typeRadios.length === 1;
    const checkedType = (typeRadios.filter((r) => r.checked)[0] || typeRadios[0] || {}).value || 'animation';

    const num = (el) => (el ? el.value : '');
    const anim = {};
    const single = {};
    [].slice.call(form.querySelectorAll('[id]')).forEach((el) => {
      let mm;
      if ((mm = ANIM.exec(el.id))) anim[mm[1]] = el.value;
      else if ((mm = SINGLE.exec(el.id))) single.frame = el.value;
    });

    /* 切块三形态：①samples 滑条（engine=CYCLES 且不允许 tile）②tiles 下拉 ③站点定死（EXR/降噪） */
    const rangeAnim = form.querySelector('input[id^="addproject_split_animation_sample_range_value_"]');
    const rangeSingle = form.querySelector('input[id^="addproject_split_sample_range_value_"]');
    const tilesEl = form.querySelector('[id="addproject_split_tiles_number_' + i + '"]');
    let split;
    if (rangeAnim) {
      split = {
        kind: 'samples', min: Number(rangeAnim.min || 1), max: Number(rangeAnim.max || 64),
        value: Number(rangeAnim.value) || Number(rangeAnim.min || 1), tiles: -1,
      };
    } else if (tilesEl && tilesEl.tagName.toLowerCase() === 'select') {
      split = {
        kind: 'tiles', tiles: str(tilesEl.value),
        options: [].slice.call(tilesEl.options).map((o) => ({ v: str(o.value), label: o.textContent.trim() })),
      };
    } else if (rangeSingle) {
      split = {
        kind: 'samples-single', min: Number(rangeSingle.min || 4), max: Number(rangeSingle.max || 32),
        value: Number(rangeSingle.value) || Number(rangeSingle.min || 4), tiles: '',
      };
    } else {
      /* 没有可见控件：站点把 tiles 定死了（EXR/降噪分支是 1 = 整帧；单帧+降噪同理） */
      split = { kind: 'fixed', tiles: tilesEl ? str(tilesEl.value) : '' };
    }

    const advChk = form.querySelector('[id="checkbox_ad_' + i + '"]');
    const advBox = form.querySelector('[id="checkbox_advanced_option_' + i + '"]');
    const ram = form.querySelector('[id="addproject_max_ram_optional_' + i + '"]');

    return Object.assign(base, {
      type: forced ? 'animation' : (checkedType === 'singleframe' ? 'singleframe' : 'animation'),
      typeForced: forced,
      anim: { start: str(anim.start), end: str(anim.end), step: str(anim.step) },
      single: { frame: str(single.frame) },
      split,
      advanced: !!advChk && !!advBox,
      ram: ram ? str(ram.value) : '',
      notes: notesOf(form),
    });
  }

  /* ------------------------------------------------------------- 组提交体 */

  /** 27 键，顺序与站点 addproject.js:57-85 一致（顺序不影响服务端，但方便逐键比对）。 */
  const SUBMIT_KEYS = [
    'type', 'compute_method', 'executable', 'engine', 'denoising', 'color_management',
    'render_on_gpu_headless', 'token', 'public_render', 'public_thumbnail', 'generate_mp4',
    'start_frame', 'end_frame', 'step_frame', 'archive', 'max_ram_optional', 'path', 'framerate',
    'output_path', 'width', 'height', 'split_tiles', 'split_samples', 'use_adaptive_sampling',
    'cycles_samples', 'samples_pixel', 'image_extension',
  ];

  const numStr = (v) => {
    const n = parseInt(str(v).trim(), 10);
    return Number.isFinite(n) ? String(n) : '';
  };

  /**
   * model（服务端给的事实）+ ui（用户改的）→ 27 键。
   * 与站点 doAddProject 的逐键对应写在括号里；**不做任何"顺手修正"**，只做站点做的事：
   *   · 单帧项目：end_frame 恒为 0、step_frame 恒为 1（addproject.js:3-4,20-21）
   *   · 没滑条时 split_samples 发空串（站点那边是 undefined，jQuery 也发 `split_samples=`）
   *   · compute_method 是位掩码：CPU=1 GPU=8（addproject.js:24-30）
   */
  function buildPayload(model, ui) {
    const vis = ui.vis || {};
    const on = (k) => (vis[k] ? '1' : '0');
    const compute = ui.compute | 0;
    const out = [];
    model.blends.forEach((b) => {
      if (b.rejected) return;
      const u = (ui.blends || {})[b.i] || {};
      const anim = u.type !== 'singleframe';
      const key = (k) => str(b.hidden[k]);
      out.push({
        i: b.i,
        data: {
          type: anim ? 'animation' : 'singleframe',
          compute_method: String(compute),
          executable: key('exe'),
          engine: key('engine'),
          denoising: key('denoising'),
          color_management: key('color_management'),
          render_on_gpu_headless: key('render_on_gpu_headless'),
          token: model.token,
          public_render: on('render'),
          public_thumbnail: on('thumb'),
          generate_mp4: on('mp4'),
          start_frame: anim ? numStr(u.start) : numStr(u.frame),
          end_frame: anim ? numStr(u.end) : '0',
          step_frame: anim ? numStr(u.step) : '1',
          archive: key('archive'),
          max_ram_optional: str(u.ram == null ? b.ram : u.ram),
          path: key('path'),
          framerate: key('framerate'),
          output_path: key('output_path'),
          width: key('width'),
          height: key('height'),
          split_tiles: anim ? str(u.splitTiles == null ? b.split.tiles : u.splitTiles)
            : str(u.splitTiles == null ? '' : u.splitTiles),
          split_samples: u.splitSamples == null ? '' : str(u.splitSamples),
          use_adaptive_sampling: key('use_adaptive_sampling'),
          cycles_samples: key('cycles_samples'),
          samples_pixel: key('samples_pixel'),
          image_extension: key('image_extension'),
        },
      });
    });
    return out;
  }

  /** 提交前的本地校验：只挡"站点会崩/会静默建错项目"的输入，其余一律等服务端回话。 */
  function validate(model, ui) {
    const errs = [];
    if (!((ui.compute | 0) & 9)) errs.push(t('up3x.needCompute'));
    model.blends.forEach((b) => {
      if (b.rejected) return;
      const u = (ui.blends || {})[b.i] || {};
      const nm = b.name || ('#' + b.i);
      const isNum = (v) => /^\d+$/.test(str(v).trim());
      if (u.type === 'singleframe') {
        if (!isNum(u.frame)) errs.push(t('up3x.badFrame', { name: nm }));
        return;
      }
      if (!isNum(u.start) || !isNum(u.end) || !isNum(u.step)) { errs.push(t('up3x.badFrame', { name: nm })); return; }
      if (Number(u.end) < Number(u.start)) errs.push(t('up3x.badRange', { name: nm }));
      if (Number(u.step) < 1) errs.push(t('up3x.badStep', { name: nm }));
      if (u.ram && !isNum(u.ram)) errs.push(t('up3x.badRam', { name: nm }));
    });
    return errs;
  }

  /* ---------------------------------------------------------------- 请求 */

  /** 契约 C：提交。成功体是 `{scheme}://{host}/project/<id>`（ProjectController.php:430）。 */
  async function submit(payload) {
    const res = await fetch(URL_SUBMIT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams(payload).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, message: t('up3x.httpFail', { code: res.status }), raw: text };
    const body = text.trim();
    if (/^https?:\/\//i.test(body)) return { ok: true, url: body };
    return { ok: false, message: messageFrom(body) || body.slice(0, 400), raw: body };
  }

  /** 服务端的错误体：`<p class="error">…` / `<p><span style="color:red">…` / 纯文本。 */
  function messageFrom(html) {
    const s = str(html);
    if (!s.trim()) return '';
    if (/^(missing parameter|Failed to add project)$/i.test(s.trim())) return s.trim();
    const d = parseDoc(s);
    const box = d.querySelector('p.error, .error, .alert');
    const src = box || d.body;
    if (!src) return '';
    const txt = (src.textContent || '').replace(/\s+/g, ' ').trim();
    return txt.length > 600 ? txt.slice(0, 600) + '…' : txt;
  }

  const JSONish = /^\s*[{[]/;

  /** 契约 B：轮询分析状态。 */
  async function analyse(token) {
    const res = await fetch(analyseUrl(token), {
      credentials: 'include', cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) return { kind: 'error', message: t('up3x.httpFail', { code: res.status }) };
    const text = await res.text();
    if (JSONish.test(text)) {
      let o = null;
      try { o = JSON.parse(text); } catch (e) { o = null; }
      if (!o) return { kind: 'error', message: t('up3x.analyseOdd') };
      if (o.status === 'RETRY') return { kind: 'retry' };
      if (o.status === 'PROCESSING') return { kind: 'processing', done: Number(o.analysed) || 0, total: Number(o.total) || 0 };
      return { kind: 'done', html: text };
    }
    /* 不是 JSON：可能是 FINISHED 的碎片，也可能是整页错误（"找不到编号"/其他）或那句
       'Internal error, please retry to upload your file' */
    if (/^\s*<(!doctype|html)/i.test(text)) {
      if (/Failed to find uploaded file/i.test(text)) return { kind: 'gone' };
      return { kind: 'error', message: messageFrom(text) || t('up3x.analyseOdd') };
    }
    if (/addproject_content_|id="token"/.test(text)) return { kind: 'done', html: text };
    return { kind: 'error', message: messageFrom(text) || t('up3x.analyseOdd') };
  }

  /** 契约 A：上传。用 XHR 是为了拿到真正的上传进度（站点靠轮询 /project/internal/progress，
      我们不需要那一趟：XMLHttpRequest.upload.onprogress 就是浏览器自己报的字节数）。

      返回 { promise, abort } 而不是裸 promise：上限 2,048 MB 意味着大量用户会在 GB 级别传，
      传错了只能关标签页等于把已传的部分全丢。abort() 后 promise 收在 {ok:false,aborted:true}，
      与"网络失败"分开，界面才能说实话。
      （界面上暂时没有取消按钮 —— 用户 2026-10-07 要求删掉；abort 能力留在这一层，
      将来要加回按钮或走快捷键都不用再动契约。） */
  function upload(file, onProgress) {
    let xhr = null;
    const promise = new Promise((resolve) => {
      const uid = (function () {
        const a = new Uint8Array(16);
        (window.crypto || window.msCrypto).getRandomValues(a);
        return [].map.call(a, (b) => ('0' + b.toString(16)).slice(-2)).join('');
      })();
      const fd = new FormData();
      fd.append('UPLOAD_IDENTIFIER', uid);
      fd.append('addproject_archive', file, file.name);
      xhr = new XMLHttpRequest();
      xhr.open('POST', URL_UPLOAD, true);
      xhr.withCredentials = true;
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
      }
      xhr.onload = () => resolve(classifyUpload(xhr));
      xhr.onerror = () => resolve({ ok: false, message: t('up3x.netFail') });
      xhr.onabort = () => resolve({ ok: false, aborted: true });
      xhr.send(fd);
    });
    return { promise, abort: () => { try { if (xhr) xhr.abort(); } catch (e) { /* 已经结束了 */ } } };
  }

  /** 上传的三种结局：跳到第二步（成功）/ 纯文本原因（addProjectCheck）/ error 页（后缀、大小…） */
  function classifyUpload(xhr) {
    const url = xhr.responseURL || '';
    const m = /\/project\/add\/([^/?#]+)/.exec(url);
    if (m) return { ok: true, token: decodeURIComponent(m[1]), url };
    if (xhr.status === 401 || xhr.status === 403) return { ok: false, message: t('state.loggedOut') };
    const text = str(xhr.responseText);
    if (xhr.status !== 200) return { ok: false, message: t('up3x.httpFail', { code: xhr.status }), raw: text };
    if (/Upload new project|add_step2/i.test(text)) {
      /* 兜底：有些路径回的是第二步整页但地址没变（理论上不会），那就当成功，让用户自己走第二步 */
      const tk = /doAnalyseUploadedProject\('([^']+)'\)/.exec(text);
      if (tk) return { ok: true, token: tk[1] };
    }
    return { ok: false, message: messageFrom(text) || t('up3x.uploadOdd'), raw: text };
  }

  /* ------------------------------------------------------------- 「原版」用 */

  /** /getstarted 那一页：上传表单在不在、站点是不是拦住了（HTML.php:2091-2108）。 */
  function uploadPage(html) {
    const d = parseDoc(html);
    const form = d.querySelector('form[action*="/project/internal/upload"]');
    const uid = form && d.querySelector('input[name="UPLOAD_IDENTIFIER"]');
    const warn = d.getElementById('addproject_warning_zero_frame');
    const note = (function () {
      const cell = form && form.querySelector('input[name="addproject_archive"]');
      const td = cell && cell.closest('td');
      return td ? td.textContent.replace(/\s+/g, ' ').trim() : '';
    })();
    const lim = limitOf(note);
    return {
      hasForm: !!form,
      warning: warn ? warn.textContent.replace(/\s+/g, ' ').trim() : '',
      note,
      /* 上限文案（"Max: 2,048 MB"）在本地就能拦住选错的文件 —— 拿在手里只用来拼提示等于白解析。
         站点不写上限时是 0 = 不判断。提示里照抄站点那个单位（"2,048 MB"），别换算成 "2.0 GB"。 */
      limitBytes: lim.bytes,
      limitText: lim.text,
      uid: uid ? str(uid.value) : '',
    };
  }

  /** "Max: 2,048 MB before ZIP compression" → { text: '2,048 MB', bytes: 2147483648 }。解析不出来返回 0/''。 */
  function limitOf(note) {
    const m = /Max:\s*([\d.,]+\s*[KMGT]?B)/i.exec(str(note));
    if (!m) return { bytes: 0, text: '' };
    const text = m[1].replace(/\s+/g, ' ');
    const n = Number((/([\d.,]+)/.exec(text) || [])[1].replace(/,/g, ''));
    const unit = ((/[KMGT]?B/i.exec(text) || [''])[0] || '').toUpperCase();
    const mult = { B: 1, KB: 1024, MB: Math.pow(1024, 2), GB: Math.pow(1024, 3), TB: Math.pow(1024, 4) }[unit];
    return { bytes: Number.isFinite(n) && mult ? Math.round(n * mult) : 0, text };
  }

  /* ------------------------------------------------------------- 估算器 */

  /** 契约 D：估算器。POST /project/estimator（ProjectController.php:925-997）——
      time = 每帧分钟数，count = 帧数，device = `cpu_<id>` 或 `gpu_<id>`（下面那个接口给的 value）。 */
  async function estimator(fields) {
    const res = await fetch('/project/estimator', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams({
        time: String(fields.time), count: String(fields.count), device: String(fields.device),
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: 'http', message: t('up3x.httpFail', { code: res.status }) };
    const plain = text.trim();
    /* 服务端认不出设备时回的就是这两句纯文本（:990 / :995） */
    if (/^failed/i.test(plain)) return { ok: false, reason: plain, message: '' };
    const d = parseDoc(text);
    const body = d.body ? d.body.textContent : text;
    const cost = (function () { const m = /([\d,.]+)\s*points/i.exec(body); return m ? m[1] : ''; })();
    const rows = [].slice.call(d.querySelectorAll('table tbody tr')).map((tr) => {
      const tds = [].slice.call(tr.children);
      return tds.map((td) => ({
        text: (td.textContent || '').replace(/\s+/g, ' ').trim(),
        good: !!td.querySelector('.label-success'),
      }));
    });
    return { ok: true, cost, rows };
  }

  /** 设备自动补全：GET /device/search?term=（DeviceController.php:45-）→ [{value:'cpu_12',label:'…'}]。
      站点遇到非法字符会回一条 value='#' 的提示，那条不是设备，过滤掉。 */
  async function deviceSearch(term) {
    const res = await fetch('/device/search?term=' + encodeURIComponent(String(term)), {
      credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    });
    if (!res.ok) return [];
    let list = null;
    try { list = await res.json(); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    return list.filter((o) => o && o.value && o.value !== '#')
      .map((o) => ({ value: String(o.value), label: String(o.label == null ? '' : o.label) }));
  }

  SP.Chain = {
    UPSTREAM, upstreamVersion,
    SUBMIT_KEYS, buildPayload, validate,
    parseStep3, uploadPage,
    submit, analyse, upload,
    estimator, deviceSearch,
    analyseUrl, step2Url, messageFrom,
  };
})();
