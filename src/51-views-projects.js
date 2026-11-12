/* ==== 51-views-projects.js：项目列表 ====
   独立 IIFE：不再借用 50 的作用域。公共件从 45-view-kit 取，跨视图状态挂到 SP.Views。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow, packLabel, whyLabel , pageSize } = SP.VK;

  /* ==== 项目 ==== */

  /* 可排序列的注册表：字段 → { 表头词条, 取值 }。
     表头词条复用既有的 `proj.col.*`，所以加一列排序**不需要新文案**；取值一律用站点给的
     原始数值（memKb / pct），不用 "1.3 G" 这种显示文本 —— 否则按字面量排。
     「我发布的」那张表站点只给得出名字与百分比，所以它有一份自己的注册表。 */
  const P_SORTS = {
    name: { label: 'proj.col.project', get: (p) => p.name, text: true },
    owner: { label: 'proj.col.owner', get: (p) => p.owner, text: true },
    progress: { label: 'proj.col.progress', get: (p) => p.pct || 0 },
    memory: { label: 'proj.col.memory', get: (p) => p.memKb || 0 },
  };
  const M_SORTS = {
    name: { label: 'proj.col.project', get: (x) => x.name, text: true },
    /* 站点对"没给百分比"的行就是不排进度，摆到最小那一头，别当成 0% 混进去 */
    progress: { label: 'proj.col.progress', get: (x) => (x.pct === null || x.pct === undefined ? -1 : x.pct) },
  };
  const SORT_PREF = 'projSort';

  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null, scope: 'all', msort: '' };

  /* 排序偏好落盘（用户自定义）：点一次表头就是一次"记住这个默认"，刷新与换页后仍在。
     存的字段名认不出来（旧版本存过、或以后删了某列）就退回默认 —— 别把列表卡在一个
     不存在的排序上，那样表头不会有箭头、点哪列都不生效，看起来像坏了。 */
  (function restoreSort() {
    const s = Util.store.get(SORT_PREF, null);
    if (!s || typeof s !== 'object') return;
    if (P_SORTS[s.sort]) projState.sort = s.sort;
    if (M_SORTS[s.msort]) projState.msort = s.msort;
    if (s.dir === 'asc' || s.dir === 'desc') projState.dir = s.dir;
  })();

  function saveSort() {
    Util.store.set(SORT_PREF, { sort: projState.sort, msort: projState.msort, dir: projState.dir });
  }

  /** 设置页改默认排序。主列表一定跟着改；「我发布的」那张表站点只给得出名字与进度，
      选到它排不了的列（发布者 / 内存）就**不动它自己那份偏好**，不硬塞一个无效字段。 */
  function setSortPref(key) {
    if (!P_SORTS[key] || projState.sort === key) return false;
    projState.sort = key;
    if (M_SORTS[key]) projState.msort = key;
    saveSort();
    return true;
  }

  function setDirPref(dir) {
    if (dir !== 'asc' && dir !== 'desc') return false;
    if (projState.dir === dir) return false;
    projState.dir = dir;
    saveSort();
    return true;
  }

  /** 比较器：文本 localeCompare、数值相减；升降方向由调用处统一翻，注册表里不写两遍 */
  function sortCmp(spec, key) {
    const s = spec[key];
    if (!s) return null;
    return s.text
      ? (a, b) => String(s.get(a) || '').localeCompare(String(s.get(b) || ''))
      : (a, b) => s.get(a) - s.get(b);
  }


  function statusLabel(p) {
    if (p.statusKind === 'rendering') {
      return p.statusCount != null ? t('proj.status.renderingN', { n: p.statusCount }) : t('proj.status.rendering');
    }
    if (p.statusKind === 'waiting') return t('proj.status.waiting');
    if (p.statusKind === 'paused') return t('proj.status.paused');
    if (p.statusKind === 'finished') return t('proj.status.finished');
    return p.status || '—';
  }

  function ownerActions(p, maps) {
    const id = p.ownerId || p.owner;
    if (!maps || !id) return null;
    const prio = maps.prio.get(id) || null;
    const spon = maps.sponsor.get(id) || null;
    const blocked = maps.blocked.get(id) || null;
    return {
      prio: {
        on: !!prio,
        url: prio ? (prio.action || `/user/priority/remove/${encodeURIComponent(id)}`)
          : (maps.add.priority ? maps.add.priority + encodeURIComponent(id) : `/user/priority/add/${encodeURIComponent(id)}`),
      },
      gift: { on: !!spon, url: spon ? spon.action : (maps.add.sponsor ? maps.add.sponsor + encodeURIComponent(id) : '') },
      block: { on: !!blocked, url: blocked ? blocked.action : (maps.add.blockOwner ? maps.add.blockOwner + encodeURIComponent(id) : '') },
    };
  }

  function ownerCell(p, me, maps) {
    const isMe = me && p.owner === me;
    const id = p.ownerId || p.owner;
    const act = isMe ? null : ownerActions(p, maps);
    const mark = (kind, icon, label) =>
      `<span class="mk mk-${kind}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${UI.icon(icon)}</span>`;
    const marks = !act ? '' : (act.prio.on ? mark('prio', 'star', t('proj.prio.inList')) : '')
      + (act.gift.on ? mark('gift', 'heart', t('proj.menu.gifted')) : '')
      + (act.block.on ? mark('block', 'ban', t('proj.menu.blocked')) : '');
    // 主页地址优先用 URL 里的用户名（parseProjects 从 <a> href 读的），读不到才回落显示名。
    const href = id ? `/user/${encodeURIComponent(id)}/profile` : '';
    const canMenu = !!(act && (act.prio.url || act.gift.url || act.block.url));
    const open = canMenu && projState.menu === p.id;
    return `<div class="ow">${UI.avatar(p.ownerAvatar, p.owner, 'ini')}
      ${href
        ? `<a class="nm" href="${esc(href)}" target="_self" title="${esc(p.owner)}">${esc(p.owner)}</a>`
        : `<span title="${esc(p.owner)}">${esc(p.owner)}</span>`}${isMe ? ` <em>${esc(t('rank.you'))}</em>` : ''}${marks}${canMenu
      ? `<button class="btn sm kebab" data-act="owner-menu" data-id="${esc(p.id)}" ` +
        `aria-haspopup="menu" aria-expanded="${open ? 'true' : 'false'}" ` +
        `title="${esc(t('proj.menu.open'))}" aria-label="${esc(t('proj.menu.open'))}">${UI.icon('more')}</button>`
      : ''}</div>`;
  }

  function ownerMenu(p, me, maps) {
    const act = me && p.owner === me ? null : ownerActions(p, maps);
    if (!act) return '';
    const item = (kind, url, on, onLabel, offLabel, icon) => (!url ? '' : `<button class="mi" role="menuitem" data-act="${kind}" data-url="${esc(url)}">
        <span class="mi-ic">${UI.icon(icon)}</span><span class="mi-tx">${esc(on ? onLabel : offLabel)}</span>
        <span class="mi-ck">${on ? UI.icon('check') : ''}</span>
      </button>`);
    const rows = [
      item('prio-set', act.prio.url, act.prio.on, t('proj.menu.unprio'), t('proj.menu.prio'), 'star'),
      item('owner-gift', act.gift.url, act.gift.on, t('proj.menu.ungift'), t('proj.menu.gift'), 'heart'),
      item('owner-block', act.block.url, act.block.on, t('proj.menu.unblock'), t('proj.menu.block'), 'ban'),
    ].filter(Boolean);
    if (!rows.length) return '';
    return `<div class="omenu" id="sp-omenu" role="menu" aria-label="${esc(t('proj.menu.title'))}">
      <div class="mh">${esc(t('proj.menu.title'))}</div>
      ${rows.join('')}
    </div>`;
  }

  function listsOf(state) {
    return state.account
      ? {
        prio: new Map((state.account.priority || []).map((x) => [x.name, x])),
        sponsor: new Map(((state.account.sponsor && state.account.sponsor.list) || []).map((x) => [x.name, x])),
        blocked: new Map((state.account.blockedOwners || []).map((x) => [x.name, x])),
        add: state.account.add || {},
      }
      : null;
  }

  /** 进度：条子与分数**同一格**（用户 2026-10-07）。
      合成一格后条子 `flex:1` 吃满剩余宽度，和数字之间只隔一个 10px 的 gap。 */
  const pcell = (pct, frac, title) => `<td><div class="pwrap">${UI.progress(pct, frac)}`
    + `<span class="frac num"${title ? ` title="${esc(title)}"` : ''}>${esc(frac)}</span></div></td>`;

  function projectRow(p, me, maps) {
    const frac = UI.progressText(p.pct, p.done, p.total);
    return `<tr data-project="${esc(p.id)}">
      <td><div class="pn" title="${esc(p.name)}">${esc(p.name)}</div></td>
      <td>${ownerCell(p, me, maps)}</td>
      <td><span class="st ${p.statusKind}" title="${esc(statusLabel(p))}">${esc(statusLabel(p))}</span></td>
      ${pcell(p.pct, frac, frac)}
      <td>${UI.devices(p.cpu, p.gpu)}</td>
      <td class="r num" title="${esc(p.memory || '—')}">${esc(p.memory || '—')}</td>
    </tr>`;
  }

  /** 范围切换（全部 / 我发布的）：两档共用同一只控件，位置也一样。 */
  const scopeSeg = () => `<div class="seg" id="sp-scope">${[['all', t('proj.scope.all')], ['mine', t('proj.scope.mine')]]
    .map(([k, label]) => `<button data-s="${k}" aria-pressed="${projState.scope === k}">${esc(label)}</button>`).join('')}</div>`;

  /** 「我发布的」：只有个人主页那张表给得出的字段（名字 / 状态 / 百分比），
     设备、内存、发布者站点没给 —— 所以不复用全站那张七列表，只画四列。 */
  function mineProjects(state) {
    const all = state.myProjects || [];
    const q = projState.q.trim().toLowerCase();
    const opts = [['all', t('proj.all')], ['rendering', t('proj.status.rendering')],
      ['waiting', t('proj.status.waiting')], ['finished', t('proj.status.finished')]];
    let rows = all.filter((x) => !q || x.name.toLowerCase().includes(q));
    if (opts.some(([k]) => k === projState.filter) && projState.filter !== 'all') {
      rows = rows.filter((x) => x.statusKind === projState.filter);
    }

    /* 默认顺序 = 解析器给的（站点 id 倒序 ≈ 新建在前）；点了表头（或设置里选了）才按列排 */
    const cmp = sortCmp(M_SORTS, projState.msort);
    if (cmp) rows = rows.slice().sort((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));

    const th = (key, label, span) => {
      const on = projState.msort === key;
      return `<th class="sortable"${span ? ` colspan="${span}"` : ''} data-msort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(label)}${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</th>`;
    };

    const body = rows.slice(0, projState.limit).map((x) => `<tr data-project="${esc(x.id)}">
        <td><div class="pn">${myName(x)}</div></td>
        <td><span class="st ${esc(x.statusKind)}">${esc(myStatus(x))}</span>
          ${x.blocked ? `<span class="st bad">${esc(t('proj.status.blocked'))}</span>` : ''}</td>
        <td>${x.pct === null || x.pct === undefined ? '<span class="st">—</span>' : UI.progress(x.pct, `${x.pct}%`)}</td>
        <td class="r">${x.id
    ? `<a class="btn sm" href="/project/${esc(x.id)}" target="_self">${esc(t('my.open'))}</a>`
    : '<span class="st">—</span>'}</td>
      </tr>`).join('')
      || `<tr><td colspan="4"><div class="state" style="padding:40px 12px">
            <div class="small">${esc(t('my.empty'))}</div>
            <a class="btn primary" href="/getstarted" target="_blank" rel="noopener" style="margin-top:12px">${esc(t('my.emptyCta'))}</a>
          </div></td></tr>`;

    return `<div class="sechead"><h2>${esc(t('my.title'))}</h2>
        <span class="sub num">${esc(t('my.count', { n: all.length }))}</span>
        <span class="spacer"></span>
        <span class="sub">${esc(t('proj.showing', { n: rows.length, total: all.length }))}</span></div>
      <div class="toolbar">
        ${scopeSeg()}
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.searchMine'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${opts.map(([k, label]) =>
    `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl tbl-mine">
          <thead><tr>
            ${th('name', t('proj.col.project'))}
            <th>${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'))}
            <th class="r">${esc(t('proj.col.manage'))}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>`;
  }

  function projects(state) {
    if (projState.scope === 'mine') return mineProjects(state);
    const all = state.projects || [];
    if (!all.length) return UI.state.empty();

    const q = projState.q.trim().toLowerCase();
    let rows = all.filter((p) => {
      if (q && !(`${p.name} ${p.owner}`.toLowerCase().includes(q))) return false;
      if (projState.filter === 'all') return true;
      if (projState.filter === 'cpu') return p.cpu;
      if (projState.filter === 'gpu') return p.gpu;
      return p.statusKind === projState.filter;
    });

    /* 排序字段来自注册表（设置页可选、表头可点，两处都落盘）；认不出来的字段退回进度 */
    const cmp = sortCmp(P_SORTS, projState.sort) || sortCmp(P_SORTS, 'progress');
    rows = rows.slice().sort((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));

    const th = (key, label, span) => {
      const on = projState.sort === key;
      return `<th class="sortable"${span ? ` colspan="${span}"` : ''} data-sort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(label)}${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</th>`;
    };

    const maps = listsOf(state);
    const prio = maps ? maps.prio : null;

    const filters = [
      ['all', t('proj.all')],
      ['rendering', t('proj.status.rendering')],
      ['waiting', t('proj.status.waiting')],
      ['gpu', t('proj.gpu')],
      ['cpu', t('proj.cpu')],
    ];

    const farmRow = state.home && state.home.stats && state.home.stats.length ? UI.farm(state.home.stats, { flush: true }) : '';

    const openP = projState.menu ? all.find((p) => p.id === projState.menu) : null;
    const menuHtml = openP ? ownerMenu(openP, state.userName, maps) : '';

    return farmRow + `<div class="sechead"><h2>${esc(t('proj.title'))}</h2>
        <span class="sub">${esc(t('proj.count', { n: all.length }))}</span>
        <span class="spacer"></span>
        <span class="sub num">${esc(t('proj.showing', { n: rows.length, total: all.length }))}</span></div>
      <div class="toolbar">
        ${scopeSeg()}
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.search'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${filters.map(([k, label]) =>
          `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl fit">
          <colgroup>
            <col style="width:28%"><col style="width:19%"><col style="width:13%">
            <col style="width:19%"><col style="width:11%"><col style="width:10%">
          </colgroup>
          <thead><tr>
            ${th('name', t('proj.col.project'))}
            ${th('owner', t('proj.col.owner'))}
            <th>${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'))}
            <th>${esc(t('proj.col.device'))}</th>
            ${th('memory', t('proj.col.memory'))}
          </tr></thead>
          <tbody>${rows.slice(0, projState.limit).map((p) => projectRow(p, state.userName, maps)).join('')
            || `<tr><td colspan="6"><div class="state" style="padding:40px 12px"><div class="small">${esc(t('proj.empty'))}</div></div></td></tr>`}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>
      ${menuHtml}`;
  }

  /* ==== 挂载后补丁：只有总览的积分曲线需要真实像素宽度 ==== */
  
  /* 注册：52/54 与 80-app 通过 SP.Views 拿这些（不再靠共享作用域）。 */
  SP.Views = SP.Views || {};
  Object.assign(SP.Views, {
    projects, projState, P_SORTS, M_SORTS,
    saveSort, setSortPref, setDirPref, sortCmp,
    moreRow, statusLabel, ownerActions, ownerCell, ownerMenu, listsOf, pcell, projectRow, scopeSeg, mineProjects,
  });
})();
