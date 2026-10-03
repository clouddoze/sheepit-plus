/* ==========================================================================
 * 50-views.js — 视图层：总览 / 项目 / 排行榜 / 设置
 *
 * 视觉与 DOM 结构照 docs/DESIGN.md 落地；数据全部来自解析器
 * 已经给出的真实字段，没有任何占位符。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');

  /** 页脚：数据来源声明。每一屏都要有 —— 这是本产品对用户的承诺。 */
  const foot = () => `<div class="foot">${esc(t('footer.source'))}</div>`;

  /* ======================================================== 逐日真实产出
     站点内联的 line_frames_timeline 是**累积**帧数曲线。把它当阶梯函数做逐日差分，
     得到"每天到底渲染了多少帧"——原站那张热力图只记"当天有没有渲染"（count 恒为 1），
     对全勤用户是整块纯色、零信息量。
     保守起见先判单调：万一站点哪天改成逐日值，就直接用它，绝不硬差分出负数。 */
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
      const v = at.has(d) ? at.get(d) : prev;   // 阶梯函数：没有采样点的日子沿用上一次的值
      if (prev !== null) out.push({ d, v: Math.max(0, v - prev) });
      prev = v;
    }
    return out;
  }

  function statOf(st, names) {
    for (const n of names) if (st[n] !== undefined && st[n] !== '') return st[n];
    return '';
  }

  const rankOf = (st) => {
    const raw = statOf(st, ['Rank']);
    const digits = String(raw).replace(/[^\d]/g, '');
    return digits || '';
  };

  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

  /** 站点把注册日期写成 "January 31st, 2024"。中文界面里要的是 2024-01-31。
   *  认不出来的形状原样返回 —— 宁可显示站点原文，也不要猜错日期。 */
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

  /** 站点原文 → 当前语言。词表里没有的一律回落站点原文，绝不显示半个键名。 */
  function packLabel(prefix, raw, upper) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const key = `${prefix}.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const hit = t(key);
    if (hit !== key) return hit;
    return upper ? s.toUpperCase() : s;
  }

  /** 客户端状态是站点给的英文句子。能对上模式的翻成中文，对不上的原样保留。 */
  const STATUS_RULES = [
    [/^waiting to render/i, () => t('status.idle')],
    [/^rendering for\s+(.+)$/i, (m) => t('status.renderingFor', { user: m[1] })],
    [/^rendering\b/i, () => t('status.rendering')],
    // 站点在这行还会说 "Disconnected"（客户端离线）。不认识的原样显示等于在中文界面里
    // 露一句英文，所以补上；以后站点再添新词也仍然只回落原文，不会瞎猜。
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

  /* ============================================================== 总览 */

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
    // 站点原文挂 title：这句说的是"你自己客户端"的状态，不是全站队列，
    // 想查证的人一眼能看到站点的原话。
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
    const hasData = (p.points && p.points.length > 1) || daily.length > 0 || (p.activity && p.activity.length > 0);

    if (!hasData) {
      // 页面确实读到了（dl 里的统计在），只是还没有任何渲染记录 → 上新用户空状态：
      // 不摆一排 0，直接告诉他这里会发生什么、怎么开始。
      // 连统计都读不到，说明是解析失败，不能拿"你还没开始"糊弄人，如实说无数据。
      const parsed = Object.keys(st).length > 0;
      return identity(p, st) + (parsed ? UI.newUser() : UI.state.empty()) + foot();
    }

    /* ---- 指标带：一个整面 + 内部 1px 分隔 ---- */
    const total = daily.reduce((a, b) => a + b.v, 0);
    const avg = daily.length ? Math.round(total / daily.length) : null;
    const peak = daily.length ? daily.reduce((a, b) => Math.max(a, b.v), 0) : null;
    const rank = rankOf(st);
    const rawTime = statOf(st, ['Time rendered']);
    const days = Util.durDays(rawTime);
    const frames = statOf(st, ['Frames rendered']);
    const points = statOf(st, ['Points']);
    // 发布者身份的两项：站点统计里本来就有，只是没建过项目的人一直是 0
    const created = statOf(st, ['Projects created']);
    const ordered = statOf(st, ['Frames ordered']);
    const asCount = (v) => Number(String(v === null || v === undefined ? '' : v).replace(/[^\d.]/g, ''));

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
      {
        k: t('stat.streak'),
        v: d.streakExclToday !== undefined ? `${fmt(d.streakExclToday)} ${t('stat.days')}` : '—',
        // 近 30 天满勤时直说"全勤"——"近 30 天活跃 30 天"是把同一个数字念了两遍
        d: d.best !== undefined
          ? t(d.active30 === 30 ? 'stat.streakFull' : 'stat.streakHint', { best: fmt(d.best), d30: fmt(d.active30 || 0) })
          : '',
      },
      // 发布者身份的两格，只在非零时出现：没建过项目的人看到的仍是原来那四格。
      ...(asCount(created) > 0
        ? [{ k: t('stat.created'), v: Util.statNum(created), d: t('stat.createdHint') }] : []),
      ...(asCount(ordered) > 0
        ? [{ k: t('stat.ordered'), v: Util.statNum(ordered), d: t('stat.orderedHint') }] : []),
    ];
    // 格数变了，栅格与分隔线要跟着重排（见 30-style.js 的 .kpis[data-n]）
    const kpiBand = UI.kpis(kpiItems);

    /* ---- 8/4 主区：积分增长 + 月度产出 ----
       站点只在**自己的主页**内联积分曲线与逐日帧数；别人的主页上这两块根本没有数据源。
       那就不画（用户拍板：宁可少两块面板，也不摆两个"暂无数据"）。只剩一块时铺满整行。 */
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

    /* ---- 通栏：渲染产出 ----
       逐日帧数只有自己的主页有；别人的主页站点给的是"这天有没有渲染"的日历，
       而原站也正是拿那份数据画这张图的 —— 所以照样画，但口径与计数文案全部换成天。 */
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

    /* ---- 已连接的机器 ----
       这里放自己的机器，不放"进行中的项目"：项目有它自己的视图，
       在总览再铺一遍只是把同一个列表说了两遍。
       全站实时（别人的机器、全站队列）也不在这里 —— 那是农场的事不是我的事，
       在项目页顶部更合身。 */
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

  /* ============================================================== 项目 */

  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null };
  const rankState = { limit: 100 };
  // 账户页选项卡。不写进地址 —— 与项目页的筛选、排行榜的分页一致，刷新回到第一档。
  const acctState = { tab: 'sched' };

  /** 「显示更多」：500 行排行榜如果一次性铺进 DOM，滚动会卡。分次渲染，
   *  并且如实写出"已显示 n / 总数"，不做静默截断。 */
  function moreRow(shown, total, step) {
    if (shown >= total) return '';
    return `<div class="more">
      <button class="btn" id="sp-more" data-step="${step}">${esc(t('list.more'))}
        <span class="num">${esc(t('list.shown', { n: shown, total }))}</span></button>
    </div>`;
  }

  /** 站点状态文案 → 本地化文案 */
  function statusLabel(p) {
    if (p.statusKind === 'rendering') {
      return p.statusCount != null ? t('proj.status.renderingN', { n: p.statusCount }) : t('proj.status.rendering');
    }
    if (p.statusKind === 'waiting') return t('proj.status.waiting');
    if (p.statusKind === 'paused') return t('proj.status.paused');
    return p.status || '—';
  }

  /** 三项名单动作各自要打的地址。加进去用站点的 add 前缀；已经在名单里就用名单行 onclick
   *  里的撤回地址。优先级那条读不到时按形状兜底（历史行为，实测可用），
   *  捐赠与黑名单没有样本就不猜 —— 读不到那一项直接不给。 */
  function ownerActions(p, maps) {
    const id = p.ownerId || p.owner;
    if (!maps || !id) return null;
    const prio = maps.prio.get(id) || null;
    const spon = maps.sponsor.get(id) || null;
    const blocked = maps.blocked.get(id) || null;
    return {
      prio: {
        on: !!prio,
        // 注意：maps.add.* 是**前缀**（站点 onclick 里读到的那一段），后面还要接用户名
        url: prio ? (prio.action || `/user/priority/remove/${encodeURIComponent(id)}`)
          : (maps.add.priority ? maps.add.priority + encodeURIComponent(id) : `/user/priority/add/${encodeURIComponent(id)}`),
      },
      gift: { on: !!spon, url: spon ? spon.action : (maps.add.sponsor ? maps.add.sponsor + encodeURIComponent(id) : '') },
      block: { on: !!blocked, url: blocked ? blocked.action : (maps.add.blockOwner ? maps.add.blockOwner + encodeURIComponent(id) : '') },
    };
  }

  /** 发布者那一格：头像 + 名字（可点进主页）+ 常驻的状态标记 + 一个 3 点菜单。
   *  标记说的是"你把他放进了哪份名单"—— 这件事不该等鼠标移上来才知道，所以它常驻；
   *  三个动作（优先 / 捐赠 / 黑名单）全收进菜单，格子本身只有一个按钮。 */
  function ownerCell(p, me, maps) {
    const isMe = me && p.owner === me;
    const id = p.ownerId || p.owner;
    const act = isMe ? null : ownerActions(p, maps);
    const mark = (kind, icon, label) =>
      `<span class="mk mk-${kind}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${UI.icon(icon)}</span>`;
    const marks = !act ? '' : (act.prio.on ? mark('prio', 'star', t('proj.prio.inList')) : '')
      + (act.gift.on ? mark('gift', 'heart', t('proj.menu.gifted')) : '')
      + (act.block.on ? mark('block', 'ban', t('proj.menu.blocked')) : '');
    // 名字进主页。地址里的用户名优先（parseProjects 从站点 <a> 的 href 里读出来的），
    // 读不到才回落显示名 —— 两者不一致时，只有 URL 里那个能打开对的人。
    const href = id ? `/user/${encodeURIComponent(id)}/profile` : '';
    // 菜单至少要有一项能打才出现（与别处同一条规矩：状态不明的地方不给动作）
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

  /** 3 点菜单的内容（浮层，挂在 #sp 里由 mount() 定位，不能放进表格 —— 会被 .tablewrap 裁掉）。
   *  三项都是"把这个人放进某份名单"：前面一个图标说明这是什么动作，右边的勾说明你现在的状态，
   *  已在名单里时文案翻成撤回。地址一律来自解析结果，读不到就不给那一项。 */
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

  function projectRow(p, me, maps) {
    // 分数单占一列：跟在条子后面会让每条轨道的长度随数字宽度变来变去（见 40-ui.js 的 progress）。
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

    // 三份名单（都是我自己那份，来自账户设置页）：优先级决定「优先 / 移出」，
    // 赞助名单与黑名单喂给发布者那格的 3 点菜单。任何一份读不到就整列不给按钮 ——
    // 不猜状态，也不摆一个按下去必然出错的按钮。
    const maps = state.account
      ? {
        prio: new Map((state.account.priority || []).map((x) => [x.name, x])),
        sponsor: new Map(((state.account.sponsor && state.account.sponsor.list) || []).map((x) => [x.name, x])),
        blocked: new Map((state.account.blockedOwners || []).map((x) => [x.name, x])),
        add: state.account.add || {},
      }
      : null;
    const prio = maps ? maps.prio : null;

    const filters = [
      ['all', t('proj.all')],
      ['rendering', t('proj.status.rendering')],
      ['waiting', t('proj.status.waiting')],
      ['gpu', t('proj.gpu')],
      ['cpu', t('proj.cpu')],
    ];

    // 全站实时放在这一页的顶上：它是"农场现在在干什么"，不是"我在干什么"。
    // 总览是个人仪表盘，把这四个数字塞进去会喧宾夺主。
    const farmRow = state.home && state.home.stats && state.home.stats.length ? UI.farm(state.home.stats, { flush: true }) : '';

    // 打开的 3 点菜单：浮层是 #sp 的直接定位子元素，**不能**放进表格里 ——
    // .tablewrap 是 overflow:auto，绝对定位的浮层会被它裁掉（最后几行尤其明显）。
    // 坐标由 Views.mount() 量一次触发按钮的位置再写进去。
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

  /* ============================================================== 排行榜 */

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

  /* ============================================================== 设置 */

  function settings(state) {
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, label]) =>
      `<button data-v="${v}" aria-pressed="${String(cur) === v}">${esc(label)}</button>`).join('')}</div>`;

    // 语言列表由注册表动态生成 —— 新增一门语言不需要改这里
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
          <div class="lbl">${esc(t('set.about'))}</div>
          <div class="hint" style="margin-top:0">${esc(t('set.aboutText'))}</div>
          <div class="hint">${esc(t('set.dangerHint'))}</div>
        </div>
      </div>`;
  }

  /* ============================================================== 账户设置 */

  /** 用户列表：头像 + 用户名 + 移除。动作地址是解析器从站点 onclick 里读出来的，不自己拼。
   *  移除是维护动作，用次级按钮 —— 实心主按钮留给每个面板里那个真正的"提交"。
   *  opts.requiresAction：动作读不到时**不画按钮**。赞助名单就是这样 —— 我们自己的名单是空的、
   *  站点不渲染这些行，没有样本可抄；宁可不给动作，也不猜一个 URL。 */
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

    /* 赞助开关：状态与动作都来自站点（checked + onclick 里的 URL）。点了就 POST 到那个地址、
       成功后整页重取 —— 与账户页别的开关走同一条收口，动作地址不自己拼。 */
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

    /* 捐赠积分（站点叫 Sponsorship）：你渲染挣到的积分会给名单里的随机一位。
       两个开关的地址、名单的增删地址全部来自解析结果；拿不到就不画那一块 ——
       状态不明的地方不给动作，这条规矩和项目页的优先级开关是同一条。 */
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

    // 七块面板堆成一列太长，按"一次只想看一件事"分三档。复用设置页那套分段控件（.seg）——
    // 它本来就是"同一件事的不同视图"的控件，不必再造一个 tab 组件。调度与名单合并成一档：
    // 用户反馈"调度那块太空"，而"谁的项目我渲染 / 谁的项目我不渲染"本来就是一件事。
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

  /* ====================================================== 会话页（一台机器）
     入口：总览「已连接的机器」→「查看会话」。
     三块数据各自独立：机器信息与可渲染项目在同一份 HTML 里，时间线是站点自己的
     AJAX JSON。任何一块拿不到，只让那一块说"没有数据"，其余照常显示。 */
  const sessState = { type: 'all', limit: 100 };

  // 已经在身份条/指标带里说过的项，不再进事实清单 —— 同一件事在一屏里说两遍就是噪音
  const sessElsewhere = new Set(['hostname', 'os', 'owner', 'version', 'frames', 'points', 'power', 'maxTime', 'status', 'action']);

  /** 事实清单的标签：站点原文 → 当前语言；站点新加的行不认识也照样显示，不吞数据 */
  function sessLabel(f) {
    if (!f.key) return f.label;
    const k = `sess.f.${f.key}`;
    const hit = t(k);
    return hit === k ? f.label : hit;
  }

  /** 站点的事件类型词 → 本地化文案；认不出来的原样显示，绝不露出半个键名 */
  function typeLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '—';
    const k = `sess.tl.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const hit = t(k);
    return hit === k ? s : hit;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /** 毫秒时间戳 → 本地 MM-DD HH:mm。不走 toLocaleString：时间线是一列要对齐的
   *  数字，形状必须可预期（中文环境下 "10月3日 21:32" 会让整列参差不齐）。
   *  withYear：区间跨年时才带上年份 —— 不跨年时年份是噪音。 */
  function stamp(ms, withYear) {
    const d = new Date(Number(ms));
    if (!Number.isFinite(d.getTime())) return '—';
    const y = withYear ? `${d.getFullYear()}-` : '';
    return `${y}${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  /** 事件时长。Util.duration 是给"机时"设计的，几秒的事件会被它读成 0m，这里单独写。 */
  function spanText(ms) {
    const s = Math.max(0, Math.round(Number(ms) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h${pad2(m % 60)}m`;
    return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
  }

  /** 站点数字文案 → 数值（"21,544" / "271" / "22 %"）。没有数字返回 null。
   *  真实的 0 要如实返回 0 —— 新机器就是 0 帧，那和"读不到"是两回事。 */
  const numOf = (s) => {
    const raw = String(s === undefined || s === null ? '' : s);
    if (!/\d/.test(raw)) return null;
    const n = Number(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  /** 毫秒 → 本地日期键。汇总按"这台机器本地的天"分桶，和行里的时间戳用同一套时区。 */
  function lkey(ms) {
    const d = new Date(Number(ms));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /**
   * 事件流 → 活动汇总：跨度超过 31 天按月，否则按天，最近的在前。
   * 每条只留能回答"这台机器在不在干活"的四个数：真正用于渲染的时长、事件数、
   * 涉及作业数、发送失败数。原始的 761 条事件不是不要，是不默认铺出来（见下面的完整日志）。
   */
  function activity(list) {
    // 自己先排一遍倒序：这个方法只该依赖"事件数组"，不该依赖调用方已经排好
    const ev = (list || []).filter((e) => Number.isFinite(e.start)).slice().sort((a, b) => b.start - a.start);
    if (!ev.length) return { rows: [], byMonth: false, anyRender: false, anyFail: false, crossYear: false };
    const byMonth = Util.ddiff(lkey(ev[ev.length - 1].start), lkey(ev[0].start)) + 1 > 31;
    // 跨年时日期键要带年份：一屏 "12-28 → 02-10" 谁也说不清是哪一年
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
    // 条的分子只有一个：渲染时长。一条渲染事件都没有时**不换口径**（不拿事件数冒充），
    // 只把填充留空 —— 一排空轨道读出来就是"这台机器没在渲染"。见视图里的 showBar。
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

    /* ---- 身份条：状态徽章 + 主机名 + OS / 属主 / 客户端版本 ---- */
    const status = val('status');
    const chip = s.running === true ? `<span class="chip">${esc(t('sess.on'))}</span>`
      : s.running === false ? `<span class="chip off">${esc(t('sess.off'))}</span>`
        : (status ? `<span class="chip">${esc(packLabel('sess.status', status))}</span>` : '');

    const bits = [];
    if (val('os')) bits.push(`<span>${esc(val('os'))}</span>`);
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

    /* 时间线先算出来：指标带要用它取"起算时刻"，下面那块还要用它的汇总 */
    const tl = s.timeline || [];
    const acts = activity(tl);

    /* ---- 指标带：这台机器干了多少活 ----
       起算时间用日志里最早那一条的**本地**时刻，不用站点原文：站点把 Creation Time 写在自己的
       时钟上（实测 UTC+2），而下面时间线是我们的本地时区 —— 同一个瞬间在一屏里差 6 小时
       会读成"创建 6 小时后才干活"。站点原文照旧留在机器信息里（那里标了"未做换算"）。 */
    const framesN = numOf(val('frames'));
    const pointsN = numOf(val('points'));
    const perFrame = framesN && pointsN ? Math.round(pointsN / framesN) : null;
    // 它自己报的单帧上限，和它实际跑过的最长一帧放在一起：这两个数不一致时，用户该知道
    const longest = tl.reduce((a, e) => Math.max(a, Math.max(0, e.end - e.start)), 0);
    const since = tl.length ? stamp(tl[tl.length - 1].start) : val('createdAt');

    const kpiItems = [
      {
        k: t('sess.kpi.frames'), v: framesN === null ? '—' : Util.num(framesN),
        d: since ? t('sess.kpi.since', { t: since }) : '',
      },
      {
        k: t('sess.kpi.points'), v: pointsN === null ? '—' : Util.num(pointsN),
        d: perFrame ? t('sess.kpi.perFrame', { n: fmt(perFrame) }) : '',
      },
      {
        k: t('sess.kpi.power'), v: val('power') || '—',
        d: s.info.power && s.info.power.href
          ? `<a href="${esc(s.info.power.href)}" target="_self">${esc(t('sess.kpi.powerLink'))}</a>` : '',
      },
      {
        k: t('sess.kpi.maxTime'), v: val('maxTime') || '—',
        d: longest ? t('sess.kpi.longest', { v: spanText(longest) }) : '',
      },
    ];

    /* ---- 机器控制：站点自己的那个按钮，同一批地址、同一套会话 ----
       只在看自己的机器时出现。实测别人的会话页站点直接 404，所以这一条实际是兜底：
       万一哪天站点放开了可见性，我们也不会摆一个按下去必然报错的按钮 —— 那时 Action
       这一行会退回事实清单里按原文显示，而不是沉默地消失。 */
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

    /* ---- 事实清单：两列键值，一格一件事。密钥排最后：它是偶尔来查一次的东西 ---- */
    const rest = s.facts.filter((f) => !sessElsewhere.has(f.key) || (f.key === 'action' && !showControl))
      .sort((a, b) => (a.key === 'renderKey' ? 1 : 0) - (b.key === 'renderKey' ? 1 : 0));
    const factsPanel = rest.length ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.facts'))}</h2><span class="sub">${esc(t('sess.factsSub'))}</span>
      </div>
      <div class="facts">${rest.map((f) => {
        let v;
        if (f.key === 'renderKey' && f.secret) {
          // 密钥：站点本来也是"点一下才显示"，照做。只落在属性里，不进可见文本。
          v = `<span class="num sec" data-key="${esc(f.secret)}">••••••••••••</span>` +
            `<button class="btn sm" data-act="reveal-key" aria-pressed="false">${esc(t('sess.reveal'))}</button>`;
        } else {
          // 每个值都带 tabular：这里的量有单位（9.8 GB / 8h27m / 06:40 Sep 29），
          // 按"能读成量"的规则走，别用启发式去猜哪个像数字
          const raw = f.value || '—';
          const txt = f.href ? `<a href="${esc(f.href)}" target="_self">${esc(raw)}</a>` : esc(raw);
          v = `<span class="num">${txt}</span>`;
        }
        return `<div class="fact"><span class="k">${esc(sessLabel(f))}</span><span class="v">${v}</span></div>`;
      }).join('')}</div>
    </div>` : '';

    /* ---- 时间线：默认给活动汇总，完整日志折叠在后面 ----
       把 761 条事件铺成表格是"把日志当正文"：占掉整屏，每行却只有四个短字段，
       五列还摊在整页宽上。默认给的是按天（跨度长时按月）的四个数——真正用于渲染的
       时长、事件数、作业数、发送失败数——一眼看出这台机器哪天在干活；
       要逐条看事件，再展开下面的完整日志。 */
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
      // 接口没回应时不在这里说"站点没有返回记录"—— 正文已经说了"没取到"，
      // 两句话在同一格里互相打脸（"没回"和"回了空"是两件事）
      : (s.timelineFailed ? '' : t('sess.tlSubEmpty'));

    /* 条只画"渲染时长"这一件事。一台机器从来没有渲染事件时（比如一直只领到校验），
       渲染时长整列都是「—」—— 那时候按事件数画一条会把图形的含义偷偷换掉，列名却还是
       "渲染时长"。这种情况不画填充（轨道照旧留着：一排空轨道读出来就是"零"），
       但**条这一列必须留着占位** —— 它是这行的弹簧，抽掉它表头和数值列会各自靠左排。 */
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

    /* ---- 可渲染项目：按"为什么现在不派给它"分组。
       站点给的是 27 行平铺、原因重复 27 遍；原因本身才是能读的那一层信息。 */
    const groups = new Map();
    for (const p of s.projects) {
      const k = p.reason || '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p.name);
    }
    const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    // 发布者：站点这张表只给项目名，发布者要去项目列表页按名字对（实测真站点 33/33 对得上）。
    // 重名项目一律不挂 —— 两个同名的项目挂谁都可能是错的，宁可留空。
    const own = new Map();
    const dup = new Set();
    for (const p of state.projects || []) {
      if (!p.name) continue;
      if (own.has(p.name)) dup.add(p.name);
      else own.set(p.name, p);
    }
    for (const n of dup) own.delete(n);

    const prjPanel = s.hasProjects !== false ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.projects'))}</h2>
        <span class="sub">${esc(t('sess.prjSub', { n: fmt(s.projects.length) }))}</span>
      </div>
      <div class="pbody" style="padding-top:4px">
        ${ordered.length ? ordered.map(([reason, names]) => `<div class="wgroup">
          <div class="wghead"><span class="wgname">${esc(reason ? packLabel('why', reason) : t('sess.whyNone'))}</span>
            <span class="num">${names.length}</span></div>
          <div class="wnames">${names.map((n) => {
            const p = own.get(n);
            // 链接用 URL 里的用户名（ownerId），显示用站点给的名字 —— 站点哪天渲染显示名也不会拼出坏链接
            const who = p && (p.ownerId || p.owner)
              ? `<a href="/user/${encodeURIComponent(p.ownerId || p.owner)}/profile" target="_self" title="${esc(`${t('sess.publisher')} · ${p.owner || p.ownerId}`)}">${esc(p.owner || p.ownerId)}</a>`
              : '';
            return `<span class="wname"><span class="nm" title="${esc(n)}">${esc(n)}</span>${who}</span>`;
          }).join('')}</div>
        </div>`).join('') : `<div class="none">${esc(t('sess.prjNone'))}</div>`}
      </div>
    </div>` : '';

    return head + UI.kpis(kpiItems) + factsPanel + control + timelinePanel + prjPanel + foot();
  }

  /* ======================================================== 挂载后补丁
     视图本身是纯字符串；只有总览的积分曲线需要拿到真实像素宽度才能画。 */
  function mount(root, state) {
    const box = root && root.querySelector('#sp-chart');
    const pts = state && state.profile && state.profile.points;
    if (box && pts && pts.length > 1) SP.Charts.points(box, pts);
    // 热力图格子要能回答"这是哪一天"，原生 title 太慢，挂一个真正的浮层
    if (root) SP.UI.bindHeatTips(root.querySelector('.heatwrap'), I18n.lang);
    // 3 点菜单的坐标：它挂在 #sp 里（表格容器是 overflow:auto，放表格里会被裁掉），
    // 所以只能量一次触发按钮的位置再写进去。右对齐到按钮，靠视口下沿时向上翻。
    const menu = root && root.querySelector('#sp-omenu');
    const trigger = root && root.querySelector('[data-act="owner-menu"][aria-expanded="true"]');
    if (menu && trigger) {
      const host = document.getElementById('sp');
      const b = trigger.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const z = Util.zoomOf(host);   // 界面缩放的补偿：rect 是物理像素，left/top 是 CSS 像素
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      // 左缘对齐到**菜单按钮**（用户拍板）：菜单从按钮的左缘往右铺，而不是往左倒挂。
      // 顶到视口右边界时整体左移，别溢出去。
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

  SP.Views = { overview, projects, ranking, settings, account, session, projState, rankState, acctState, sessState, dailySeries, mount };
})();
