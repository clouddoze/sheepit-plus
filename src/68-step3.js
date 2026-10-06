/* ==== 68-step3.js：新版上传 · 第三步「设置」（自绘，0.2.0）========================

   与前身 60-step3.js 的根本区别：**不再搬站点的活节点**。
   服务端那份 HTML 只在 62-chain.js 里被 DOMParser 解析成数据，页面上从头到尾只有我们
   这一套 DOM、这一套 id，提交也是我们自己发（POST /project/add_internal，27 键）。
   于是 0.1.14–0.1.17 反复踩的那一类缺陷（两份同名控件、站点 JS 抢 DOM、$('#id') 取到
   隐藏原件）在结构上不可能出现。

   边界没变：**服务端只认 POST 键，不认 DOM**。所以自绘控件不违反任何契约；
   所有隐藏值（引擎、分辨率、采样、路径…）原样来自解析结果，一个字节都不改。

   版式（用户 2026-10-07 提的三条：要概览、别框套框、字号跟其他页一致）：
     · 概览 = 站点算出来的事实，摆成一行 chips（存档 / 文件数 / 上游版本），每个文件
       自己那一行（引擎 / 分辨率 / 帧率 / 采样 / 格式 / 降噪…）
     · 真需要"一组"的只有项目级设置（可见性 + 计算方式）= **一个**块，里面两行，行间发丝线
     · 每个 .blend 一块，块之间只隔一条发丝线 + 文件名标题，不再套第二个框
     · 字号一律走站内那套：标题 13.5 / 正文 13 / 次要 12.5 / 提示 12 */

