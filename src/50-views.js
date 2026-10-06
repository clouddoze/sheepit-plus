/* ==== 50-views.js：视图层（六个视图 + 上传卡片 + 分析等待页） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');

  const foot = () => `<div class="foot">${esc(t('footer.source'))}</div>`;

  /* line_frames_timeline 是站点内联的**累积**帧数曲线，按阶梯函数差分才是逐日帧数（原站热力图只记
     "当天有没有渲染"，count 恒为 1）；先判单调，站点改成逐日值就直接用，绝不硬差出负数。 */
  function dailySeries(cum) {
    const rows = (cum || []).filter((p) => p && p.d && Number.isFinite(p.v)).slice()
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    if (rows.length < 2) return [];

    const monotonic = rows.every((p, i) => i === 0 || p.v >= rows[i - 1].v);
    if (!monotonic) return rows.map((p) => ({ d: p.d, v: Math.max(0, p.v) }));

    const at = new Map(rows.map((p) => [p.d, p.v]));
    const out = [];
    let prev = null;
    for (let d = rows[0].d, guard = 0; d <= rows[rows.length - 1].d && guard < 20000; d = Util.dshift(d, 1), guard++) {
      const v = at.has(d) ? at.get(d) : prev;   // 阶梯函数：没采样点的日子沿用上一次的值
      if (prev !== null) out.push({ d, v: Math.max(0, v - prev) });
      prev = v;
    }
    return out;
  }

  function statOf(st, names) {
    for (const n of names) if (st[n] !== undefined && st[n] !== '') return st[n];
    return '';
  }

  /* "42" / "20,062" / "1h 20m" → 数字；空/认不出 → 0。只用来判断"有没有真实数字"。 */
  const asCount = (v) => Number(String(v === null || v === undefined ? '' : v).replace(/[^\d.]/g, '')) || 0;

  const rankOf = (st) => {
    const raw = statOf(st, ['Rank']);
    const digits = String(raw).replace(/[^\d]/g, '');
    return digits || '';
  };

  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

  function isoDate(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    let m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
    if (m) {
      const mo = MONTHS[m[1].toLowerCase()];
      if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
    }
    m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    if (/^\d{4}$/.test(s)) return s;
    return s;
  }

  function packLabel(prefix, raw, upper) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const key = `${prefix}.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const hit = t(key);
    if (hit !== key) return hit;
    return upper ? s.toUpperCase() : s;
  }

  /* 站点给的原因里有的带数字（内存那句每次都不一样），slug 查不到 → 先用规则匹配。
     与下面的 STATUS_RULES 同一套做法；英文词典里没有 why.* 条目，所以没命中要回落原句。 */
  const WHY_RULES = [
    [/^not enough free memory,\s*requiring:\s*(.+?),\s*available:\s*(.+)$/i, (m) => {
      const key = 'why.notEnoughMemory';
      const hit = t(key, { need: m[1].trim(), have: m[2].trim() });
      return hit === key ? m[0] : hit;
    }],
  ];
  function whyLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    for (const [re, fn] of WHY_RULES) { const m = s.match(re); if (m) return fn(m); }
    return packLabel('why', s);
  }

  const STATUS_RULES = [
    [/^waiting to render/i, () => t('status.idle')],
    [/^rendering for\s+(.+)$/i, (m) => t('status.renderingFor', { user: m[1] })],
    [/^rendering\b/i, () => t('status.rendering')],
    [/^(disconnected|not connected|offline)/i, () => t('status.disconnected')],
  ];
  function statusText(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    for (const [re, fn] of STATUS_RULES) {
      const m = s.match(re);
      if (m) return fn(m);
    }
    return s;
  }

  /* ==== 总览 ==== */

  function identity(p, st) {
    const rank = rankOf(st);
    const badge = packLabel('badge', p.badge, true);
    const team = statOf(st, ['Team']).trim().toUpperCase();
    const joined = isoDate(statOf(st, ['Registration']));
    const status = statusText(p.status);
    const bits = [];
    if (rank) bits.push(`<span><b class="num">#${esc(rank)}</b> ${esc(t('hero.rank'))}</span>`);
    if (badge) bits.push(`<span><b>${esc(badge)}</b></span>`);
    if (team) bits.push(`<span><b>${esc(team)}</b> ${esc(t('hero.team'))}</span>`);
    if (joined) bits.push(`<span>${esc(t('hero.joined'))} <b class="num">${esc(joined)}</b></span>`);
    if (status) bits.push(`<span title="${esc(t('hero.statusRaw', { raw: p.status }))}">${esc(status)}</span>`);

    return `<div class="identity">
      ${UI.avatar(p.avatar, p.name, 'av')}
      <h1>${esc(p.name)}</h1>
      ${bits.length ? `<div class="meta">${bits.join('')}</div>` : ''}
    </div>`;
  }

  function overview(state) {
    const p = state.profile;
    const home = state.home;
    if (!p) return UI.state.error('profile parse failed');

    const st = p.stats || {};
    const d = p.derived || {};
    const daily = dailySeries(p.frames);
    const hasCalendar = daily.length > 0 || !!(p.activity && p.activity.length > 0);
    /* 新账号站点常常"只给统计表、不给图表数组"（line_*_timeline 与热力图整段不渲染）。
       数字是真的（Frames rendered 148 / Points 20,062），所以判据不能只看图表：
       统计表里任何一个数 > 0、或者有在线机器/历史会话，都算"有记录"（用户实报：总览说"还没有渲染记录"）。 */
    const hasStat = asCount(statOf(st, ['Frames rendered'])) > 0
      || asCount(statOf(st, ['Points'])) > 0
      || asCount(statOf(st, ['Time rendered'])) > 0;
    const hasData = (p.points && p.points.length > 1) || hasCalendar || hasStat
      || (p.machines && p.machines.count > 0) || (p.sessions && p.sessions.length > 0);

    if (!hasData) {
      // 统计读到了但确实一帧都没有 → 新用户空状态，不摆一排 0；连统计都读不到是解析失败，如实说无数据。
      const parsed = Object.keys(st).length > 0;
      return identity(p, st) + (parsed ? UI.newUser() : UI.state.empty()) + foot();
    }

    /* ---- 指标带 ---- */
    const total = daily.reduce((a, b) => a + b.v, 0);
    const avg = daily.length ? Math.round(total / daily.length) : null;
    const peak = daily.length ? daily.reduce((a, b) => Math.max(a, b.v), 0) : null;
    const rank = rankOf(st);
    const rawTime = statOf(st, ['Time rendered']);
    const days = Util.durDays(rawTime);
    const frames = statOf(st, ['Frames rendered']);
    const points = statOf(st, ['Points']);
    const created = statOf(st, ['Projects created']);
    const ordered = statOf(st, ['Frames ordered']);

    const kpiItems = [
      {
        k: t('stat.frames'),
        v: frames ? Util.statNum(frames) : '—',
        d: avg !== null && peak !== null
          ? t('stat.avgPeak', { avg: `<b class="num">${fmt(avg)}</b>`, peak: `<span class="num">${fmt(peak)}</span>` })
          : '',
      },
      {
        k: t('stat.points'),
        v: points ? Util.statNum(points) : '—',
        d: rank ? t('stat.rankWindow', { rank: `<span class="num">${esc(rank)}</span>` }) : '',
      },
      { k: t('stat.time'), v: Util.renderTime(rawTime), d: days ? t('stat.daysEquiv', { days: fmt(days) }) : '' },
      /* 连续天数是从产出日历算出来的：站点没给日历就整格不画（否则会给新账号摆一个"连续 0 天"） */
      ...(hasCalendar ? [{
        k: t('stat.streak'),
        v: d.streakExclToday !== undefined ? `${fmt(d.streakExclToday)} ${t('stat.days')}` : '—',
        d: d.best !== undefined
          ? t(d.active30 === 30 ? 'stat.streakFull' : 'stat.streakHint', { best: fmt(d.best), d30: fmt(d.active30 || 0) })
          : '',
      }] : []),
      ...(asCount(created) > 0
        ? [{ k: t('stat.created'), v: Util.statNum(created), d: t('stat.createdHint') }] : []),
      ...(asCount(ordered) > 0
        ? [{ k: t('stat.ordered'), v: Util.statNum(ordered), d: t('stat.orderedHint') }] : []),
    ];
    // 格数变了，栅格与分隔线要跟着重排（见 30-style.js 的 .kpis[data-n]）
    const kpiBand = UI.kpis(kpiItems);

    /* ---- 8/4 主区：积分增长 + 月度产出 ----
       只有**自己的主页**内联这两块；没有数据源就整块不画（不摆"暂无数据"），只剩一块时铺满整行。 */
    const hasPoints = !!(p.points && p.points.length > 1);
    const first = p.points[0], last = p.points[p.points.length - 1];
    const chartSub = t('chart.pointsSub', {
      n: p.points.length, from: first ? first.d : '—', to: last ? last.d : '—',
      now: last ? Util.num(last.v) : '—',
    });
    const mo = UI.months(daily);
    const pointsPanel = !hasPoints ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('chart.points'))}</h2><span class="sub num">${esc(chartSub)}</span></div>
        <div class="chart" id="sp-chart"><div class="tip" id="sp-tip"></div></div>
      </div>`;
    const monthsPanel = !mo.html ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('months.title'))}</h2><span class="sub">${esc(t('months.sub'))}</span></div>
        <div class="produce">${mo.html}</div>
      </div>`;
    const main = pointsPanel && monthsPanel
      ? `<div class="grid">${pointsPanel}${monthsPanel}</div>`
      : pointsPanel + monthsPanel;

    const actDaily = (p.activity || []).map((x) => ({ d: x.d, v: Number(x.c) || 1 }));
    const byFrames = daily.length > 0;
    const heatDaily = byFrames ? daily : actDaily;
    const hm = UI.heatmap(heatDaily, 53, I18n.lang, { unit: byFrames ? 'frames' : 'days' });
    const heat = `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:16px">
        <h2>${esc(t('heat.title'))}</h2>
        <span class="sub">${esc(byFrames ? t('heat.sub') : t('heat.subDays'))}</span>
        <span class="spacer"></span>
        <span class="sub num">${esc(hm.note)}</span>
      </div>
      ${heatDaily.length
        ? `<div class="produce" style="padding-top:0">${hm.html}</div>`
        : `<div class="produce" style="padding-top:0">${UI.state.empty(t('heat.none'))}</div>`}
    </div>`;

    /* ---- 已连接的机器（只放自己的机器；全站实时在项目页顶部） ---- */
    const mc = p.machines || { count: 0, list: [] };
    const machinesPanel = `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('machines.title'))}</h2>
        <span class="sub num">${esc(t('machines.count', { n: mc.count || 0 }))}</span>
      </div>
      ${UI.machines(mc)}
    </div>`;

    return identity(p, st)
      + kpiBand
      + main
      + heat
      + machinesPanel
      + foot();
  }

  /* ==== 项目 ==== */

  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null };
  const rankState = { limit: 100 };
  const acctState = { tab: 'sched' };

  function moreRow(shown, total, step) {
    if (shown >= total) return '';
    return `<div class="more">
      <button class="btn" id="sp-more" data-step="${step}">${esc(t('list.more'))}
        <span class="num">${esc(t('list.shown', { n: shown, total }))}</span></button>
    </div>`;
  }

  function statusLabel(p) {
    if (p.statusKind === 'rendering') {
      return p.statusCount != null ? t('proj.status.renderingN', { n: p.statusCount }) : t('proj.status.rendering');
    }
    if (p.statusKind === 'waiting') return t('proj.status.waiting');
    if (p.statusKind === 'paused') return t('proj.status.paused');
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

  function projectRow(p, me, maps) {
    const frac = UI.progressText(p.pct, p.done, p.total);
    return `<tr data-project="${esc(p.id)}">
      <td><div class="pn" title="${esc(p.name)}">${esc(p.name)}</div></td>
      <td>${ownerCell(p, me, maps)}</td>
      <td><span class="st ${p.statusKind}">${esc(statusLabel(p))}</span></td>
      <td>${UI.progress(p.pct, frac)}</td>
      <td class="r num frac">${esc(frac)}</td>
      <td>${UI.devices(p.cpu, p.gpu)}</td>
      <td class="r num">${esc(p.memory || '—')}</td>
    </tr>`;
  }

  function projects(state) {
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

    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name),
      owner: (a, b) => a.owner.localeCompare(b.owner),
      progress: (a, b) => (a.pct || 0) - (b.pct || 0),
      memory: (a, b) => (a.memKb || 0) - (b.memKb || 0),
    }[projState.sort] || ((a, b) => (a.pct || 0) - (b.pct || 0));
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
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.search'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${filters.map(([k, label]) =>
          `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl">
          <thead><tr>
            ${th('name', t('proj.col.project'))}
            ${th('owner', t('proj.col.owner'))}
            <th>${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'), 2)}
            <th>${esc(t('proj.col.device'))}</th>
            ${th('memory', t('proj.col.memory'))}
          </tr></thead>
          <tbody>${rows.slice(0, projState.limit).map((p) => projectRow(p, state.userName, maps)).join('')
            || `<tr><td colspan="7"><div class="state" style="padding:40px 12px"><div class="small">${esc(t('proj.empty'))}</div></div></td></tr>`}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>
      ${menuHtml}`;
  }

  /* ==== 排行榜 ==== */

  function ranking(state) {
    const rows = state.ranking || [];
    if (!rows.length) return UI.state.empty();
    const me = state.userName;
    const body = rows.slice(0, rankState.limit).map((r) => {
      const isMe = me && r.user === me;
      return `<tr class="${isMe ? 'me' : ''}">
        <td class="rankcell tight">${esc(r.rank)}</td>
        <td><div class="ow">${UI.avatar(r.avatar, r.user, 'ini')}
          ${r.user || r.userId
            ? `<a class="nm" href="/user/${encodeURIComponent(r.userId || r.user)}/profile" target="_self" title="${esc(r.user)}">${esc(r.user || r.userId)}</a>`
            : ''}${isMe ? ` <em>${esc(t('rank.you'))}</em>` : ''}</div></td>
        <td class="r num">${esc(Util.num(r.frames))}</td>
        <td class="r num">${esc(Util.duration(r.seconds))}</td>
        <td class="r num">${esc(Util.num(Math.round(r.points)))}</td>
      </tr>`;
    }).join('');

    return `<div class="sechead"><h2>${esc(t('rank.title'))}</h2>
        <span class="sub">${esc(t('rank.sub'))}</span>
        <span class="spacer"></span>
        <span class="sub num">${esc(t('rank.count', { n: rows.length }))}</span></div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl">
          <thead><tr>
            <th class="tight">${esc(t('rank.col.rank'))}</th><th>${esc(t('rank.col.user'))}</th>
            <th class="r">${esc(t('rank.col.frames'))}</th><th class="r">${esc(t('rank.col.time'))}</th>
            <th class="r">${esc(t('rank.col.points'))}</th>
          </tr></thead><tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, rankState.limit), rows.length, 100)}
      </div>`;
  }

  /* ==== 设置 ==== */

  function settings(state) {
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, label]) =>
      `<button data-v="${v}" aria-pressed="${String(cur) === v}">${esc(label)}</button>`).join('')}</div>`;

    const langOpts = [['auto', t('set.lang.auto')]]
      .concat(I18n.available().map((l) => [l.code, l.label]));
    const cov = I18n.coverage();
    const covTotal = cov ? cov.entries + cov.blocks + cov.patterns : 0;

    return `<div class="sechead"><h2>${esc(t('set.title'))}</h2></div>
      <div class="panel settings">
        <div class="row"><div class="lbl">${esc(t('set.theme'))}</div>
          ${seg('sp-theme', state.themePref, [['auto', t('set.theme.auto')], ['dark', t('set.theme.dark')], ['light', t('set.theme.light')]])}</div>

        <div class="row block">
          <div class="lbl">${esc(t('set.scale'))}</div>
          ${seg('sp-scale', String(state.uiScale), [['0.9', '90%'], ['1', '100%'], ['1.1', '110%'], ['1.25', '125%'], ['1.4', '140%']])}
          <div class="hint">${esc(t('set.scaleHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.lang'))}</div>
          ${seg('sp-lang', state.langPref, langOpts)}
          <div class="hint">${esc(t('set.langHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.translate'))}</div>
          ${seg('sp-translate', state.translateSite ? 'on' : 'off', [['on', t('set.on')], ['off', t('set.off')]])}
          <div class="hint">${esc(t('set.translateHint', { n: covTotal }))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.exp'))}</div>
          <div class="hint" style="margin-top:0"><b>${esc(t('set.upmode'))}</b></div>
          ${seg('sp-upmode', state.uploadMode, [['off', t('set.upmode.off')], ['raw', t('set.upmode.raw')], ['compat', t('set.upmode.compat')], ['new', t('set.upmode.new')]])}
          <div class="hint">${esc(t('set.upmodeHint'))}</div>
          ${(state.uploadMode === 'new' && SP.Step3x ? SP.Step3x.fpRows() : (SP.Step3 ? SP.Step3.fpRows() : ''))}
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
    if (!items || !items.length) return `<div class="ulist"><div class="none">${esc(emptyText)}</div></div>`;
    const needAction = !!(opts && opts.requiresAction);
    return `<div class="ulist">${items.map((u) => `<div class="u">
        ${UI.avatar(u.avatar, u.name, 'ini')}
        <span class="n"><a href="/user/${encodeURIComponent(u.name)}/profile" target="_self">${esc(u.name)}</a></span>
        ${u.action || !needAction ? `<button class="btn sm" data-del="${esc(u.action)}">${esc(t('account.remove'))}</button>` : ''}
      </div>`).join('')}</div>`;
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
      ${userList(a.priority, t('account.empty'))}
      <div class="addrow">
        <label class="input">${UI.icon('search')}
          <input id="sp-prio" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.priorityAdd'))}">
        </label>
        <button class="btn primary" data-act="prio-add" data-input="sp-prio">${esc(t('account.add'))}</button>
      </div>`);

    /* 捐赠积分（站点叫 Sponsorship）：积分会给名单里的随机一位；地址全来自解析结果，拿不到就不画。 */
    const spon = a.sponsor || { give: null, receive: null, addUrl: '', list: [] };
    const sponsor = panel(t('account.sponsor'), t('account.sponsorSub'), `
      <p class="hint">${esc(t('account.sponsorHint'))}</p>
      ${spon.give || spon.receive
        ? swAction(spon.give, t('account.sponsor.give'), t('account.sponsor.giveHint'))
          + swAction(spon.receive, t('account.sponsor.receive'), t('account.sponsor.receiveHint'))
        : ''}
      <div class="phead" style="padding:18px 0 0"><h2>${esc(t('account.sponsorList'))}</h2></div>
      ${userList(spon.list, t('account.sponsorEmpty'), { requiresAction: true })}
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
      ${a.renderKeys.length ? `<div class="ulist">${a.renderKeys.map((k) => `<div class="keyrow">
          <span class="k num" title="${esc(k.key)}">${esc(k.key)}</span>
          <span class="c" title="${esc(k.comment)}">${esc(k.comment)}</span>
          <span class="use ${k.inUse ? 'on' : ''}">${esc(k.inUse ? t('account.keys.inUse') : t('account.keys.free'))}</span>
          <button class="btn sm" data-del="${esc(k.action)}" data-confirm="${esc(t('account.keys.delConfirm'))}">${esc(t('account.keys.del'))}</button>
        </div>`).join('')}</div>` : `<div class="ulist"><div class="none">${esc(t('account.empty'))}</div></div>`}
      <div class="addrow">
        <label class="input"><input id="sp-keycomment" type="text" autocomplete="off" placeholder="${esc(t('account.keys.comment'))}"></label>
        <button class="btn primary" data-act="key-add" data-input="sp-keycomment">${esc(t('account.keys.add'))}</button>
      </div>`);

    const blacklist = panel(t('account.block.renderer'), '', `
      <p class="hint">${esc(t('account.block.rendererHint'))}</p>
      ${userList(a.blockedRenderers, t('account.empty'))}
      <div class="addrow">
        <label class="input"><input id="sp-block-renderer" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.block.add'))}"></label>
        <button class="btn primary" data-act="block-add" data-kind="renderer" data-input="sp-block-renderer">${esc(t('account.add'))}</button>
      </div>
      <div class="phead" style="padding:20px 0 0"><h2>${esc(t('account.block.owner'))}</h2></div>
      <p class="hint" style="margin-top:8px">${esc(t('account.block.ownerHint'))}</p>
      ${userList(a.blockedOwners, t('account.empty'))}
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

    return `<div class="sechead"><h2>${esc(t('account.title'))}</h2>
        <span class="sub">${esc(t('account.sub'))}</span></div>
      <div class="seg" id="sp-acct-tabs" role="tablist">${acctTabs.map(([k, label]) =>
        `<button data-tab="${k}" role="tab" aria-selected="${tab === k}" aria-pressed="${tab === k}">${esc(label)}</button>`).join('')}</div>
      <div class="acct">${acctPanels[tab]}</div>
      ${foot()}`;
  }

  /* ==== 会话页（一台机器）：机器信息 + 可渲染项目在同一份 HTML 里，时间线是站点自己的 AJAX JSON；
     任何一块拿不到，只让那一块说"没有数据"，其余照常显示。 */
  const sessState = { type: 'all', limit: 100 };

  const sessElsewhere = new Set(['hostname', 'os', 'owner', 'version', 'frames', 'points', 'power', 'powerGpu', 'maxTime', 'status', 'action', 'currentFrames']);

  function sessLabel(f) {
    if (!f.key) return f.label;
    const k = `sess.f.${f.key}`;
    const hit = t(k);
    return hit === k ? f.label : hit;
  }

  /* 站点在「机器信息」里塞的有些值是**内部枚举**，不是给人看的字：OS 那格印 `linux`，
     Scheduler 那格印 `very_slow_computer`（它说的是这台机器跑多快，跟"调度模式"没关系），
     从没活动过的机器几格印 `Never`。这些翻成人话、原文进悬停提示；
     **认不出的值一律原样显示** —— 站点哪天加新档，界面上照样看得见。 */
  const OS_NAME = {
    linux: 'Linux', windows: 'Windows', win32: 'Windows',
    'mac os x': 'macOS', macos: 'macOS', darwin: 'macOS', freebsd: 'FreeBSD',
  };
  const MACHINE_CLASS = [
    [/^very[_\s-]*slow[_\s-]*computer$/i, 'verySlow'],
    [/^(slow|low)[_\s-]*computer$/i, 'slow'],
    [/^(medium|average|normal)[_\s-]*computer$/i, 'medium'],
    [/^(fast|high)[_\s-]*computer$/i, 'fast'],
    [/^very[_\s-]*fast[_\s-]*computer$/i, 'veryFast'],
  ];
  /* Action 那格站点放的是 `<input type="button" value="Pause">`（值是英文按钮字，
     实测只有 Pause / Resume 两种），只在没显示我们自己的控制面板时才走到这里。 */
  const ACTION_NAME = { pause: 'sess.act.pause', resume: 'sess.act.resume' };
  function valueHuman(key, raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (/^never$/i.test(s)) return { text: t('sess.never'), title: t('sess.rawTip', { raw: s }) };
    if (key === 'os') {
      const n = OS_NAME[s.toLowerCase()];
      if (n) return { text: n, title: t('sess.rawTip', { raw: s }) };
    }
    if (key === 'scheduler') {
      const hit = MACHINE_CLASS.find(([re]) => re.test(s));
      if (hit) return { text: t(`sess.class.${hit[1]}`), title: t('sess.rawTip', { raw: s }) };
    }
    if (key === 'action' && ACTION_NAME[s.toLowerCase()]) {
      return { text: t(ACTION_NAME[s.toLowerCase()]), title: t('sess.rawTip', { raw: s }) };
    }
    /* 值里带站点日期形状（`20th Oct 06:10` / `06:40 Sep 29`）就按语言包本地化；
       转换没变化说明不是日期，交给后面原样显示。 */
    const loc = I18n.date(s);
    if (loc !== s) return { text: loc, title: '' };
    return null;
  }

  function typeLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '—';
    const k = `sess.tl.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const hit = t(k);
    return hit === k ? s : hit;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /** 毫秒 → 本地 MM-DD HH:mm。不走 toLocaleString：整列要对齐，中文环境会把它撑得参差不齐。 */
  function stamp(ms, withYear) {
    const d = new Date(Number(ms));
    if (!Number.isFinite(d.getTime())) return '—';
    const y = withYear ? `${d.getFullYear()}-` : '';
    return `${y}${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  /** 事件时长单独写：Util.duration 是给"机时"设计的，几秒的事件会被它读成 0m。 */
  function spanText(ms) {
    const s = Math.max(0, Math.round(Number(ms) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h${pad2(m % 60)}m`;
    return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
  }

  /** 站点数字文案 → 数值，没有数字返回 null；真实的 0 要如实返回 0（与"读不到"是两回事）。 */
  const numOf = (s) => {
    const raw = String(s === undefined || s === null ? '' : s);
    if (!/\d/.test(raw)) return null;
    const n = Number(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  function lkey(ms) {
    const d = new Date(Number(ms));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /** 事件流 → 活动汇总：跨度 >31 天按月、否则按天，最近的在前。 */
  function activity(list) {
    const ev = (list || []).filter((e) => Number.isFinite(e.start)).slice().sort((a, b) => b.start - a.start);
    if (!ev.length) return { rows: [], byMonth: false, anyRender: false, anyFail: false, crossYear: false };
    const byMonth = Util.ddiff(lkey(ev[ev.length - 1].start), lkey(ev[0].start)) + 1 > 31;
    const crossYear = new Date(ev[0].start).getFullYear() !== new Date(ev[ev.length - 1].start).getFullYear();
    const map = new Map();
    for (const e of ev) {
      const day = lkey(e.start);
      const key = byMonth ? day.slice(0, 7) : (crossYear ? day : day.slice(5));
      let b = map.get(key);
      if (!b) { b = { key, events: 0, jobs: new Set(), render: 0, failed: 0 }; map.set(key, b); }
      b.events++;
      if (e.job) b.jobs.add(e.job);
      if (e.type === 'rendering') b.render += Math.max(0, e.end - e.start);
      if (/error/.test(e.type)) b.failed++;
    }
    const rows = [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
    const anyRender = rows.some((b) => b.render > 0);
    const scale = Math.max(...rows.map((b) => b.render)) || 1;
    return {
      rows: rows.map((b) => ({ ...b, jobs: b.jobs.size, bar: b.render / scale })),
      byMonth, anyRender, anyFail: rows.some((b) => b.failed > 0), crossYear,
    };
  }

  function session(state) {
    const s = state.session;
    if (!s) return UI.state.empty();
    const val = (k) => (s.info[k] ? s.info[k].value : '');
    const owner = s.info.owner || null;

    /* **两种暂停是两件事**："Paused server side" 与客户端自己的 "Paused client side" 以站点那行为准；
       Action 只说"服务器认不认它在跑"（本地暂停时 Status 照样 Enable），只看 Action 会报成「运行中」。 */
    const status = val('status');
    const note = s.info.note ? s.info.note.value : '';
    const noteKey = /paused\s+server\s+side/i.test(note) ? 'sess.pausedServer'
      : /paused\s+client\s+side/i.test(note) ? 'sess.pausedClient' : '';
    const noteTitle = note ? ` title="${esc(t('sess.statusRaw', { raw: note }))}"` : '';
    const chip = note
      ? `<span class="chip off"${noteTitle}>${esc(noteKey ? t(noteKey) : note)}</span>`
      : s.running === false ? `<span class="chip off">${esc(t('sess.off'))}</span>`
        : s.running === true ? `<span class="chip on">${esc(t('sess.on'))}</span>`
          : (status ? `<span class="chip">${esc(packLabel('sess.status', status))}</span>` : '');

    const bits = [];
    /* "Current frames"：这台机器此刻在跑什么（空闲不印）。它是**活的**，留身份条、不进「机器信息」表；
       暂停时文案说"当前作业"，免得和「已暂停」徽章自相矛盾。 */
    const cur = val('currentFrames');
    const cm = cur.match(/^project:\s*(.+?)\s+frame:\s*(\S+)\s+Request time:/i);
    // 「Current frames」写**文件名**（1002.blend）、项目表写**项目名**（1002），比对时剥后缀。
    const curProject = cm ? cm[1] : '';
    const curProjectBase = curProject.replace(/\.blend\d*$/i, '');
    if (cm) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cm[1])}</b> · ${esc(t('sess.frame'))} <b class="num">${esc(cm[2])}</b></span>`);
    } else if (cur) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cur)}</b></span>`);
    }
    if (val('os')) {
      const os = valueHuman('os', val('os'));
      bits.push(`<span${os ? ` title="${esc(os.title)}"` : ''}>${esc(os ? os.text : val('os'))}</span>`);
    }
    if (owner) {
      const href = owner.href || (owner.user ? `/user/${encodeURIComponent(owner.user)}/profile` : '');
      bits.push(`<span>${esc(t('sess.owner'))} ${href
        ? `<a href="${esc(href)}" target="_self"><b>${esc(owner.value)}</b></a>`
        : `<b>${esc(owner.value)}</b>`}</span>`);
    }
    if (val('version')) bits.push(`<span>${esc(t('sess.client'))} <b class="num">${esc(val('version'))}</b></span>`);

    const head = `<div class="identity sesshead">
      ${chip}
      <h1>${esc(val('hostname') || t('sess.unknownHost'))}</h1>
      ${bits.length ? `<div class="meta">${bits.join('')}</div>` : ''}
    </div>`;

    const tl = s.timeline || [];
    const acts = activity(tl);

    /* ---- 指标带 ----
       起算时间取日志最早那条的**本地**时刻：**时区**不同（Creation Time 实测站点 UTC+2），与本地时间线
       同屏差 6 小时，会读成"创建 6 小时后才干活"。 */
    const framesN = numOf(val('frames'));
    const pointsN = numOf(val('points'));
    const perFrame = framesN && pointsN ? Math.round(pointsN / framesN) : null;
    const since = I18n.date(tl.length ? stamp(tl[tl.length - 1].start) : val('createdAt'));

    /* 算力那格跟着站点印了哪一行走（"Power CPU" / "Power GPU" 都开就两行都在）；**不写死** —— 早先写死读
       Power CPU，纯 GPU 机器上那格永远是"—"，被读成"CPU 有问题"。 */
    const powerFacts = s.facts.filter((f) => f.key === 'power' || f.key === 'powerGpu');

    const kpiItems = [
      {
        k: t('sess.kpi.frames'), v: framesN === null ? '—' : Util.num(framesN),
        d: since ? t('sess.kpi.since', { t: since }) : '',
      },
      {
        k: t('sess.kpi.points'), v: pointsN === null ? '—' : Util.num(pointsN),
        d: perFrame ? t('sess.kpi.perFrame', { n: fmt(perFrame) }) : '',
      },
      ...powerFacts.map((f) => ({
        k: sessLabel(f),
        v: f.value || '—',
        d: f.href ? `<a href="${esc(f.href)}" target="_self">${esc(t('sess.kpi.powerLink'))}</a>` : '',
      })),
      {
        k: t('sess.kpi.maxTime'), v: val('maxTime') || '—', d: '',
      },
    ];

    /* ---- 机器控制：站点自己的按钮、同一批地址；只在看自己的机器时出现（实测别人的会话页直接 404），
       否则 Action 退回事实清单按原文显示。 */
    const act = s.info.action;
    const mine = !!(owner && owner.user && state.userName && owner.user === state.userName);
    const showControl = !!(act && act.action && mine);
    const control = showControl ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:0"><h2>${esc(t('sess.control'))}</h2></div>
      <div class="pbody">
        <p class="hint">${esc(t('sess.controlHint'))}</p>
        <button class="btn primary" data-act="sess-run" data-url="${esc(act.action)}">
          ${esc(s.running === true ? t('sess.pause') : t('sess.resume'))}</button>
      </div>
    </div>` : '';

    /* ---- 事实清单 ---- */
    const rest = s.facts.filter((f) => !sessElsewhere.has(f.key) || (f.key === 'action' && !showControl))
      .sort((a, b) => (a.key === 'renderKey' ? 1 : 0) - (b.key === 'renderKey' ? 1 : 0));
    const factsPanel = rest.length ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.facts'))}</h2><span class="sub">${esc(t('sess.factsSub'))}</span>
      </div>
      <div class="facts">${rest.map((f) => {
        let v;
        if (f.key === 'renderKey' && f.secret) {
          v = `<span class="num sec" data-key="${esc(f.secret)}">••••••••••••</span>` +
            `<button class="btn sm" data-act="reveal-key" aria-pressed="false">${esc(t('sess.reveal'))}</button>`;
        } else {
          const raw = f.value || '—';
          const human = f.href ? null : valueHuman(f.key, f.value);
          const txt = f.href
            ? `<a href="${esc(f.href)}" target="_self">${esc(raw)}</a>`
            : esc(human ? human.text : raw);
          v = `<span class="num"${human ? ` title="${esc(human.title)}"` : ''}>${txt}</span>`;
        }
        return `<div class="fact"><span class="k">${esc(sessLabel(f))}</span><span class="v">${v}</span></div>`;
      }).join('')}</div>
    </div>` : '';

    const openLog = !!sessState.open;
    const MAXB = 14;
    const buckets = acts.rows.slice(0, MAXB);
    const hiddenB = acts.rows.length - buckets.length;

    const counts = new Map();
    for (const e of tl) counts.set(e.type, (counts.get(e.type) || 0) + 1);
    if (sessState.type !== 'all' && !counts.has(sessState.type)) sessState.type = 'all';   // 换了机器，旧筛选要清掉
    const types = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
    const rows = tl.filter((e) => sessState.type === 'all' || e.type === sessState.type);

    const tlHead = tl.length
      ? t('sess.tlSub', {
        n: fmt(tl.length),
        from: stamp(tl[tl.length - 1].start, acts.crossYear),
        to: stamp(tl[0].start, acts.crossYear),
      })
      // 接口没回应时不在这里说"站点没返回记录"：正文已说"没取到"，两句会互相打脸。
      : (s.timelineFailed ? '' : t('sess.tlSubEmpty'));

    /* 条只画"渲染时长"：没有渲染事件时不换口径（不拿事件数冒充），只把填充留空 —— 但**这一列必须留着
       占位**，它是这行的弹簧，抽掉表头与数值列会各自靠左排。 */
    const showBar = acts.anyRender;
    const pct = (b) => Math.round(b.bar * 100);
    const actTable = buckets.length ? `<div class="acts" role="table">
      <div class="acthead" role="row">
        <span class="ad" role="columnheader">${esc(acts.byMonth ? t('sess.act.month') : t('sess.act.day'))}</span>
        <span class="bar" role="columnheader" aria-label="${esc(t('sess.act.render'))}"></span>
        <span class="h" role="columnheader">${esc(t('sess.act.render'))}</span>
        <span class="h s" role="columnheader">${esc(t('sess.act.events'))}</span>
        <span class="h s" role="columnheader">${esc(t('sess.act.jobs'))}</span>
        ${acts.anyFail ? `<span class="h s" role="columnheader">${esc(t('sess.act.failed'))}</span>` : ''}
      </div>
      ${buckets.map((b) => `<div class="actrow" role="row">
        <span class="ad num" role="cell">${esc(b.key)}</span>
        <span class="ab" role="cell" aria-hidden="true">${showBar && b.bar > 0 ? `<i style="width:max(3px, ${pct(b)}%)"></i>` : ''}</span>
        <span class="av num" role="cell">${b.render ? esc(spanText(b.render)) : '—'}</span>
        <span class="an num" role="cell">${fmt(b.events)}</span>
        <span class="aj num" role="cell">${fmt(b.jobs)}</span>
        ${acts.anyFail ? `<span class="af num${b.failed ? ' on' : ''}" role="cell">${b.failed ? fmt(b.failed) : '—'}</span>` : ''}
      </div>`).join('')}
    </div>` : '';

    const detail = openLog ? `
      <div class="tlbar"><div class="seg" id="sp-tl-types">
        <button data-t="all" aria-pressed="${sessState.type === 'all'}">${esc(t('proj.all'))} <span class="num">${tl.length}</span></button>
        ${types.map((x) => `<button data-t="${esc(x)}" aria-pressed="${sessState.type === x}">${esc(typeLabel(x))} <span class="num">${counts.get(x)}</span></button>`).join('')}
      </div></div>
      <div class="tlwrap"><div class="tablewrap log" tabindex="0" role="region" aria-label="${esc(t('sess.timeline'))}"><table class="tbl dense">
        <thead><tr><th>${esc(t('sess.col.type'))}</th><th class="r">${esc(t('sess.col.start'))}</th>
          <th class="r">${esc(t('sess.col.span'))}</th><th class="r">${esc(t('sess.col.end'))}</th>
          <th>${esc(t('sess.col.job'))}</th></tr></thead>
        <tbody>${rows.slice(0, sessState.limit).map((e) => `<tr>
          <td><span class="st">${esc(typeLabel(e.type))}</span></td>
          <td class="r num">${esc(stamp(e.start, acts.crossYear))}</td>
          <td class="r num">${esc(spanText(e.end - e.start))}</td>
          <td class="r num">${esc(stamp(e.end, acts.crossYear))}</td>
          <td class="job num">${esc(e.job || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${moreRow(Math.min(rows.length, sessState.limit), rows.length, 100)}</div>` : '';

    const timelinePanel = tl.length ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.timeline'))}</h2><span class="sub num">${esc(tlHead)}</span>
        <span class="spacer"></span>
        ${openLog ? `<span class="sub num">${esc(t('list.shown', { n: Math.min(rows.length, sessState.limit), total: rows.length }))}</span>` : ''}
      </div>
      ${actTable}
      <div class="tlfoot">
        <button class="btn" data-act="sess-log" aria-expanded="${openLog}">${esc(openLog
          ? t('sess.logClose') : t('sess.logOpen', { n: fmt(tl.length) }))}</button>
        ${hiddenB ? `<span class="sub">${esc(t(acts.byMonth ? 'sess.act.moreMonth' : 'sess.act.moreDay', { n: hiddenB }))}</span>` : ''}
      </div>
      ${detail}
    </div>` : `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.timeline'))}</h2><span class="sub num">${esc(tlHead)}</span>
      </div>
      <div class="pbody"><div class="none">${esc(s.timelineFailed ? t('sess.tlFailed') : t('sess.tlNone'))}</div></div>
    </div>`;

    /* ---- 可渲染项目 ---- */
    const own = new Map();
    const dup = new Set();
    for (const p of state.projects || []) {
      if (!p.name) continue;
      if (own.has(p.name)) dup.add(p.name);
      else own.set(p.name, p);
    }
    for (const n of dup) own.delete(n);

    /* **站点的行序就是优先级，必须原样保留**：实测前 12 行是 "Renderable"，之后才是 "Over user's
       time limit"、"Computer has previously failed to render project" —— 只做一次映射：不排序、不分组、不去重。 */
    const prjRows = s.projects.map((p) => ({
      n: p.name,
      label: p.reason ? whyLabel(p.reason) : t('sess.whyNone'),
      p: own.get(p.name) || null,
    }));

    const maps = listsOf(state);
    const openP = projState.menu ? [...own.values()].find((x) => x.id === projState.menu) : null;
    const menuHtml = openP ? ownerMenu(openP, state.userName, maps) : '';

    const prjPanel = s.hasProjects !== false ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.projects'))}</h2>
        <span class="sub">${esc(t('sess.prjSub', { n: fmt(s.projects.length) }))}</span>
      </div>
      ${prjRows.length ? `<div class="tablewrap" style="margin:0 6px 6px"><table class="tbl dense">
        <thead><tr>
          <th>${esc(t('proj.col.project'))}</th>
          <th>${esc(t('proj.col.owner'))}</th>
          <th>${esc(t('proj.col.status'))}</th>
          <th colspan="2">${esc(t('proj.col.progress'))}</th>
          <th>${esc(t('proj.col.device'))}</th>
          <th class="r">${esc(t('proj.col.memory'))}</th>
        </tr></thead>
        <tbody>${prjRows.map(({ n, label, p }) => {
          const who = p && (p.ownerId || p.owner) ? ownerCell(p, state.userName, maps) : '<span class="dash">—</span>';
          const isCur = !!curProject && (curProject === n || curProjectBase === n);
          const frac = p ? UI.progressText(p.pct, p.done, p.total) : '';
          return `<tr>
            <td><div class="pnwrap"><div class="pn" title="${esc(n)}">${esc(n)}</div>${
              isCur ? `<span class="now">${esc(t('sess.rendering'))}</span>` : ''}</div></td>
            <td>${who}</td>
            <td><span class="st" title="${esc(label)}">${esc(label)}</span></td>
            <td>${p ? UI.progress(p.pct, frac) : '<span class="dash">—</span>'}</td>
            <td class="r num frac">${p ? esc(frac) : '<span class="dash">—</span>'}</td>
            <td>${p ? UI.devices(p.cpu, p.gpu) : '<span class="dash">—</span>'}</td>
            <td class="r num">${p ? esc(p.memory || '—') : '<span class="dash">—</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="pbody"><div class="none">${esc(t('sess.prjNone'))}</div></div>`}
    </div>` : '';

    return head + UI.kpis(kpiItems) + factsPanel + control + timelinePanel + prjPanel + foot() + menuHtml;
  }

  /* ==== 挂载后补丁：只有总览的积分曲线需要真实像素宽度 ==== */
  /* ==== 项目上传页 / 分析等待页：等待页整页重建；上传页是**换装** —— 骨架我们画，能干活的节点
     从抓回来的 /getstarted 里搬进来，不接管那一页（Borrowed Controls Rule 见 docs/DESIGN.md）。 */

  function upload(state) {
    return `<div class="wrap up">
      <div class="sechead">
        <h2>${esc(t('up.title'))}</h2>
        <span class="sub">${esc(t('up.sub'))}</span>
      </div>
      ${state.uploadMode === 'new' ? '' : `<div class="expnote">${esc(t('up.expNote'))}</div>`}
      <div class="up-grid">
        <div class="up-col">
          <div class="panel">
            <div class="phead"><h2>${esc(t('up.formTitle'))}</h2></div>
            <div class="up-body" data-up="form"></div>
          </div>
          <div class="panel" data-up="estPanel">
            <div class="phead"><h2>${esc(t('up.estTitle'))}</h2></div>
            <div class="up-body" data-up="est"></div>
          </div>
        </div>
        <div class="panel up-rules">
          <div class="phead"><h2>${esc(t('up.rulesTitle'))}</h2></div>
          <div class="up-body" data-up="rules"></div>
        </div>
      </div>
      <div class="up-src">${esc(t('up.origin'))}</div>
    </div>`;
  }

  /** 站点那句「Max: 2,048 MB …」和 `<input type="file">` 挤在同一 `<td>`：**整块替换会把文件框删掉**
      （见 70-i18n-dom.js），逐节点拼不回中文 —— 故由卡片自己说 `up.maxNote`，大小从站点原文里读。 */
  function rewordFileLimit(scope) {
    const file = scope.querySelector('input[type=file]');
    if (!file) return;
    const cell = file.closest('td') || file.parentElement;
    if (!cell) return;
    const txt = cell.textContent || '';
    const m = txt.match(/Max:\s*([\d.,]+\s*[KMGT]?B)/i) || txt.match(/上限：\s*([\d.,]+\s*[KMGT]?B)/);
    if (!m) return;
    [...cell.childNodes].forEach((n) => { if (n !== file) n.remove(); });
    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = t('up.maxNote', { size: m[1] });
    file.after(note);
  }

  /** 须知块**只贴标签、只去掉多余字符**：站点把「项目总数: 29」写成裸文本节点（包 span 才能排版）；
      `…3.0 or higher</strong>.` 的句号在 <strong> 外 → 中文译文双句号，只在前面已有句末标点时删 "."。 */
  function tidyRules(scope) {
    const col = scope.firstElementChild;
    if (!col) return;
    for (const n of [...col.childNodes]) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const span = document.createElement('span');
      span.className = 'qtotal';
      span.textContent = n.nodeValue.trim();
      n.replaceWith(span);
    }
    const firstUl = col.querySelector('ul');
    if (firstUl) firstUl.classList.add('qpos');
    for (const li of scope.querySelectorAll('li')) {
      const last = li.lastChild;
      if (!last || last.nodeType !== 3) continue;
      const tail = last.nodeValue.trim();
      if (!/^[.．。]+$/.test(tail)) continue;
      const before = li.textContent.slice(0, li.textContent.length - tail.length).trimEnd();
      if (/[。．.！!？?]$/.test(before)) last.remove();
    }

    const h4s = [...col.querySelectorAll(':scope > h4')];
    const head = h4s[0];
    if (head) {
      const stop = h4s[1] || null;
      const group = [];
      for (let n = head.nextSibling; n && n !== stop; n = n.nextSibling) group.push(n);
      if (group.length) {
        const band = document.createElement('div');
        band.className = 'qband';
        const text = document.createElement('div');
        text.className = 'qtext';
        const data = document.createElement('div');
        data.className = 'qdata';
        band.appendChild(text);
        band.appendChild(data);

        let lead = null;
        const para = group.find((n) => n.nodeType === 1 && n.tagName === 'P');
        const br = para ? [...para.childNodes].find((n) => n.nodeType === 1 && n.tagName === 'BR') : null;
        if (para && br) {
          const tail = [];
          for (let n = br.nextSibling; n; n = n.nextSibling) tail.push(n);
          if (tail.some((n) => n.nodeValue && n.nodeValue.trim())) {
            lead = document.createElement('p');
            lead.className = 'qlead';
            for (const n of tail) lead.appendChild(n);
          }
          br.remove();
        }
        if (lead) data.appendChild(lead);

        for (const n of group) {
          const isData = n.nodeType === 1 && (n.classList.contains('qpos') || n.classList.contains('qtotal'));
          (isData ? data : text).appendChild(n);
        }
        head.after(band);
      }
    }
  }

  /** 估算器结果是站点 AJAX 回来的一段英文 HTML：`DomI18n.translateSubtree()` 允许翻译器走进 #sp
      （DOM 在容器里、文字却是站点的）；另去掉中文译文后吊着的英文句号。 */
  function watchEstimatorResult(box) {
    if (!box) return;
    const fix = () => {
      if (SP.DomI18n && SP.DomI18n.translateSubtree) SP.DomI18n.translateSubtree(box);
      for (const n of [...box.childNodes]) {
        if (n.nodeType !== 3 || n.nodeValue.trim() !== '.') continue;
        const before = n.previousSibling ? (n.previousSibling.textContent || '') : '';
        if (/[\u4e00-\u9fff]$/.test(before.replace(/\s+$/, ''))) n.remove();
      }
    };
    new MutationObserver(fix).observe(box, { childList: true });
    if (box.innerHTML.trim()) fix();
  }

  /** 上传卡片唯一的填充方式：抓 `/getstarted` 回来，从解析出的文档里取三块装进卡片，不"接管那一页"
      （它同时是下载客户端指南页，见 docs/DESIGN.md）；`<script>` 不执行，故补全要重绑、表单靠全局 `onsubmit`。 */
  /** 站点结构变了、这一档拼不出来时，别给用户一张空白卡片：说清楚 + 给出切档办法。 */
  function shapeNotice(root, mode) {
    const box = document.createElement('div');
    box.className = 'wrap';
    box.innerHTML = `<div class="sechead"><h2>${esc(t('up.title'))}</h2></div>
      <div class="panel" style="padding:16px 20px">
        <div class="hint bad">${esc(t(mode === 'new' ? 'up.shapeNew' : 'up.shapeCompat'))}</div>
        <div class="hint" style="margin-top:8px">${esc(t('up.shapeHow'))}</div>
      </div>`;
    root.textContent = '';
    root.appendChild(box);
  }

  function wireUploadDoc(root, html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = doc.querySelector('#addproject_main_div');
    const blocked = doc.querySelector('#addproject_warning_zero_frame');
    if (!main && !blocked) return false;
    const slotForm = root.querySelector('[data-up="form"]');
    const slotEst = root.querySelector('[data-up="est"]');
    const slotRules = root.querySelector('[data-up="rules"]');
    const estPanel = root.querySelector('[data-up="estPanel"]');
    const grab = (el) => (el ? el : null);

    if (main) {
      const left = main.querySelector(':scope > .row > .col-md-5');
      const right = main.querySelector(':scope > .row > .col-md-6');
      const blocks = left ? [...left.children] : [];
      const formBlock = blocks.find((b) => b.querySelector('form[action*="/project/internal/upload"]')) || blocks[0];
      const estBlock = blocks.find((b) => b !== formBlock) || null;
      if (formBlock && slotForm) slotForm.appendChild(grab(formBlock));
      if (estBlock && slotEst) {
        slotEst.appendChild(grab(estBlock));
        /* 站点在这块里自带一个 <h4>估算器</h4>，与卡片标题重复：去掉它，只留内容 */
        const dup = estBlock.querySelector('h4');
        if (dup && /估算器|Estimator/i.test(dup.textContent)) dup.remove();
        const numTable = estBlock.querySelector('table');
        if (numTable) numTable.classList.add('numband');
        watchEstimatorResult(estBlock.querySelector('#addproject_estimator_result'));
        rebindDeviceSearch(estBlock, html);
      } else if (estPanel) estPanel.remove();
      if (right && slotRules) slotRules.appendChild(grab(right));
    } else if (slotForm) {
      slotForm.appendChild(grab(blocked));
      if (estPanel) estPanel.remove();
    }

    /* **先翻译、再整理**，顺序不能反：整块翻译的规则按站点原句写，而 tidyRules 会把「排队情况」在 <br>
       处切开，切完不再以 "Predicted position in queue:" 结尾 → 规则失配，那一段永远是英文。 */
    for (const slot of [slotForm, slotEst, slotRules]) if (slot) SP.DomI18n.translateSubtree(slot);
    if (slotForm) rewordFileLimit(slotForm);
    if (slotRules) tidyRules(slotRules);
    return true;
  }

  /** 设备名自动补全要自己重绑（内联脚本不执行），source 从站点脚本里读、不写死。**坑在菜单**：
      jQuery UI 把菜单挂 `<body>`，被守卫 `body > *:not(#sp){display:none}` 挡成"输入了没反应"
      （2026-10-04 实报）—— 所以贴类名 `ul.sp-acmenu` 放行并同步主题。 */
  function rebindDeviceSearch(estBlock, html) {
    const src = (html.match(/#addproject_estimator_device_form_search_text_label"\)\s*\.autocomplete\(\{[\s\S]{0,600}?source:\s*"([^"]+)"/) || [])[1];
    const $ = window.jQuery;
    if (!src || !$ || !$.fn || !$.fn.autocomplete) return;
    const label = estBlock.querySelector('#addproject_estimator_device_form_search_text_label');
    const value = estBlock.querySelector('#addproject_estimator_device_form_search_text_value');
    if (!label) return;

    /* 每次重画卡片都绑一个新 widget，而菜单挂 <body> 上不跟旧卡片消失 —— 绑之前先清上一批。 */
    document.querySelectorAll('body > ul.sp-acmenu').forEach((m) => m.remove());

    const paintMenu = () => {
      const inst = $(label).data('uiAutocomplete') || $(label).data('ui-autocomplete');
      const menu = inst && inst.menu && inst.menu.element;
      if (!menu || !menu.length) return;
      menu.addClass('sp-acmenu');
      const host = document.getElementById('sp');
      const th = host && host.getAttribute('data-theme');
      if (th) menu.attr('data-theme', th);
    };

    $(label).autocomplete({
      minLength: 3,
      source: src,
      select(event, ui) {
        $(label).val(ui.item.label);
        if (value) $(value).val(ui.item.value);
        return false;
      },
      open: paintMenu,   // 每次弹出都同步一次：主题可能在卡片开着时被换掉
    });
    paintMenu();

    /* 关闭时机得自己管：这个 jQuery UI（1.10.2）实测**既不 blur 关、也不"点外面"关**
       —— 打「2060」弹出菜单后点导航切走，那块菜单会留在屏幕上（display 还是 block）。
       菜单又挂在 <body> 上、不跟卡片一起消失，所以失焦与点外面各补一次关闭。
       点菜单项不会误关：jQuery UI 在菜单项 mousedown 里 preventDefault，输入框不失焦。 */
    const closeMenu = () => { try { $(label).autocomplete('close'); } catch (e) { /* 没初始化就无所谓 */ } };
    $(label).on('blur', () => setTimeout(closeMenu, 160));
    $(document).off('mousedown.spacmenu').on('mousedown.spacmenu', (ev) => {
      if (!$(ev.target).closest('ul.sp-acmenu, #addproject_estimator_device_form_search_text_label').length) closeMenu();
    });
  }

  /* ---- 分析等待页 ---- */

  /** 上传后的等待页整页归我们；真正在跑的是 80-app.js 的轮询，它认 `#sp-an-*` 这几个钩子。 */
  function analyse() {
    return `<div class="wrap">
      <div class="sechead">
        <h2 data-an="title">${esc(t('an.title'))}</h2>
        <span class="sub" data-an="titleSub">${esc(t('an.sub'))}</span>
      </div>
      <div class="panel an-card">
        <div class="an-head">
          <div class="spin" data-an="spin"></div>
          <div>
            <div class="an-state" data-an="state">${esc(t('an.waiting'))}</div>
            <div class="an-sub" data-an="sub">${esc(t('an.slow'))}</div>
          </div>
        </div>
        <div class="an-track" data-an="track"><i data-an="bar"></i></div>
        <div id="sp-an-result" class="sp-siteform" hidden></div>
      </div>
      <div class="foot">${esc(t('footer.source'))}</div>
    </div>`;
  }

  /** 项目管理页 /project/<数字>：站点那一大块由 80-app.js 的 wireManageDoc **搬**进来（活节点）。
   *  这里只画外壳；名字 / 进度 / 状态从站点 DOM 里读，拿不到就少显示几个字，不编数据。 */
  function project(state) {
    const id = state.projectId || '';
    const sec = document.getElementById('jobs_of_a_project');
    const nameEl = id ? document.getElementById(`project_job_${id}_path`) : null;
    const progEl = id ? document.getElementById(`project_job_${id}_progression`) : null;
    const name = nameEl ? nameEl.textContent.trim() : '';
    const prog = progEl ? progEl.textContent.trim() : '';
    const stEl = sec && sec.querySelector('li[class^="msg_"]');
    const stRaw = stEl ? stEl.textContent.trim() : '';
    const stCls = stEl ? ((stEl.className.match(/msg_([a-z]+)/i) || [])[1] || '') : '';
    const stText = stRaw ? (I18n.siteText(stRaw) || stRaw) : '';
    const meta = [
      name ? `<b>${esc(name)}</b>` : '',
      prog ? `${esc(t('proj.col.progress'))} ${esc(prog)}` : '',
      stText ? `<span class="sp-mg-badge s-${esc(stCls || 'x')}">${esc(stText)}</span>` : '',
    ].filter(Boolean).join(' · ');
    return `<div class="wrap">
      <div class="sechead">
        <h2>${esc(t('mg.title'))}</h2>
        <span class="sub">${meta || esc(t('mg.unknown'))}</span>
      </div>
      <div class="sp-manage" id="sp-mg-host"></div>
      <div class="hint">${esc(t('mg.note'))}</div>
      <div class="foot">${esc(t('footer.source'))}</div>
    </div>`;
  }


  function mount(root, state) {
    /* 上传视图接线的两道判据：`.up-grid`（show() 先画骨架，那时还没卡片）与 `state.uploadHtml`（boot() 先
       render() 再 show()，直接开 #/upload 那次只拿到空卡片）。少了任一道就会把 body 早标成"已接线"，
       之后 render() 全被守卫早退 —— 用户拿到空壳（实测踩过）。 */
    if (state && state.view === 'upload' && root && !root.dataset.spWired
        && root.querySelector('.up-grid') && state.uploadHtml) {
      root.dataset.spWired = '1';
      SP.DomI18n.enabled = !!state.translateSite;
      /* 「开」：三个槽位全自绘（64-step1.js），站点那份 HTML 只当数据源；
         其余档：老的"搬站点活节点"路（S3 换成"原版内嵌"后会删掉这条）。 */
      if (state.uploadMode === 'new' && SP.Step1) {
        if (SP.Step1.mount(root, state.uploadHtml) === false) { shapeNotice(root, 'new'); return false; }
      } else if (wireUploadDoc(root, state.uploadHtml) === false) { shapeNotice(root, 'compat'); return false; }
    }
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

  SP.Views = { overview, projects, ranking, settings, account, session, upload, analyse, project, projState, rankState, acctState, sessState, dailySeries, mount };
})();
