/* ==== 50-views.js：视图层（六个视图 + 上传卡片 + 分析等待页） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  /* 视图层公共件（45-view-kit 提供）：解构成局部名字，下面代码不用动。 */
  const { esc, fmt, foot, moreRow, dailySeries, statOf, asCount, rankOf, isoDate, packLabel, whyLabel } = SP.VK;

  /* 站点主页那个「Connected as …」框里的客户端状态（Waiting to render / Rendering for X / …）
     **不再画**（用户 2026-10-07）：说的是"你自己客户端"的状态，现在在线机器那块把每台机器的
     真实状态（等待任务 / 渲染中 / 暂停）逐台说清了，身份条上这一格只会重复且容易误读。 */

  /* ==== 我的项目（个人主页那张表，两处共用） ====
     数据来自 Api.parseMyProjects（见 20-api.js 的那段注释）：自己的主页每行带 id，别人的主页没有。
     站点**没给**最后更新时间、也不给设备/内存，所以这两处只画名字、状态、（渲染中的）百分比。 */

  const MY_KIND_KEY = {
    rendering: 'proj.status.rendering', waiting: 'proj.status.waiting',
    paused: 'proj.status.paused', finished: 'proj.status.finished',
  };

  /** 百分比站点只对"渲染中/等待中"给（HTML.php 的 printProjects），没有就只说状态 */
  function myStatus(x) {
    const key = MY_KIND_KEY[x.statusKind];
    const base = key ? t(key) : (x.status || '—');
    return x.pct === null || x.pct === undefined ? base : `${base} ${x.pct}%`;
  }

  const myName = (x) => (x.id
    ? `<a href="/project/${esc(x.id)}" target="_self">${esc(x.name)}</a>`
    : `<span>${esc(x.name)}</span>`);

  const MY_SHOW = 5;

  /* ==== 总览行内的「一个关键事实」 ====
     数据来自 /project/<id> 管理页（80-app 的 fillMetaFor 挂到 p.meta）。总览行只放**一个**
     事实：优先自动删除日期（压成「20 Oct」），其次是帧进度；完整事实放整行 title，不铺开。
     拼接口径与项目页「我发布的」副标题一致（compute · RAM · 帧 · 删除），两处说法不打架。 */

  const MONS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  /** '20th Oct 06:10' → { key: 1020, short: '20 Oct' }；认不出来给 null */
  function parseDelDate(raw) {
    const m = String(raw || '').match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})/);
    if (!m) return null;
    const mon = MONS[m[2].toLowerCase()];
    if (!mon) return null;
    const day = Number(m[1]);
    return { key: mon * 100 + day, short: `${day} ${m[2]}` };
  }

  /** 完整事实（与 51 的 mineMetaLine 同一口径），用于整行 title */
  function metaFacts(p) {
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
    return parts.join(' · ');
  }

  /** 行内那一个关键事实：自动删除日期优先，其次帧进度；都没有返回 null（不占位） */
  function metaKeyFact(p) {
    const m = p && p.meta;
    if (!m) return null;
    const d = parseDelDate(m.autoDelete);
    if (d) return { text: d.short, title: t('my.meta.deleted', { date: m.autoDelete }) };
    if (m.done !== null && m.done !== undefined && m.total) {
      return { text: `${m.done}/${m.total} ${t('proj.frameUnit')}`, title: metaFacts(p) };
    }
    return null;
  }

  /** 标题旁汇总：全部 rows（不只前 5）里的渲染中数量 + 最近自动删除日期 */
  function panelSummary(rows) {
    const running = rows.filter((x) => x && x.statusKind === 'rendering').length;
    let best = null;
    for (const x of rows) {
      const d = parseDelDate(x && x.meta && x.meta.autoDelete);
      if (!d) continue;
      if (!best || d.key < best.key) best = d;
    }
    const bits = [];
    if (running) bits.push(t('my.meta.running', { n: running }));
    if (best) bits.push(t('my.meta.next', { date: best.short }));
    return bits.join(' · ');
  }

  /** 总览的「我的项目」区块。两条边界（用户 2026-10-07 拍板）：
   *  ① 一个项目都没有 → **整块不画**（不摆一块空态占首屏；去上传页的入口在项目页那一档里）；
   *  ② 不是自己的主页 → 不画（那张表没有 id，点不进管理页）。 */
  function myPanel(state, p) {
    if (!state.userName || (state.profileName && state.profileName !== state.userName)) return '';
    const rows = (p && p.myProjects) || [];
    if (!rows.length) return '';
    const summary = panelSummary(rows);

    const list = rows.slice(0, MY_SHOW).map((x) => {
      const fact = metaKeyFact(x);
      const full = metaFacts(x);
      return `<div class="mp"${full ? ` title="${esc(full)}"` : ''}>
        <span class="nm">${myName(x)}</span>
        ${fact ? `<span class="meta" title="${esc(fact.title)}">${esc(fact.text)}</span>` : ''}
        ${x.blocked ? `<span class="st bad">${esc(t('proj.status.blocked'))}</span>` : ''}
        <span class="st">${esc(myStatus(x))}</span>
      </div>`;
    }).join('');

    return `<div class="panel" style="margin-top:16px">
      <div class="phead">
        <h2>${esc(t('my.title'))}</h2>
        <span class="sub num">${esc(t('my.count', { n: rows.length }))}</span>
        ${summary ? `<span class="sub meta-sub">${esc(summary)}</span>` : ''}
        <span class="spacer"></span>
        <a class="sub" href="#/projects" data-scope="mine">${esc(t('my.all'))}</a>
      </div>
      <div class="myproj">${list}</div>
    </div>`;
  }

  /* ==== 总览 ==== */

  /* 总览页的区块注册表与显隐。块名 → 文案；`identity` 与页脚**不做成可关的块**：
     一个是这一页的身份，一个是数据来源那行，关掉只会让页面看着像出错了。
     块标签优先复用区块自己的标题词条（我的项目 / 渲染产出 / 在线机器），只有没有现成
     标题的两块才新增文案。 */
  const OV_BLOCKS = {
    kpi: { label: 'ovb.kpi' },
    mine: { label: 'my.title' },
    charts: { label: 'ovb.charts' },
    heat: { label: 'heat.title' },
    machines: { label: 'machines.title' },
  };
  /* 位置固定的块：不进可调序的那条列表（顶上那条数据看板钉死在那儿，用户 2026-10-07 拍板），
     但**仍然可以关掉** —— "不挪位置"和"不许隐藏"是两件事。 */
  const OV_PINNED = ['kpi'];
  const OV_MOVABLE = Object.keys(OV_BLOCKS).filter((k) => !OV_PINNED.includes(k));
  const OV_PREF = 'ovHidden';
  const OV_PREF_ORDER = 'ovOrder';

  /* 存的是**被关掉的那些键**，不是"开着的那些"。这样以后新加一个块，老用户的偏好里没有它
     → 默认就是开着的；反过来存（存开着的集合）就会出现"加了新块但谁都不显示"。
     认不出的键直接忽略，不留在集合里。 */
  const ovHidden = new Set();
  (function restoreOv() {
    const s = Util.store.get(OV_PREF, null);
    if (!Array.isArray(s)) return;
    for (const k of s) if (OV_BLOCKS[k]) ovHidden.add(k);
  })();

  const ovOn = (k) => !ovHidden.has(k);

  /** 单块开关（设置页那排按钮调它）。全部关掉也允许 —— 那是用户自己的选择。 */
  function setOvHidden(key) {
    if (!OV_BLOCKS[key]) return false;
    if (ovHidden.has(key)) ovHidden.delete(key); else ovHidden.add(key);
    Util.store.set(OV_PREF, [...ovHidden]);
    return true;
  }

  /* 可调序的那条顺序。存法同样是"从宽"：认不出的键丢掉、重复的去掉、固定块不许进来，
     而**偏好里没提到的块按注册表顺序补到末尾** —— 以后新加一块，老用户直接就能看见它，
     不会被一份旧名单挡在外面（和 ovHidden 存"关掉的"是同一个思路）。 */
  let ovSeq = OV_MOVABLE.slice();
  (function restoreOvOrder() {
    const s = Util.store.get(OV_PREF_ORDER, null);
    if (!Array.isArray(s)) return;
    const seen = new Set();
    const out = [];
    for (const k of s) {
      if (!OV_BLOCKS[k] || OV_PINNED.includes(k) || seen.has(k)) continue;
      seen.add(k); out.push(k);
    }
    for (const k of OV_MOVABLE) if (!seen.has(k)) out.push(k);
    ovSeq = out;
  })();

  /** 页面上的渲染顺序：固定块在前（按注册表顺序），其余按用户排的 */
  const ovDisplayOrder = () => OV_PINNED.concat(ovSeq);

  /** 上/下移一格（设置页那对箭头调它）。到头了就返回 false，不落盘也不重画。 */
  function moveOv(key, dir) {
    const i = ovSeq.indexOf(key);
    if (i < 0 || !dir) return false;
    const j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= ovSeq.length) return false;
    ovSeq.splice(i, 1);
    ovSeq.splice(j, 0, key);
    Util.store.set(OV_PREF_ORDER, ovSeq);
    return true;
  }

  /** 设置页里的一块：开关 + 上/下移。固定块只画开关，旁边标一句"固定在顶部"。 */
  function ovRow(k) {
    const i = OV_PINNED.includes(k) ? -1 : ovSeq.indexOf(k);
    const last = ovSeq.length - 1;
    const arrow = (dir, off, icon, key) => `<button class="btn sm" data-ov-move="${k}" data-ov-dir="${dir}"`
      + `${off ? ' disabled' : ''} title="${esc(t(key))}" aria-label="${esc(t(key))}">${UI.icon(icon)}</button>`;
    return `<div class="ovrow">
      <div class="seg"><button data-ov-toggle="${k}" aria-pressed="${ovOn(k)}">${esc(t(OV_BLOCKS[k].label))}</button></div>
      ${i < 0 ? `<span class="lock">${esc(t('ovb.pinned'))}</span>`
    : arrow(-1, i === 0, 'caretUp', 'ovb.up') + arrow(1, i === last, 'caretDown', 'ovb.down')}
    </div>`;
  }

  function identity(p, st) {
    const rank = rankOf(st);
    const badge = packLabel('badge', p.badge, true);
    const teamText = statOf(st, ['Team']).trim();
    /* 团队做成链接：id 来自 parseProfile 在 <dd> 里读到的 /team/<id>（用户 2026-11-12） */
    const teamHref = p.team && p.team.id ? `/team/${encodeURIComponent(p.team.id)}` : '';
    const joined = isoDate(statOf(st, ['Registration']));
    /* 站点那个「Connected as …」的客户端状态**不画**（用户 2026-10-07，见上面那段注释）：
       在线机器那块已经逐台说清"等待任务 / 渲染中 / 暂停"，这里再来一格只会重复且容易误读。 */
    const bits = [];
    if (rank) bits.push(`<span><b class="num">#${esc(rank)}</b> ${esc(t('hero.rank'))}</span>`);
    /* 站点不给名次（未上榜，或上游排名计算出 bug 回一句 "Has not rendered anything…"）：
       如实说没有排名，不留空、也不把句子里的数字当名次。 */
    else bits.push(`<span>${esc(t('hero.rankNone'))}</span>`);
    if (badge) bits.push(`<span><b>${esc(badge)}</b></span>`);
    if (teamText) bits.push(`<span>${teamHref ? `<a href="${esc(teamHref)}" target="_self"><b>${esc(teamText.toUpperCase())}</b></a>` : `<b>${esc(teamText.toUpperCase())}</b>`} ${esc(t('hero.team'))}</span>`);
    if (joined) bits.push(`<span>${esc(t('hero.joined'))} <b class="num">${esc(UI.dateLabel(joined, { year: true }))}</b></span>`);

    return `<div class="identity">
      <div class="idmain">
        ${UI.avatar(p.avatar, p.name, 'av')}
        <div class="idtext">
          <h1>${esc(p.name)}</h1>
          ${bits.length ? `<div class="meta">${bits.join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function overview(state) {
    const p = state.profile;
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
      // 新用户却已经有项目（在建、还没出帧）：把项目摆出来，别让人找不到自己传上去的东西
      return identity(p, st) + (parsed ? UI.newUser() : UI.state.empty())
        + (ovOn('mine') ? myPanel(state, p) : '') + foot();
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
        d: rank ? t('stat.rankWindow', { rank: `<span class="num">${esc(rank)}</span>` }) : t('stat.rankNone'),
      },
      { k: t('stat.time'), v: Util.renderTime(rawTime), d: days ? t('stat.daysEquiv', { days: fmt(days) }) : '' },
      /* 连续天数是从产出日历算出来的：站点没给日历就整格不画（否则会给新账号摆一个"连续 0 天"） */
      ...(hasCalendar ? [{
        k: t('stat.streak'),
        v: d.streakExclToday !== undefined ? `${fmt(d.streakExclToday)} ${t('stat.days')}` : '—',
        d: d.best !== undefined ? t('stat.streakHint', { best: fmt(d.best) }) : '',
      }] : []),
      ...(asCount(created) > 0
        ? [{ k: t('stat.created'), v: Util.statNum(created), d: t('stat.createdHint') }] : []),
      ...(asCount(ordered) > 0
        ? [{ k: t('stat.ordered'), v: Util.statNum(ordered), d: t('stat.orderedHint') }] : []),
    ];
    // 格数变了，每排几格与分隔线由 CSS 按 data-n 自己算（见 30-style.js 的 .kpis[data-n]）
    const kpiBand = UI.kpis(kpiItems);

    /* ---- 8/4 主区：积分增长 + 月度产出 ----
       只有**自己的主页**内联这两块；没有数据源就整块不画（不摆"暂无数据"），只剩一块时铺满整行。
       副标题不再写"当前 X 积分"：上面指标带已有同一个数（用户 2026-10-18）。 */
    const hasPoints = !!(p.points && p.points.length > 1);
    const first = p.points[0], last = p.points[p.points.length - 1];
    const chartSub = t('chart.pointsSub', {
      n: p.points.length, from: first ? first.d : '—', to: last ? last.d : '—',
    });
    const mo = UI.months(daily);
    const pointsPanel = !hasPoints ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('chart.points'))}</h2><span class="sub num">${esc(chartSub)}</span></div>
        <div class="chart" id="sp-chart"><div class="tip" id="sp-tip"></div></div>
      </div>`;

    /* 右侧那张卡：默认「近 30 天概览」，右上角可一键切回「月度产出」，选择落盘（用户 2026-10-18）。
       口径是**含今天的 30 个日历日**（没跑的日子按 0 算），全部是真值、不做任何估算。 */
    const today = Util.dkeyLocal();
    const start30 = Util.dshift(today, -29);
    const byDay = new Map(daily.map((x) => [x.d, x.v]));
    let frames30 = 0, peak30 = { d: '', v: 0 };
    for (let n = 0, d = start30; n < 30; n += 1, d = Util.dshift(d, 1)) {
      const v = byDay.get(d) || 0;
      frames30 += v;
      if (v > peak30.v) peak30 = { d, v };
    }
    /* 活跃天数用站点自己的渲染日历（derived.active30，和上面 KPI 的连续天数同一份数据）；
       帧数曲线在个别日子缺采样点，数出来会比站点少一天。 */
    const active30 = Number.isFinite(Number(d.active30))
      ? Number(d.active30)
      : daily.filter((x) => x.d >= start30 && x.d <= today && x.v > 0).length;
    const avg30 = Math.round(frames30 / 30);
    const peakDate = peak30.v ? new Date(`${peak30.d}T00:00:00`).toLocaleDateString(
      I18n.lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' },
    ) : '';
    /* 积分是累计曲线：取"30 天前（含今天算起）那个采样点"做差，能反映净变化（可能是负的） */
    const pCurve = (p.points && p.points.length > 1) ? p.points : [];
    const pLast = pCurve.length ? pCurve[pCurve.length - 1] : null;
    const pBase = pLast
      ? (pCurve.slice(0, -1).reverse().find((x) => Util.ddiff(x.d, today) >= 30) || pCurve[0])
      : null;
    const points30 = (pLast && pBase) ? Number(pLast.v) - Number(pBase.v) : null;
    const recentOk = daily.length > 0;
    const canToggle = !!(mo.html && recentOk);
    const toggleBtn = (v, label) =>
      `<span class="spacer"></span><button type="button" class="subbtn" data-act="ov-right" data-v="${v}">${esc(label)}</button>`;
    const effCell = (k, v, h) => `<div class="eff"><div class="k">${esc(k)}</div><div class="v num">${esc(v)}</div>${h ? `<div class="h">${esc(h)}</div>` : ''}</div>`;
    const recentPanel = !recentOk ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('recent.title'))}</h2><span class="sub">${esc(t('recent.sub'))}</span>${canToggle ? toggleBtn('months', t('recent.toMonths')) : ''}</div>
        <div class="produce"><div class="effgrid">
          ${effCell(t('recent.frames'), fmt(frames30), t('recent.framesHint', { avg: fmt(avg30) }))}
          ${effCell(t('recent.active'), `${active30} / 30`, t('recent.activeHint'))}
          ${effCell(t('recent.peak'), peak30.v ? fmt(peak30.v) : '—', peak30.v ? t('recent.peakHint', { date: peakDate }) : '')}
          ${effCell(t('recent.points'), points30 == null ? '—' : `${points30 > 0 ? '+' : ''}${fmt(points30)}`, t('recent.pointsHint'))}
        </div></div>
      </div>`;
    const monthsPanel = !mo.html ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('months.title'))}</h2><span class="sub">${esc(t('months.sub'))}</span>${canToggle ? toggleBtn('recent', t('months.toRecent')) : ''}</div>
        <div class="produce">${mo.html}</div>
      </div>`;
    /* 偏好 'months' 才显示月度；没有近 30 天数据时自动回退；两边都没有就整块不画 */
    const rightPanel = (state.ovRight === 'months' || !recentPanel) ? monthsPanel : recentPanel;
    const main = pointsPanel && rightPanel
      ? `<div class="grid">${pointsPanel}${rightPanel}</div>`
      : pointsPanel + rightPanel;

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

    /* ---- 按 OV_ORDER 拼块，用户关掉的整块跳过。顺序是固定的（拖拽排序还没做）；
           myPanel 自己在"没项目 / 不是自己的主页"时返回空串，所以"被关掉"和"本来就没有"
           在页面上是同一种结果，不需要分开处理。 ---- */
    const blocks = { kpi: kpiBand, mine: myPanel(state, p), charts: main, heat, machines: machinesPanel };
    let body = identity(p, st);
    for (const k of ovDisplayOrder()) if (ovOn(k)) body += blocks[k];
    return body + foot();
  }

  SP.Views = SP.Views || {};
  /* ovRow 是设置页「总览区块」编辑行要用的渲染函数，一并注册 */
  Object.assign(SP.Views, { overview, ovDisplayOrder, ovRow, setOvHidden, moveOv, dailySeries });
})();