(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.Step3x) return;
  const { Util, UI, I18n } = SP;
  const t = SP.t;
  const esc = Util.esc;

  const REPORT_KEY = 'up3Report';
  const mk = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };

  /* 同名 radio 在同一个文档里算**一组**，会互相取消勾选：每次 render 用自己的后缀。 */
  let seq = 0;

  /** 站点原文 → 中文（没命中就原样）。说明文字是站点写的，翻译表在 12-lang-zh.js。 */
  const zh = (s) => (I18n && I18n.siteText ? (I18n.siteText(s) || s) : s);

  function saveReport(rep) { try { Util.store.set(REPORT_KEY, rep); } catch (e) { /* 隐私模式 */ } }
  function report() {
    const r = Util.store.get(REPORT_KEY, null);
    return r && typeof r === 'object' ? r : null;
  }

  /** 数字好看一点：服务端 width 是 resolution_x * percentage / 100，可能是 160.0000001 */
  const num = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || String(v).trim() === '') return String(v);
    return String(Math.round(n * 100) / 100);
  };

  /* ------------------------------------------------------------------ 小组件 */

  /** 概览行（站内 .meta 的写法：竖线分隔的 chips） */
  function metaRow(bits) {
    const m = mk('div', 'meta up3-meta');
    bits.forEach((html) => {
      const s = mk('span');
      s.innerHTML = html;
      m.appendChild(s);
    });
    return m;
  }

  /** 设置块里的一行：左边固定宽度的名字，右边内容 */
  function line(k, content) {
    const l = mk('div', 'up3-line');
    const a = mk('div', 'up3-k');
    a.textContent = k;
    const b = mk('div', 'up3-c');
    if (typeof content === 'string') b.innerHTML = content; else b.appendChild(content);
    l.appendChild(a);
    l.appendChild(b);
    return l;
  }

  /** 选项行：<label class="up3-opt"><input …><span>文字</span></label>，title 走原生悬停 */
  function opt(kind, name, value, label, opts) {
    const o = opts || {};
    const lb = mk('label', 'up3-opt' + (o.cls ? ' ' + o.cls : ''));
    const inp = mk('input');
    inp.type = kind;
    if (name) inp.name = name;
    if (value != null) inp.value = value;
    inp.checked = !!o.checked;
    if (o.disabled) inp.disabled = true;
    if (o.title) lb.title = o.title;
    lb.appendChild(inp);
    const sp = mk('span');
    sp.textContent = label;
    lb.appendChild(sp);
    return lb;
  }

  function tip(text) {
    const d = mk('div', 'up3-tip');
    d.textContent = text;
    return d;
  }

  function fld(label, opts) {
    const o = opts || {};
    const box = mk('div', 'up3-fld');
    const lb = mk('label');
    lb.textContent = label;
    if (o.title) lb.title = o.title;
    const inp = mk('input');
    inp.type = 'text';
    inp.value = o.value == null ? '' : String(o.value);
    inp.inputMode = 'numeric';
    inp.autocomplete = 'off';
    if (o.size) inp.size = o.size;
    if (o.placeholder) inp.placeholder = o.placeholder;
    box.appendChild(lb);
    box.appendChild(inp);
    box._input = inp;
    return box;
  }

  /** 滑条 + 读数：站点那两个 range 的 value="0" 会被浏览器夹到 min，这里直接给 min。 */
  function slider(label, min, max, value) {
    const box = mk('div', 'up3-slider');
    const lb = mk('label');
    lb.textContent = label;
    const inp = mk('input');
    inp.type = 'range';
    inp.min = String(min);
    inp.max = String(max);
    inp.value = String(value);
    const out = mk('span', 'up3-read');
    const paint = () => { out.textContent = t('up3x.nTiles', { n: inp.value }); };
    inp.addEventListener('input', paint);
    paint();
    box.appendChild(lb);
    box.appendChild(inp);
    box.appendChild(out);
    box._input = inp;
    return box;
  }

  /** 站点给这个文件算出来的事实（只显示，不改；提交时也原样发回去） */
  function blendFacts(b) {
    const h = b.hidden || {};
    const out = [];
    if (h.engine) out.push(t('up3x.mEngine', { v: h.engine }));
    if (h.exe) out.push(t('up3x.mBlender', { v: h.exe }));
    if (h.width && h.height) out.push(t('up3x.mRes', { w: num(h.width), h: num(h.height) }));
    if (h.framerate) out.push(t('up3x.mFps', { v: num(h.framerate) }));
    if (h.cycles_samples) out.push(t('up3x.mSamples', { v: num(h.cycles_samples) }));
    if (h.samples_pixel) out.push(t('up3x.mPerPixel', { v: h.samples_pixel }));
    if (h.image_extension) out.push(h.image_extension);
    if (h.denoising === '1') out.push(t('up3x.mDenoise'));
    if (h.use_adaptive_sampling === '1') out.push(t('up3x.mAdaptive'));
    if (h.render_on_gpu_headless === '1') out.push(t('up3x.mHeadless'));
    if (h.color_management === '1') out.push(t('up3x.mColorMgmt'));
    if (h.output_path) out.push(t('up3x.mOutput', { v: h.output_path }));
    return out;
  }

  /* ------------------------------------------------------------------ 渲染 */

  /**
   * @param box   #sp-an-result（我们自己的容器，class 已带 sp-up3）
   * @param model 62-chain.js parseStep3() 的结果
   * @returns {{ok:boolean, reason?:string}}
   */
  function render(box, model) {
    if (!box || !model) return { ok: false, reason: 'args' };
    box.textContent = '';
    box.hidden = false;
    box.classList.remove('sp-siteform');
    box.classList.add('sp-up3');

    const uid = 'sp3-' + (++seq);
    const root = mk('div', 'up3');
    const state = { vis: {}, compute: 0, blends: {} };
    const msg = mk('div', 'up3-msg');
    msg.hidden = true;
    const say = (text, bad) => {
      msg.textContent = text;
      msg.hidden = !text;
      msg.classList.toggle('bad', !!bad);
    };

    /* ① 抬头 + 概览（站点算出来的事实，一行 chips） */
    const head = mk('div', 'up3-head');
    const h4 = mk('h4');
    h4.textContent = t('up3x.title');
    head.appendChild(h4);
    head.appendChild(tip(t('up3x.sub')));
    root.appendChild(head);

    const archive = (model.blends.filter((b) => b.hidden && b.hidden.archive)[0] || { hidden: {} }).hidden.archive;
    const bits = [];
    if (archive) bits.push(`${esc(t('up3x.mArchive'))} <b>${esc(archive)}</b>`);
    bits.push(`${esc(t('up3x.mFiles'))} <b>${model.blends.length}</b>`);
    if (model.upstream) bits.push(`${esc(t('up3x.mUpstream'))} <b>${esc(model.upstream)}</b>`);
    root.appendChild(metaRow(bits));

    /* ② 项目级设置：一个块两行（可见性 + 计算方式）—— 这里才需要"一组" */
    const group = mk('div', 'up3-group');

    const visBox = mk('div', 'up3-opts');
    let visAny = false;
    const visTips = [];
    [['render', model.vis.render, 'up3x.render', 'up3x.renderTip'],
      ['mp4', model.vis.mp4, 'up3x.mp4', 'up3x.mp4Tip'],
      ['thumb', model.vis.thumb, 'up3x.thumb', 'up3x.thumbTip']].forEach(([key, def, lbl, tipKey]) => {
      if (def.kind === 'none') return;
      visAny = true;
      const hidden = def.kind === 'hidden';
      const o = opt('checkbox', null, null, t(lbl), {
        checked: hidden ? !!def.force : !!def.on, disabled: hidden, title: t(tipKey),
      });
      state.vis[key] = hidden ? false : !!def.on;   // 站点对 hidden 一律发 "0"（.is(':checked') 为假）
      const inp = o.querySelector('input');
      inp.addEventListener('change', () => { state.vis[key] = inp.checked; });
      visBox.appendChild(o);
      /* 站点替用户定了的开关：单独一行说清楚（塞在选项同一行会挤成一句读不懂的话） */
      if (hidden) visTips.push(t('up3x.forced', { state: def.force ? t('up3x.yes') : t('up3x.no') }));
    });
    visTips.forEach((s) => {
      const d = tip(s);
      d.classList.add('up3-tiprow');
      visBox.appendChild(d);
    });
    if (visAny) group.appendChild(line(t('up3.vis'), visBox));

    const compute = model.compute;
    if (compute.cpuOn) state.compute |= 1;
    if (compute.gpuOn) state.compute |= 8;
    if (!state.compute) state.compute = compute.canCpu ? 1 : (compute.canGpu ? 8 : 0);
    const cpuBox = mk('div', 'up3-cmps');
    const addCompute = (bit, can, lbl, hint) => {
      if (!can) return;
      const o = opt('radio', uid + '-compute', String(bit), t(lbl), { checked: !!(state.compute & bit), cls: 'up3-cmp' });
      const el = o.querySelector('input');
      el.addEventListener('change', () => { if (el.checked) state.compute = bit; });
      const wrap = mk('div', 'up3-cmpbox');
      wrap.appendChild(o);
      const parts = [];
      if (hint && hint.queue) parts.push(t('up3x.queue', { v: hint.queue }));
      if (hint && hint.total) parts.push(t('up3x.total', { n: hint.total }));
      if (parts.length) {
        const h = mk('div', 'up3-tip');
        h.textContent = parts.join(' · ');
        wrap.appendChild(h);
      }
      cpuBox.appendChild(wrap);
    };
    addCompute(1, compute.canCpu, 'up3x.cpu', compute.cpuHint);
    addCompute(8, compute.canGpu, 'up3x.gpu', compute.gpuHint);
    if (cpuBox.childNodes.length) group.appendChild(line(t('up3.cpu'), cpuBox));

    root.appendChild(group);

    /* ③ 每个 .blend 一块：文件名 + 它自己的事实 + 能改的那几项 + 提交 */
    let parsedKeys = 0;
    const cards = [];
    model.blends.forEach((b) => {
      parsedKeys += Object.keys(b.hidden).length + (b.rejected ? 0 : 3);
      const bl = mk('div', 'up3-blend');
      bl.dataset.i = b.i;
      const bh = mk('div', 'up3-bhead');
      const name = mk('h4');
      name.textContent = b.name || ('#' + b.i);
      bh.appendChild(name);
      const facts = b.rejected ? [] : blendFacts(b);
      if (facts.length) {
        const fm = mk('div', 'up3-bmeta');
        fm.textContent = facts.join(' · ');
        bh.appendChild(fm);
      }
      bl.appendChild(bh);

      if (b.rejected) {
        /* 站点对"缺相机 / 有活动输出节点 / 分析报错"的文件只给理由、不给表单（HTML.php:1162-1182） */
        state.blends[b.i] = { rejected: true };
        const bad = mk('div', 'up3-notes up3-bad');
        bad.textContent = zh(b.reason) || t('up3x.rejectedBlend');
        bl.appendChild(bad);
        root.appendChild(bl);
        cards.push({ b, card: bl, body: bl, submit: null });
        return;
      }

      state.blends[b.i] = {
        type: b.type, start: b.anim.start, end: b.anim.end, step: b.anim.step || '1',
        frame: b.single.frame, ram: b.ram,
        splitTiles: b.split.tiles,
        splitSamples: (b.split.kind === 'samples' || b.split.kind === 'samples-single') ? String(b.split.value) : '',
      };

      /* 类型：站点只在"非 EXR 且无降噪"时给可见的两个 radio（HTML.php:1259-1267）；
         EXR/降噪分支连 radio 都是 hidden 的（:1205），那就没有可选项。 */
      if (!b.typeForced) {
        const opts = mk('div', 'up3-opts');
        const anim = opt('radio', uid + '-type-' + b.i, 'animation', t('up3x.anim'), { checked: b.type !== 'singleframe' });
        const sing = opt('radio', uid + '-type-' + b.i, 'singleframe', t('up3x.single'), { checked: b.type === 'singleframe' });
        opts.appendChild(anim);
        opts.appendChild(sing);
        bl.appendChild(line(t('up3x.type'), opts));

        const fields = mk('div', 'up3-fields');
        const animRow = mk('div', 'up3-fields');
        const singRow = mk('div', 'up3-fields');
        [['start', 'up3x.start', 6], ['end', 'up3x.end', 6], ['step', 'up3x.step', 3]].forEach(([k, lbl, size]) => {
          const f = fld(t(lbl), { value: state.blends[b.i][k], size });
          f._input.addEventListener('input', (e) => { state.blends[b.i][k] = e.target.value; });
          animRow.appendChild(f);
        });
        const sf = fld(t('up3x.frame'), { value: state.blends[b.i].frame, size: 6 });
        sf._input.addEventListener('input', (e) => { state.blends[b.i].frame = e.target.value; });
        singRow.appendChild(sf);
        animRow.hidden = b.type === 'singleframe';
        singRow.hidden = b.type !== 'singleframe';
        fields.appendChild(animRow);
        fields.appendChild(singRow);
        const sync = () => {
          const v = anim.querySelector('input').checked ? 'animation' : 'singleframe';
          state.blends[b.i].type = v;
          animRow.hidden = v !== 'animation';
          singRow.hidden = v !== 'singleframe';
        };
        anim.querySelector('input').addEventListener('change', sync);
        sing.querySelector('input').addEventListener('change', sync);
        bl.appendChild(line(t('up3x.frames'), fields));
      } else {
        const animRow = mk('div', 'up3-fields');
        [['start', 'up3x.start', 6], ['end', 'up3x.end', 6], ['step', 'up3x.step', 3]].forEach(([k, lbl, size]) => {
          const f = fld(t(lbl), { value: state.blends[b.i][k], size });
          f._input.addEventListener('input', (e) => { state.blends[b.i][k] = e.target.value; });
          animRow.appendChild(f);
        });
        bl.appendChild(line(t('up3x.frames'), animRow));
      }

      /* 切块：三形态（samples 滑条 / tiles 下拉 / 站点定死） */
      const splitBox = mk('div', 'up3-split');
      if (b.split.kind === 'samples' || b.split.kind === 'samples-single') {
        const s = slider(t('up3x.splitEach'), b.split.min, b.split.max, b.split.value);
        s._input.addEventListener('input', (e) => { state.blends[b.i].splitSamples = e.target.value; });
        splitBox.appendChild(s);
      } else if (b.split.kind === 'tiles') {
        const sel = mk('select');
        b.split.options.forEach((o) => {
          const op = mk('option');
          op.value = o.v;
          op.textContent = o.v === '1' ? t('up3x.fullFrame') : o.label;
          if (o.v === String(b.split.tiles)) op.selected = true;
          sel.appendChild(op);
        });
        sel.addEventListener('change', () => { state.blends[b.i].splitTiles = sel.value; });
        splitBox.appendChild(sel);
      } else {
        splitBox.appendChild(tip(t('up3x.splitFixed')));
      }
      bl.appendChild(line(t('up3x.split'), splitBox));

      /* 站点写的说明（EXR 限制、降噪、缺文件、驱动警告…）：小字，不装箱 */
      if (b.notes && b.notes.length) {
        const notes = mk('div', 'up3-notes');
        b.notes.forEach((s) => {
          const d = mk('div');
          d.textContent = zh(s);
          notes.appendChild(d);
        });
        bl.appendChild(notes);
      }

      /* 底部：高级选项（内存）在左、提交在右 —— 同一行，省掉一层框 */
      const foot = mk('div', 'up3-bfoot');
      if (b.advanced) {
        const adv = mk('div', 'up3-adv');
        const ck = opt('checkbox', null, null, t('up3.adv'), { cls: 'up3-opt-adv' });
        const inp = ck.querySelector('input');
        const ramWrap = mk('div', 'up3-fld up3-ram');
        ramWrap.hidden = true;
        const rl = mk('label');
        rl.textContent = t('up3x.ram');
        rl.title = t('up3x.ramTip');
        const ri = mk('input');
        ri.type = 'text';
        ri.inputMode = 'numeric';
        ri.placeholder = t('up3x.ramPh');
        ri.value = b.ram || '';
        ri.addEventListener('input', (e) => { state.blends[b.i].ram = e.target.value; });
        ramWrap.appendChild(rl);
        ramWrap.appendChild(ri);
        inp.addEventListener('change', () => { ramWrap.hidden = !inp.checked; });
        adv.appendChild(ck);
        adv.appendChild(ramWrap);
        foot.appendChild(adv);
      }
      const btn = mk('button', 'btn up3-submit');
      btn.type = 'button';
      btn.textContent = t('up3x.submit');
      foot.appendChild(btn);
      bl.appendChild(foot);

      const slot = mk('div', 'up3-slot');
      slot.hidden = true;
      bl.appendChild(slot);

      btn.addEventListener('click', () => doSubmit(b, bl, slot, btn, msg, say, state, model));
      root.appendChild(bl);
      cards.push({ b, card: bl, body: bl, submit: btn, slot });
    });

    /* 多文件：站点的分析编号是**一次性**的（ProjectController.php:427 成功后删除），
       所以第二份提交必然拿到 "failed to found data"。这是我们唯一能提前告诉用户的事。 */
    if (model.blends.filter((x) => !x.rejected).length > 1) {
      const warn = mk('div', 'up3-notes up3-warn');
      warn.textContent = t('up3x.multi');
      root.appendChild(warn);
    }

    root.appendChild(msg);
    box.appendChild(root);

    saveReport({
      at: Date.now(), stage: 'enter', ok: true, n: parsedKeys, missing: [],
      upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
    });
    /* state 一并交出去：离线验收要用它组提交体跟站点的 doAddProject 逐键比对 */
    return { ok: true, cards: cards.length, state, model };
  }

  /* ------------------------------------------------------------------ 提交 */

  async function doSubmit(b, card, slot, btn, msg, say, state, model) {
    slot.hidden = true;
    slot.textContent = '';
    slot.classList.remove('up3-bad');

    const ui = { vis: state.vis, compute: state.compute, blends: state.blends };
    const errs = SP.Chain.validate(model, ui);
    if (errs.length) {
      slot.hidden = false;
      slot.classList.add('up3-bad');
      slot.textContent = errs.join('；');
      return;
    }
    const list = SP.Chain.buildPayload(model, ui).filter((p) => p.i === b.i);
    if (!list.length) { slot.hidden = false; slot.textContent = t('up3x.rejectedBlend'); return; }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = t('up3x.sending');
    try {
      const r = await SP.Chain.submit(list[0].data);
      if (r.ok) {
        saveReport({
          at: Date.now(), stage: 'submit', ok: true, n: Object.keys(list[0].data).length, missing: [],
          upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
        });
        btn.textContent = t('up3x.done');
        location.href = r.url;
        return;
      }
      saveReport({
        at: Date.now(), stage: 'submit', ok: false, n: Object.keys(list[0].data).length, missing: [],
        upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
      });
      slot.hidden = false;
      slot.classList.add('up3-bad');
      /* 服务端的错误体是 HTML 片段（含 <strong>/<ul>），我们只取文字、不注入它 */
      slot.textContent = r.message || t('up3x.rejected');
    } catch (e) {
      slot.hidden = false;
      slot.classList.add('up3-bad');
      slot.textContent = t('up3x.netFail') + ' ' + ((e && e.message) || e);
    }
    btn.disabled = false;
    btn.textContent = old;
  }

  /** 设置面板里的上游指纹行（与 60-step3.js 同格式，0.2.0 起报告来自解析层）。 */
  function fpRows() {
    const now = SP.Chain.upstreamVersion();
    const known = SP.Chain.UPSTREAM;
    const rep = report();
    const when = rep && rep.at ? new Date(rep.at).toLocaleString() : '';
    const tipLines = [];
    if (now) tipLines.push(t('set.fp.now', { v: now }), t('set.fp.same', { v: now }));
    if (rep && rep.at) {
      tipLines.push(rep.stage === 'submit' ? t('set.fp.ok', { time: when, n: rep.n }) : t('set.fp.enter', { time: when, n: rep.n }));
    } else tipLines.push(t('set.fp.never'));
    const tipAttr = esc(tipLines.join('\n'));

    let line;
    if (!now) line = `<div class="hint bad">${esc(t('set.fp.unknown'))}</div>`;
    else if (now !== known) line = `<div class="hint bad">${esc(t('set.fp.diff', { now, known }))}</div>`;
    else if (rep && rep.at) line = `<div class="hint" title="${tipAttr}">${esc(t('set.fp.one', { v: now, n: rep.n }))}</div>`;
    else line = `<div class="hint" title="${tipAttr}">${esc(t('set.fp.oneNew', { v: now }))}</div>`;

    return `<div class="fp">
        <div class="lbl2">${esc(t('set.fp.title'))}</div>
        ${line}
      </div>`;
  }

  SP.Step3x = { render, report, fpRows, version: '0.2.0-rewrite' };
})();
