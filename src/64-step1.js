/* ==== 64-step1.js：新版上传 · 第一步「上传」（自绘，0.2.0）========================

   契约（站点源码）：
     页面    /getstarted 最后一段（HTML.php:2021 printCreateProject）。站点在这里给的是
             **纯 PHP 拼的 HTML**，我们只当数据源读两件事：表单在不在（没给就是前置拦截：
             renderedFrames<10 且公共剩余帧>5000，HTML.php:2091-2108）、文件上限文案。
     上传    POST /project/internal/upload（multipart：addproject_archive + UPLOAD_IDENTIFIER）
             成功 → 302 /project/add/<token>；失败 → 200 纯文本原因（维护中/没头像/并发上限…）
             或 error 页（后缀不对/太大）
     估算器  POST /project/estimator + GET /device/search?term=（ProjectController.php:925-997）

   站点的进度条靠轮询 POST /project/internal/progress；我们用 XHR 自己的 upload 进度事件，
   少一趟请求，也少一份状态。上传成功就让浏览器跳到第二步（那一页由 66 那边接管）。 */

(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.Step1) return;
  const { Util, I18n } = SP;
  const t = SP.t;

  const mk = (tag, cls, txt) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  };
  const zh = (s) => (I18n && I18n.siteText ? (I18n.siteText(s) || s) : s);

  let picked = null;        // 选中的 File（input 与拖放共用）
  let busy = false;         // 上传中：不许再点

  /* ---------------------------------------------------------------- 数据 */

  /** 站点"上传须知"那段 <ul>（HTML.php:2219+），只取文字 */
  function rulesFrom(html) {
    const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const head = [].slice.call(d.querySelectorAll('h4')).filter((x) => /Before adding a file/i.test(x.textContent))[0];
    if (!head) return [];
    let ul = head.nextElementSibling;
    while (ul && ul.tagName !== 'UL') ul = ul.nextElementSibling;
    if (!ul && head.parentNode) ul = head.parentNode.querySelector('ul');
    if (!ul) return [];
    return [].slice.call(ul.querySelectorAll('li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim());
  }

  function limitFrom(note) {
    const m = /Max:\s*([\d.,]+\s*[KMGT]?B)/i.exec(note || '');
    return m ? m[1] : '';
  }

  /* ---------------------------------------------------------------- 上传 */

  function buildForm(slot, page, html) {
    slot.textContent = '';
    if (!page.hasForm) {
      /* 站点根本没给表单 = 前置拦截（欠帧/维护/没头像/并发上限…），原文照译 */
      const box = mk('div', 'up1-msg bad');
      box.textContent = page.warning ? zh(page.warning) : t('up1.gate');
      slot.appendChild(box);
      return;
    }

    /* 站点这次给的上限，在本地就拦住选错的文件（拿在手里只用来拼提示等于白解析）。
       提示里用站点自己的单位（"2,048 MB"），别换算成 "2.0 GB"。 */
    const maxBytes = page.limitBytes || 0;
    const maxText = page.limitText || (maxBytes ? fmtSize(maxBytes) : '');
    const drop = mk('div', 'up1-drop');
    const title = mk('div', 'up1-droptitle');
    title.appendChild(document.createTextNode(t('up1.pick') + ' '));
    /* 复用站内已有的 label.filepick（头像那个也是它）：原生 file input 塞在 label 里、
       1px 透明，Tab 顺序保得住，外观由 label 承担。 */
    const pick = mk('label', 'filepick');
    pick.appendChild(document.createTextNode(t('up1.pickBtn')));
    const inp = mk('input');
    inp.type = 'file';
    inp.accept = '.blend,.zip';
    inp.className = 'up1-input';
    pick.appendChild(inp);
    title.appendChild(pick);
    drop.appendChild(title);
    drop.appendChild(mk('div', 'up1-dropsub', t('up1.pickSub', { size: limitFrom(page.note) || t('up1.anySize') })));
    const nameEl = mk('div', 'up1-name');
    const bar = mk('div', 'up1-bar');
    bar.hidden = true;
    const fill = mk('i');
    bar.appendChild(fill);
    const pct = mk('div', 'up1-pct');
    pct.hidden = true;
    const msg = mk('div', 'up1-msg');
    msg.hidden = true;
    const foot = mk('div', 'up1-foot');
    /* 取消：上限 2,048 MB 意味着大量用户在 GB 级别传，传错了只能关标签页等于把已传的丢掉 */
    const cancel = mk('button', 'btn');
    cancel.type = 'button';
    cancel.textContent = t('up1.cancel');
    cancel.hidden = true;
    const btn = mk('button', 'btn primary');
    btn.type = 'button';
    btn.textContent = t('up1.go');
    btn.disabled = true;   // 未选文件时它不是"已就绪"——以前那是一颗满血主色按钮
    foot.appendChild(cancel);
    foot.appendChild(btn);

    slot.appendChild(drop);
    /* 投递之前就说清"传完会发生什么"：这句话以前只存在于下一个页面，也就是用户已经无法反悔之后 */
    slot.appendChild(mk('div', 'up1-after', t('up1.after')));
    slot.appendChild(nameEl);
    slot.appendChild(bar);
    slot.appendChild(pct);
    slot.appendChild(msg);
    slot.appendChild(foot);

    const say = (text, bad) => {
      msg.textContent = text || '';
      msg.hidden = !text;
      msg.classList.toggle('bad', !!bad);
    };
    /* 剩余时间：onProgress 已经把 loaded/total 给了我们，速率取滑动平均，别只报百分比 */
    const rate = { t: 0, loaded: 0, speed: 0 };
    const fmtEta = (sec) => {
      if (!Number.isFinite(sec) || sec <= 0) return '';
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return m + ':' + ('0' + s).slice(-2);
    };
    const etaOf = (loaded, total) => {
      const now = Date.now();
      if (!rate.t) { rate.t = now; rate.loaded = loaded; return ''; }
      const dt = (now - rate.t) / 1000;
      const dl = loaded - rate.loaded;
      if (dt >= 0.6 && dl > 0) {
        const inst = dl / dt;
        rate.speed = rate.speed ? rate.speed * 0.7 + inst * 0.3 : inst;
        rate.t = now;
        rate.loaded = loaded;
      }
      return rate.speed ? fmtEta((total - loaded) / rate.speed) : '';
    };
    const show = (f) => {
      picked = null;
      if (!f) { nameEl.textContent = ''; btn.disabled = true; return; }
      if (!/\.(blend|zip)$/i.test(f.name)) {
        nameEl.textContent = '';
        btn.disabled = true;
        say(t('up1.badType', { name: f.name }), true);
        return;
      }
      if (maxBytes && f.size > maxBytes) {
        nameEl.textContent = '';
        btn.disabled = true;
        say(t('up1.tooBig', { name: f.name, size: fmtSize(f.size), max: maxText }), true);
        return;
      }
      say('');
      picked = f;
      nameEl.textContent = t('up1.picked', { name: f.name, size: fmtSize(f.size) });
      btn.disabled = busy;
    };

    drop.addEventListener('click', (e) => {
      /* 点在 label.filepick 上由标签自己开文件框；点别处我们代开 */
      if (e.target && e.target.closest && e.target.closest('.filepick')) return;
      inp.click();
    });
    inp.addEventListener('change', () => show(inp.files && inp.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) show(f);
    });

    let ctrl = null;   // Chain.upload 的 { promise, abort }
    cancel.addEventListener('click', () => { if (ctrl) ctrl.abort(); });

    btn.addEventListener('click', async () => {
      if (busy) return;
      if (!picked) { say(t('up1.noFile'), true); return; }
      busy = true;
      btn.disabled = true;
      btn.textContent = t('up1.goBusy');
      cancel.hidden = false;
      say('');
      bar.hidden = false;
      pct.hidden = false;
      fill.style.width = '0%';
      pct.textContent = t('up1.uploading', { pct: 0 });
      rate.t = 0; rate.loaded = 0; rate.speed = 0;

      ctrl = SP.Chain.upload(picked, (loaded, total) => {
        const p = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        fill.style.width = p + '%';
        if (p >= 100) { pct.textContent = t('up1.sending'); return; }
        if (!total) { pct.textContent = t('up1.uploading', { pct: p }); return; }
        const eta = etaOf(loaded, total);
        pct.textContent = eta
          ? t('up1.progress', { done: fmtSize(loaded), total: fmtSize(total), eta })
          : t('up1.progressNoEta', { done: fmtSize(loaded), total: fmtSize(total) });
      });
      const r = await ctrl.promise;
      ctrl = null;

      busy = false;
      cancel.hidden = true;
      btn.textContent = t('up1.go');
      if (r.ok) {
        pct.textContent = t('up1.jumping');
        location.href = SP.Chain.step2Url(r.token);
        return;
      }
      bar.hidden = true;
      pct.hidden = true;
      btn.disabled = !picked;
      if (r.aborted) { say(t('up1.canceled')); return; }   // 取消不是错误：中性色，别写成失败
      say(r.message || t('up1.fail'), true);
    });
  }

  function fmtSize(n) {
    if (!Number.isFinite(n)) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
  }

  /* -------------------------------------------------------------- 估算器 */

  function buildEst(slot) {
    slot.textContent = '';
    let devValue = '';

    const dev = mk('div', 'up1-dev');
    const devInp = mk('input');
    devInp.type = 'text';
    devInp.className = 'up1-devin';
    devInp.placeholder = t('up1.devPh');
    devInp.autocomplete = 'off';
    const sug = mk('div', 'up1-sug');
    sug.hidden = true;
    dev.appendChild(devInp);
    dev.appendChild(sug);

    const fields = mk('div', 'up1-estfields');
    const timeF = mk('div', 'up1-fld');
    timeF.appendChild(mk('label', null, t('up1.time')));
    const timeInp = mk('input');
    timeInp.type = 'text';
    timeInp.inputMode = 'decimal';
    timeF.appendChild(timeInp);
    const cntF = mk('div', 'up1-fld');
    cntF.appendChild(mk('label', null, t('up1.count')));
    const cntInp = mk('input');
    cntInp.type = 'text';
    cntInp.inputMode = 'numeric';
    cntF.appendChild(cntInp);
    fields.appendChild(timeF);
    fields.appendChild(cntF);

    const foot = mk('div', 'up1-foot');
    const btn = mk('button', 'btn primary');
    btn.type = 'button';
    btn.textContent = t('up1.estGo');
    foot.appendChild(btn);

    const out = mk('div', 'up1-estout');
    const msg = mk('div', 'up1-msg');
    msg.hidden = true;
    const say = (text, bad) => {
      msg.textContent = text || '';
      msg.hidden = !text;
      msg.classList.toggle('bad', !!bad);
    };

    slot.appendChild(mk('div', 'up1-tip', t('up1.estTip')));
    slot.appendChild(dev);
    slot.appendChild(fields);
    slot.appendChild(foot);
    slot.appendChild(msg);
    slot.appendChild(out);

    /* 设备名：站点那个 jQuery UI autocomplete 的替代品，走同一个 GET /device/search */
    let timer = null;
    let seq = 0;
    const closeSug = () => { sug.hidden = true; sug.textContent = ''; };
    devInp.addEventListener('input', () => {
      devValue = '';
      closeSug();
      const term = devInp.value.trim();
      if (term.length < 3) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const my = ++seq;
        const list = await SP.Chain.deviceSearch(term);
        if (my !== seq) return;
        sug.textContent = '';
        if (!list.length) { closeSug(); return; }
        list.slice(0, 12).forEach((o) => {
          const li = mk('div', 'up1-sugitem', o.label);
          li.addEventListener('click', () => {
            devValue = o.value;
            devInp.value = o.label;
            closeSug();
          });
          sug.appendChild(li);
        });
        sug.hidden = false;
      }, 250);
    });
    devInp.addEventListener('blur', () => setTimeout(closeSug, 180));

    btn.addEventListener('click', async () => {
      const time = Number(String(timeInp.value).replace(',', '.'));
      const count = Number(cntInp.value);
      say('');
      out.textContent = '';
      if (!devValue) { say(t('up1.devPick'), true); return; }
      if (!(time > 0) || !(count > 0)) { say(t('up1.estNeed'), true); return; }
      btn.disabled = true;
      btn.textContent = t('up1.estimating');
      const r = await SP.Chain.estimator({ time, count, device: devValue });
      btn.disabled = false;
      btn.textContent = t('up1.estGo');
      if (!r.ok) {
        say(r.reason === 'failed to import device' ? t('up1.devPick') : (r.message || t('up1.estFail')), true);
        return;
      }
      if (r.cost) {
        const c = mk('div', 'up1-cost');
        c.innerHTML = t('up1.cost', { pts: '<b>' + Util.esc(r.cost) + '</b>' });
        out.appendChild(c);
      }
      if (r.rows.length) {
        const tbl = mk('table', 'tbl up1-tbl');
        const thead = mk('thead');
        const tr = mk('tr');
        tr.appendChild(mk('th', null, t('up1.tiles')));
        tr.appendChild(mk('th', null, t('up1.perTile')));
        thead.appendChild(tr);
        tbl.appendChild(thead);
        const tb = mk('tbody');
        r.rows.forEach((cells) => {
          const row = mk('tr');
          cells.forEach((c, idx) => {
            const td = mk('td');
            if (idx === 1 && c.good) td.className = 'ok';
            td.textContent = /^no split$/i.test(c.text) ? t('up1.noSplit') : c.text;
            row.appendChild(td);
          });
          tb.appendChild(row);
        });
        tbl.appendChild(tb);
        out.appendChild(tbl);
      }
      if (!out.childNodes.length) say(t('up1.estFail'), true);
    });
  }

  /* ---------------------------------------------------------------- 须知 */

  /** 须知：站点那几条 `<li>` 里带 `<strong>`，按 textContent 拼成一整句反而匹配不上词典
      （词典是按文本节点/整块两种粒度写的）。所以**原样克隆节点**，再走 DOM 翻译器那一趟。 */
  function buildRules(slot, html) {
    slot.textContent = '';
    const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const head = [].slice.call(d.querySelectorAll('h4')).filter((x) => /Before adding a file/i.test(x.textContent))[0];
    let src = null;
    if (head) {
      src = head.nextElementSibling;
      while (src && src.tagName !== 'UL') src = src.nextElementSibling;
      if (!src && head.parentNode) src = head.parentNode.querySelector('ul');
    }
    const ul = mk('ul', 'up1-rules');
    if (src) [].slice.call(src.children).forEach((li) => ul.appendChild(document.importNode(li, true)));
    if (!ul.children.length) { slot.appendChild(mk('div', 'up1-tip', t('up1.noRules'))); return; }
    slot.appendChild(ul);
    /* 这是我们自己的卡片，里面的站点原文也该是中文：临时打开翻译器那一趟（用户的总开关不参与）。 */
    const di = SP.DomI18n;
    if (di && di.translateSubtree) {
      const keep = di.enabled;
      di.enabled = true;
      try { di.translateSubtree(ul); } finally { di.enabled = keep; }
    }
    /* 站点把句号写在 <strong> 外面（`…3.0 or higher</strong>.`）：中文译文自己带句号，
       后面那个 "." 就成了「。.」——译文已经以句末标点收尾时，把那个孤零零的 "." 去掉。 */
    [].slice.call(ul.querySelectorAll('li')).forEach((li) => {
      const last = li.lastChild;
      if (!last || last.nodeType !== 3) return;
      const tail = last.nodeValue.trim();
      if (!/^[.．。]+$/.test(tail)) return;
      const before = li.textContent.slice(0, li.textContent.length - tail.length).trimEnd();
      if (/[。．.！!？?]$/.test(before)) last.remove();
    });
  }

  /* ---------------------------------------------------------------- 入口 */

  /** 把站点的 /getstarted 当数据源，三个槽位全部自绘。返回 false = 页面结构不认识。 */
  function mount(root, html) {
    if (!root || !html) return false;
    const page = SP.Chain.uploadPage(html);
    const form = root.querySelector('[data-up="form"]');
    const est = root.querySelector('[data-up="est"]');
    const rules = root.querySelector('[data-up="rules"]');
    if (!form || !est || !rules) return false;
    /* 站点连表单都没给时，估算器与须知也没有意义 */
    buildForm(form, page, html);
    if (page.hasForm) {
      buildEst(est);
      buildRules(rules, html);
    } else {
      est.textContent = '';
      rules.textContent = '';
    }
    return true;
  }

  SP.Step1 = { mount, rulesFrom, limitFrom, fmtSize };
})();
