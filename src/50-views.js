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

  /** 三份名单（都是我自己的那份，来自账户设置页）：优先级决定「优先 / 移出」，
   *  赞助名单与黑名单喂给发布者那格的 3 点菜单。任何一份读不到就整格不给按钮 ——
   *  不猜状态，也不摆一个按下去必然出错的按钮。项目页与会话页共用同一份构造。 */
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
    // 赞助名单与黑名单喂给发布者那格的 3 点菜单。任何一份读不到就整格不给按钮 ——
    // 不猜状态，也不摆一个按下去必然出错的按钮。
    const maps = listsOf(state);
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
          <div class="lbl">${esc(t('set.exp'))}</div>
          ${seg('sp-exp', state.expUpload ? 'on' : 'off', [['on', t('set.on')], ['off', t('set.off')]])}
          <div class="hint" style="margin-top:9px"><b>${esc(t('set.expUpload'))}</b></div>
          <div class="hint">${esc(t('set.expUploadHint'))}</div>
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
  const sessElsewhere = new Set(['hostname', 'os', 'owner', 'version', 'frames', 'points', 'power', 'powerGpu', 'maxTime', 'status', 'action', 'currentFrames']);

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

    /* ---- 身份条：状态徽章 + 主机名 + OS / 属主 / 客户端版本 ----
       状态徽章先说站点那行没有标签的状态行：**两种暂停是不同的两件事**。
       服务器端点暂停 → "Paused server side"；客户端自己暂停 → "Paused client side"。
       它才是权威说法 —— Action 那格只说明"服务器认不认它在跑"，而客户端本地暂停时
       服务器仍然认为它在跑（Status 也照样写着 Enable），只看 Action 会把本地暂停
       报成「运行中」。认得出的译成中文，认不出的原样显示，站点原文一律挂 title 备查。 */
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
    /* 这台机器此刻在跑什么。站点写在 "Current frames"，形如
       "project: 1002.blend frame: 194 Request time: 1m"（空闲时它不印这一行）。
       它是**活的** —— 几分钟就变 —— 所以放在身份条上，不留在「机器信息」那张表里：
       那张表的副标题正是"站点报告的原值，未做换算"，把一个马上过期的数字混进静态
       原值里，读者会拿它当档案看。暂停时说"当前作业"而不是"正在渲染"，
       否则会和旁边那枚「已暂停」徽章自相矛盾。 */
    const cur = val('currentFrames');
    const cm = cur.match(/^project:\s*(.+?)\s+frame:\s*(\S+)\s+Request time:/i);
    // 正在跑哪个项目的哪一帧。项目名后面还要用一次 —— 可渲染项目表里给那一行挂「正在渲染」。
    // 站点在「Current frames」里写的是**文件名**（1002.blend），可渲染项目表里写的是
    // **项目名**（1002），所以比对时把 .blend 后缀剥掉。
    const curProject = cm ? cm[1] : '';
    const curProjectBase = curProject.replace(/\.blend\d*$/i, '');
    if (cm) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cm[1])}</b> · ${esc(t('sess.frame'))} <b class="num">${esc(cm[2])}</b></span>`);
    } else if (cur) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cur)}</b></span>`);
    }
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
    const since = tl.length ? stamp(tl[tl.length - 1].start) : val('createdAt');

    /* 算力那一格跟着站点印了哪一行走：这台机器启用了哪个计算设备，站点就印哪一行 ——
       CPU 机器给 "Power CPU"，GPU 机器给 "Power GPU"，两个都开就两行都在，于是这一带
       从 4 格变 5 格（.kpis[data-n="5"] 在 5 / 3 / 2 三档宽度下都验过，见 30-style.js）。
       这里**不写死 CPU 或 GPU**，只遍历站点真的印了哪几行：站点哪天再添第三种设备，
       多出来的那行会照既有规矩落进「机器信息」（标签原样显示），不会被吞。
       早先写死读 Power CPU，于是纯 GPU 机器（只开 GPU 渲染）上那格永远是"—" ——
       那不是"没数据"，是这台机器根本不用 CPU 渲染，摆一格空的会被读成"CPU 有问题"。
       一行都没给就整格不画：站点没给的不摆空壳。 */
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
        // 只说上限。早先这里还挂一句"实测最长一帧"，但两者本就不可比（一个是参考机上的
        // 预估上限，一个是本机实际耗时），摆在一起只会让人以为哪个数不对，已按用户要求去掉。
        k: t('sess.kpi.maxTime'), v: val('maxTime') || '—', d: '',
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

    /* ---- 可渲染项目。
    
       **站点的行序就是优先级，必须原样保留。** 实测一台机器：前 12 行写的是
       "Renderable"（此刻真能渲染的），之后才是 "Over user's time limit"、
       "Computer has previously failed to render project" 这些；而且第 1 行往往
       就是这台机器此刻正在渲染的那个项目（实测 1. 1002 对 "project: 1002.blend"）。
       换句话说，"越靠前越可能先渲染"这层信息只存在于顺序里，站点没用别的列表达它。
       所以这里只做一次映射，不排序、不分组、不去重。

       早先按原因分组、组内重排，等于把这层信息抹掉了 —— 表面更好看，代价是丢事实。 */
    const prjRows = s.projects.map((p) => ({
      n: p.name,
      label: p.reason ? packLabel('why', p.reason) : t('sess.whyNone'),
      p: own.get(p.name) || null,
    }));

    // 发布者那一格用与项目页同一个 ownerCell：头像 + 名字 + 常驻名单标记 + 3 点菜单。
    // 三份名单来自账户设置页 —— ensureData 为会话页也取一次，否则整格不给动作。
    const maps = listsOf(state);
    // 打开的 3 点菜单：和项目页一样，浮层放在视图最外层（.tablewrap 是 overflow:auto，
    // 放进去会被裁掉），坐标由 Views.mount() 量触发按钮的位置再写进去。
    const openP = projState.menu ? [...own.values()].find((x) => x.id === projState.menu) : null;
    const menuHtml = openP ? ownerMenu(openP, state.userName, maps) : '';

    /* 列与项目页对齐：项目 / 发布者 / 状态 / 进度（条 + 分数两列）/ 设备 / 内存。
       进度那两列是分开的 —— 分数挂在条子后面会让每行的轨道长度随数字宽度变来变去，
       这条规矩见 docs/DESIGN.md 的 Progress Bar 一节。 */
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
          // 关联得到就用项目页那一格；关联不到留一个破折号 —— 缺一个事实就让它缺着，不猜。
          const who = p && (p.ownerId || p.owner) ? ownerCell(p, state.userName, maps) : '<span class="dash">—</span>';
          // 这台机器此刻正在跑的那一行：站点在「Current frames」里给的是文件名，
          // 表里是项目名，所以连剥掉 .blend 后的名字一起比。
          const isCur = !!curProject && (curProject === n || curProjectBase === n);
          const frac = p ? UI.progressText(p.pct, p.done, p.total) : '';
          return `<tr>
            <td><div class="pnwrap"><div class="pn" title="${esc(n)}">${esc(n)}</div>${
              isCur ? `<span class="now">${esc(t('sess.rendering'))}</span>` : ''}</div></td>
            <td>${who}</td>
            <td><span class="st">${esc(label)}</span></td>
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

  /* ======================================================== 挂载后补丁
     视图本身是纯字符串；只有总览的积分曲线需要拿到真实像素宽度才能画。 */
  /* ================================================== 项目上传页 / 分析等待页
     这两页与前面六个视图不是一回事，写清楚免得后来人改错：

     前六个是"整页重建" —— 数据从站点页面解析出来，界面由字符串模板画出来。
     这两页是**局部换装**：卡片骨架我们画，但**能干活的节点从原站搬过来**。

     为什么搬而不是重画：上传表单靠 `onsubmit="addproject_upload_progress_fct(uid)"`
     触发站点自己的 addproject.js，估算器靠一段内联 `jQuery(...).autocomplete()` 绑定
     设备名搜索，进度条由站点的轮询喂。这些绑的都是 **id 和事件属性**，不是外观 ——
     节点搬进我们的卡片，处理器全都还在；重画就等于把上传、进度轮询、设备自动补全
     在客户端再实现一遍，而且站点一改就得跟着改。

     搬运的另一个前提：文案已经翻译过了。DomI18n 明确**不进 #sp**，所以搬运必须发生在
     它跑完之后 —— 顺序是"先让站点页面在原地翻好，再把节点搬进来"，见 80-app.js 的 boot。

     验证状态（2026-10-04，别当成"已在真实安装路径下验过"）：
     这两页是对着**真实页面**验的，但验法是「先清掉已安装脚本的节点、再把 dist 产物注入
     已加载的页面」。所以 `@run-at document-start` 那一段 —— 防闪、以及守卫在原站界面画出来
     之前注入的时机 —— **没有走完整安装路径**。补它只能靠用户更新到新版后直接看。
     详见 docs/PUBLISHING.md 的「五、验证状态」。 */

  /** 卡片骨架。真正的内容由 wireUpload() / wireUploadDoc() 装进来，所以这里只有空的插槽。
   *  opts.inApp：应用内版本（实验性入口点进来的那一个），顶上多一句话说明它的性质。 */
  function upload(state, opts) {
    return `<div class="wrap up">
      <div class="sechead">
        <h2>${esc(t('up.title'))}</h2>
        <span class="sub">${esc(t('up.sub'))}</span>
      </div>
      ${opts && opts.inApp ? `<div class="expnote">${esc(t('up.expNote'))}</div>` : ''}
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

  /**
   * 站点那句「Max: 2,048 MB before ZIP compression / Blender compression is recommended
   * and supported.」和 `<input type="file">` 挤在同一个 `<td>` 里。
   *
   * 这一格正是「翻译层不能整块替换」那条安全规则被踩出来的地方（见 70-i18n-dom.js）：
   * 整块替换会把文件框一起删掉。但那一格被 `<br>`/`<strong>` 切成了好几个文本节点，
   * 逐节点翻译也拼不回一句中文 —— 所以这句话由卡片自己说，**大小从站点原文里读**
   * （上限是站点配置，不写死）。认不出站点那句话就原样留着，不猜。
   */
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

  /**
   * 须知那一块的收尾。**只贴标签、只去掉一个多余字符，不改写任何文字** ——
   * 排版该由 CSS 干，这里只处理 CSS 够不着的两件事：
   *
   *   1. 站点把「项目总数: 29」写成一个**裸文本节点**直接挂在容器里（不是元素）。
   *      裸文本节点没法给类名、没法排版，所以给它包一个 span。
   *   2. CPU/GPU 那一行是 `<ul>`，但它的语义是"两个数"，给它 `.qpos` 让它排成一行数据。
   *   3. 站点那句 `…<strong>3.0 or higher</strong>.` 的句号在 `<strong>` **外面**；
   *      中文译文自带句号，于是渲染成「…或更高。.」这种双句号。孤立的一个 "." 去掉 ——
   *      只在**前面已经以句末标点收尾**时才去，所以英文界面（不翻译）原样保留。
   */
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

    /* 排队那一组（说明 + CPU/GPU + 项目总数）原来整组竖着摞在左边，右边半张卡片空着。
       把它拆成"说明在左、数字在右"的横带 —— 只是把已有节点分到两个盒子里，不碰文字。
       另外站点把「预计排队位置：」和那三个数字写在同一段里、用 <br> 隔开；
       既然数字搬到了右边，这条引子也跟着数字走 —— 留在正文末尾就是一句吊着的话。 */
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

  /**
   * 估算器的结果是**站点渲染的一段英文 HTML**，通过 AJAX 落进我们的卡片
   * （`POST /project/estimator` → `<h4>` + 一句英文 + 一张 Bootstrap 表格）。
   * 这里管两件事：
   *   1. 用同一份词典把它翻成当前语言 —— `DomI18n.translateSubtree()` 允许翻译器
   *      走进 #sp，因为这段 DOM 虽然在我们的容器里，文字却是站点的；
   *   2. 去掉中文译文后面吊着的那个英文句号：站点原句是
   *      `…up to <strong>10,958 points</strong>.`，句号在 <strong> 外面，
   *      翻完就成了「…10,958 积分.」。
   */
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

  /**
   * 应用内版本：把 `/getstarted` 抓回来，从**解析出的文档**里取同样那三块装进卡片。
   *
   * 与 wireUpload()（就地搬活节点）的差别，以及为什么还得有这一条：
   *   · 就地搬，绑定全都活着，但那一页带着站点的头尾和下载指南 —— 从新界面点进来会变成
   *     "新界面 → 原版页面 → 卡片"的来回跳（用户报的正是这个）。
   *   · 抓回来装，页面完全在新界面里；代价是 `<script>` 不会执行，所以估算器的设备名
   *     自动补全要自己重新绑一次（这是这里唯一需要"再实现一遍"的东西，源地址仍从
   *     站点那段脚本里读，不写死）。表单本身不用管：它靠 `onsubmit` 属性提交，
   *     而 addproject.js 在每一页都加载，函数是全局的。
   *
   * 译文同样走一份词典：这里用 DomI18n.translateSubtree()，它允许翻译器走进 #sp。
   */
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

    /* **先翻译、再整理**，顺序不能反。整块翻译的模式规则是按站点原句写的，
       而 tidyRules 会把「排队情况」那段在 <br> 处切开（引子跟数字走），切完就不再有
       "Predicted position in queue:" 结尾 —— 整块规则随即失配，那一段就永远是英文。
       （就地搬的那条路径没这个问题：页面翻译层在搬运之前就跑过了。） */
    for (const slot of [slotForm, slotEst, slotRules]) if (slot) SP.DomI18n.translateSubtree(slot);
    if (slotForm) rewordFileLimit(slotForm);
    if (slotRules) tidyRules(slotRules);
    return true;
  }

  /**
   * 估算器的设备名自动补全，站点是**内联脚本**绑的（`jQuery(...).autocomplete({...})`）。
   * 抓回来的 HTML 里那段脚本不会执行，所以这里照它原来的参数重绑一次 ——
   * 源地址从那段脚本里读，不写死。绑不上就让它做一个普通输入框（估算器会回
   * "failed to import device"，用户看得见，不会静默出错）。
   */
  function rebindDeviceSearch(estBlock, html) {
    const src = (html.match(/#addproject_estimator_device_form_search_text_label"\)\s*\.autocomplete\(\{[\s\S]{0,600}?source:\s*"([^"]+)"/) || [])[1];
    const $ = window.jQuery;
    if (!src || !$ || !$.fn || !$.fn.autocomplete) return;
    const label = estBlock.querySelector('#addproject_estimator_device_form_search_text_label');
    const value = estBlock.querySelector('#addproject_estimator_device_form_search_text_value');
    if (!label) return;
    $(label).autocomplete({
      minLength: 3,
      source: src,
      select(event, ui) {
        $(label).val(ui.item.label);
        if (value) $(value).val(ui.item.value);
        return false;
      },
    });
  }

  /**
   * 把 /getstarted 上「Add your project」那一段的节点搬进卡片，然后用 #sp 顶掉原站那一段。
   *
   * 三个可能的现场，都要认：
   *   1. 站点给了上传表单（正常）；
   *   2. 站点给了 `#addproject_warning_zero_frame`（渲染帧数不够，站点自己拦住不让传）；
   *   3. 两个都没有 —— 站点渲染的是 printError（未登录 / 维护中 / 管理员关了上传）。
   * 第 3 种**原样还给用户**：这一页本来就不是我们能接管的，退回"只补翻译"。
   *
   * 返回 false 表示什么都没动过（调用方据此退回原站界面）。
   */
  function wireUpload(root) {
    const slotForm = root.querySelector('[data-up="form"]');
    const slotEst = root.querySelector('[data-up="est"]');
    const slotRules = root.querySelector('[data-up="rules"]');
    const estPanel = root.querySelector('[data-up="estPanel"]');
    const main = document.querySelector('#addproject_main_div');
    const blocked = document.querySelector('#addproject_warning_zero_frame');
    // 先判定、再动手：走第 3 条路时不能留下半搬的状态
    if (!main && !blocked) return false;

    if (main) {
      // 结构：#addproject_main_div > .row > [.col-md-5（表单块 + 估算器块）, .col-md-6（须知）]
      const left = main.querySelector(':scope > .row > .col-md-5');
      const right = main.querySelector(':scope > .row > .col-md-6');
      const blocks = left ? [...left.children] : [];
      const formBlock = blocks.find((b) => b.querySelector('form[action*="/project/internal/upload"]')) || blocks[0];
      const estBlock = blocks.find((b) => b !== formBlock) || null;
      if (formBlock && slotForm) { slotForm.appendChild(formBlock); rewordFileLimit(formBlock); }
      if (estBlock && slotEst) {
        slotEst.appendChild(estBlock);
        /* 估算器自己那张「渲染耗时 / 帧数」表要单独标出来：它和站点稍后返回的结果表格
           不是一回事 —— 前者是两列标签值，后者是带表头的真表格。没有这个类名，
           针对前者的网格规则会连后者一起命中，把列序搞乱（实测把分块数和耗时对调了）。 */
        const numTable = estBlock.querySelector('table');
        if (numTable) numTable.classList.add('numband');
        watchEstimatorResult(slotEst.querySelector('#addproject_estimator_result'));
      }
      else if (estPanel) estPanel.remove();
      if (right && slotRules) { slotRules.appendChild(right); tidyRules(slotRules); }
    } else if (slotForm) {
      // 站点自己写明了为什么不能传，把那一段原样搬过来 —— 理由由站点负责，我们只换外观
      slotForm.appendChild(blocked);
      if (estPanel) estPanel.remove();
    }

    // 站点那个 <h3>Add your project</h3> 连同它那一节一起让位：现在这一段的标题在我们的卡片上
    const section = (main || blocked).closest('section');
    if (section && section.parentElement) section.replaceWith(root);
    else (document.body || document.documentElement).appendChild(root);
    return true;
  }

  /* ------------------------------------------------------------ 分析等待页 */

  /** 上传后的等待页。整页归我们：站点那一版就是一个转圈圈加一句英文。
   *  真正在跑的是 80-app.js 里的轮询 —— 它认的是 `#sp-an-*` 这几个钩子。 */
  function analyse() {
    return `<div class="wrap">
      <div class="sechead">
        <h2>${esc(t('an.title'))}</h2>
        <span class="sub">${esc(t('an.sub'))}</span>
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
        <div class="an-done" data-an="done" hidden>
          <div class="an-sub">${esc(t('an.doneNote'))}</div>
          <button class="btn" data-act="mode-classic">${esc(t('mode.toClassic'))}</button>
        </div>
        <div id="sp-an-result" class="sp-siteform" hidden></div>
      </div>
      <div class="foot">${esc(t('footer.source'))}</div>
    </div>`;
  }

  function mount(root, state) {
    // 上传页的搬运放在这里，是因为它要等 #sp 已经进了 DOM、卡片骨架已经在里面。
    // 搬不动（这一页站点渲染的是 printError，没有表单）就回 false，让调用方把页面还回去。
    /* 上传视图的接线。注意那个 `.up-grid` 判断：show() 先画一屏骨架再取数据，而骨架里没有
       卡片 —— 少了这个条件就会在骨架阶段就把 body 标成"已接线"，等真正出内容的那次
       render() 反而早退，卡片永远不出现。（实测踩过一次。） */
    if (state && state.view === 'upload' && root && !root.dataset.spWired && root.querySelector('.up-grid')) {
      root.dataset.spWired = '1';
      // 抓回来的片段没经过页面翻译层，翻译开关要在这里自己执行（就地搬的那条路径已经翻过）
      SP.DomI18n.enabled = !!state.translateSite;
      const ok = state.uploadHtml ? wireUploadDoc(root, state.uploadHtml) : wireUpload(root);
      if (!ok) return false;
    }
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

  SP.Views = { overview, projects, ranking, settings, account, session, upload, analyse, projState, rankState, acctState, sessState, dailySeries, mount };
})();
