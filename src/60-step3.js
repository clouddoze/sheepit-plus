/* ==== 60-step3.js：新版上传 · 第三步（分析完成后的项目设置表单）====================

   这一页的表单是站点服务端渲染好、由站点脚本 addproject.js 的 doAddProject(i) 按 **id** 逐项
   取值的（事实见 .tmp/upload-test/rewrite-facts.md 与 error-branches.md）。所以做法只有一条：
   **搬活节点** —— 4 个容器、27 个控件的 id/name、内联 onsubmit 全部原样保留，我们只重排外观。
   自绘边界：容器之间的一切外观都是我们的；容器本身一个属性都不动。

   三条护栏：
     ① 提交前点名：注入时记下服务端给了哪些带 id 的控件，点提交那一刻逐个确认还在；不在就拦下不
        提交。jQuery 对缺失元素取到 undefined → 请求里 key 还在但值是空串，而服务端只判 key 在不在
        → 会静默建成错项目，最坏撞上站点封禁 90 天那条分支。宁可不动，不要错提。
     ② 桩对比验收：把站点 doAddProject 换成只记录请求体的桩，比对 27 个键的值（见 docs/PUBLISHING.md）。
     ③ 上游指纹：站点资源路径 /media/<short_version>/ 就是线上 www 仓库的 commit 短 id；与
        VERIFIED_UPSTREAM 不一致时在设置面板里明说"新版可能已失效"。
   错误文案一律用我们自己的：站点那 6 个错误分支的片段会被拦下 —— 它那句
   $('#addproject_content_'+i).html(data) 会把我们整棵树顶掉，我们接住片段、把树放回去。 */

