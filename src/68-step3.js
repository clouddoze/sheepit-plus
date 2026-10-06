/* ==== 68-step3.js：新版上传 · 第三步「设置」（自绘，0.2.0）========================

   与前身 60-step3.js 的根本区别：**不再搬站点的活节点**。
   服务端那份 HTML 只在 62-chain.js 里被 DOMParser 解析成数据，页面上从头到尾只有我们
   这一套 DOM、这一套 id，提交也是我们自己发（POST /project/add_internal，27 键）。
   于是 0.1.14–0.1.17 反复踩的那一类缺陷（两份同名控件、站点 JS 抢 DOM、$('#id') 取到
   隐藏原件）在结构上不可能出现。

   边界没变：**服务端只认 POST 键，不认 DOM**。所以自绘控件不违反任何契约；
   所有隐藏值（引擎、分辨率、采样、路径…）原样来自解析结果，一个字节都不改。 */

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

  function sec(key, title) {
    const s = mk('section', 'up3-sec');
    s.dataset.sec = key;
    const h = mk('h3');
    h.textContent = title;
    s.appendChild(h);
    s.appendChild(mk('div', 'up3-body'));
    return s;
  }
  const bodyOf = (s) => s.querySelector('.up3-body');

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
    inp.dataset.k = o.key || '';
    box.appendChild(lb);
    box.appendChild(inp);
    return box;
  }

  /** 滑条 + 读数：站点那两个 range 的 value="0" 会被浏览器夹到 min，这里直接给 min。 */
  function slider(label, min, max, value, onInput) {
    const box = mk('div', 'up3-fld up3-slider');
    const lb = mk('label');
    lb.textContent = label;
    const inp = mk('input');
    inp.type = 'range';
    inp.min = String(min);
    inp.max = String(max);
    inp.value = String(value);
    const out = mk('span', 'up3-read');
    const paint = () => { out.textContent = t('up3x.nTiles', { n: inp.value }); };
    inp.addEventListener('input', () => { paint(); if (onInput) onInput(); });
    paint();
    box.appendChild(lb);
    box.appendChild(inp);
    box.appendChild(out);
    box._input = inp;
    return box;
  }

  function noteBox(lines) {
    const box = mk('div', 'up3-note');
    lines.forEach((s) => {
      const p = mk('div');
      p.textContent = zh(s);
      box.appendChild(p);
    });
    return box;
  }

  /* ------------------------------------------------------------------ 渲染 */

  /**
   * @param box   #sp-an-result（我们自己的容器）
   * @param model 62-chain.js parseStep3() 的结果
   * @returns {{ok:boolean, reason?:string}}
   */
  function render(box, model) {
    if (!box || !model) return { ok: false, reason: 'args' };
    box.textContent = '';
    box.hidden = false;
    box.classList.remove('sp-siteform');
    box.classList.add('sp-up3');

    const root = mk('div', 'up3');
    const uid = 'sp3-' + (++seq);
    const state = { vis: {}, compute: 0, blends: {} };
    const msg = mk('div', 'up3-msg');
    msg.hidden = true;
    const say = (text, bad) => {
      msg.textContent = text;
      msg.hidden = false;
      msg.classList.toggle('bad', !!bad);
    };

    /* 头部：上游指纹 + 这一份碎片解析出来的键数（设置面板那行读同一个报告） */
    const head = mk('div', 'up3-head');
    const h4 = mk('h4');
    h4.textContent = t('up3x.title');
    const sub = mk('div', 'up3-sub');
    sub.textContent = t('up3x.sub', { n: model.blends.length, v: model.upstream || '?' });
    head.appendChild(h4);
    head.appendChild(sub);
    root.appendChild(head);

    /* ① 可见性：三个开关，语义与站点 HTML.php:1036-1071 一一对应 */
    const vis = sec('vis', t('up3.vis'));
    const vb = bodyOf(vis);
    const visDefs = [
      ['render', model.vis.render, 'up3x.render', 'up3x.renderTip'],
      ['mp4', model.vis.mp4, 'up3x.mp4', 'up3x.mp4Tip'],
      ['thumb', model.vis.thumb, 'up3x.thumb', 'up3x.thumbTip'],
    ];
    visDefs.forEach(([key, def, lbl, tip]) => {
      if (def.kind === 'none') return;
      const hidden = def.kind === 'hidden';
      const o = opt('checkbox', null, null, t(lbl), {
        checked: hidden ? !!def.force : !!def.on,
        disabled: hidden,
        title: t(tip),
      });
      state.vis[key] = hidden ? false : !!def.on;   // 站点对 hidden 一律发 "0"（.is(':checked') 为假）
      const inp = o.querySelector('input');
      inp.addEventListener('change', () => { state.vis[key] = inp.checked; });
      vb.appendChild(o);
      if (hidden) {
        const why = mk('div', 'up3-hint');
        why.textContent = t('up3x.forced', { state: def.force ? t('up3x.yes') : t('up3x.no') });
        vb.appendChild(why);
      }
    });

    /* ② 计算方式：CPU=1 / GPU=8 的位掩码（addproject.js:24-30）。
       站点给不给某一列由 blend 能力决定（HTML.php:1072-1095），我们照它给的画。 */
    const cpu = sec('cpu', t('up3.cpu'));
    const cb = bodyOf(cpu);
    const compute = model.compute;
    if (compute.cpuOn) state.compute |= 1;
    if (compute.gpuOn) state.compute |= 8;
    if (!state.compute) state.compute = compute.canCpu ? 1 : (compute.canGpu ? 8 : 0);
    const addCompute = (bit, can, lbl, hint) => {
      if (!can) return;
      const o = opt('radio', uid + '-compute', String(bit), t(lbl), { checked: !!(state.compute & bit), cls: 'up3-cmp' });
      const el = o.querySelector('input');
      el.addEventListener('change', () => { if (el.checked) state.compute = bit; });
      const wrap = mk('div', 'up3-cmpbox');
      wrap.appendChild(o);
      const h = mk('div', 'up3-hint');
      const parts = [];
      if (hint && hint.queue) parts.push(t('up3x.queue', { v: hint.queue }));
      if (hint && hint.total) parts.push(t('up3x.total', { n: hint.total }));
      if (!parts.length) return;
      h.textContent = parts.join(' · ');
      wrap.appendChild(h);
      cb.appendChild(wrap);
    };
    addCompute(1, compute.canCpu, 'up3x.cpu', compute.cpuHint);
    addCompute(8, compute.canGpu, 'up3x.gpu', compute.gpuHint);
    root.appendChild(vis);
    root.appendChild(cpu);

    /* ③ 每个 .blend 一张卡：一个文件 = 一个项目，各自提交（站点也是每份一个提交按钮） */
    let parsedKeys = 0;
    const cards = [];
    model.blends.forEach((b) => {
      parsedKeys += Object.keys(b.hidden).length + (b.rejected ? 0 : 3);
      const card = sec('blend', b.name || ('#' + b.i));
      card.classList.add('up3-card');
      card.dataset.i = b.i;
      const cbody = bodyOf(card);

      if (b.rejected) {
        /* 站点对"缺相机 / 有活动输出节点 / 分析报错"的文件只给理由、不给表单（HTML.php:1162-1182） */
        state.blends[b.i] = { rejected: true };
        const bad = mk('div', 'up3-note up3-bad');
        bad.textContent = zh(b.reason) || t('up3x.rejectedBlend');
        cbody.appendChild(bad);
        root.appendChild(card);
        cards.push({ b, card, body: cbody, submit: null });
        return;
      }

      state.blends[b.i] = {
        type: b.type, start: b.anim.start, end: b.anim.end, step: b.anim.step || '1',
        frame: b.single.frame, ram: b.ram,
        splitTiles: b.split.tiles,
        splitSamples: (b.split.kind === 'samples' || b.split.kind === 'samples-single') ? String(b.split.value) : '',
      };

      /* 类型：站点只在"非 EXR 且无降噪"时给可见的两个 radio（HTML.php:1259-1267） */
      if (!b.typeForced) {
        const row = mk('div', 'up3-opts');
        const anim = opt('radio', uid + '-type-' + b.i, 'animation', t('up3x.anim'), { checked: b.type !== 'singleframe' });
        const sing = opt('radio', uid + '-type-' + b.i, 'singleframe', t('up3x.single'), { checked: b.type === 'singleframe' });
        row.appendChild(anim);
        row.appendChild(sing);
        cbody.appendChild(row);

        const animInp = mk('div', 'up3-fields');
        ['start', 'end', 'step'].forEach((k) => {
          const def = { start: ['up3x.start', 6], end: ['up3x.end', 6], step: ['up3x.step', 3] }[k];
          const f = fld(t(def[0]), { key: k, value: state.blends[b.i][k], size: def[1] });
          f.querySelector('input').addEventListener('input', (e) => { state.blends[b.i][k] = e.target.value; });
          animInp.appendChild(f);
        });
        const singRow = mk('div', 'up3-fields');
        const f = fld(t('up3x.frame'), { key: 'frame', value: state.blends[b.i].frame, size: 6 });
        f.querySelector('input').addEventListener('input', (e) => { state.blends[b.i].frame = e.target.value; });
        singRow.appendChild(f);
        animInp.hidden = b.type === 'singleframe';
        singRow.hidden = b.type !== 'singleframe';
        const sync = () => {
          const v = anim.querySelector('input').checked ? 'animation' : 'singleframe';
          state.blends[b.i].type = v;
          animInp.hidden = v !== 'animation';
          singRow.hidden = v !== 'singleframe';
        };
        anim.querySelector('input').addEventListener('change', sync);
        sing.querySelector('input').addEventListener('change', sync);
        cbody.appendChild(animInp);
        cbody.appendChild(singRow);
      } else {
        /* 强制动画：只有帧区间（HTML.php:1204-1243 那条分支连类型 radio 都是 hidden 的） */
        const row = mk('div', 'up3-fields');
        ['start', 'end', 'step'].forEach((k) => {
          const def = { start: ['up3x.start', 6], end: ['up3x.end', 6], step: ['up3x.step', 3] }[k];
          const g = fld(t(def[0]), { key: k, value: state.blends[b.i][k], size: def[1] });
          g.querySelector('input').addEventListener('input', (e) => { state.blends[b.i][k] = e.target.value; });
          row.appendChild(g);
        });
        cbody.appendChild(row);
      }

      /* 切块：三形态（samples 滑条 / tiles 下拉 / 站点定死） */
      const splitBox = mk('div', 'up3-split');
      if (b.split.kind === 'samples') {
        const s = slider(t('up3x.splitEach'), b.split.min, b.split.max, b.split.value, null);
        s._input.addEventListener('input', (e) => { state.blends[b.i].splitSamples = e.target.value; });
        splitBox.appendChild(s);
      } else if (b.split.kind === 'tiles') {
        const row = mk('div', 'up3-fld');
        const lb = mk('label');
        lb.textContent = t('up3x.splitGrid');
        const sel = mk('select');
        b.split.options.forEach((o) => {
          const op = mk('option');
          op.value = o.v;
          op.textContent = o.v === '1' ? t('up3x.fullFrame') : o.label;
          if (o.v === String(b.split.tiles)) op.selected = true;
          sel.appendChild(op);
        });
        sel.addEventListener('change', () => { state.blends[b.i].splitTiles = sel.value; });
        row.appendChild(lb);
        row.appendChild(sel);
        splitBox.appendChild(row);
      } else if (b.split.kind === 'samples-single') {
        const s = slider(t('up3x.splitEach'), b.split.min, b.split.max, b.split.value, null);
        s._input.addEventListener('input', (e) => { state.blends[b.i].splitSamples = e.target.value; });
        splitBox.appendChild(s);
      } else {
        const fixed = mk('div', 'up3-hint');
        fixed.textContent = t('up3x.splitFixed', { tiles: String(b.split.tiles || 1) });
        splitBox.appendChild(fixed);
      }
      cbody.appendChild(splitBox);

      if (b.notes && b.notes.length) cbody.appendChild(noteBox(b.notes));

      /* 高级选项：内存（站点给的是 MB，服务端 ×1024 存 kB，ProjectController.php:348） */
      if (b.advanced) {
        const adv = mk('div', 'up3-adv');
        const on = { v: false };
        const ck = opt('checkbox', null, null, t('up3.adv'), { cls: 'up3-opt-adv' });
        const inp = ck.querySelector('input');
        const ramRow = mk('div', 'up3-fld up3-ram');
        ramRow.hidden = true;
        const lb = mk('label');
        lb.textContent = t('up3x.ram');
        lb.title = t('up3x.ramTip');
        const ramInp = mk('input');
        ramInp.type = 'text';
        ramInp.inputMode = 'numeric';
        ramInp.placeholder = t('up3x.ramPh');
        ramInp.value = b.ram || '';
        ramInp.addEventListener('input', (e) => { state.blends[b.i].ram = e.target.value; });
        ramRow.appendChild(lb);
        ramRow.appendChild(ramInp);
        inp.addEventListener('change', () => { on.v = inp.checked; ramRow.hidden = !inp.checked; });
        adv.appendChild(ck);
        adv.appendChild(ramRow);
        cbody.appendChild(adv);
      }

      /* 每张卡自己的错误槽 + 提交按钮（站点也是一个文件一个提交） */
      const slot = mk('div', 'up3-slot');
      slot.hidden = true;
      const foot = mk('div', 'up3-foot');
      const btn = mk('button', 'btn up3-submit');
      btn.type = 'button';
      btn.textContent = t('up3x.submit');
      foot.appendChild(btn);
      cbody.appendChild(slot);
      cbody.appendChild(foot);

      btn.addEventListener('click', () => doSubmit(b, card, slot, btn, msg, say, state, model));
      root.appendChild(card);
      cards.push({ b, card, body: cbody, submit: btn, slot });
    });

    /* 多文件：站点的分析编号是**一次性**的（ProjectController.php:427 成功后删除），
       所以第二份提交必然拿到 "failed to found data"。这是我们唯一能提前告诉用户的事。 */
    if (model.blends.filter((x) => !x.rejected).length > 1) {
      const warn = mk('div', 'up3-note');
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
    say('', false);
    msg.hidden = true;

    const ui = {
      vis: state.vis,
      compute: state.compute,
      blends: state.blends,
    };
    const errs = SP.Chain.validate(model, ui);
    if (errs.length) {
      slot.hidden = false;
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
        at: Date.now(), stage: 'submit', ok: false, n: Object.keys(list[0].data).length,
        missing: [], upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
      });
      slot.hidden = false;
      slot.textContent = r.message || t('up3x.rejected');
      /* 服务端的错误体是 HTML 片段（含 <strong>/<ul>），我们只取文字、不注入它 */
      slot.classList.add('up3-bad');
    } catch (e) {
      slot.hidden = false;
      slot.textContent = t('up3x.netFail') + ' ' + ((e && e.message) || e);
      slot.classList.add('up3-bad');
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
    const tip = [];
    if (now) tip.push(t('set.fp.now', { v: now }), t('set.fp.same', { v: now }));
    if (rep && rep.at) {
      tip.push(rep.stage === 'submit' ? t('set.fp.ok', { time: when, n: rep.n }) : t('set.fp.enter', { time: when, n: rep.n }));
    } else tip.push(t('set.fp.never'));
    const tipAttr = esc(tip.join('\n'));

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
