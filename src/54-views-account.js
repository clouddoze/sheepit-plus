/* ==== 54-views-account.js：设置 / 账户 ====
   独立 IIFE：公共件从 45-view-kit 取，项目状态从 SP.Views 取。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow } = SP.VK;

  /* 账户页当前标签（原放在 51 里，跟着视图走） */
  const acctState = { tab: 'sched' };
  /* ==== 设置 ==== */

  function settings(state) {
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, label]) =>
      `<button data-v="${v}" aria-pressed="${String(cur) === v}">${esc(label)}</button>`).join('')}</div>`;

    const langOpts = [['auto', t('set.lang.auto')]]
      .concat(I18n.available().map((l) => [l.code, l.label]));

    return `<div class="sechead"><h2>${esc(t('set.title'))}</h2></div>
      <div class="panel settings">
        <div class="row"><div class="lbl">${esc(t('set.theme'))}</div>
          ${seg('sp-theme', state.themePref, [['auto', t('set.theme.auto')], ['dark', t('set.theme.dark')], ['light', t('set.theme.light')]])}</div>

        <div class="row block">
          <div class="lbl">${esc(t('set.pageSize'))}</div>
          ${seg('sp-pagesize', String(SP.VK.pageSize()), [['100', '100'], ['200', '200'], ['500', '500']])}
          <div class="hint">${esc(t('set.pageSizeHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.nav'))}
            <button class="btn sm" data-nav-reset>${esc(t('set.navReset'))}</button></div>
          <div class="seg" id="sp-navcfg">${SP.VK.NAV_ITEMS.map(([k, locked]) => {
    const on = locked || !state.navHidden.includes(k);
    return `<button data-nav-toggle="${esc(k)}" aria-pressed="${on}"${locked ? ' disabled' : ''} title="${esc(locked ? t('set.navLocked') : '')}">${esc(t('nav.' + k))}</button>`;
  }).join('')}</div>
          <div class="hint">${esc(t('set.navHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.scale'))}</div>
          ${seg('sp-scale', String(state.uiScale), [['0.9', '90%'], ['1', '100%'], ['1.1', '110%'], ['1.25', '125%'], ['1.4', '140%']])}
          <div class="hint">${esc(t('set.scaleHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.lang'))}</div>
          ${seg('sp-lang', state.langPref, langOpts)}
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.psort'))}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            ${seg('sp-psort', SP.Views.projState.sort, Object.keys(SP.Views.P_SORTS).map((k) => [k, t(SP.Views.P_SORTS[k].label)]))}
            ${seg('sp-pdir', SP.Views.projState.dir, [['asc', t('set.pdir.asc')], ['desc', t('set.pdir.desc')]])}
          </div>
          <div class="hint">${esc(t('set.psortHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.ovblocks'))}</div>
          <div class="ovlist">${SP.Views.ovDisplayOrder().map(SP.Views.ovRow).join('')}</div>
          <div class="hint">${esc(t('set.ovblocksHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.about'))}</div>
          <div class="hint" style="margin-top:0">${esc(t('set.aboutText'))}</div>
          <div class="hint">${esc(t('set.dangerHint'))}</div>
        </div>
      </div>`;
  }

  /* ==== 账户设置 ==== */

  /** 动作地址一律从站点 onclick 读出、不自己拼；requiresAction 时读不到就**不画按钮**（不猜 URL）。 */
  function userList(items, emptyText, opts) {
    const list = (opts && opts.list) || '';
    const box = (inner) => `<div class="ulist" data-listbox="${esc(list)}" data-empty="${esc(emptyText)}">${inner}</div>`;
    if (!items || !items.length) return box(`<div class="none">${esc(emptyText)}</div>`);
    const needAction = !!(opts && opts.requiresAction);
    return box(items.map((u) => `<div class="u">
        ${UI.avatar(u.avatar, u.name, 'ini')}
        <span class="n"><a href="/user/${encodeURIComponent(u.name)}/profile" target="_self">${esc(u.name)}</a></span>
        ${u.action || !needAction
    ? `<button class="btn sm" data-list-del="${esc(u.name)}" data-url="${esc(u.action)}" data-list="${esc(list)}">${esc(t('account.remove'))}</button>`
    : ''}
      </div>`).join(''));
  }

  /* ---- 渲染优先级名单：就地增删（这一屏最高频的动作，别整页重画） ----
     整页重画不只慢：render() 会把 #sp-body 整个替换掉，输入框、光标位置、敲了一半的用户名
     一起消失，连着加几个人就得反复点回输入框。所以这一段写操作只动两处 DOM —— 名单本身、
     输入框下面那行状态。写端点仍是站点自己的：添加用解析出来的 /user/priority/add/ 前缀，
     移除用每一行 onclick 里带的 /user/priority/remove/<名字>（20-api.js parseAccount 的 action）。
     行上的删除按钮改名 data-prio-del 而不是 data-del：80-app.js 那份 [data-del] 收口是
     "提交后整页重取"，正好是这里要去掉的行为。 */

  /** 空名单不是一片留白：说清"还没有人"，并把下一步（输入用户名后回车）写在原地。 */
  const prioEmptyText = () => `${t('account.prioNone')} · ${t('account.priorityAdd')}`;

  const prioRow = (u) => `<div class="u" data-prio-row="${esc(u.name)}">
      ${UI.avatar(u.avatar, u.name, 'ini')}
      <span class="n"><a href="/user/${encodeURIComponent(u.name)}/profile" target="_self">${esc(u.name)}</a></span>
      ${u.action ? `<button class="btn sm" data-prio-del="${esc(u.name)}" data-url="${esc(u.action)}">${esc(t('account.remove'))}</button>` : ''}
    </div>`;

  const prioList = (items) => `<div class="ulist" id="sp-prio-list">${items && items.length
    ? items.map(prioRow).join('')
    : `<div class="none">${esc(prioEmptyText())}</div>`}</div>`;

  let prioBusy = false;      // 一次只发一个写请求：双击「移除」不会再打两发
  let prioSeq = 0;           // 每次重取的序号：慢的那次回来时，更晚的一次可能已经落过地
  let prioMsgTimer = 0;
  /* 本屏内已经删成功的名字：写操作回了 OK 就是删掉了，之后的重取（可能命中站点/代理的
     过期页）不能再把它画回来。整页重开时这份集合自然失效（那时以站点数据为准）。 */
  const prioGone = new Set();

  const prioEl = (id) => document.getElementById(id);
  const prioState = () => (SP.app && SP.app.state) || null;

  /** 输入框下面那行状态：text 空即收起；bad 用警示色（校验不通过 / 站点报错）。 */
  function prioSay(text, bad) {
    const msg = prioEl('sp-prio-msg');
    if (!msg) return;
    if (prioMsgTimer) { clearTimeout(prioMsgTimer); prioMsgTimer = 0; }
    msg.textContent = text || '';
    msg.hidden = !text;
    msg.classList.toggle('bad', !!(text && bad));
  }

  /** 成功提示：说完就收，别占着校验的位置。 */
  function prioFlash(text) {
    prioSay(text);
    prioMsgTimer = setTimeout(() => {
      const msg = prioEl('sp-prio-msg');
      if (msg && msg.textContent === text) { msg.textContent = ''; msg.hidden = true; }
    }, 2200);
  }

  /** 只重画名单这一块（输入框、光标、焦点都不动）。 */
  function prioPaint() {
    const list = prioEl('sp-prio-list');
    const s = prioState();
    if (!list || !s || !s.account) return;
    const items = s.account.priority || [];
    list.innerHTML = items.length ? items.map(prioRow).join('') : `<div class="none">${esc(prioEmptyText())}</div>`;
  }

  /** 输入即校验：空 → 按钮禁用（placeholder 已说明下一步）；重复 → 说明"已在名单里"并挡住
      （再提交一次是纯浪费）；自己 → 说明调度器默认把「我自己」排最前，但**不挡**：关掉
      "优先渲染我自己的项目"开关时，把自己加进名单是有意义的。 */
  function prioCheck() {
    const inp = prioEl('sp-prio');
    const btn = prioEl('sp-prio-add');
    if (!inp || !btn) return { name: '', blocked: true, dup: false };
    const s = prioState() || {};
    const acc = s.account || {};
    const name = inp.value.trim();
    const me = String(s.userName || '').toLowerCase();
    const dup = !!name && (acc.priority || []).some((x) => String(x.name).toLowerCase() === name.toLowerCase());
    const self = !!name && !!me && name.toLowerCase() === me;
    if (!name) { btn.disabled = true; prioSay(''); }
    else if (dup) { btn.disabled = true; prioSay(t('proj.prio.inList'), true); }
    else if (self) { btn.disabled = false; prioSay(t('account.schedulerHint'), true); }
    else { btn.disabled = false; prioSay(''); }
    return { name, blocked: !name || dup, dup };
  }

  /** 写成功后重拉一次账户页数据，只回填优先级名单（其余面板不动 —— 整页重画就丢焦点）。
      opts.added：刚加成功的名字，站点页面偶尔还没带上它，先补一行（没有移除按钮：站点给的
      action 要等下一次整页数据才知道），下次整页取数会补全。 */
  async function prioReload(opts) {
    const s = prioState();
    const user = s && s.userName;
    if (!user || !s.account) return false;
    const seq = ++prioSeq;
    SP.Api.invalidate();
    let acc;
    try {
      acc = SP.Api.parseAccount(await SP.Api.fetchPage(`/user/${encodeURIComponent(user)}/edit`));
    } catch (e) {
      return false;   // 写已经成功：读失败就保持现状，下次整页取数会纠正；别把成功报成失败
    }
    if (seq !== prioSeq) return false;   // 更晚的一次刷新已经落地，这份数据已经过时
    let items = (acc.priority || []).filter((x) => !prioGone.has(x.name));
    if (opts && opts.added && !items.some((x) => x.name === opts.added)) {
      items = items.concat([{ name: opts.added, action: '', avatar: '' }]);
    }
    s.account = Object.assign({}, s.account, { priority: items });
    prioPaint();
    return true;
  }

  async function prioAdd() {
    if (prioBusy) return;
    const inp = prioEl('sp-prio');
    const btn = prioEl('sp-prio-add');
    const s = prioState();
    if (!inp || !btn || !s || !s.account) return;
    const v = prioCheck();
    if (!v.name) { prioSay(t('mg.acl.needName'), true); return; }   // 空：说清楚，别静默
    if (v.dup) return;                                              // 已在名单里：按钮已禁用，这里兜底
    const base = (s.account.add && s.account.add.priority) || '/user/priority/add/';
    prioBusy = true;
    btn.disabled = true;
    try {
      const r = await SP.Api.post(base + encodeURIComponent(v.name));
      if (!SP.Api.isOk(r)) { prioSay(t('account.failed', { msg: r }), true); return; }
    } catch (e) {
      prioSay(t('account.failed', { msg: (e && e.message) || String(e) }), true);
      return;
    } finally {
      prioBusy = false;
      if (btn.isConnected) btn.disabled = false;
    }
    /* 先就地补一行再重拉：用户马上看到结果（重拉只负责把站点那份完整数据换进来） */
    prioGone.delete(v.name);
    s.account = Object.assign({}, s.account, {
      priority: (s.account.priority || []).concat([{ name: v.name, action: '', avatar: '' }]),
    });
    inp.value = '';
    prioPaint();
    prioCheck();
    inp.focus();                        // 连续录入：焦点留在输入框
    prioFlash(t('account.ok'));
    prioReload({ added: v.name });
  }

  async function prioRemove(btn) {
    if (prioBusy || !btn) return;
    const url = btn.dataset.url;
    const name = btn.dataset.prioDel;
    const row = btn.closest('[data-prio-row]');
    const s = prioState();
    if (!url || !name || !row || !s || !s.account) return;   // 读不到站点给的地址：不发请求
    prioBusy = true;
    btn.disabled = true;
    try {
      const r = await SP.Api.post(url);
      if (!SP.Api.isOk(r)) { prioSay(t('account.failed', { msg: r }), true); btn.disabled = false; return; }
    } catch (e) {
      prioSay(t('account.failed', { msg: (e && e.message) || String(e) }), true);
      btn.disabled = false;
      return;
    } finally {
      prioBusy = false;
    }
    prioGone.add(name);
    s.account = Object.assign({}, s.account, {
      priority: (s.account.priority || []).filter((x) => x.name !== name),
    });
    row.remove();                       // 就地删一行：输入框、选中位置、焦点全都没动
    prioPaint();                        // 删空了要换成空态
    prioCheck();                        // 输入的若正好是刚删掉的名字，现在可以加了
    prioFlash(t('account.ok'));
    prioReload();
  }

  /** 名单行删除：就地摘掉那一行（赞助 / 两个黑名单 / 渲染密钥）。
      与 priority 的 prioRemove 是同一套手感：不整页重画，输入框和焦点都不动。 */
  const LIST_KEYS = {
    sponsor: (acc) => (acc.sponsor && acc.sponsor.list) || [],
    blockedRenderers: (acc) => acc.blockedRenderers || [],
    blockedOwners: (acc) => acc.blockedOwners || [],
    keys: (acc) => acc.renderKeys || [],
  };

  /** 名字字段不一样：其它名单按 name，密钥按 key。 */
  function listBoxSync(list, acc, name) {
    const arr = LIST_KEYS[list] ? LIST_KEYS[list](acc) : null;
    if (!Array.isArray(arr)) return;
    const next = arr.filter((x) => (list === 'keys' ? x.key !== name : x.name !== name));
    if (list === 'sponsor') acc.sponsor = Object.assign({}, acc.sponsor, { list: next });
    else if (list === 'keys') acc.renderKeys = next;
    else acc[list] = next;
  }

  async function listRemove(btn) {
    const url = btn && btn.dataset.url;
    const list = btn && btn.dataset.list;
    const name = btn && btn.dataset.listDel;
    const s = prioState();
    if (!url || !list || !s || !s.account) return;   // 读不到站点给的地址：不发空 POST
    if (btn.dataset.confirm && !window.confirm(btn.dataset.confirm)) return;
    btn.disabled = true;
    try {
      const r = await SP.Api.post(url);
      if (!SP.Api.isOk(r)) {
        btn.disabled = false;
        if (SP.app && SP.app.toast) SP.app.toast(t('account.failed', { msg: r }));
        return;
      }
    } catch (e) {
      btn.disabled = false;
      if (SP.app && SP.app.toast) SP.app.toast(t('account.failed', { msg: (e && e.message) || String(e) }));
      return;
    }
    const row = btn.closest('.u, .keyrow');
    if (row) row.remove();                     // 就地摘行：不动输入框、不丢焦点
    listBoxSync(list, s.account, name);
    const box = document.querySelector('[data-listbox="' + list + '"]');
    if (box && !box.querySelector('.u') && !box.querySelector('.keyrow')) {
      const none = document.createElement('div');
      none.className = 'none';
      none.textContent = box.dataset.empty || t('account.empty');
      box.appendChild(none);
    }
    if (SP.app && SP.app.toast) SP.app.toast(t('account.ok'));
  }

  /** 账户页的事件委托：装一次，挂在 #sp-body 上（它整场会话都不换）。 */
  function prioWire(root) {
    if (!root || root.dataset.spAcct === '1') return;
    root.dataset.spAcct = '1';
    root.addEventListener('click', (ev) => {
      const tgt = ev.target;
      const add = tgt && tgt.closest && tgt.closest('[data-act="prio-add"]');
      if (add) {
        /* 只 stopPropagation：80-app.js 那份 prio-add 逻辑原样留着当兜底 —— 这里的接线万一
           没绑上，按钮仍按老路走（整页重画但能用）；绑上了就不能让它再跑一遍。 */
        ev.stopPropagation();
        prioAdd();
        return;
      }
      const del = tgt && tgt.closest && tgt.closest('[data-prio-del]');
      if (del) { ev.stopPropagation(); prioRemove(del); return; }
      /* 其余三份名单（赞助 / 两个黑名单 / 渲染密钥）：同一条就地路径 ——
         删除只摘掉那一行，不再走 80-app 的 [data-del] → submit() → 整页重取。 */
      const ld = tgt && tgt.closest && tgt.closest('[data-list-del]');
      if (ld) { ev.stopPropagation(); listRemove(ld); }
    });
    root.addEventListener('input', (ev) => {
      if (ev.target && ev.target.id === 'sp-prio') prioCheck();
    });
    root.addEventListener('keydown', (ev) => {
      if (!ev.target || ev.target.id !== 'sp-prio') return;
      /* 占位符承诺了"回车添加"（原来回车什么都不做）；输入法组合中的回车不能当提交 */
      if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); prioAdd(); }
    });
  }

  function account(state) {
    const a = state.account;
    if (!a) return UI.state.empty();

    const sw = (mask, on, title, hint) => `<label class="sw">
      <input type="checkbox" data-sched="${esc(mask)}" ${on ? 'checked' : ''}>
      <span class="track"><span class="knob"></span></span>
      <span class="txt"><b>${esc(title)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    </label>`;

    const swAction = (o, title, hint) => (!o ? '' : `<label class="sw">
      <input type="checkbox" data-act="sponsor-set" data-url="${esc(o.action)}" ${o.on ? 'checked' : ''}>
      <span class="track"><span class="knob"></span></span>
      <span class="txt"><b>${esc(title)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    </label>`);

    const panel = (title, sub, body) => `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:0"><h2>${esc(title)}</h2>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div>
      <div class="pbody">${body}</div>
    </div>`;

    const sched = panel(t('account.scheduler'), '', `
      <p class="hint">${esc(t('account.schedulerHint'))}</p>
      ${sw('render_my_project_first', a.scheduler.mineFirst !== false, t('account.sched.mine'), t('account.sched.mineHint'))}
      ${sw('render_my_team_projects_first', a.scheduler.teamFirst === true, t('account.sched.team'), '')}
      ${sw('render_heavy_project', a.scheduler.heavyFirst === true, t('account.sched.heavy'), t('account.sched.heavyHint'))}`);

    const priority = panel(t('account.priority'), '', `
      <p class="hint">${esc(t('account.priorityHint'))}</p>
      ${prioList(a.priority)}
      <div class="addrow">
        <label class="input">${UI.icon('search')}
          <input id="sp-prio" type="text" autocomplete="off" spellcheck="false"
            placeholder="${esc(t('account.priorityAdd'))}" aria-describedby="sp-prio-msg">
        </label>
        <button class="btn primary" id="sp-prio-add" data-act="prio-add" data-input="sp-prio">${esc(t('account.add'))}</button>
      </div>
      <div class="hint" id="sp-prio-msg" role="status" style="margin:8px 0 0" hidden></div>`);

    /* 捐赠积分（站点叫 Sponsorship）：积分会给名单里的随机一位；地址全来自解析结果，拿不到就不画。 */
    const spon = a.sponsor || { give: null, receive: null, addUrl: '', list: [] };
    const sponsor = panel(t('account.sponsor'), t('account.sponsorSub'), `
      <p class="hint">${esc(t('account.sponsorHint'))}</p>
      ${spon.give || spon.receive
        ? swAction(spon.give, t('account.sponsor.give'), t('account.sponsor.giveHint'))
          + swAction(spon.receive, t('account.sponsor.receive'), t('account.sponsor.receiveHint'))
        : ''}
      <div class="phead" style="padding:18px 0 0"><h2>${esc(t('account.sponsorList'))}</h2></div>
      ${userList(spon.list, t('account.sponsorEmpty'), { requiresAction: true, list: 'sponsor' })}
      ${spon.addUrl ? `<div class="addrow">
        <label class="input">${UI.icon('search')}
          <input id="sp-sponsor" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.sponsorAdd'))}">
        </label>
        <button class="btn primary" data-act="sponsor-add" data-input="sp-sponsor" data-url="${esc(spon.addUrl)}">${esc(t('account.add'))}</button>
      </div>` : ''}`);

    const avatarBox = panel(t('account.avatar'), '', `
      <p class="hint">${esc(t('account.avatarHint'))}</p>
      <div class="avatarline">
        ${UI.avatar(a.avatar, state.userName || '', 'ini')}
        <div>
          <label class="filepick">${esc(t('account.avatarPick'))}<input type="file" id="sp-avatar" accept="image/*"></label>
          <div class="addrow"><button class="btn primary" data-act="avatar-save">${esc(t('account.avatarSave'))}</button></div>
        </div>
      </div>`);

    const emailBox = panel(t('account.email'), '', `
      <p class="hint">${esc(a.email || '—')}</p>
      <div class="addrow">
        <label class="input"><input id="sp-email" type="email" autocomplete="off" placeholder="${esc(t('account.emailNew'))}"></label>
        <button class="btn primary" data-act="email-save" data-input="sp-email">${esc(t('account.emailSave'))}</button>
      </div>`);

    const keys = panel(t('account.keys'), '', `
      <p class="hint">${esc(t('account.keysHint'))}</p>
      ${a.renderKeys.length ? `<div class="ulist" data-listbox="keys" data-empty="${esc(t('account.empty'))}">${a.renderKeys.map((k) => `<div class="keyrow">
          <span class="k num" title="${esc(k.key)}">${esc(k.key)}</span>
          <span class="c" title="${esc(k.comment)}">${esc(k.comment)}</span>
          <span class="use ${k.inUse ? 'on' : ''}">${esc(k.inUse ? t('account.keys.inUse') : t('account.keys.free'))}</span>
          <button class="btn sm" data-list-del="${esc(k.key)}" data-url="${esc(k.action)}" data-list="keys" data-confirm="${esc(t('account.keys.delConfirm'))}">${esc(t('account.keys.del'))}</button>
        </div>`).join('')}</div>` : `<div class="ulist" data-listbox="keys" data-empty="${esc(t('account.empty'))}"><div class="none">${esc(t('account.empty'))}</div></div>`}
      <div class="addrow">
        <label class="input"><input id="sp-keycomment" type="text" autocomplete="off" placeholder="${esc(t('account.keys.comment'))}"></label>
        <button class="btn primary" data-act="key-add" data-input="sp-keycomment">${esc(t('account.keys.add'))}</button>
      </div>`);

    const blacklist = panel(t('account.block.renderer'), '', `
      <p class="hint">${esc(t('account.block.rendererHint'))}</p>
      ${userList(a.blockedRenderers, t('account.empty'), { list: 'blockedRenderers' })}
      <div class="addrow">
        <label class="input"><input id="sp-block-renderer" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.block.add'))}"></label>
        <button class="btn primary" data-act="block-add" data-kind="renderer" data-input="sp-block-renderer">${esc(t('account.add'))}</button>
      </div>
      <div class="phead" style="padding:20px 0 0"><h2>${esc(t('account.block.owner'))}</h2></div>
      <p class="hint" style="margin-top:8px">${esc(t('account.block.ownerHint'))}</p>
      ${userList(a.blockedOwners, t('account.empty'), { list: 'blockedOwners' })}
      <div class="addrow">
        <label class="input"><input id="sp-block-owner" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.block.add'))}"></label>
        <button class="btn primary" data-act="block-add" data-kind="owner" data-input="sp-block-owner">${esc(t('account.add'))}</button>
      </div>`);

    const acctTabs = [['sched', t('account.tab.sched')],
      ['sponsor', t('account.tab.sponsor')], ['account', t('account.tab.account')]];
    const acctPanels = {
      sched: sched + priority + blacklist,
      sponsor,
      account: avatarBox + emailBox + keys,
    };
    const tab = acctPanels[acctState.tab] ? acctState.tab : 'sched';

    return `<div class="sechead"><h2>${esc(t('account.title'))}</h2></div>
      <div class="seg" id="sp-acct-tabs" role="tablist">${acctTabs.map(([k, label]) =>
        `<button data-tab="${k}" role="tab" aria-selected="${tab === k}" aria-pressed="${tab === k}">${esc(label)}</button>`).join('')}</div>
      <div class="acct">${acctPanels[tab]}</div>
      ${foot()}`;
  }

  function mount(root, state) {
    /* 上一屏的图表观察器/兜底 resize 监听先收掉：否则它挂在已摘除的节点上（单节点泄漏，
       切走再回来还可能对 0 宽节点重画）。 */
    if (SP.Charts && SP.Charts.dispose) SP.Charts.dispose();
    /* 账户设置：优先级名单就地增删的接线（装一次，事件委托挂在 #sp-body 上）。
       每次画完都同步一次输入框状态 —— 面板重建后按钮是新的，禁用与提示得按当前输入重算。 */
    if (root && root.querySelector('#sp-prio')) { prioWire(root); prioCheck(); }
    const box = root && root.querySelector('#sp-chart');
    const pts = state && state.profile && state.profile.points;
    if (box && pts && pts.length > 1) SP.Charts.points(box, pts);
    if (root) SP.UI.bindHeatTips(root.querySelector('.heatwrap'), I18n.lang);
    const menu = root && root.querySelector('#sp-omenu');
    const trigger = root && root.querySelector('[data-act="owner-menu"][aria-expanded="true"]');
    if (menu && trigger) {
      const host = document.getElementById('sp');
      const b = trigger.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const z = Util.zoomOf(host);   // 界面缩放的补偿：rect 是物理像素，left/top 是 CSS 像素
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      // 左缘对齐到**菜单按钮**（用户拍板），不往左倒挂；顶到视口右边界时整体左移。
      let left = (b.left - hr.left) / z;
      left = Math.max(8, Math.min(left, host.clientWidth - mw - 8));
      const below = b.bottom + (6 + mh) * z <= window.innerHeight;
      const top = below
        ? (b.bottom - hr.top) / z + host.scrollTop + 6
        : (b.top - hr.top) / z + host.scrollTop - mh - 6;
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
    }
  }

  /* 只注册本文件产出的：50/51/52/53 各自注册自己的。 */
  SP.Views = Object.assign(SP.Views || {}, { settings, account, mount, acctState });
})();