(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  const { Util, t } = { Util: SP.Util, t: SP.t };
  const esc = Util.esc;

  /** 我们验证过的上游版本 = 站点资源路径里的 short_version（= www 仓库 commit 短 id）。
      站点更新后要重新验证并把这里改成新值（同时更新 docs/PUBLISHING.md 的记录）。 */
  const VERIFIED_UPSTREAM = '9b13032c';

  const REPORT_KEY = 'up3Report';   // 最近一次「提交前点名」的结果，设置面板读它
  let lastReport = null;

  const mk = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };

  /** 站点资源路径里的版本号：/media/<8 位十六进制>/…（脚本、样式、图片都带） */
  function upstreamVersion() {
    const nodes = document.querySelectorAll('script[src*="/media/"],link[href*="/media/"]');
    for (let i = 0; i < nodes.length; i++) {
      const url = nodes[i].src || nodes[i].href || '';
      const m = /\/media\/([0-9a-f]{8})\//.exec(url);
      if (m) return m[1];
    }
    return '';
  }

  function saveReport(rep) {
    lastReport = rep;
    try { Util.store.set(REPORT_KEY, rep); } catch (e) { /* 隐私模式等 */ }
  }

  function report() {
    if (lastReport) return lastReport;
    const r = Util.store.get(REPORT_KEY, null);
    return r && typeof r === 'object' ? r : null;
  }

  /* ---- ① 提交前点名 ---------------------------------------------------- */

  /** 注入这一刻服务端给了什么：这一块里所有带 id 的元素 */
  function snapshot(box) {
    const list = [];
    box.querySelectorAll('[id]').forEach((el) => {
      list.push({
        id: el.id,
        type: (el.type || '').toLowerCase(),
        value: el.value === undefined ? '' : String(el.value),
      });
    });
    return list;
  }

  /** 点名：还在不在。hidden 的"服务端这次算出来的值"还要没被清空 —— 空了就是把参数送成空串。 */
  function check(list) {
    const missing = [];
    list.forEach((rec) => {
      const el = document.getElementById(rec.id);
      if (!el) { missing.push(rec.id); return; }
      const type = (el.type || '').toLowerCase();
      if (rec.type && type !== rec.type) { missing.push(rec.id); return; }
      if (rec.type === 'hidden' && rec.value && String(el.value) === '') missing.push(rec.id);
    });
    return missing;
  }

  /* ---- ② 重排外观（搬活节点，不改语义）--------------------------------- */

  const sec = (key, title) => {
    const s = mk('section', 'up3-sec');
    s.dataset.sec = key;
    const h = mk('h3');
    h.textContent = title;
    s.appendChild(h);
    s.appendChild(mk('div', 'up3-body'));
    return s;
  };
  const bodyOf = (s) => s.querySelector('.up3-body');

  /** 把服务端渲染的那一块重排成我们的布局。box = #sp-an-result。
      返回 { ok:true, id, count } 或 { ok:false, reason }（reason='shape' → 调用方保持站点原样）。 */
  function enhance(box) {
    if (!box || box.dataset.spUp3 === '1') return { ok: false, reason: 'done' };
    const cont = box.querySelector('[id^="addproject_content_"]');
    const form = cont && cont.querySelector('form[id^="addproject_"]');
    if (!cont || !form) return { ok: false, reason: 'shape' };
    const i = form.id.replace('addproject_', '');

    /* 先抓引用：下面整块搬家，再查就找不着了 */
    const fname = cont.querySelector('h4');
    const errBox = cont.querySelector('[id^="addproject_error_box_"]');
    const div10 = form.querySelector('[id^="addproject_animation_div10_"]');
    const advChk = form.querySelector('[id^="checkbox_ad_"]');
    const advBox = form.querySelector('[id^="checkbox_advanced_option_"]');
    const advWrap = advChk && advChk.parentElement;
    const submitDiv = form.querySelector('[id^="addproject_submit_div_"]');
    const submitInput = form.querySelector('input[type=submit]');
    const maxRam = form.querySelector('[id^="addproject_max_ram_optional_"]');
    const pub = box.querySelector('#public_render');
    const mp4 = box.querySelector('#generate_mp4');
    const cpu = box.querySelector('#compute_method_cpu');
    if (!div10 || !submitDiv || !submitInput || !errBox) return { ok: false, reason: 'shape' };

    const baseline = snapshot(box);

    /* ① 整块搬进我们的 host：先搬再排，站点节点一个不丢（顺序＝服务端给的顺序） */
    const host = mk('div', 'up3');
    while (cont.firstChild) host.appendChild(cont.firstChild);
    cont.appendChild(host);

    /* ② 容器外那两个勾选与计算方式也是这一页真正的输入，一起搬进来（hidden 的留在原位） */
    const visSec = sec('vis', t('up3.vis'));
    if (pub && pub.closest('label')) bodyOf(visSec).appendChild(pub.closest('label'));
    if (mp4 && mp4.closest('label')) bodyOf(visSec).appendChild(mp4.closest('label'));

    const cpuSec = sec('cpu', t('up3.cpu'));
    if (cpu && cpu.closest('.row')) bodyOf(cpuSec).appendChild(cpu.closest('.row'));

    /* ③ 帧范围 / 高级选项：站点自己的节点原样搬进对应面板 */
    const framesSec = sec('frames', t('up3.frames'));
    bodyOf(framesSec).appendChild(div10);
    const advSec = sec('adv', t('up3.adv'));
    if (advWrap) bodyOf(advSec).appendChild(advWrap);
    if (advBox) bodyOf(advSec).appendChild(advBox);

    /* ④ 剩下的是隐藏项、畸形项与降噪提示文本：隐藏项收进 .up3-hid，有字的文本进提示条 */
    const hid = mk('div', 'up3-hid');
    const note = mk('div', 'up3-note');
    Array.prototype.slice.call(form.childNodes).forEach((n) => {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) note.appendChild(n); return; }
      if (n.nodeName === 'BR') { note.appendChild(n); return; }
      if (n === div10 || n === advBox || n === submitDiv || (advWrap && n === advWrap)) return;
      hid.appendChild(n);
    });

    /* ⑤ 面板入 form：隐藏项 → 可见性 → 计算方式 → 帧范围 → 高级选项 → 提示 → 消息 → 提交 */
    const msg = mk('div', 'up3-msg');
    msg.hidden = true;
    const foot = mk('div', 'up3-foot');
    foot.appendChild(submitDiv);

    const frag = document.createDocumentFragment();
    [visSec, cpuSec, framesSec, advSec].forEach((s) => frag.appendChild(s));
    if (note.childNodes.length) frag.appendChild(note);
    frag.appendChild(msg);
    frag.appendChild(foot);
    form.insertBefore(hid, form.firstChild);
    form.appendChild(frag);

    /* ⑥ host 里只留 标题 → 表单 → 站点错误框；其余散件（hidden 的 exe/path 等）收进 .up3-hid */
    const head = mk('div', 'up3-head');
    /* 站点给文件名挂了内联 style="color: var(--color-form-bg)"（那是站点主题的变量）。
       内联样式会压过我们 CSS 里的颜色，而那个变量在我们的外壳里没有定义 —— 摘掉它。 */
    if (fname) { fname.removeAttribute('style'); head.appendChild(fname); }
    host.insertBefore(head, host.firstChild);
    host.appendChild(form);
    host.appendChild(errBox);
    Array.prototype.slice.call(host.children).forEach((el) => {
      if (el !== head && el !== form && el !== errBox) hid.appendChild(el);
    });

    box.dataset.spUp3 = '1';
    box.classList.add('sp-up3');
    wire({ box, form, cont, errBox, msg, host, hid, submitDiv, submitInput, maxRam, baseline, i });
    saveReport({ at: Date.now(), stage: 'enter', ok: true, n: baseline.length, missing: [], upstream: upstreamVersion(), verified: VERIFIED_UPSTREAM });
    return { ok: true, id: i, count: baseline.length };
  }

  /* ---- ③ 提交挂钩：点名 → 放行；出错 → 接住片段、把树放回去 ------------- */

  function wire(ctx) {
    const { box, form, cont, errBox, msg, host, submitDiv, submitInput, maxRam, baseline } = ctx;

    function say(text, bad) {
      msg.textContent = text;
      msg.hidden = false;
      msg.classList.toggle('bad', !!bad);
    }

    /** 站点把按钮换成了 loading 图、并 disable 了内存框：出错后要能再点一次 */
    function restore() {
      if (submitInput && !submitInput.isConnected) {
        submitDiv.textContent = '';
        submitDiv.appendChild(submitInput);
      }
      if (maxRam) maxRam.disabled = false;
    }

    /* 提交前点名。
       注意事件顺序：submit 事件的目标就是 form，而在**目标节点**上 capture 与非 capture
       是按注册先后跑的 —— 站点那句内联 onsubmit 在我们之前注册，挂在 form 上抢不到它前面。
       所以挂到**祖先**（box）的捕获阶段：捕获阶段先于目标阶段，stopPropagation 之后事件
       根本到不了 form，站点那条内联 onsubmit 与它的 $.ajax 都不会跑。 */
    const gate = box || form.parentNode || form;
    gate.addEventListener('submit', (ev) => {
      if (ev.target !== form) return;
      /* 两个都没勾时站点那边只 alert 一句英文就中止，不如我们自己说 */
      const cp = document.getElementById('compute_method_cpu');
      const gp = document.getElementById('compute_method_gpu');
      if (cp && gp && !cp.checked && !gp.checked) {
        ev.preventDefault();
        ev.stopPropagation();
        say(t('up3.needCompute'), true);
        return;
      }
      const missing = check(baseline);
      if (missing.length) {
        ev.preventDefault();
        ev.stopPropagation();
        say(t('up3.missing', { list: missing.join('、') }), true);
        saveReport({ at: Date.now(), stage: 'submit', ok: false, n: baseline.length, missing, upstream: upstreamVersion(), verified: VERIFIED_UPSTREAM });
        return;
      }
      msg.hidden = true;
      msg.textContent = '';
      saveReport({ at: Date.now(), stage: 'submit', ok: true, n: baseline.length, missing: [], upstream: upstreamVersion(), verified: VERIFIED_UPSTREAM });
    }, true);

    /* 结果：站点 .done 出错时 $('#'+cont.id).html(data) 会把我们整棵树顶掉；
           .fail 时写进 #addproject_error_box_i。两种情况都接住，换成我们自己的话。 */
    const obs = new MutationObserver(() => {
      const net = (errBox.textContent || '').trim();
      if (net) {
        errBox.textContent = '';
        restore();
        say(t('up3.netFail') + ' ' + net, true);
        return;
      }
      if (!host.isConnected) {
        const raw = (cont.textContent || '').replace(/\s+/g, ' ').trim();
        cont.textContent = '';
        cont.appendChild(host);
        restore();
        ctx.lastRaw = raw;
        /* 站点片段往往写明了原因（帧数太多、空间不足…），切一段跟着一起说，不整段吞掉 */
        say(t('up3.rejected') + (raw ? ' ' + raw.slice(0, 200) : ''), true);
      }
    });
    obs.observe(cont, { childList: true });
    obs.observe(errBox, { childList: true, characterData: true, subtree: true });
    ctx.observer = obs;
  }

  /* ---- 设置面板里的指纹行（D8：放在上传开关旁边）----------------------- */

  function fpRows() {
    const now = upstreamVersion();
    const rep = report();
    let version;
    if (!now) version = `<div class="hint">${esc(t('set.fp.unknown'))}</div>`;
    else if (now === VERIFIED_UPSTREAM) version = `<div class="hint">${esc(t('set.fp.same', { v: now }))}</div>`;
    else version = `<div class="hint bad">${esc(t('set.fp.diff', { now, known: VERIFIED_UPSTREAM }))}</div>`;
    let checkRow = `<div class="hint">${esc(t('set.fp.never'))}</div>`;
    if (rep && rep.at) {
      const when = new Date(rep.at).toLocaleString();
      if (rep.missing && rep.missing.length) {
        checkRow = `<div class="hint bad">${esc(t('set.fp.bad', { time: when, n: rep.missing.length, list: rep.missing.join('、') }))}</div>`;
      } else if (rep.stage === 'submit') {
        checkRow = `<div class="hint">${esc(t('set.fp.ok', { time: when, n: rep.n }))}</div>`;
      } else {
        checkRow = `<div class="hint">${esc(t('set.fp.enter', { time: when, n: rep.n }))}</div>`;
      }
    }
    return `<div class="fp">
        <div class="lbl2">${esc(t('set.fp.title'))}</div>
        <div class="hint">${esc(t('set.fp.now', { v: now || '—' }))}</div>
        ${version}
        ${checkRow}
      </div>`;
  }

  SP.Step3 = {
    enhance,
    check,
    upstreamVersion,
    verifiedUpstream: VERIFIED_UPSTREAM,
    report,
    fpRows,
  };
})();
