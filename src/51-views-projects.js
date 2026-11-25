/* ==== 51-views-projects.js：项目列表 ====
   独立 IIFE：不再借用 50 的作用域。公共件从 45-view-kit 取，跨视图状态挂到 SP.Views。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  /* 重复注入（站点导航 / 同页再 eval 产物）时不要重建 projState：第二个实例会用默认排序
     覆盖 SP.Views，表头看起来像「记忆丢了」（用户实报：内存升序刷新后回退）。与 52 的 rankState 同规。 */
  if (SP.Views && SP.Views.projState) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow, packLabel, whyLabel , pageSize, sechead, emptyRow } = SP.VK;

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

  /* picked：「我发布的」勾选的项目 id（字符串数组，仅内存，不落盘）。
     刷新/换视图就没了 —— 选中集是"这一屏要删的一批"，不是用户偏好。
     confirm：批量删除两步确认的第一阶段（只由 80-app 改；渲染时据此决定批量条形态）。 */
  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null, scope: 'all', msort: '', picked: [], confirm: false };

  /* 排序偏好落盘（用户自定义）：点一次表头就是一次"记住这个默认"，刷新与换页后仍在。
     存的字段名认不出来（旧版本存过、或以后删了某列）就退回默认 —— 别把列表卡在一个
     不存在的排序上，那样表头不会有箭头、点哪列都不生效，看起来像坏了。 */
  const SESS_KEY = 'sheepit-plus:' + SORT_PREF;

  /* 站点偶尔会清 localStorage（站点自己的脚本会 clear），排序偏好跟着一起没。
     写两份：localStorage 正常路径，sessionStorage 兜底（同标签页刷新仍在）。 */
  function readSortPref() {
    const fromLocal = Util.store.get(SORT_PREF, null);
    if (fromLocal && typeof fromLocal === 'object') return fromLocal;
    try { return JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null'); } catch (e) { return null; }
  }

  function restoreSort() {
    const s = readSortPref();
    if (!s || typeof s !== 'object') return;
    if (P_SORTS[s.sort]) projState.sort = s.sort;
    if (M_SORTS[s.msort]) projState.msort = s.msort;
    if (s.dir === 'asc' || s.dir === 'desc') projState.dir = s.dir;
  }
  restoreSort();

  function saveSort() {
    const v = { sort: projState.sort, msort: projState.msort, dir: projState.dir };
    Util.store.set(SORT_PREF, v);
    try { sessionStorage.setItem(SESS_KEY, JSON.stringify(v)); } catch (e) { /* 隐私模式等 */ }
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

  /* ---- 「我发布的」那张表 ---- */

  /** 状态与名字的显示口径与 50 的总览小列表一致，但 51 是独立 IIFE、借不到那边的局部函数：
      不在这里定义，这张表只要有行就会 ReferenceError（空态不执行，所以一直没暴露）。 */
  const MY_KIND_KEY = {
    rendering: 'proj.status.rendering', waiting: 'proj.status.waiting',
    paused: 'proj.status.paused', finished: 'proj.status.finished',
  };
  /** 状态列只说状态：百分比归「进度」列（与全站表同构），两边都说一遍数字是重复信息。 */
  function myStatus(x) {
    const key = MY_KIND_KEY[x.statusKind];
    return key ? t(key) : (x.status || '—');
  }
  const myName = (x) => (x.id
    ? `<a href="/project/${esc(x.id)}" target="_self">${esc(x.name)}</a>`
    : `<span>${esc(x.name)}</span>`);

  /** 筛选档位：按钮与过滤判据共用一份，档位改了只改一处。 */
  const mineFilterOpts = () => [['all', t('proj.all')], ['rendering', t('proj.status.rendering')],
    ['waiting', t('proj.status.waiting')], ['finished', t('proj.status.finished')]];

  /** 「我发布的」**唯一**的搜索 + 筛选 + 排序实现：渲染与「全选」都走这里。
      两边各写一份的话，"全选选中了谁"和"屏幕上画了谁"迟早对不上 —— 而这是要删数据的操作。 */
  function mineRows(state) {
    const all = (state && state.myProjects) || [];
    const q = projState.q.trim().toLowerCase();
    let rows = all.filter((x) => !q || String(x.name || '').toLowerCase().includes(q));
    if (mineFilterOpts().some(([k]) => k === projState.filter) && projState.filter !== 'all') {
      rows = rows.filter((x) => x.statusKind === projState.filter);
    }

    /* 默认顺序 = 解析器给的（站点 id 倒序 ≈ 新建在前）；点了表头（或设置里选了）才按列排 */
    const cmp = sortCmp(M_SORTS, projState.msort);
    if (cmp) rows = rows.toSorted((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    return { all, rows };
  }

  /** 全选只覆盖**当前渲染出来的行**（slice(0, limit)）：没画在屏幕上的项目
      不能被"全选"带进删除名单。没有 id 的行不能删，直接不进名单。 */
  function mineVisibleIds(state) {
    return mineRows(state).rows.slice(0, projState.limit)
      .map((x) => (x && x.id ? String(x.id) : '')).filter(Boolean);
  }

  /** manage 页里的事实拼成一行副标题：计算方式 · RAM · 帧进度 · 自动删除日期。
      只拼存在的字段；没有 meta（没抓到 / 没权限）就整行不出 —— 不占位、不撑高行。
      站点只给英文日期字符串，I18n 没有对应格式化就原样显示，不编翻译。 */
  function mineMetaLine(p) {
    const m = p && p.meta;
    if (!m) return '';
    const cpu = t('proj.cpu');
    const gpu = t('proj.gpu');
    const compute = m.compute === 'both' ? `${cpu}+${gpu}` : m.compute === 'gpu' ? gpu : m.compute === 'cpu' ? cpu : '';
    const parts = [];
    if (compute) parts.push(compute);
    if (m.ram) parts.push(`${m.ram} RAM`);
    if (m.done !== null && m.done !== undefined && m.total) parts.push(`${m.done}/${m.total} ${t('proj.frameUnit')}`);
    if (m.autoDelete) parts.push(`${m.autoDelete} ${t('proj.del')}`);
    if (!parts.length) return '';
    const line = parts.join(' · ');
    return `<div class="pmeta" title="${esc(line)}">${esc(line)}</div>`;
  }

  /** 「我发布的」：只有个人主页那张表给得出的字段（名字 / 状态 / 百分比），
     设备、内存、发布者站点没给 —— 所以不复用全站那张七列表。
      五列：勾选 / 项目 / 状态 / 进度 / 操作；删除有行内与批量两条入口，都是两步确认。 */
  function mineProjects(state) {
    const { all, rows } = mineRows(state);
    const opts = mineFilterOpts();
    const shown = rows.slice(0, projState.limit);
    const picked = new Set(projState.picked || []);
    /* 没有 id 的行（别人的主页、解析失败）不能删：不画 checkbox，也不画行内删除按钮 */
    const idOf = (x) => (x && x.id ? String(x.id) : '');

    /* 排序入口必须是 <button>：只给 th 绑 click 时，键盘用户没有可达的激活点。
       aria-sort 放在 th 上（语义属于表头），按钮自己带一句可读的排序说明。 */
    const th = (key, label, cls) => {
      const on = projState.msort === key;
      const dir = on ? (projState.dir === 'asc' ? t('sort.asc') : t('sort.desc')) : t('sort.none');
      return `<th scope="col" class="sortable${cls ? ' ' + cls : ''}" data-msort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
        + `<button type="button" class="thbtn" aria-label="${esc(t('sort.title', { col: label, dir }))}">${esc(label)}`
        + `${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</button></th>`;
    };

    /* 空态两种，别混成一句「你还没有发布过项目」：
       ① 一个项目都没有 → 上传入口（accent 主按钮）；
       ② 有项目但搜索/筛选没匹配 → 「没有匹配的项目」+ 次级「清除筛选」；
          表头与表格框留着，否则整块消失会让人分不清"是筛没了"还是"真没有"。 */
    const emptyRow = all.length === 0
      ? `<tr><td colspan="5"><div class="state" style="padding:40px 12px">
            <div class="small">${esc(t('my.empty'))}</div>
            <a class="btn primary" href="/getstarted" target="_blank" rel="noopener" style="margin-top:12px">${esc(t('my.emptyCta'))}</a>
          </div></td></tr>`
      : `<tr><td colspan="5"><div class="state" style="padding:40px 12px">
            <div class="small">${esc(t('proj.empty'))}</div>
            <button class="btn" data-act="proj-clear-filters" style="margin-top:12px">${esc(t('proj.clearFilters'))}</button>
          </div></td></tr>`;

    const body = shown.map((x) => {
      const id = idOf(x);
      const on = !!id && picked.has(id);
      const pct = x.pct;
      return `<tr data-project="${esc(id)}"${on ? ' class="picked"' : ''}>
        <td class="c-pick">${id
    ? `<label class="pickbox"><input type="checkbox" data-pick="${esc(id)}" aria-label="${esc(t('proj.pick') + ' ' + x.name)}"${on ? ' checked' : ''}></label>`
    : ''}</td>
        <td><div class="pn">${myName(x)}</div>${mineMetaLine(x)}</td>
        <td class="c-status"><span class="st ${esc(x.statusKind)}">${esc(myStatus(x))}</span>
          ${x.blocked ? `<span class="st bad">${esc(t('proj.status.blocked'))}</span>` : ''}</td>
        <td class="c-prog">${pct === null || pct === undefined ? '<span class="st">—</span>'
    : `<div class="pwrap">${UI.progress(pct, `${pct}%`)}<span class="frac num">${pct}%</span></div>`}</td>
        <td class="c-act">${id
    ? `<a class="btn sm" href="/project/${esc(id)}" target="_self">${esc(t('my.open'))}</a>`
      + `<button class="btn sm" data-act="proj-del" data-id="${esc(id)}" data-name="${esc(x.name)}">${esc(t('proj.del'))}</button>`
    : '<span class="st">—</span>'}</td>
      </tr>`;
    }).join('') || emptyRow;

    /* 批量操作常驻在 sechead 右侧（不是表格上方另起一行）：未选中时它只是
       「匹配 n / 共 total」那段文字，选中后才长出按钮 —— 表头因此不会因为批量条出现/消失而上下跳。 */
    return `<div class="sechead"><h2>${esc(t('my.title'))}</h2>
        <span class="sub num">${esc(t('my.count', { n: all.length }))}</span>
        <span class="spacer"></span>
        <div class="bulkbar" id="sp-bulk">
          <span class="btext" role="status" aria-live="polite">${esc(t('proj.match', { n: rows.length, total: all.length }))}</span>
          <button class="btn sm" data-act="proj-del-picked" hidden>${esc(t('proj.delPicked'))}</button>
          <button class="btn sm" data-act="proj-picknone" hidden>${esc(t('proj.pickNone'))}</button>
          <button class="btn sm" data-act="proj-del-confirm" hidden>${esc(t('proj.delConfirmInline'))}</button>
          <button class="btn sm" data-act="proj-del-back" hidden>${esc(t('proj.back'))}</button>
          <button class="btn sm" data-act="proj-del-stop" hidden>${esc(t('proj.delStop'))}</button>
        </div></div>
      <div class="toolbar">
        ${scopeSeg()}
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.searchMine'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${opts.map(([k, label]) =>
    `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-mine">
          <colgroup>
            <col class="c-pick"><col><col class="c-status"><col class="c-prog"><col class="c-act">
          </colgroup>
          <thead><tr>
            <th scope="col" class="c-pick"><label class="pickbox"><input type="checkbox" id="sp-pickall" data-pickall="1" aria-label="${esc(t('proj.pickAll'))}"></label></th>
            ${th('name', t('proj.col.project'))}
            <th scope="col" class="c-status">${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'), 'c-prog')}
            <th scope="col" class="c-act">${esc(t('proj.col.manage'))}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>`;
  }

  function projects(state) {
    /* 每次渲染都以存储为准：实例被重建、或 localStorage 被站点清掉时，排序不会退回默认。 */
    restoreSort();
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
    rows = rows.toSorted((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));

    const th = (key, label, span) => {
      const on = projState.sort === key;
      const dir = on ? (projState.dir === 'asc' ? t('sort.asc') : t('sort.desc')) : t('sort.none');
      return `<th scope="col" class="sortable"${span ? ` colspan="${span}"` : ''} data-sort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
        + `<button type="button" class="thbtn" aria-label="${esc(t('sort.title', { col: label, dir }))}">${esc(label)}`
        + `${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</button></th>`;
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

    return farmRow + `${sechead({ title: esc(t('proj.title')), sub: esc(t('proj.count', { n: all.length })), right: `<span class="sub num">${esc(t('proj.match', { n: rows.length, total: all.length }))}</span>` })}
      <div class="toolbar">
        ${scopeSeg()}
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.search'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${filters.map(([k, label]) =>
          `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl fit">
          <colgroup>
            <col style="width:28%"><col style="width:19%"><col style="width:13%">
            <col style="width:19%"><col style="width:11%"><col style="width:10%">
          </colgroup>
          <thead><tr>
            ${th('name', t('proj.col.project'))}
            ${th('owner', t('proj.col.owner'))}
            <th scope="col">${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'))}
            <th scope="col">${esc(t('proj.col.device'))}</th>
            ${th('memory', t('proj.col.memory'))}
          </tr></thead>
          <tbody>${rows.slice(0, projState.limit).map((p) => projectRow(p, state.userName, maps)).join('')
            || emptyRow(6, esc(t('proj.empty')), '40px 12px')}</tbody>
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
    mineRows, mineVisibleIds,
  });
})();